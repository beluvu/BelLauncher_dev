-- Права на новые админ-функции (как у остальных admin_* — доступ проверяет токен входа), и сброс аккаунтов админки.
-- Ключ активации для новой версии создаётся отдельно и в репозиторий не попадает (хранится только его хеш).
grant execute on function public.admin_nft_list(text) to anon, authenticated;
grant execute on function public.admin_catalog_list(text) to anon, authenticated;

delete from public.admin_sessions;
delete from public.admin_keys;
