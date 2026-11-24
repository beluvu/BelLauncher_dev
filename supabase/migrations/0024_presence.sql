-- «Где играет»: статус игрока (сервер или одиночная игра). Живёт 10 минут, лаунчер обновляет его, пока игра запущена.
alter table public.players add column if not exists presence text;
alter table public.players add column if not exists presence_at timestamptz;

create or replace function public.social_presence_set(p_key text, p_where text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  update public.players
     set presence = nullif(left(trim(coalesce(p_where, '')), 60), ''),
         presence_at = case when nullif(trim(coalesce(p_where, '')), '') is null then null else now() end
   where key_hash = p_key;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.social_presence(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object('nick', p.nick, 'where', p.presence) order by p.nick), '[]'::jsonb)
          from public.players p
          where p.presence is not null and p.presence_at > now() - interval '10 minutes');
end $$;

grant execute on function public.social_presence_set(text, text) to anon, authenticated;
grant execute on function public.social_presence(text) to anon, authenticated;
