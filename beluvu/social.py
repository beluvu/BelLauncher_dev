"""Друзья: вход не нужен. Аккаунт = ник, привязанный к ключу кошелька (железо + установка).
Все действия идут через функции social_* и news_list в Supabase. Проверки прав и мут делает база."""
from . import coins


class SocialError(Exception):
    pass


def _call(fn, **args):
    try:
        return coins._rpc(fn, p_key=coins._wallet_key(), **args)
    except ValueError as e:
        raise SocialError(str(e)) from None


def _ok(r):
    if not r.get('ok'):
        raise SocialError(r.get('error') or 'Не получилось')
    return r


def password_set(password):
    return _call('social_password_set', p_password=str(password or ''))


def login(nick, password):
    """Вход по нику и паролю: сервер отдаёт ключ аккаунта, он сохраняется на этом ПК."""
    try:
        r = coins._rpc('social_login', p_nick=str(nick or '').strip(), p_password=str(password or ''))
    except ValueError as e:
        raise SocialError(str(e)) from None
    _ok(r)
    coins.set_account_key(r.get('key'))
    return {'nick': r.get('nick')}


def me():
    return _call('social_me')


def register(nick):
    return _call('social_register', p_nick=str(nick or '').strip())


def profile_set(bio, show):
    return _call('social_profile_set', p_bio=str(bio or ''), p_show=list(show or []))


def nick_change(nick):
    return _call('social_nick_change', p_nick=str(nick or '').strip())


def appearance_set(avatar, items, show_all=True):
    return _call('social_appearance_set', p_avatar=str(avatar or 'letter'), p_items=list(items or []),
                 p_all=bool(show_all))


def presence():
    try:
        rows = _call('social_presence')
    except SocialError:
        return {}
    return {r['nick']: r['where'] for r in (rows or []) if r.get('nick') and r.get('where')}


def players():
    rows = _call('social_players')
    where = presence()
    for p in rows or []:
        p['where'] = where.get(p.get('nick'))
    return rows


def profile(nick):
    return _call('social_profile', p_nick=str(nick or ''))


def nft_info(nft_id):
    return _call('social_nft_info', p_id=int(nft_id or 0))


def nft_send(nft_id, to):
    return _call('social_nft_send', p_id=int(nft_id or 0), p_to=str(to or '').strip())


def chat(after=0):
    return _call('social_chat_list', p_after=int(after or 0))


def chat_send(text):
    return _ok(_call('social_chat_send', p_body=str(text or '')))


def dm(peer, after=0):
    return _call('social_dm_list', p_peer=str(peer or ''), p_after=int(after or 0))


def dm_send(peer, text):
    return _ok(_call('social_dm_send', p_peer=str(peer or ''), p_body=str(text or '')))


def news():
    return coins._rpc('news_list')
