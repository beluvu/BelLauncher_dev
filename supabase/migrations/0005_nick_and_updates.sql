-- Смена ника игроком (раз в 30 дней) и релизы лаунчера для обновления из админки.

alter table public.players add column if not exists nick_changed_at timestamptz;

create or replace function public.social_nick_change(p_key text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; v_nick text := btrim(coalesce(p_nick, ''));
begin
  p := public._player(p_key);
  if lower(v_nick) = lower(p.nick) then raise exception 'Это уже твой ник'; end if;
  if p.nick_changed_at is not null and p.nick_changed_at > now() - interval '30 days' then
    raise exception 'Ник меняется раз в 30 дней, следующая смена: %',
      to_char((p.nick_changed_at + interval '30 days') at time zone 'Europe/Moscow', 'DD.MM.YYYY');
  end if;
  perform public._nick_ok(v_nick);
  if exists (select 1 from public.players where lower(nick) = lower(v_nick) and key_hash <> p_key) then
    raise exception 'Этот ник уже занят';
  end if;
  update public.players set nick = v_nick, nick_changed_at = now() where key_hash = p_key;
  return public.social_me(p_key);
end $$;

grant execute on function public.social_nick_change(text, text) to anon, authenticated;
revoke all on function public.social_nick_change(text, text) from public;
grant execute on function public.social_nick_change(text, text) to anon, authenticated;

-- ---------- релизы лаунчера ----------
create table if not exists public.launcher_releases (
  id bigint generated always as identity primary key,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  url text not null check (url ~ '^https://'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size bigint not null check (size > 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.launcher_releases enable row level security;
revoke all on public.launcher_releases from anon, authenticated;

create or replace function public.launcher_latest() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('version', r.version, 'url', r.url, 'sha256', r.sha256,
                                             'size', r.size, 'notes', r.notes, 'createdAt', r.created_at)
                   from public.launcher_releases r order by r.created_at desc limit 1), 'null'::jsonb)
$$;

create or replace function public.admin_release_publish(p_token text, p_version text, p_url text, p_sha256 text,
                                                       p_size bigint, p_notes text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public._admin(p_token);
  insert into public.launcher_releases (version, url, sha256, size, notes)
    values (btrim(p_version), btrim(p_url), lower(btrim(p_sha256)), p_size, btrim(coalesce(p_notes, '')))
    returning id into v_id;
  perform public._log('релиз лаунчера', btrim(p_version), btrim(p_url));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_release_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select id, version, url, sha256, size, notes, created_at from public.launcher_releases
    order by created_at desc limit 50) x);
end $$;

grant execute on function public.launcher_latest() to anon, authenticated;
grant execute on function public.admin_release_publish(text, text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_release_list(text) to anon, authenticated;
revoke all on function public.admin_release_publish(text, text, text, text, bigint, text) from public;
revoke all on function public.admin_release_list(text) from public;
revoke all on function public.launcher_latest() from public;
grant execute on function public.launcher_latest() to anon, authenticated;
grant execute on function public.admin_release_publish(text, text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_release_list(text) to anon, authenticated;
