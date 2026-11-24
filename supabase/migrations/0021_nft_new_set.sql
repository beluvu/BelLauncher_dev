-- Coffee Cup убран: владельцам возвращаем стоимость экземпляров, экземпляры удаляем.
with r as (
  select owner, sum(public._nft_value(family, bg)) as amt
  from public.nft_items where family = 'coffee' group by owner
)
update public.wallets w set balance = w.balance + r.amt from r where w.key_hash = r.owner;
delete from public.nft_items where family = 'coffee';
delete from public.case_items where case_id = 'nft' and kind = 'nft' and item_id = 'coffee';
delete from public.catalog where kind = 'nft' and item_id = 'coffee';

-- Новые NFT: цена от 5 000 до 50 000 кристалликов
insert into public.catalog (kind, item_id, name, price, nft_price) values
  ('nft', 'popcorn',      'Popcorn',      null,  5000),
  ('nft', 'sneakers',     'Sneakers',     null, 10000),
  ('nft', 'baseball-cap', 'Baseball Cap', null, 15000),
  ('nft', 'compass',      'Compass',      null, 20000),
  ('nft', 'lava-lamp',    'Lava Lamp',    null, 30000),
  ('nft', 'magic-potion', 'Magic Potion', null, 50000);

-- Шансы: новые модели берут место Coffee Cup (400) и чуть больше; дорогие реже
insert into public.case_items (case_id, pos, kind, item_id, weight) values
  ('nft', 115, 'nft', 'popcorn',      40),
  ('nft', 116, 'nft', 'sneakers',     25),
  ('nft', 117, 'nft', 'baseball-cap', 15),
  ('nft', 118, 'nft', 'compass',      12),
  ('nft', 119, 'nft', 'lava-lamp',     8),
  ('nft', 120, 'nft', 'magic-potion',  5);

-- Кристаллики-остаток: сумма весов кейса снова 10000
update public.case_items
set weight = 10000 - (select sum(weight) from public.case_items where case_id = 'nft' and pos <> 7)
where case_id = 'nft' and pos = 7;
