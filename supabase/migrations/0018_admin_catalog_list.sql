-- Админка: список всех предметов каталога (плащи, NFT, темы) для выдачи и забора.
create or replace function public.admin_catalog_list(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'id', c.item_id, 'name', c.name)
                                    order by c.kind, c.name), '[]'::jsonb)
          from public.catalog c where c.kind in ('cloak', 'nft', 'theme'));
end $function$;

revoke all on function public.admin_catalog_list(text) from public, anon, authenticated;
