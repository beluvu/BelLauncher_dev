-- Курсор и блокировка для бота Ai_Helper_Bot (функция ai-helper-bot), запуск раз в минуту через pg_cron + pg_net.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.bot_state (
  id int primary key default 1 check (id = 1),
  last_id bigint not null default 0,
  busy_until timestamptz not null default 'epoch'
);
insert into public.bot_state (id) values (1) on conflict (id) do nothing;
alter table public.bot_state enable row level security;   -- без политик: доступ только у service role

select cron.unschedule('ai-helper-bot') where exists (select 1 from cron.job where jobname = 'ai-helper-bot');
select cron.schedule('ai-helper-bot', '* * * * *', $$
  select net.http_post(
    url := 'https://clugtadhkstnwijqythc.supabase.co/functions/v1/ai-helper-bot',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb);
$$);
