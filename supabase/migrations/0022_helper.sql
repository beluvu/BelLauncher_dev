-- Помогатор (ИИ в лаунчере): 50 бесплатных запросов в сутки (день по Москве), докупка +100 за 10 000 кристалликов.

create table if not exists public.helper_usage (
  key_hash text not null references public.wallets(key_hash) on delete cascade,
  day date not null,
  used int not null default 0 check (used >= 0),
  primary key (key_hash, day)
);

create table if not exists public.helper_extra (
  key_hash text primary key references public.wallets(key_hash) on delete cascade,
  extra int not null default 0 check (extra >= 0)
);

create table if not exists public.helper_msgs (
  id bigint generated always as identity primary key,
  key_hash text not null references public.wallets(key_hash) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists helper_msgs_key_idx on public.helper_msgs (key_hash, id desc);

alter table public.helper_usage enable row level security;
alter table public.helper_extra enable row level security;
alter table public.helper_msgs enable row level security;
revoke all on public.helper_usage, public.helper_extra, public.helper_msgs from anon, authenticated;

create or replace function public._helper_day() returns date
language sql stable as $$ select (now() at time zone 'Europe/Moscow')::date $$;

-- Состояние счётчика: сколько осталось сегодня и докупленных
create or replace function public.helper_state(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; v_used int; v_extra int; v_bal int;
begin
  p := public._player(p_key);
  select coalesce((select used from public.helper_usage where key_hash = p.key_hash and day = public._helper_day()), 0) into v_used;
  select coalesce((select extra from public.helper_extra where key_hash = p.key_hash), 0) into v_extra;
  select balance into v_bal from public.wallets where key_hash = p.key_hash;
  return jsonb_build_object('ok', true, 'limit', 50, 'used', v_used, 'extra', v_extra,
    'left', greatest(50 - v_used, 0) + v_extra, 'pack', 100, 'price', 10000, 'balance', coalesce(v_bal, 0));
end $$;

-- Докупка: +100 запросов за 10 000 кристалликов
create or replace function public.helper_buy(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; v_bal int;
begin
  p := public._player(p_key);
  select balance into v_bal from public.wallets where key_hash = p.key_hash for update;
  if coalesce(v_bal, 0) < 10000 then
    raise exception 'Не хватает кристалликов: нужно 10 000, у тебя %', coalesce(v_bal, 0);
  end if;
  update public.wallets set balance = balance - 10000 where key_hash = p.key_hash;
  insert into public.helper_extra (key_hash, extra) values (p.key_hash, 100)
    on conflict (key_hash) do update set extra = public.helper_extra.extra + 100;
  return public.helper_state(p_key);
end $$;

-- Списание одного запроса (вызывает только edge function, service_role).
-- Сначала дневной лимит, потом докупленные.
create or replace function public.helper_consume(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; v_used int;
begin
  p := public._player(p_key);
  insert into public.helper_usage (key_hash, day, used) values (p.key_hash, public._helper_day(), 0)
    on conflict (key_hash, day) do nothing;
  select used into v_used from public.helper_usage where key_hash = p.key_hash and day = public._helper_day() for update;
  if v_used < 50 then
    update public.helper_usage set used = used + 1 where key_hash = p.key_hash and day = public._helper_day();
  else
    update public.helper_extra set extra = extra - 1 where key_hash = p.key_hash and extra > 0;
    if not found then
      raise exception 'Лимит на сегодня исчерпан (50 запросов). Докупить +100 можно за 10 000 кристалликов.';
    end if;
  end if;
  return public.helper_state(p_key);
end $$;

-- История переписки для лаунчера (последние 60, по возрастанию id)
create or replace function public.helper_history(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  p := public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object('role', x.role, 'body', x.body, 'id', x.id) order by x.id), '[]'::jsonb)
          from (select id, role, body from public.helper_msgs where key_hash = p.key_hash order by id desc limit 60) x);
end $$;

-- Последние сообщения для модели (service_role)
create or replace function public.helper_recent(p_key text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  p := public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object('role', x.role, 'body', x.body) order by x.id), '[]'::jsonb)
          from (select id, role, body from public.helper_msgs where key_hash = p.key_hash order by id desc limit greatest(p_n, 1)) x);
end $$;

create or replace function public.helper_store(p_key text, p_role text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  p := public._player(p_key);
  insert into public.helper_msgs (key_hash, role, body) values (p.key_hash, p_role, left(p_body, 4000));
end $$;

grant execute on function public.helper_state(text) to anon, authenticated;
grant execute on function public.helper_buy(text) to anon, authenticated;
grant execute on function public.helper_history(text) to anon, authenticated;
grant execute on function public.helper_consume(text) to service_role;
grant execute on function public.helper_recent(text, int) to service_role;
grant execute on function public.helper_store(text, text, text) to service_role;
revoke all on function public.helper_consume(text) from public, anon, authenticated;
revoke all on function public.helper_recent(text, int) from public, anon, authenticated;
revoke all on function public.helper_store(text, text, text) from public, anon, authenticated;
