-- Профили: ник игрока в лаунчере. Выполни в SQL Editor один раз.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null check (nick ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);

-- ник уникален без учёта регистра
create unique index profiles_nick_lower on public.profiles (lower(nick));

alter table public.profiles enable row level security;

create policy "Authenticated can read profiles"
on public.profiles for select to authenticated
using (true);

create policy "Users create own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

-- Проверка занятости ника до регистрации (до входа пользователь — гость)
create policy "Anyone can check nick"
on public.profiles for select to anon
using (true);

-- ===== Обновление: имя в чате отдельно от ника в Minecraft (выполни этот блок один раз) =====
alter table public.profiles add column if not exists chat_name text
  check (chat_name is null or char_length(chat_name) between 1 and 24);
update public.profiles set chat_name = nick where chat_name is null;

create policy "Users edit own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
