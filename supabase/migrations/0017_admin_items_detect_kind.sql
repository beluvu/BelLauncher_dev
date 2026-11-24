-- Админка: выдача и забор предметов определяют вид по каталогу.
-- Раньше NFT (kind nft) выдавались как cloak, и при выборе «cloak» по умолчанию id NFT давали «Нет такого предмета».
create or replace function public.admin_grant_item(p_token text, p_nick text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; v_kind text;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  if exists (select 1 from public.catalog where kind = p_kind and item_id = p_item) then
    v_kind := p_kind;
  else
    select c.kind into v_kind from public.catalog c where c.item_id = p_item limit 1;
  end if;
  if v_kind is null then
    raise exception 'Нет такого предмета';
  end if;
  if v_kind = 'theme' then
    if exists (select 1 from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item) then
      raise exception 'Тема уже есть у игрока';
    end if;
    insert into public.wallet_items (key_hash, kind, item_id, count) values (t.key_hash, 'theme', p_item, 1);
  else
    perform public._add_one(t.key_hash, v_kind, p_item);
  end if;
  perform public._log('выдал ' || v_kind || ':' || p_item, t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_revoke_item(p_token text, p_nick text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  elsif p_kind in ('cloak', 'nft') then
    delete from public.wallet_items where key_hash = t.key_hash and kind in ('cloak', 'nft') and item_id = p_item;
  else
    raise exception 'Неизвестный вид';
  end if;
  perform public._log('забрал ' || p_kind || ':' || p_item, t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;
