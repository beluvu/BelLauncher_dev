"""Сборка для админа: аккаунт поддержки входит сам, без регистрации; ник, аватарку и описание меняет только администрация.

В обычной сборке ENABLED = False и ключа нет. Отдельную сборку поддержки делает скрипт с нужным ключом."""
ENABLED = False
NICK = 'Support Account'
KEY = ''


def seed_account():
    """Кладёт ключ аккаунта поддержки на этот ПК, если входа ещё не было."""
    if not ENABLED or not KEY:
        return
    from . import coins
    if coins._read_account() is None:
        coins.set_account_key(KEY)
