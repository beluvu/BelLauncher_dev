-- Шансы кейса «nft»: фоны NFT не подписываем (но они выпадают как раньше, вероятности считаются от полного веса);
-- NFT подписываем по названию из каталога; убираем строки удалённых семей (зелёный гем, снежинка).
delete from public.case_items where kind = 'nft' and (item_id like 'green-gem-v%' or item_id like 'snowflake-v%');

create or replace function public._item_label(p_kind text, p_id text) returns text
language sql stable as $$
  select case p_kind
    when 'theme' then 'Тема: ' || coalesce((select name from public.catalog where kind = 'theme' and item_id = p_id), '?')
    when 'cloak' then 'Плащ: ' || coalesce((select name from public.catalog where kind = 'cloak' and item_id = p_id), '?')
    when 'nft' then 'NFT: ' || coalesce((select name from public.catalog where kind = 'nft' and item_id = p_id), '?')
    else case when p_id = '0' then 'Пусто' else p_id || ' кристалликов' end
  end
$$;

create or replace function public._case_json(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'price', c.price, 'image', c.image, 'open', c.open_image,
    'odds', (select jsonb_agg(jsonb_build_object(
               'label', public._item_label(ci.kind, ci.item_id),
               'percent', round(100.0 * ci.weight / (select sum(x.weight) from public.case_items x where x.case_id = c.id), 1))
             order by ci.pos)
             from public.case_items ci
             where ci.case_id = c.id
               and not (ci.kind = 'nft' and ci.item_id like 'bg-%')))   -- фоны NFT в шансах не показываем
  from public.cases c where c.id = p_id
$$;
