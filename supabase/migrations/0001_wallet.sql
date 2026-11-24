-- Кристаллики на сервере: баланс, шансы кейсов и все награды считает база.
-- Клиент (лаунчер) видит только свой кошелёк через функции wallet_*; прямого доступа к таблицам нет.

-- ---------- каталог и кейсы (читать можно, менять только миграциями) ----------
create table public.catalog (
  kind text not null check (kind in ('theme', 'cloak')),
  item_id text not null,
  name text not null,
  price int,
  nft_price int,
  primary key (kind, item_id)
);

create table public.cases (
  id text primary key,
  name text not null,
  price int not null check (price >= 0),
  is_free boolean not null default false,
  image text not null,
  open_image text not null,
  sort int not null default 0
);

create table public.case_items (
  case_id text not null references public.cases(id) on delete cascade,
  pos int not null,
  kind text not null check (kind in ('theme', 'cloak', 'crystals')),
  item_id text not null,
  weight int not null check (weight > 0),
  primary key (case_id, pos)
);

-- ---------- кошельки (только через функции) ----------
create table public.wallets (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{32,64}$'),
  balance int not null default 0 check (balance >= 0),
  equipped_theme text,
  equipped_cloak text,
  last_daily date,
  streak int not null default 0,
  play_sec bigint not null default 0,
  play_acc int not null default 0,
  play_day date,
  play_day_earned int not null default 0,
  milestones int[] not null default '{}',
  last_free_roll timestamptz,
  free_cases int not null default 0,
  created_at timestamptz not null default now()
);

create table public.wallet_items (
  key_hash text not null references public.wallets(key_hash) on delete cascade,
  kind text not null check (kind in ('theme', 'cloak')),
  item_id text not null,
  count int not null default 1 check (count > 0),
  primary key (key_hash, kind, item_id)
);

alter table public.catalog enable row level security;
alter table public.cases enable row level security;
alter table public.case_items enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_items enable row level security;

create policy catalog_read on public.catalog for select to anon, authenticated using (true);
create policy cases_read on public.cases for select to anon, authenticated using (true);
create policy case_items_read on public.case_items for select to anon, authenticated using (true);
-- wallets и wallet_items: политик нет, значит прямой доступ закрыт полностью

-- ---------- данные ----------
insert into public.catalog (kind, item_id, name, price, nft_price) values
  ('theme', 'red', 'Рубиновый', 150, null),
  ('theme', 'green', 'Изумрудный', 150, null),
  ('theme', 'orange', 'Янтарный', 200, null),
  ('theme', 'purple', 'Аметистовый', 250, null),
  ('cloak', 'creeper', 'Крипер', null, null),
  ('cloak', 'endermen', 'Эндермены', null, null),
  ('cloak', 'aynull', 'Aynull', null, null),
  ('cloak', 'experience', 'Minecraft Experience', null, null),
  ('cloak', 'nft-cat', 'Кошка', null, 1000),
  ('cloak', 'nft-mono', 'Монохром', null, 1200),
  ('cloak', 'nft-rose', 'Роза', null, 1800),
  ('cloak', 'nft-pink', 'Розовая', null, 1500),
  ('cloak', 'nft-angel', 'Ангел', null, 15000),
  ('cloak', 'nft-sad', 'Грусть', null, 2000),
  ('cloak', 'golden', 'Золотой', null, null),
  ('cloak', 'milk', 'Молочный', null, null),
  ('cloak', 'warden', 'Страж', null, null),
  ('cloak', 'femboy', 'Femboy', null, null),
  ('cloak', 'copper', 'Медный', null, null);

insert into public.cases (id, name, price, is_free, image, open_image, sort) values
  ('free', 'Бесплатный', 0, true, 'assets/cases/free-closed.png', 'assets/cases/free-open.png', 0),
  ('start', 'Стартовый', 300, false, 'assets/cases/start-closed.png', 'assets/cases/start-open.png', 1),
  ('pro', 'Продвинутый', 800, false, 'assets/cases/pro-closed.png', 'assets/cases/pro-open.png', 2),
  ('nft', 'NFT', 1500, false, 'assets/cases/nft-closed.png', 'assets/cases/nft-open.png', 3);

insert into public.case_items (case_id, pos, kind, item_id, weight) values
  ('start', 1, 'theme', 'red', 20), ('start', 2, 'theme', 'green', 20), ('start', 3, 'theme', 'orange', 10),
  ('start', 4, 'cloak', 'copper', 10), ('start', 5, 'cloak', 'milk', 10), ('start', 6, 'cloak', 'creeper', 10),
  ('start', 7, 'crystals', '150', 20),
  ('pro', 1, 'theme', 'purple', 20), ('pro', 2, 'cloak', 'endermen', 15), ('pro', 3, 'cloak', 'golden', 15),
  ('pro', 4, 'cloak', 'aynull', 15), ('pro', 5, 'cloak', 'warden', 15), ('pro', 6, 'cloak', 'femboy', 6),
  ('pro', 7, 'crystals', '400', 9), ('pro', 8, 'cloak', 'experience', 5),
  ('nft', 1, 'cloak', 'nft-angel', 1), ('nft', 2, 'cloak', 'nft-sad', 2), ('nft', 3, 'cloak', 'nft-rose', 3),
  ('nft', 4, 'cloak', 'nft-pink', 4), ('nft', 5, 'cloak', 'nft-mono', 5), ('nft', 6, 'cloak', 'nft-cat', 5),
  ('nft', 7, 'crystals', '800', 80),
  ('free', 1, 'crystals', '50', 50), ('free', 2, 'crystals', '100', 35), ('free', 3, 'crystals', '200', 15);

-- ---------- внутренние функции ----------
create or replace function public._check_key(p text) returns void language plpgsql immutable as $$
begin
  if p is null or p !~ '^[0-9a-f]{32,64}$' then
    raise exception 'Некорректный ключ кошелька';
  end if;
end $$;

create or replace function public._lock_wallet(p_key text) returns public.wallets
language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype;
begin
  perform _check_key(p_key);
  insert into public.wallets (key_hash) values (p_key) on conflict do nothing;
  select * into w from public.wallets where key_hash = p_key for update;
  return w;
end $$;

create or replace function public._item_label(p_kind text, p_id text) returns text
language sql stable as $$
  select case p_kind
    when 'theme' then 'Тема: ' || coalesce((select name from public.catalog where kind = 'theme' and item_id = p_id), '?')
    when 'cloak' then 'Плащ: ' || coalesce((select name from public.catalog where kind = 'cloak' and item_id = p_id), '?')
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
             from public.case_items ci where ci.case_id = c.id))
  from public.cases c where c.id = p_id
$$;

create or replace function public._wallet_json(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  w public.wallets%rowtype;
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_free_in int := 0;
  v_next int;
begin
  select * into w from public.wallets where key_hash = p_key;
  if w.last_free_roll is not null then
    v_free_in := greatest(0, ceil(extract(epoch from (w.last_free_roll + interval '24 hours' - now())))::int);
  end if;
  select coalesce(min(s), 180000) into v_next from unnest(array[36000, 180000]) s where s > w.play_sec;
  return jsonb_build_object(
    'balance', w.balance,
    'owned', (select coalesce(jsonb_agg(wi.kind || ':' || wi.item_id order by wi.kind, wi.item_id), '[]'::jsonb)
              from public.wallet_items wi, generate_series(1, wi.count) g where wi.key_hash = p_key),
    'equipped', jsonb_build_object('theme', w.equipped_theme, 'cloak', w.equipped_cloak),
    'dailyAvailable', w.last_daily is distinct from v_today,
    'streak', w.streak,
    'playSec', w.play_sec,
    'playTarget', v_next,
    'playToday', case when w.play_day = v_today then w.play_day_earned else 0 end,
    'cases', (select coalesce(jsonb_agg(public._case_json(id) order by sort), '[]'::jsonb)
              from public.cases where not is_free),
    'freeCase', public._case_json('free'),
    'freeCases', w.free_cases,
    'freeIn', v_free_in
  );
end $$;

-- выбор предмета из кейса по весам (случайность — на стороне базы)
create or replace function public._case_pick(p_case text, out kind text, out item_id text)
language plpgsql volatile as $$
#variable_conflict use_column
begin
  with r as materialized (
    select random() * (select sum(weight) from public.case_items where case_id = p_case) as x
  ), c as (
    select ci.kind, ci.item_id, ci.pos, sum(ci.weight) over (order by ci.pos) as cum
    from public.case_items ci where ci.case_id = p_case
  )
  select c.kind, c.item_id into kind, item_id
  from c, r
  where c.cum > r.x
  order by c.pos
  limit 1;
end $$;

create or replace function public._remove_one(p_key text, p_cloak text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cnt int;
begin
  select count into v_cnt from public.wallet_items
    where key_hash = p_key and kind = 'cloak' and item_id = p_cloak;
  if coalesce(v_cnt, 0) = 0 then
    raise exception 'Такого плаща нет';
  end if;
  if v_cnt = 1 then
    delete from public.wallet_items where key_hash = p_key and kind = 'cloak' and item_id = p_cloak;
    update public.wallets set equipped_cloak = null where key_hash = p_key and equipped_cloak = p_cloak;
  else
    update public.wallet_items set count = count - 1
      where key_hash = p_key and kind = 'cloak' and item_id = p_cloak;
  end if;
end $$;

create or replace function public._add_one(p_key text, p_kind text, p_item text) returns void
language sql security definer set search_path = public as $$
  insert into public.wallet_items (key_hash, kind, item_id, count) values (p_key, p_kind, p_item, 1)
  on conflict (key_hash, kind, item_id) do update set count = public.wallet_items.count + 1
$$;

-- ---------- публичные функции (их и вызывает лаунчер) ----------
create or replace function public.wallet_get(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._lock_wallet(p_key);
  return public._wallet_json(p_key);
end $$;

create or replace function public.wallet_claim_daily(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.wallets%rowtype;
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_streak int; v_amount int;
begin
  w := public._lock_wallet(p_key);
  if w.last_daily = v_today then raise exception 'Сегодня уже получено'; end if;
  v_streak := case when w.last_daily = v_today - 1 then w.streak + 1 else 1 end;
  v_amount := 50 + floor(random() * 21)::int + least(70, 10 * v_streak);
  update public.wallets set balance = balance + v_amount, streak = v_streak, last_daily = v_today
    where key_hash = p_key;
  return jsonb_build_object('amount', v_amount, 'streak', v_streak) || public._wallet_json(p_key);
end $$;

-- раз в игровой тик (клиент шлёт ~30 сек); сервер ограничивает до 60 сек за вызов
create or replace function public.wallet_tick(p_key text, p_sec int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.wallets%rowtype;
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_sec int := least(greatest(coalesce(p_sec, 0), 0), 60);
  v_room int; v_earn int;
begin
  w := public._lock_wallet(p_key);
  if w.play_day is distinct from v_today then
    w.play_day := v_today; w.play_day_earned := 0; w.play_acc := 0;
  end if;
  w.play_sec := w.play_sec + v_sec;
  v_room := 500 - w.play_day_earned;
  if v_room > 0 then
    w.play_acc := w.play_acc + v_sec;
    v_earn := least(w.play_acc / 36, v_room);
    w.play_acc := w.play_acc - v_earn * 36;
    w.balance := w.balance + v_earn;
    w.play_day_earned := w.play_day_earned + v_earn;
    if v_earn = v_room then w.play_acc := 0; end if;
  end if;
  if w.play_sec >= 36000 and not (36000 = any(w.milestones)) then
    w.milestones := w.milestones || 36000; w.balance := w.balance + 300;
  end if;
  if w.play_sec >= 180000 and not (180000 = any(w.milestones)) then
    w.milestones := w.milestones || 180000; w.balance := w.balance + 1000;
  end if;
  update public.wallets set balance = w.balance, play_day = w.play_day, play_day_earned = w.play_day_earned,
    play_acc = w.play_acc, play_sec = w.play_sec, milestones = w.milestones
    where key_hash = p_key;
  return public._wallet_json(p_key);
end $$;

create or replace function public.wallet_buy_theme(p_key text, p_theme text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; v_price int;
begin
  select price into v_price from public.catalog where kind = 'theme' and item_id = p_theme;
  if v_price is null then raise exception 'Нет такой темы'; end if;
  w := public._lock_wallet(p_key);
  if exists (select 1 from public.wallet_items where key_hash = p_key and kind = 'theme' and item_id = p_theme) then
    raise exception 'Тема уже куплена';
  end if;
  if w.balance < v_price then raise exception 'Не хватает кристалликов'; end if;
  update public.wallets set balance = balance - v_price where key_hash = p_key;
  insert into public.wallet_items (key_hash, kind, item_id, count) values (p_key, 'theme', p_theme, 1);
  return public._wallet_json(p_key);
end $$;

create or replace function public.wallet_equip(p_key text, p_kind text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_item text := nullif(p_item, '');
begin
  perform public._lock_wallet(p_key);
  if p_kind = 'theme' then
    if v_item is not null and not exists (select 1 from public.wallet_items
        where key_hash = p_key and kind = 'theme' and item_id = v_item) then
      raise exception 'Тема не куплена';
    end if;
    update public.wallets set equipped_theme = v_item where key_hash = p_key;
  elsif p_kind = 'cloak' then
    if v_item is not null and not exists (select 1 from public.wallet_items
        where key_hash = p_key and kind = 'cloak' and item_id = v_item) then
      raise exception 'Плащ не получен';
    end if;
    update public.wallets set equipped_cloak = v_item where key_hash = p_key;
  else
    raise exception 'Неизвестный вид';
  end if;
  return public._wallet_json(p_key);
end $$;

create or replace function public.wallet_open_case(p_key text, p_case text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.wallets%rowtype;
  v_price int; v_free boolean;
  v_pick record; v_tmp record;
  v_reel jsonb := '[]'::jsonb;
  v_refund int := 0; v_gain int := 0;
  v_nft boolean;
begin
  select price, is_free into v_price, v_free from public.cases where id = p_case;
  if not found then raise exception 'Нет такого кейса'; end if;
  w := public._lock_wallet(p_key);
  if w.balance < v_price then raise exception 'Не хватает кристалликов'; end if;
  if v_free then
    if w.free_cases <= 0 then raise exception 'Бесплатного кейса нет'; end if;
    update public.wallets set free_cases = free_cases - 1 where key_hash = p_key;
  end if;

  select * into v_pick from public._case_pick(p_case);
  if v_pick.kind is null then raise exception 'Кейс пуст'; end if;
  -- лента: 46 карточек, выигрыш на позиции 37
  for i in 1..46 loop
    if i = 37 then
      v_tmp := v_pick;
    else
      select * into v_tmp from public._case_pick(p_case);
    end if;
    v_reel := v_reel || jsonb_build_array(jsonb_build_object(
      'kind', v_tmp.kind, 'id', v_tmp.item_id, 'name', public._item_label(v_tmp.kind, v_tmp.item_id)));
  end loop;

  update public.wallets set balance = balance - v_price where key_hash = p_key;
  if v_pick.kind = 'crystals' then
    v_gain := v_pick.item_id::int;
    update public.wallets set balance = balance + v_gain where key_hash = p_key;
  else
    v_nft := exists (select 1 from public.catalog where kind = 'cloak' and item_id = v_pick.item_id and nft_price is not null);
    if not v_nft and exists (select 1 from public.wallet_items
        where key_hash = p_key and kind = v_pick.kind and item_id = v_pick.item_id) then
      v_refund := 50;                       -- повтор обычного предмета переводим в кристаллики
      update public.wallets set balance = balance + v_refund where key_hash = p_key;
    else
      perform public._add_one(p_key, v_pick.kind, v_pick.item_id);
    end if;
  end if;

  return jsonb_build_object(
    'item', jsonb_build_object('kind', v_pick.kind, 'id', v_pick.item_id,
              'name', public._item_label(v_pick.kind, v_pick.item_id)),
    'reel', v_reel, 'index', 36, 'duplicateRefund', v_refund
  ) || public._wallet_json(p_key);
end $$;

create or replace function public.wallet_roll_free(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; v_won boolean := random() < 0.5;
begin
  w := public._lock_wallet(p_key);
  if w.last_free_roll is not null and now() - w.last_free_roll < interval '24 hours' then
    raise exception 'Бросок ещё не готов';
  end if;
  update public.wallets set last_free_roll = now(),
    free_cases = free_cases + (case when v_won then 1 else 0 end) where key_hash = p_key;
  return jsonb_build_object('won', v_won) || public._wallet_json(p_key);
end $$;

create or replace function public.wallet_sell_nft(p_key text, p_cloak text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_price int;
begin
  select nft_price into v_price from public.catalog where kind = 'cloak' and item_id = p_cloak;
  if v_price is null then raise exception 'Этот плащ нельзя продать'; end if;
  perform public._lock_wallet(p_key);
  perform public._remove_one(p_key, p_cloak);
  update public.wallets set balance = balance + v_price where key_hash = p_key;
  return jsonb_build_object('price', v_price) || public._wallet_json(p_key);
end $$;

create or replace function public.wallet_upgrade(p_key text, p_in text, p_target text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_in int; v_tgt int; v_chance numeric; v_won boolean;
begin
  select nft_price into v_in from public.catalog where kind = 'cloak' and item_id = p_in;
  select nft_price into v_tgt from public.catalog where kind = 'cloak' and item_id = p_target;
  if v_in is null or v_tgt is null then raise exception 'Апгрейд только для NFT-плащей'; end if;
  perform public._lock_wallet(p_key);
  v_chance := least(0.9, 0.9 * v_in::numeric / v_tgt);
  v_won := random() < v_chance;
  perform public._remove_one(p_key, p_in);
  if v_won then perform public._add_one(p_key, 'cloak', p_target); end if;
  return jsonb_build_object(
    'won', v_won, 'chance', round(100 * v_chance, 1),
    'item', case when v_won then jsonb_build_object('kind', 'cloak', 'id', p_target,
              'name', public._item_label('cloak', p_target)) else null end
  ) || public._wallet_json(p_key);
end $$;

-- права: вызывать можно только публичные функции кошелька, внутренние и таблицы — нет
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.wallet_get(text) to anon, authenticated;
grant execute on function public.wallet_claim_daily(text) to anon, authenticated;
grant execute on function public.wallet_tick(text, int) to anon, authenticated;
grant execute on function public.wallet_buy_theme(text, text) to anon, authenticated;
grant execute on function public.wallet_equip(text, text, text) to anon, authenticated;
grant execute on function public.wallet_open_case(text, text) to anon, authenticated;
grant execute on function public.wallet_roll_free(text) to anon, authenticated;
grant execute on function public.wallet_sell_nft(text, text) to anon, authenticated;
grant execute on function public.wallet_upgrade(text, text, text) to anon, authenticated;

-- поправка после применения: фиксированный search_path у внутренних функций
alter function public._case_pick(text) set search_path = public;
alter function public._check_key(text) set search_path = public;
alter function public._item_label(text, text) set search_path = public;
