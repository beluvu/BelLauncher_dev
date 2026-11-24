-- 0009: новый набор NFT — 15 предметов по 8 вариантов (120 картинок). Старый набор заменён полностью.
-- Редкости: ULTRA (вес 1) — Crystal, Ruby, Gold Bars; LEGENDARY (вес 2) — Polar Bear, Snow Globe, Clover Pin, Sakura;
-- RARE (вес 2) — остальные восемь. Кристаллы 800 в кейсе не меняются.
delete from public.case_items where case_id = 'nft' and kind = 'nft';
delete from public.catalog where kind = 'nft';

insert into public.catalog (kind, item_id, name)
select 'nft', t.id || '-v' || v, t.nm || ' #' || v
from (values ('gold-bars','Gold Bars'),('ruby','Ruby'),('crystal','Crystal'),('polar-bear','Polar Bear'),('snow-globe','Snow Globe'),('clover-pin','Clover Pin'),('sakura','Sakura'),('candy','Candy'),('ramen','Ramen'),('instant-ramen','Instant Ramen'),('coffee','Coffee'),('snowflake','Snowflake'),('ice-cream','Ice Cream'),('evil-eye','Evil Eye'),('jelly-bunny','Jelly Bunny')) as t(id, nm)
cross join generate_series(1, 8) as v
on conflict do nothing;

insert into public.case_items (case_id, pos, kind, item_id, weight)
select 'nft', 7 + row_number() over (order by t.idx, v), 'nft', t.id || '-v' || v, t.w
from (values (1,'crystal',1),(2,'ruby',1),(3,'gold-bars',1),(4,'polar-bear',2),(5,'snow-globe',2),(6,'clover-pin',2),(7,'sakura',2),(8,'candy',2),(9,'ramen',2),(10,'instant-ramen',2),(11,'coffee',2),(12,'snowflake',2),(13,'ice-cream',2),(14,'evil-eye',2),(15,'jelly-bunny',2)) as t(idx, id, w)
cross join generate_series(1, 8) as v
on conflict do nothing;
