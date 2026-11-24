-- Бейджи игроков (выставляет админ) и аватарка бота «Ai_Helper_Bot».
alter table public.players add column if not exists badges text[] not null default '{}';

alter table public.players drop constraint if exists players_avatar_check;
alter table public.players add constraint players_avatar_check check (
  avatar = 'letter' or avatar like 'cloak:%' or avatar like 'bot:%'
  or (avatar like 'emoji:%' and char_length(avatar) between 7 and 40));

create or replace function public._badge_ok(p text)
returns boolean language sql immutable as $$
  select p = any (array['verified','plus','minus','heart','broken_heart','up','down','like','dislike','warning','fake','scam','aml','kyc','ban','new']);
$$;

create or replace function public._avatar_of(p players)
returns text language sql stable security definer set search_path to 'public' as $function$
  select case
    when p.avatar like 'emoji:%' then p.avatar
    when p.avatar like 'bot:%' then p.avatar
    when p.avatar like 'cloak:%' and exists (
           select 1 from public.wallet_items wi
           where wi.key_hash = p.key_hash and wi.kind = 'cloak' and 'cloak:' || wi.item_id = p.avatar)
         then p.avatar
    else 'letter' end
$function$;

create or replace function public.admin_set_badges(p_token text, p_nick text, p_badges text[])
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare t public.players%rowtype; v text[] := '{}'; b text;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  foreach b in array coalesce(p_badges, '{}'::text[]) loop
    if not public._badge_ok(b) then raise exception 'Нет такого бейджа: %', b; end if;
    if not (b = any (v)) then v := v || b; end if;
  end loop;
  update public.players set badges = v where key_hash = t.key_hash;
  perform public._log('бейджи', t.nick, array_to_string(v, ','));
  return public.admin_player_info(p_token, t.nick);
end $function$;

create or replace function public.admin_player_info(p_token text, p_nick text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare t public.players%rowtype; w public.wallets%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  select * into w from public.wallets where key_hash = t.key_hash;
  return jsonb_build_object(
    'nick', t.nick, 'bio', t.bio, 'createdAt', t.created_at, 'lastSeen', t.last_seen,
    'balance', w.balance, 'equipped', jsonb_build_object('theme', w.equipped_theme, 'cloak', w.equipped_cloak),
    'items', (select coalesce(jsonb_agg(wi.kind || ':' || wi.item_id || ' x' || wi.count order by wi.kind, wi.item_id), '[]'::jsonb)
              from public.wallet_items wi where wi.key_hash = t.key_hash),
    'showNfts', to_jsonb(t.show_nfts), 'badges', to_jsonb(t.badges),
    'muteUntil', t.mute_until, 'banUntil', t.ban_until, 'banForever', t.ban_forever, 'banReason', t.ban_reason);
end $function$;

create or replace function public.social_players(p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'nick', p.nick, 'online', p.last_seen > now() - interval '5 minutes', 'me', p.key_hash = p_key,
            'avatar', public._avatar_of(p), 'prefix', p.prefix, 'prefixColor', p.prefix_color, 'badges', to_jsonb(p.badges))
            order by p.last_seen desc), '[]'::jsonb)
          from public.players p);
end $function$;

create or replace function public.social_profile(p_key text, p_nick text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_nick);
  return jsonb_build_object(
    'nick', t.nick, 'bio', t.bio, 'online', t.last_seen > now() - interval '5 minutes', 'lastSeen', t.last_seen,
    'own', t.key_hash = p_key,
    'avatar', public._avatar_of(t),
    'prefix', t.prefix, 'prefixColor', t.prefix_color, 'badges', to_jsonb(t.badges),
    'showAllItems', t.show_all_items,
    'showItems', to_jsonb(t.show_items),
    'nfts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.item_id, 'name', c.name) order by c.name), '[]'::jsonb)
             from unnest(t.show_nfts) s join public.catalog c on c.kind = 'cloak' and c.item_id = s),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.kind || ':' || c.item_id, 'name', c.name, 'kind', c.kind)
                                        order by c.kind, c.name), '[]'::jsonb)
              from public.wallet_items wi join public.catalog c on c.kind = wi.kind and c.item_id = wi.item_id
              where wi.key_hash = t.key_hash
                and not (c.kind = 'cloak' and c.nft_price is not null)
                and (t.show_all_items or (c.kind || ':' || c.item_id) = any (t.show_items))));
end $function$;

create or replace function public.social_chat_list(p_key text, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select s.id, s.nick, s.body, s.at, s.prefix, s."prefixColor", s.badges from (
      select m.id, p.nick, m.body, m.created_at as at, p.prefix, p.prefix_color as "prefixColor", to_jsonb(p.badges) as badges
      from public.chat_messages m join public.players p on p.key_hash = m.key_hash
      where m.id > coalesce(p_after, 0)
      order by m.id desc
      limit case when coalesce(p_after, 0) = 0 then 50 else 200 end
    ) s order by s.id) x);
end $function$;

-- Бот: аккаунт Ai_Helper_Bot (бывший Test)
update public.players set nick = 'Ai_Helper_Bot', avatar = 'bot:ai-helper', badges = array['verified','new']
  where nick = 'Test';
