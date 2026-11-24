-- Префикс игрока (например красный [Bot]). Применено как миграция player_prefix.
alter table public.players add column if not exists prefix text, add column if not exists prefix_color text;
update public.players set prefix = 'Bot', prefix_color = '#ff3b3b' where nick = 'Test';
-- social_players, social_profile и social_chat_list теперь отдают prefix и prefixColor (см. применённую миграцию).
