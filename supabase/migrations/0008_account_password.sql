-- 0008: вход в аккаунт по нику и паролю (на другом компьютере).
-- Пароль хранится хешем (bcrypt через pgcrypto). После 5 неверных попыток вход на 15 минут заблокирован.

create extension if not exists pgcrypto with schema extensions;

alter table public.players
  add column if not exists pw_hash text,
  add column if not exists pw_fails int not null default 0,
  add column if not exists pw_locked_until timestamptz;

-- задать или сменить пароль (только владелец аккаунта, по своему ключу)
create or replace function public.social_password_set(p_key text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t public.players%rowtype; v_pw text := coalesce(p_password, '');
begin
  perform public._check_key(p_key);
  select * into t from public.players where key_hash = p_key;
  if not found then return jsonb_build_object('ok', false, 'error', 'Сначала выберите ник'); end if;
  if length(v_pw) < 6 or length(v_pw) > 64 then
    return jsonb_build_object('ok', false, 'error', 'Пароль: от 6 до 64 символов');
  end if;
  update public.players set pw_hash = extensions.crypt(v_pw, extensions.gen_salt('bf', 10)),
    pw_fails = 0, pw_locked_until = null where key_hash = p_key;
  return jsonb_build_object('ok', true);
end $$;

-- вход по нику и паролю: возвращает ключ аккаунта, лаунчер сохраняет его у себя
create or replace function public.social_login(p_nick text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t public.players%rowtype; v_nick text := btrim(coalesce(p_nick, ''));
begin
  select * into t from public.players where lower(nick) = lower(v_nick);
  if not found or t.pw_hash is null then
    return jsonb_build_object('ok', false, 'error', 'Неверный ник или пароль');
  end if;
  if t.pw_locked_until is not null and t.pw_locked_until > now() then
    return jsonb_build_object('ok', false, 'error',
      'Слишком много попыток. Подождите ' || ceil(extract(epoch from (t.pw_locked_until - now())) / 60)::int || ' мин');
  end if;
  if extensions.crypt(coalesce(p_password, ''), t.pw_hash) = t.pw_hash then
    update public.players set pw_fails = 0, pw_locked_until = null where key_hash = t.key_hash;
    return jsonb_build_object('ok', true, 'key', t.key_hash, 'nick', t.nick);
  end if;
  update public.players set
    pw_fails = case when pw_fails + 1 >= 5 then 0 else pw_fails + 1 end,
    pw_locked_until = case when pw_fails + 1 >= 5 then now() + interval '15 minutes' else null end
  where key_hash = t.key_hash;
  return jsonb_build_object('ok', false, 'error', 'Неверный ник или пароль');
end $$;

-- админ сбрасывает пароль игрока (он сможет установить новый в «Друзьях»)
create or replace function public.admin_password_reset(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set pw_hash = null, pw_fails = 0, pw_locked_until = null where key_hash = t.key_hash;
  perform public._log('пароль сброшен', t.nick, null);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.social_password_set(text, text), public.social_login(text, text),
  public.admin_password_reset(text, text) from public, anon, authenticated;
grant execute on function public.social_password_set(text, text), public.social_login(text, text),
  public.admin_password_reset(text, text) to anon, authenticated;
