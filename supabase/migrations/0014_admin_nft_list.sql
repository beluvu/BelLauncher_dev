-- Админка: список NFT для вкладки «NFT» (id, название, цена).
create or replace function public.admin_nft_list(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.item_id, 'name', c.name, 'price', c.nft_price)
                                    order by c.name), '[]'::jsonb)
          from public.catalog c where c.kind = 'cloak' and c.nft_price is not null);
end $function$;

revoke all on function public.admin_nft_list(text) from public, anon, authenticated;
