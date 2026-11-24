-- Стартовые 500 кристалликов для новых кошельков. Уже существующие балансы не меняются.
alter table public.wallets alter column balance set default 500;
