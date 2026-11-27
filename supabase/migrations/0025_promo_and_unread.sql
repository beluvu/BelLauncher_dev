-- Промокоды: кристаллики, модпак, мод, ресурспак (файлы — ссылки на GitHub).
create table if not exists public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind text not null check (kind in ('crystals', 'modpack', 'mod', 'resource_pack')),
  title text not null default '',
  amount int not null default 0 check (amount >= 0),
  url text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  size bigint check (size is null or size > 0),
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'crystals' or amount > 0),
  check (kind = 'crystals' or url is not null)
);

create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes(code) on delete cascade,
  key_hash text not null references public.players(key_hash) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, key_hash)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

create or replace function public.promo_redeem(p_key text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pc public.promo_codes%rowtype; v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform public._player(p_key);
  select * into pc from public.promo_codes where code = v_code for update;
  if not found or not pc.active then
    return jsonb_build_object('ok', false, 'error', 'Такого промокода нет');
  end if;
  if pc.expires_at is not null and pc.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Срок промокода истёк');
  end if;
  if pc.max_uses is not null and pc.uses >= pc.max_uses then
    return jsonb_build_object('ok', false, 'error', 'Промокод уже закончился');
  end if;
  if exists (select 1 from public.promo_redemptions where code = v_code and key_hash = p_key) then
    return jsonb_build_object('ok', false, 'error', 'Ты уже активировал этот промокод');
  end if;
  insert into public.promo_redemptions (code, key_hash) values (v_code, p_key);
  update public.promo_codes set uses = uses + 1 where code = v_code;
  if pc.kind = 'crystals' then
    insert into public.wallets (key_hash) values (p_key) on conflict (key_hash) do nothing;
    update public.wallets set balance = balance + pc.amount where key_hash = p_key;
    return jsonb_build_object('ok', true, 'kind', 'crystals', 'amount', pc.amount, 'title', pc.title);
  end if;
  return jsonb_build_object('ok', true, 'kind', pc.kind, 'title', pc.title, 'code', pc.code,
                            'url', pc.url, 'sha256', pc.sha256, 'size', pc.size);
end $$;

create or replace function public.admin_promo_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'code', c.code, 'kind', c.kind, 'title', c.title, 'amount', c.amount, 'url', c.url,
            'sha256', c.sha256, 'size', c.size, 'maxUses', c.max_uses, 'uses', c.uses,
            'expiresAt', c.expires_at, 'active', c.active) order by c.created_at desc), '[]'::jsonb)
          from public.promo_codes c);
end $$;

create or replace function public.admin_promo_create(p_token text, p_code text, p_kind text, p_title text,
  p_amount int, p_url text, p_sha256 text, p_size bigint, p_max_uses int, p_expires timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform public._admin(p_token);
  if p_url is not null and p_url !~ '^https://(github\.com|objects\.githubusercontent\.com)/' then
    return jsonb_build_object('ok', false, 'error', 'Файл берём только с GitHub (https://github.com/…)');
  end if;
  insert into public.promo_codes (code, kind, title, amount, url, sha256, size, max_uses, expires_at)
  values (v_code, p_kind, btrim(coalesce(p_title, '')), coalesce(p_amount, 0), nullif(btrim(coalesce(p_url, '')), ''),
          nullif(lower(btrim(coalesce(p_sha256, ''))), ''), p_size, p_max_uses, p_expires);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Такой код уже есть');
when check_violation then
  return jsonb_build_object('ok', false, 'error', 'Проверь поля: код A-Z, 0-9, _ и -, для файла нужна ссылка и sha256');
end $$;

create or replace function public.admin_promo_set_active(p_token text, p_code text, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  update public.promo_codes set active = p_active where code = upper(btrim(p_code));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_promo_delete(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  delete from public.promo_codes where code = upper(btrim(p_code));
  return jsonb_build_object('ok', true);
end $$;

-- Непрочитанные личные сообщения: кто написал и сколько (за последние 7 дней)
create table if not exists public.dm_reads (
  reader text not null references public.players(key_hash) on delete cascade,
  peer text not null references public.players(key_hash) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (reader, peer)
);
alter table public.dm_reads enable row level security;

create or replace function public.social_dm_unread(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object('nick', s.nick, 'count', s.cnt, 'lastAt', s.last)
                                    order by s.last desc), '[]'::jsonb)
          from (select p.nick, count(*) as cnt, max(d.created_at) as last
                  from public.direct_messages d
                  join public.players p on p.key_hash = d.sender
                  left join public.dm_reads r on r.reader = p_key and r.peer = d.sender
                 where d.recipient = p_key
                   and d.created_at > greatest(coalesce(r.read_at, 'epoch'::timestamptz), now() - interval '7 days')
                 group by p.nick) s);
end $$;

create or replace function public.social_dm_mark_read(p_key text, p_peer text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_peer);
  insert into public.dm_reads (reader, peer, read_at) values (p_key, t.key_hash, now())
  on conflict (reader, peer) do update set read_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Доступ: админ — по токену внутри функций, игрок — по ключу аккаунта
grant execute on function public.promo_redeem(text, text) to anon, authenticated;
grant execute on function public.admin_promo_list(text) to anon, authenticated;
grant execute on function public.admin_promo_create(text, text, text, text, int, text, text, bigint, int, timestamptz) to anon, authenticated;
grant execute on function public.admin_promo_set_active(text, text, boolean) to anon, authenticated;
grant execute on function public.admin_promo_delete(text, text) to anon, authenticated;
grant execute on function public.social_dm_unread(text) to anon, authenticated;
grant execute on function public.social_dm_mark_read(text, text) to anon, authenticated;
