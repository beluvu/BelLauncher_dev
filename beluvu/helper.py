"""Помогатор: ИИ-чат во вкладке «Друзья» и установка модов из его предложений.
Ключ OpenAI хранится на сервере (edge function helper-chat), в лаунчере его нет.
Счётчик запросов и докупка — функции helper_* в Supabase."""
import os
import re
import json
import urllib.error
import urllib.request

from . import coins, instance, modrinth, settings
from .social import SocialError

FN_URL = coins.SUPABASE_URL + '/functions/v1/helper-chat'
MAX_MODS = 30
_SLUG = re.compile(r'^[a-z0-9][a-z0-9_.\-]{1,63}$')


class HelperError(SocialError):
    pass


def _rpc(fn, **args):
    try:
        return coins._rpc(fn, p_key=coins._wallet_key(), **args)
    except ValueError as e:
        raise HelperError(str(e)) from None


def state():
    return _rpc('helper_state')


def buy():
    return _rpc('helper_buy')


def history():
    return _rpc('helper_history') or []


def chat(text):
    text = str(text or '').strip()
    if not text:
        raise HelperError('Пустое сообщение')
    body = json.dumps({'key': coins._wallet_key(), 'message': text}).encode('utf-8')
    req = urllib.request.Request(FN_URL, data=body, method='POST', headers={
        'apikey': coins.SUPABASE_KEY, 'Authorization': 'Bearer ' + coins.SUPABASE_KEY,
        'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read().decode('utf-8') or '{}')
        except ValueError:
            data = {}
        raise HelperError(data.get('error') or 'Помогатор не ответил') from None
    except (urllib.error.URLError, OSError, ValueError):
        raise HelperError('Нет связи с помогатором') from None
    if not data.get('ok'):
        raise HelperError(data.get('error') or 'Не получилось ответить')
    return {'reply': data.get('reply') or '', 'state': data.get('state')}


def install_mods(slugs):
    """Ставит моды в текущую установку (версия и загрузчик из настроек). Ошибки по одному моду не рвут остальные."""
    s = settings.get()
    inst = instance.dir_for(s)
    os.makedirs(inst, exist_ok=True)
    done, failed = [], []
    for slug in [str(x).strip().lower() for x in (slugs or [])][:MAX_MODS]:
        if not _SLUG.match(slug):
            failed.append(slug)
            continue
        try:
            modrinth.install_by_slug(slug, 'mod', s.get('version'), s.get('loader'), inst)
            done.append(slug)
        except Exception:  # noqa: BLE001
            failed.append(slug)
    return {'installed': done, 'failed': failed}
