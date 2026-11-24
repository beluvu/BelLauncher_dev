-- Соцфункции заново: аккаунт = ник + ключ кошелька (железо). Старые таблицы почты/друзей удаляются.
-- Чат общий и личные сообщения. Админка: одноразовый ключ -> сессия на 30 дней. Личные сообщения
-- админке недоступны (функций для их чтения нет).

drop table if exists public.direct_messages, public.friendships, public.messages, public.news, public.profiles cascade;

create table public.players (
  key_hash text primary key references public.wallets(key_hash) on delete cascade,
  nick text not null check (nick ~ '^[A-Za-z0-9_]{3,16}$'),
  bio text not null default '' check (char_length(bio) <= 140),
  show_nfts text[] not null default '{}' check (cardinality(show_nfts) <= 6),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  mute_until timestamptz,
  ban_until timestamptz,
  ban_forever boolean not null default false,
  ban_reason text
);
create unique index players_nick_ci on public.players (lower(nick));

create table public.chat_messages (
  id bigint generated always as identity primary key,
  key_hash text not null references public.players(key_hash) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create table public.direct_messages (
  id bigint generated always as identity primary key,
  sender text not null references public.players(key_hash) on delete cascade,
  recipient text not null references public.players(key_hash) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index direct_messages_pair on public.direct_messages (least(sender, recipient), greatest(sender, recipient), id);

create table public.news (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.admin_keys (
  key_hash text primary key,
  label text not null default '',
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked boolean not null default false
);

create table public.admin_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  target text,
  detail text
);

alter table public.players enable row level security;
alter table public.chat_messages enable row level security;
alter table public.direct_messages enable row level security;
alter table public.news enable row level security;
alter table public.admin_keys enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_log enable row level security;
create policy news_read on public.news for select to anon, authenticated using (true);

-- ---------- внутренние ----------
create or replace function public._hash(p text) returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

create or replace function public._nick_ok(p text) returns void language plpgsql immutable set search_path = public as $$
begin
  if p is null or p !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Ник: 3–16 символов, латиница, цифры и _';
  end if;
  if p ~* '(хуй|пизд|еба|бляд|сук[аеи]|нацист|hitler)' then
    raise exception 'Этот ник нельзя использовать';
  end if;
end $$;

create or replace function public._log(p_action text, p_target text, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_log (action, target, detail) values (p_action, p_target, p_detail)
$$;

-- игрок, который может пользоваться соцфункциями (есть ник, не забанен); обновляет last_seen
create or replace function public._player(p_key text) returns public.players
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  perform public._check_key(p_key);
  select * into p from public.players where key_hash = p_key;
  if not found then raise exception 'Сначала выберите ник'; end if;
  if p.ban_forever or (p.ban_until is not null and p.ban_until > now()) then
    raise exception 'Аккаунт заблокирован%', case when p.ban_reason is null or p.ban_reason = '' then '' else ': ' || p.ban_reason end;
  end if;
  update public.players set last_seen = now() where key_hash = p_key;
  return p;
end $$;

create or replace function public._check_mute(p public.players) returns void
language plpgsql stable set search_path = public as $$
begin
  if p.mute_until is not null and p.mute_until > now() then
    raise exception 'Вы в муте до %', to_char(p.mute_until at time zone 'Europe/Moscow', 'DD.MM HH24:MI');
  end if;
end $$;

-- мат допустим, а вот оскорбление родителей (упоминание родителя + мат) даёт мут на 30 минут
create or replace function public._moderate(p_key text, p_body text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_body ~* '\m(мат[ьеи]|мам\w*|пап\w*|отц\w*|отец|батя|бат[еюу]|родител\w*)'
     and p_body ~* '\m(хуй|еб[аеиоуыё]|бля|пизд|сук[аеиоуё]|долбо|уеб)' then
    update public.players set mute_until = greatest(coalesce(mute_until, now()), now()) + interval '30 minutes'
      where key_hash = p_key;
    return 'Мут на 30 минут: оскорбление родителей';
  end if;
  return null;
end $$;

create or replace function public._validate_showcase(p_key text, p_show jsonb) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_bad int;
begin
  select coalesce(array_agg(value), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_show, '[]'::jsonb));
  if cardinality(v_ids) > 6 then raise exception 'В профиль можно поставить не больше 6 плащей'; end if;
  select count(*) into v_bad from unnest(v_ids) i
    where not exists (select 1 from public.wallet_items wi join public.catalog c
                        on c.kind = 'cloak' and c.item_id = wi.item_id and c.nft_price is not null
                      where wi.key_hash = p_key and wi.kind = 'cloak' and wi.item_id = i);
  if v_bad > 0 then raise exception 'В профиле можно показывать только свои NFT-плащи'; end if;
  return v_ids;
end $$;

create or replace function public._admin(p_token text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_token is null or not exists (select 1 from public.admin_sessions
      where token_hash = public._hash(p_token) and expires_at > now()) then
    raise exception 'Нужен вход в админку';
  end if;
end $$;

create or replace function public._target(p_nick text) returns public.players
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  select * into p from public.players where lower(nick) = lower(btrim(coalesce(p_nick, '')));
  if not found then raise exception 'Игрок не найден'; end if;
  return p;
end $$;

-- ---------- игрок ----------
create or replace function public.social_me(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype;
begin
  perform public._check_key(p_key);
  select * into p from public.players where key_hash = p_key;
  if not found then return jsonb_build_object('registered', false); end if;
  return jsonb_build_object(
    'registered', true, 'nick', p.nick, 'bio', p.bio, 'showNfts', to_jsonb(p.show_nfts),
    'muteUntil', p.mute_until,
    'banned', coalesce(p.ban_forever or p.ban_until > now(), false),
    'banForever', p.ban_forever, 'banUntil', p.ban_until, 'banReason', p.ban_reason);
end $$;

create or replace function public.social_register(p_key text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_nick text := btrim(coalesce(p_nick, ''));
begin
  perform public._lock_wallet(p_key);
  if exists (select 1 from public.players where key_hash = p_key) then raise exception 'Ник уже выбран'; end if;
  perform public._nick_ok(v_nick);
  if exists (select 1 from public.players where lower(nick) = lower(v_nick)) then raise exception 'Этот ник уже занят'; end if;
  insert into public.players (key_hash, nick) values (p_key, v_nick);
  return jsonb_build_object('nick', v_nick);
end $$;

create or replace function public.social_profile_set(p_key text, p_bio text, p_show jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bio text := btrim(coalesce(p_bio, '')); v_show text[];
begin
  perform public._player(p_key);
  if char_length(v_bio) > 140 then raise exception 'Описание до 140 символов'; end if;
  if public._moderate(p_key, v_bio) is not null then raise exception 'В описании нельзя оскорблять родителей'; end if;
  v_show := public._validate_showcase(p_key, p_show);
  update public.players set bio = v_bio, show_nfts = v_show where key_hash = p_key;
  return public.social_me(p_key);
end $$;

create or replace function public.social_players(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'nick', p.nick, 'online', p.last_seen > now() - interval '5 minutes', 'me', p.key_hash = p_key)
            order by p.last_seen desc), '[]'::jsonb)
          from public.players p);
end $$;

create or replace function public.social_profile(p_key text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_nick);
  return jsonb_build_object(
    'nick', t.nick, 'bio', t.bio, 'online', t.last_seen > now() - interval '5 minutes', 'lastSeen', t.last_seen,
    'own', t.key_hash = p_key,
    'nfts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.item_id, 'name', c.name) order by c.name), '[]'::jsonb)
             from unnest(t.show_nfts) s join public.catalog c on c.kind = 'cloak' and c.item_id = s));
end $$;

-- ---------- общий чат ----------
create or replace function public.social_chat_list(p_key text, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._player(p_key);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select s.id, s.nick, s.body, s.at from (
      select m.id, p.nick, m.body, m.created_at as at
      from public.chat_messages m join public.players p on p.key_hash = m.key_hash
      where m.id > coalesce(p_after, 0)
      order by m.id desc
      limit case when coalesce(p_after, 0) = 0 then 50 else 200 end
    ) s order by s.id) x);
end $$;

create or replace function public.social_chat_send(p_key text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; v_body text := btrim(coalesce(p_body, '')); v_mute text;
begin
  p := public._player(p_key);
  perform public._check_mute(p);
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'error', 'Сообщение от 1 до 300 символов');
  end if;
  if exists (select 1 from public.chat_messages where key_hash = p_key and created_at > now() - interval '2 seconds') then
    return jsonb_build_object('ok', false, 'error', 'Не так быстро');
  end if;
  v_mute := public._moderate(p_key, v_body);
  if v_mute is not null then
    return jsonb_build_object('ok', false, 'error', v_mute);   -- без raise, чтобы мут сохранился
  end if;
  insert into public.chat_messages (key_hash, body) values (p_key, v_body);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- личные сообщения ----------
create or replace function public.social_dm_list(p_key text, p_peer text, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._player(p_key);
  t := public._target(p_peer);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select s.id, s.mine, s.body, s.at from (
      select d.id, d.sender = p_key as mine, d.body, d.created_at as at
      from public.direct_messages d
      where ((d.sender = p_key and d.recipient = t.key_hash) or (d.sender = t.key_hash and d.recipient = p_key))
        and d.id > coalesce(p_after, 0)
      order by d.id desc
      limit case when coalesce(p_after, 0) = 0 then 50 else 200 end
    ) s order by s.id) x);
end $$;

create or replace function public.social_dm_send(p_key text, p_peer text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players%rowtype; t public.players%rowtype; v_body text := btrim(coalesce(p_body, '')); v_mute text;
begin
  p := public._player(p_key);
  perform public._check_mute(p);
  t := public._target(p_peer);
  if t.key_hash = p_key then return jsonb_build_object('ok', false, 'error', 'Себе нельзя писать'); end if;
  if char_length(v_body) < 1 or char_length(v_body) > 300 then
    return jsonb_build_object('ok', false, 'error', 'Сообщение от 1 до 300 символов');
  end if;
  if exists (select 1 from public.direct_messages where sender = p_key and created_at > now() - interval '2 seconds') then
    return jsonb_build_object('ok', false, 'error', 'Не так быстро');
  end if;
  v_mute := public._moderate(p_key, v_body);
  if v_mute is not null then
    return jsonb_build_object('ok', false, 'error', v_mute);
  end if;
  insert into public.direct_messages (sender, recipient, body) values (p_key, t.key_hash, v_body);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- новости (читает любой, пишет только админка) ----------
create or replace function public.news_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(n) order by n.id desc), '[]'::jsonb)
  from (select id, title, body, created_at from public.news order by id desc limit 50) n
$$;

-- ---------- админка ----------
create or replace function public.admin_activate(p_key text) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  update public.admin_keys set used_at = now()
    where key_hash = public._hash(upper(btrim(coalesce(p_key, ''))))
      and used_at is null and not revoked;
  if not found then raise exception 'Ключ неверный или уже использован'; end if;
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.admin_sessions (token_hash, expires_at) values (public._hash(tok), now() + interval '30 days');
  perform public._log('вход в админку', null, null);
  return tok;
end $$;

create or replace function public.admin_logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.admin_sessions where token_hash = public._hash(p_token)
$$;

create or replace function public.admin_check(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_players(p_token text, p_search text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen desc), '[]'::jsonb) from (
    select p.nick, p.last_seen, p.mute_until, p.ban_until, p.ban_forever, w.balance
    from public.players p join public.wallets w on w.key_hash = p.key_hash
    where btrim(coalesce(p_search, '')) = '' or p.nick ilike btrim(p_search) || '%'
    order by p.last_seen desc limit 300) x);
end $$;

create or replace function public.admin_player_info(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; w public.wallets%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  select * into w from public.wallets where key_hash = t.key_hash;
  return jsonb_build_object(
    'nick', t.nick, 'bio', t.bio, 'createdAt', t.created_at, 'lastSeen', t.last_seen,
    'balance', w.balance, 'equipped', jsonb_build_object('theme', w.equipped_theme, 'cloak', w.equipped_cloak),
    'items', (select coalesce(jsonb_agg(wi.kind || ':' || wi.item_id || ' x' || wi.count order by wi.kind, wi.item_id), '[]'::jsonb)
              from public.wallet_items wi where wi.key_hash = t.key_hash),
    'showNfts', to_jsonb(t.show_nfts),
    'muteUntil', t.mute_until, 'banUntil', t.ban_until, 'banForever', t.ban_forever, 'banReason', t.ban_reason);
end $$;

create or replace function public.admin_add_crystals(p_token text, p_nick text, p_delta int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; v_balance int;
begin
  perform public._admin(p_token);
  if p_delta is null or abs(p_delta) > 1000000000 then raise exception 'Некорректная сумма'; end if;
  t := public._target(p_nick);
  update public.wallets set balance = greatest(0, balance + p_delta) where key_hash = t.key_hash
    returning balance into v_balance;
  perform public._log('кристаллики ' || case when p_delta >= 0 then '+' else '' end || p_delta, t.nick, null);
  return jsonb_build_object('balance', v_balance);
end $$;

create or replace function public.admin_grant_item(p_token text, p_nick text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  if not exists (select 1 from public.catalog where kind = p_kind and item_id = p_item) then
    raise exception 'Нет такого предмета';
  end if;
  if p_kind = 'theme' then
    if exists (select 1 from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item) then
      raise exception 'Тема уже есть у игрока';
    end if;
    insert into public.wallet_items (key_hash, kind, item_id, count) values (t.key_hash, 'theme', p_item, 1);
  else
    perform public._add_one(t.key_hash, 'cloak', p_item);
  end if;
  perform public._log('выдал ' || p_kind || ':' || p_item, t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_revoke_item(p_token text, p_nick text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  if p_kind = 'cloak' then
    perform public._remove_one(t.key_hash, p_item);
  elsif p_kind = 'theme' then
    if not exists (select 1 from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item) then
      raise exception 'У игрока нет этой темы';
    end if;
    delete from public.wallet_items where key_hash = t.key_hash and kind = 'theme' and item_id = p_item;
    update public.wallets set equipped_theme = null where key_hash = t.key_hash and equipped_theme = p_item;
  else
    raise exception 'Неизвестный вид';
  end if;
  perform public._log('забрал ' || p_kind || ':' || p_item, t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_mute(p_token text, p_nick text, p_minutes int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set mute_until = case when coalesce(p_minutes, 0) <= 0 then null
                                              else now() + make_interval(mins => p_minutes) end
    where key_hash = t.key_hash;
  perform public._log(case when coalesce(p_minutes, 0) <= 0 then 'размут' else 'мут ' || p_minutes || ' мин' end, t.nick, p_reason);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_ban(p_token text, p_nick text, p_days int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set ban_forever = (p_days is null),
    ban_until = case when p_days is null then null else now() + make_interval(days => p_days) end,
    ban_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where key_hash = t.key_hash;
  perform public._log(case when p_days is null then 'бан навсегда' else 'бан ' || p_days || ' дн.' end, t.nick, p_reason);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_unban(p_token text, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  update public.players set ban_forever = false, ban_until = null, ban_reason = null where key_hash = t.key_hash;
  perform public._log('разбан', t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_set_nick(p_token text, p_nick text, p_new text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; v_new text := btrim(coalesce(p_new, ''));
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  perform public._nick_ok(v_new);
  if exists (select 1 from public.players where lower(nick) = lower(v_new) and key_hash <> t.key_hash) then
    raise exception 'Этот ник уже занят';
  end if;
  update public.players set nick = v_new where key_hash = t.key_hash;
  perform public._log('ник: ' || t.nick || ' -> ' || v_new, v_new, null);
  return public.admin_player_info(p_token, v_new);
end $$;

create or replace function public.admin_set_bio(p_token text, p_nick text, p_bio text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; v_bio text := btrim(coalesce(p_bio, ''));
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  if char_length(v_bio) > 140 then raise exception 'Описание до 140 символов'; end if;
  update public.players set bio = v_bio where key_hash = t.key_hash;
  perform public._log('описание изменено', t.nick, null);
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_set_showcase(p_token text, p_nick text, p_show jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype; v_show text[];
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  v_show := public._validate_showcase(t.key_hash, p_show);
  update public.players set show_nfts = v_show where key_hash = t.key_hash;
  perform public._log('профиль: плащи', t.nick, array_to_string(v_show, ','));
  return public.admin_player_info(p_token, t.nick);
end $$;

create or replace function public.admin_delete_account(p_token text, p_nick text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.players%rowtype;
begin
  perform public._admin(p_token);
  t := public._target(p_nick);
  delete from public.wallets where key_hash = t.key_hash;   -- каскадно удалит игрока, сообщения и предметы
  perform public._log('аккаунт удалён', t.nick, null);
end $$;

create or replace function public.admin_chat_list(p_token text, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select s.id, s.nick, s.body, s.at from (
      select m.id, p.nick, m.body, m.created_at as at
      from public.chat_messages m join public.players p on p.key_hash = m.key_hash
      where m.id > coalesce(p_after, 0)
      order by m.id desc
      limit case when coalesce(p_after, 0) = 0 then 100 else 300 end
    ) s order by s.id) x);
end $$;

create or replace function public.admin_delete_chat(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  delete from public.chat_messages where id = p_id;
  perform public._log('удалено сообщение в чате', p_id::text, null);
end $$;

create or replace function public.admin_news_publish(p_token text, p_title text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public._admin(p_token);
  insert into public.news (title, body) values (btrim(coalesce(p_title, '')), btrim(coalesce(p_body, ''))) returning id into v_id;
  perform public._log('новость', v_id::text, btrim(coalesce(p_title, '')));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_news_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  delete from public.news where id = p_id;
  perform public._log('новость удалена', p_id::text, null);
end $$;

create or replace function public.admin_log_list(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb)
          from (select id, at, action, target, detail from public.admin_log order by id desc limit 200) x);
end $$;

-- ---------- права ----------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.catalog, public.cases, public.case_items, public.news to anon, authenticated;

grant execute on function
  public.social_me(text), public.social_register(text, text), public.social_profile_set(text, text, jsonb),
  public.social_players(text), public.social_profile(text, text),
  public.social_chat_list(text, bigint), public.social_chat_send(text, text),
  public.social_dm_list(text, text, bigint), public.social_dm_send(text, text, text),
  public.news_list(),
  public.admin_activate(text), public.admin_logout(text), public.admin_check(text),
  public.admin_players(text, text), public.admin_player_info(text, text),
  public.admin_add_crystals(text, text, int), public.admin_grant_item(text, text, text, text),
  public.admin_revoke_item(text, text, text, text), public.admin_mute(text, text, int, text),
  public.admin_ban(text, text, int, text), public.admin_unban(text, text),
  public.admin_set_nick(text, text, text), public.admin_set_bio(text, text, text),
  public.admin_set_showcase(text, text, jsonb), public.admin_delete_account(text, text),
  public.admin_chat_list(text, bigint), public.admin_delete_chat(text, bigint),
  public.admin_news_publish(text, text, text), public.admin_news_delete(text, bigint),
  public.admin_log_list(text)
  to anon, authenticated;
