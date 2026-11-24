-- Профили: аватарка (буква или свой плащ) и показ своих предметов (до 6). Админка может сбросить профиль.
-- Личные сообщения по-прежнему никому, кроме участников переписки, не видны: функций их чтения для админки нет.

alter table public.players
  add column if not exists avatar text not null default 'letter'
    check (avatar = 'letter' or avatar like 'cloak:%'),
  add column if not exists show_items text[] not null default '{}'
    check (cardinality(show_items) <= 6);

-- аватарка, которую игрок реально может показать: плащ должен быть всё ещё у него
create or replace function public._avatar_of(p public.players) returns text
language sql stable security definer set search_path = public as $$
  select case when p.avatar like 'cloak:%' and exists (
           select 1 from public.wallet_items wi
           where wi.key_hash = p.key_hash and wi.kind = 'cloak' and 'cloak:' || wi.item_id = p.avatar)
         then p.avatar else 'letter' end
$$;

-- предметы, которые игрок выбрал показать: только свои, формат kind:item_id
create or replace function public._validate_items(p_key text, p_items jsonb) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_bad int;
begin
  select coalesce(array_agg(value), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_items, '[]'::jsonb));
  if cardinality(v_ids) > 6 then raise exception 'В профиль можно поставить не больше 6 предметов'; end if;
  select count(*) into v_bad from unnest(v_ids) i
    where not exists (select 1 from public.wallet_items wi where wi.key_hash = p_key and wi.kind || ':' || wi.item_id = i);
  if v_bad > 0 then raise exception 'В профиле можно показывать только свои предметы'; end if;
  return v_ids;
end $$;

create or replace function public.social_appearance_set(p_key text, p_avatar text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_av text := coalesce(nullif(btrim(coalesce(p_avatar, '')), ''), 'letter'); v_items text[];
begin
  perform public._player(p_key);
  if v_av <> 'letter' and (v_av not like 'cloak:%' or not exists (
       select 1 from public.wallet_items wi where wi.key_hash = p_key and wi.kind = 'cloak' and 'cloak:' || wi.item_id = v_av)) then
    raise exception 'Аватарка: буква или свой плащ';
  end if;
  v_items := public._validate_items(p_key, p_items);
  update public.players set avatar = v_av, show_items = v_items where key_hash = p_key;
  return public.social_me(p_key);
end $$;

create or replace function public.social_players(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'nick', p.nick, 'online', p.last_seen > now() - interval '5 minutes', 'me', p.key_hash = p_key,
            'avatar', public._avatar_of(p))
            order by p.last_seen desc), '[]'::jsonb)
          from public.players p);
end $$;

create or replace function public.social_profile(p_key text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_nick);
  return jsonb_build_object(
    'nick', t.nick, 'bio', t.bio, 'online', t.last_seen > now() - interval '5 minutes', 'lastSeen', t.last_seen,
    'own', t.key_hash = p_key,
    'avatar', public._avatar_of(t),
    'nfts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.item_id, 'name', c.name) order by c.name), '[]'::jsonb)
             from unnest(t.show_nfts) s join public.catalog c on c.kind = 'cloak' and c.item_id = s),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.kind || ':' || c.item_id, 'name', c.name, 'kind', c.kind)
                                        order by c.name), '[]'::jsonb)
              from unnest(t.show_items) s join public.catalog c on c.kind || ':' || c.item_id = s));
end $$;

create or replace function public.admin_profile_reset(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set bio = '', show_nfts = '{}', show_items = '{}', avatar = 'letter' where key_hash = t.key_hash;
  perform public._log('профиль сброшен', t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

revoke all on function public.social_appearance_set(text, text, jsonb), public.admin_profile_reset(text, text)
  from public, anon, authenticated;
grant execute on function public.social_appearance_set(text, text, jsonb), public.admin_profile_reset(text, text)
  to anon, authenticated;

-- внутренние хелперы не нужны клиенту
revoke all on function public._avatar_of(public.players), public._validate_items(text, jsonb)
  from public, anon, authenticated;
