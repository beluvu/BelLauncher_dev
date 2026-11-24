-- Аватарка: буква, эмодзи или свой плащ. Предметы: показываются все свои (по умолчанию) или выбранные вручную, без лимита.

alter table public.players drop constraint if exists players_avatar_check;
alter table public.players drop constraint if exists players_show_items_check;
alter table public.players
  add constraint players_avatar_check check (
    avatar = 'letter' or avatar like 'cloak:%' or (avatar like 'emoji:%' and char_length(avatar) between 7 and 40)),
  add column if not exists show_all_items boolean not null default true;

create or replace function public._avatar_of(p public.players) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.avatar like 'emoji:%' then p.avatar
    when p.avatar like 'cloak:%' and exists (
           select 1 from public.wallet_items wi
           where wi.key_hash = p.key_hash and wi.kind = 'cloak' and 'cloak:' || wi.item_id = p.avatar)
         then p.avatar
    else 'letter' end
$$;

create or replace function public._validate_items(p_key text, p_items jsonb) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_bad int;
begin
  select coalesce(array_agg(value), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_items, '[]'::jsonb));
  select count(*) into v_bad from unnest(v_ids) i
    where not exists (select 1 from public.wallet_items wi where wi.key_hash = p_key and wi.kind || ':' || wi.item_id = i);
  if v_bad > 0 then raise exception 'В профиле можно показывать только свои предметы'; end if;
  return v_ids;
end $$;

drop function if exists public.social_appearance_set(text, text, jsonb);
create or replace function public.social_appearance_set(p_key text, p_avatar text, p_items jsonb, p_all boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_av text := coalesce(nullif(btrim(coalesce(p_avatar, '')), ''), 'letter'); v_items text[];
begin
  perform public._player(p_key);
  if v_av = 'letter' or v_av like 'emoji:%' then
    if v_av like 'emoji:%' and char_length(v_av) not between 7 and 40 then raise exception 'Аватарка: один эмодзи'; end if;
  elsif v_av like 'cloak:%' and exists (
       select 1 from public.wallet_items wi where wi.key_hash = p_key and wi.kind = 'cloak' and 'cloak:' || wi.item_id = v_av) then
    null;
  else
    raise exception 'Аватарка: буква, эмодзи или свой плащ';
  end if;
  v_items := public._validate_items(p_key, p_items);
  update public.players set avatar = v_av, show_items = v_items, show_all_items = coalesce(p_all, true)
    where key_hash = p_key;
  return public.social_me(p_key);
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
    'showAllItems', t.show_all_items,
    'showItems', to_jsonb(t.show_items),
    'nfts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.item_id, 'name', c.name) order by c.name), '[]'::jsonb)
             from unnest(t.show_nfts) s join public.catalog c on c.kind = 'cloak' and c.item_id = s),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.kind || ':' || c.item_id, 'name', c.name, 'kind', c.kind)
                                        order by c.kind, c.name), '[]'::jsonb)
              from public.wallet_items wi join public.catalog c on c.kind = wi.kind and c.item_id = wi.item_id
              where wi.key_hash = t.key_hash
                and not (c.kind = 'cloak' and c.nft_price is not null)   -- NFT-плащи показываются отдельно
                and (t.show_all_items or (c.kind || ':' || c.item_id) = any (t.show_items))));
end $$;

revoke all on function public.social_appearance_set(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.social_appearance_set(text, text, jsonb, boolean) to anon, authenticated;

-- сброс профиля возвращает и показ всех предметов
create or replace function public.admin_profile_reset(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set bio = '', show_nfts = '{}', show_items = '{}', avatar = 'letter', show_all_items = true
    where key_hash = t.key_hash;
  perform public._log('профиль сброшен', t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;
