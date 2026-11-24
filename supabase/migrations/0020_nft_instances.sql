-- NFT как отдельные экземпляры: каждый подарок — своя строка (модель + вариант + фон), владелец, цена по фону.
-- Плащи-NFT убираем (возвращаем стоимость владельцам), фоны больше не NFT, а влияют на цену.

-- 1. Фоны (вес выпадения и множитель цены по редкости)
create table if not exists public.nft_bgs (
  id     text primary key,
  name   text not null,
  tier   text not null,
  mult   int  not null,
  weight int  not null
);
alter table public.nft_bgs enable row level security;

insert into public.nft_bgs (id, name, tier, mult, weight)
select c.item_id, c.name,
       case c.nft_price when 300 then 'common' when 800 then 'rare' else 'epic' end,
       case c.nft_price when 300 then 1 when 800 then 2 else 4 end,
       case c.nft_price when 300 then 10 when 800 then 4 else 1 end
from public.catalog c
where c.kind = 'nft' and c.item_id like 'bg-%';

-- 2. Экземпляры NFT
create table if not exists public.nft_items (
  id         bigserial primary key,
  family     text not null,
  variant    int  not null check (variant between 1 and 8),
  bg         text not null references public.nft_bgs(id),
  owner      text not null,
  origin     text not null default 'drop',
  created_at timestamptz not null default now()
);
create index if not exists nft_items_owner_idx on public.nft_items (owner);
create index if not exists nft_items_family_idx on public.nft_items (family);
alter table public.nft_items enable row level security;

-- 3. Случайный фон по весам (метод экспоненциальных меток)
create or replace function public._nft_pick_bg() returns text
language sql volatile security definer set search_path to 'public'
as $$
  select b.id from public.nft_bgs b order by -ln(greatest(random(), 1e-12)) / b.weight limit 1
$$;

-- 4. Цена экземпляра: базовая цена модели × множитель фона, но не меньше 3000
create or replace function public._nft_value(p_family text, p_bg text) returns int
language sql stable security definer set search_path to 'public'
as $$
  select greatest(3000, (coalesce((select c.nft_price from public.catalog c where c.kind = 'nft' and c.item_id = p_family), 3000)
                         * (select b.mult from public.nft_bgs b where b.id = p_bg)))::int
$$;

-- 5. Перенос старых NFT: wallet_items kind nft (polar-bear-v1 x7) → экземпляры
insert into public.nft_items (family, variant, bg, owner, origin)
select regexp_replace(wi.item_id, '-v\d+$', ''),
       substring(wi.item_id from '(\d+)$')::int,
       case wi.item_id when 'polar-bear-v1' then 'bg-aqua-fish' else public._nft_pick_bg() end,
       wi.key_hash, 'legacy'
from public.wallet_items wi, generate_series(1, wi.count) g
where wi.kind = 'nft';
delete from public.wallet_items where kind = 'nft';

-- 6. Плащи-NFT: возвращаем стоимость (цена каталога × количество), снимаем надетые и показываемые
with r as (
  select wi.key_hash, sum(c.nft_price * wi.count) as amt
  from public.wallet_items wi
  join public.catalog c on c.kind = 'cloak' and c.item_id = wi.item_id
  where wi.kind = 'cloak' and wi.item_id like 'nft-%'
  group by wi.key_hash
)
update public.wallets w set balance = w.balance + r.amt
from r where w.key_hash = r.key_hash;

delete from public.wallet_items where kind = 'cloak' and item_id like 'nft-%';
update public.wallets set equipped_cloak = null where equipped_cloak like 'nft-%';
update public.players set avatar = 'letter' where avatar like 'cloak:nft-%';
update public.players set show_nfts = array(select x from unnest(show_nfts) x where x not like 'nft-%')
where exists (select 1 from unnest(show_nfts) x where x like 'nft-%');
delete from public.case_items where kind = 'cloak' and item_id like 'nft-%';
delete from public.catalog where kind = 'cloak' and item_id like 'nft-%';

-- 7. Каталог: старые NFT-варианты и фоны-NFT убираем, вместо них 15 моделей
delete from public.case_items where kind = 'nft';
delete from public.case_items where case_id = 'nft';
delete from public.catalog where kind = 'nft';

insert into public.catalog (kind, item_id, name, price, nft_price) values
  ('nft', 'polar-bear',   'Polar Bear',   null, 100000),
  ('nft', 'ruby',         'Ruby',         null,  10000),
  ('nft', 'ion-gem',      'Ion Gem',      null,  10000),
  ('nft', 'crystal',      'Crystal',      null,   5000),
  ('nft', 'evil-eye',     'Evil Eye',     null,   3000),
  ('nft', 'gold-bars',    'Gold Bars',    null,   3000),
  ('nft', 'snow-globe',   'Snow Globe',   null,   3000),
  ('nft', 'clover-pin',   'Clover Pin',   null,   3000),
  ('nft', 'sakura',       'Sakura',       null,   3000),
  ('nft', 'instant-ramen','Instant Ramen',null,   3000),
  ('nft', 'ramen',        'Ramen',        null,   3000),
  ('nft', 'coffee',       'Coffee',       null,   3000),
  ('nft', 'candy',        'Candy',        null,   3000),
  ('nft', 'ice-cream',    'Ice Cream',    null,   3000),
  ('nft', 'jelly-bunny',  'Jelly Bunny',  null,   3000);

-- 8. Кейс NFT: шансы моделей из 10000; кристаллики добирают остаток (6859 = 68.59%)
insert into public.case_items (case_id, pos, kind, item_id, weight) values
  ('nft', 7,   'crystals', '800', 6859),
  ('nft', 100, 'nft', 'jelly-bunny',  600),
  ('nft', 101, 'nft', 'ice-cream',    500),
  ('nft', 102, 'nft', 'candy',        500),
  ('nft', 103, 'nft', 'coffee',       400),
  ('nft', 104, 'nft', 'ramen',        300),
  ('nft', 105, 'nft', 'instant-ramen',300),
  ('nft', 106, 'nft', 'sakura',       200),
  ('nft', 107, 'nft', 'clover-pin',   100),
  ('nft', 108, 'nft', 'snow-globe',   100),
  ('nft', 109, 'nft', 'gold-bars',     50),
  ('nft', 110, 'nft', 'evil-eye',      50),
  ('nft', 111, 'nft', 'crystal',       20),
  ('nft', 112, 'nft', 'ion-gem',       10),
  ('nft', 113, 'nft', 'ruby',          10),
  ('nft', 114, 'nft', 'polar-bear',     1);

-- 9. Выдача NFT создаёт экземпляр (вариант случайный, фон по весам)
create or replace function public._add_one(p_key text, p_kind text, p_item text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_kind = 'nft' then
    insert into public.nft_items (family, variant, bg, owner, origin)
    values (p_item, 1 + floor(random() * 8)::int, public._nft_pick_bg(), p_key, 'drop');
  else
    insert into public.wallet_items (key_hash, kind, item_id, count) values (p_key, p_kind, p_item, 1)
    on conflict (key_hash, kind, item_id) do update set count = public.wallet_items.count + 1;
  end if;
end $$;

-- 10. Список подарков игрока
create or replace function public._nft_list(p_key text) returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'family', n.family, 'name', c.name, 'variant', n.variant,
           'bg', n.bg, 'bgName', b.name, 'tier', b.tier, 'value', public._nft_value(n.family, n.bg))
           order by public._nft_value(n.family, n.bg) desc, n.id), '[]'::jsonb)
  from public.nft_items n
  join public.nft_bgs b on b.id = n.bg
  join public.catalog c on c.kind = 'nft' and c.item_id = n.family
  where n.owner = p_key
$$;

-- 11. Карточка NFT (для превью, ссылки и отправки)
create or replace function public._nft_info_json(p_id bigint) returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', n.id, 'family', n.family, 'name', c.name, 'variant', n.variant,
    'bg', n.bg, 'bgName', b.name, 'tier', b.tier, 'mult', b.mult,
    'value', public._nft_value(n.family, n.bg),
    'owner', p.nick,
    'minted', (select count(*) from public.nft_items x where x.family = n.family),
    'origin', n.origin, 'createdAt', n.created_at)
  from public.nft_items n
  join public.nft_bgs b on b.id = n.bg
  join public.catalog c on c.kind = 'nft' and c.item_id = n.family
  left join public.players p on p.key_hash = n.owner
  where n.id = p_id
$$;

create or replace function public.social_nft_info(p_key text, p_id bigint) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v jsonb;
begin
  perform public._player(p_key);
  v := public._nft_info_json(p_id);
  if v is null then raise exception 'Нет такого NFT'; end if;
  return v;
end $$;

create or replace function public.social_nft_send(p_key text, p_id bigint, p_to text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare n public.nft_items%rowtype; t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_to);
  if t.key_hash = p_key then raise exception 'Нельзя отправить NFT самому себе'; end if;
  select * into n from public.nft_items where id = p_id for update;
  if not found or n.owner <> p_key then raise exception 'Это не ваш NFT'; end if;
  update public.nft_items set owner = t.key_hash where id = p_id;
  return public._nft_info_json(p_id);
end $$;

-- 12. Кошелёк, профиль, админка: подарки отдельным списком
create or replace function public._wallet_json(p_key text) returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  w public.wallets%rowtype;
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_free_in int := 0;
  v_next int;
begin
  select * into w from public.wallets where key_hash = p_key;
  if w.last_free_roll is not null then
    v_free_in := greatest(0, ceil(extract(epoch from (w.last_free_roll + interval '24 hours' - now())))::int);
  end if;
  select coalesce(min(s), 180000) into v_next from unnest(array[36000, 180000]) s where s > w.play_sec;
  return jsonb_build_object(
    'balance', w.balance,
    'owned', (select coalesce(jsonb_agg(wi.kind || ':' || wi.item_id order by wi.kind, wi.item_id), '[]'::jsonb)
              from public.wallet_items wi, generate_series(1, wi.count) g where wi.key_hash = p_key),
    'gifts', public._nft_list(p_key),
    'equipped', jsonb_build_object('theme', w.equipped_theme, 'cloak', w.equipped_cloak),
    'dailyAvailable', w.last_daily is distinct from v_today,
    'streak', w.streak,
    'playSec', w.play_sec,
    'playTarget', v_next,
    'playToday', case when w.play_day = v_today then w.play_day_earned else 0 end,
    'cases', (select coalesce(jsonb_agg(public._case_json(id) order by sort), '[]'::jsonb)
              from public.cases where not is_free),
    'freeCase', public._case_json('free'),
    'freeCases', w.free_cases,
    'freeIn', v_free_in
  );
end $$;

create or replace function public.social_profile(p_key text, p_nick text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
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
    'gifts', public._nft_list(t.key_hash),
    'nfts', '[]'::jsonb,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', c.kind || ':' || c.item_id, 'name', c.name, 'kind', c.kind)
                                        order by c.kind, c.name), '[]'::jsonb)
              from public.wallet_items wi join public.catalog c on c.kind = wi.kind and c.item_id = wi.item_id
              where wi.key_hash = t.key_hash
                and (t.show_all_items or (c.kind || ':' || c.item_id) = any (t.show_items))));
end $$;

create or replace function public.admin_player_info(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
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
    'gifts', public._nft_list(t.key_hash),
    'showNfts', to_jsonb(t.show_nfts), 'badges', to_jsonb(t.badges),
    'muteUntil', t.mute_until, 'banUntil', t.ban_until, 'banForever', t.ban_forever, 'banReason', t.ban_reason);
end $$;

create or replace function public.admin_revoke_item(p_token text, p_nick text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  if p_kind = 'theme' then
    if not exists (select 1 from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item) then
      raise exception 'У игрока нет этой темы';
    end if;
    delete from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item;
    update public.wallets set equipped_theme = null where key_hash = t.key_hash and equipped_theme = p_item;
  elsif p_kind = 'nft' then
    -- забираем один экземпляр модели (самый старый)
    delete from public.nft_items where id = (select x.id from public.nft_items x
                                             where x.owner = t.key_hash and x.family = p_item
                                             order by x.id limit 1);
    if not found then raise exception 'У игрока нет этого NFT'; end if;
  elsif p_kind = 'cloak' then
    delete from public.wallet_items where key_hash = t.key_hash and kind = 'cloak' and item_id = p_item;
  else
    raise exception 'Неизвестный вид';
  end if;
  perform public._log('забрал ' || p_kind || ':' || p_item, t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

-- 13. Проценты в шансах с двумя знаками (0.01% для Polar Bear)
create or replace function public._case_json(p_id text) returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'price', c.price, 'image', c.image, 'open', c.open_image,
    'odds', (select jsonb_agg(jsonb_build_object(
               'label', public._item_label(ci.kind, ci.item_id),
               'percent', round(100.0 * ci.weight / (select sum(x.weight) from public.case_items x where x.case_id = c.id), 2))
             order by ci.pos)
             from public.case_items ci
             where ci.case_id = c.id
               and not (ci.kind = 'nft' and ci.item_id like 'bg-%')))
  from public.cases c where c.id = p_id
$$;

-- 14. Права: внутренние функции закрыты, публичные — для игроков
revoke all on function public._nft_pick_bg() from public, anon, authenticated;
revoke all on function public._nft_value(text, text) from public, anon, authenticated;
revoke all on function public._nft_list(text) from public, anon, authenticated;
revoke all on function public._nft_info_json(bigint) from public, anon, authenticated;
revoke all on function public.social_nft_info(text, bigint) from public;
revoke all on function public.social_nft_send(text, bigint, text) from public;
grant execute on function public.social_nft_info(text, bigint) to anon, authenticated;
grant execute on function public.social_nft_send(text, bigint, text) to anon, authenticated;
