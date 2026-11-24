"""settings.json — те же поля и значения по умолчанию, что в Electron-версии."""
import json
import re
import secrets
import threading

from . import paths
from .util import write_json

NICK = re.compile(r'^[A-Za-z0-9_]{3,16}$')   # 16 — жёсткий предел Minecraft
LOADERS = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt']
SKIN_TYPES = ['steve', 'alex', 'custom']
THEMES = ['light', 'dark']
_lock = threading.RLock()


def make_guest_nick():
    return 'BeluvuLauncher' + str(secrets.randbelow(100))


def _defaults():
    return {
        'nick': None, 'version': None, 'loader': 'fabric', 'ramGb': 4,
        'skin': {'type': 'steve', 'id': None}, 'uploads': [], 'preferredMods': [], 'selectedModpack': None, 'selectedInstall': None,
        'theme': 'light'
    }


def _save(s):
    write_json(paths.settings(), s)


def _read_raw():
    try:
        with open(paths.settings(), 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def get():
    with _lock:
        s = _read_raw()
        d = _defaults()
        out = {**d, **s}
        out['skin'] = {**d['skin'], **(s.get('skin') or {})}
        if not isinstance(out.get('uploads'), list):
            out['uploads'] = []
        if not out.get('nick') or not NICK.match(str(out['nick'])):
            out['nick'] = make_guest_nick()
            out['skin'] = {'type': 'steve', 'id': None}
            _save(out)
        return out


def update(patch):
    with _lock:
        patch = patch or {}
        s = get()
        if 'nick' in patch:
            if not NICK.match(str(patch['nick'])):
                raise ValueError('Ник: 3–16 символов, латиница, цифры и _')
            s['nick'] = str(patch['nick'])
        if 'version' in patch:
            v = patch['version']
            if not isinstance(v, str) or not re.match(r'^[A-Za-z0-9._\- ]{1,40}$', v):
                raise ValueError('Некорректная версия')
            s['version'] = v
        if 'loader' in patch:
            if patch['loader'] not in LOADERS:
                raise ValueError('Этот загрузчик пока не поддерживается')
            s['loader'] = patch['loader']
        if 'ramGb' in patch:
            try:
                n = int(patch['ramGb'])
            except (TypeError, ValueError):
                n = 0
            if not (1 <= n <= 64):
                raise ValueError('Некорректный объём памяти')
            s['ramGb'] = n
        if 'theme' in patch:
            if patch['theme'] not in THEMES:
                raise ValueError('Неизвестная тема')
            s['theme'] = patch['theme']
        if 'preferredMods' in patch:
            s['preferredMods'] = patch['preferredMods'] if isinstance(patch['preferredMods'], list) else []
        if 'selectedModpack' in patch:
            s['selectedModpack'] = patch['selectedModpack'] or None
        if ('version' in patch or 'loader' in patch) and 'selectedInstall' not in patch:
            s['selectedInstall'] = None  # выбрали версию вручную — своя установка больше не активна
        if 'selectedInstall' in patch:
            s['selectedInstall'] = str(patch['selectedInstall']) if patch['selectedInstall'] else None
        if 'skin' in patch:
            k = patch['skin'] or {}
            if k.get('type') not in SKIN_TYPES:
                raise ValueError('Некорректный скин')
            if k['type'] == 'custom' and not any(u.get('id') == k.get('id') for u in s['uploads']):
                raise ValueError('Скин не найден')
            prev = (s.get('skin') or {}).get('model')
            model = k.get('model', prev)
            if model not in ('classic', 'slim'):
                model = 'classic'
            s['skin'] = {'type': k['type'], 'id': k.get('id') if k['type'] == 'custom' else None, 'model': model}
        _save(s)
        return s


def add_upload(entry):
    with _lock:
        s = get()
        s['uploads'].append({'id': entry['id'], 'name': entry['name']})
        _save(s)
        return s


def remove_upload(skin_id):
    with _lock:
        s = get()
        s['uploads'] = [u for u in s['uploads'] if u.get('id') != skin_id]
        if s['skin'].get('type') == 'custom' and s['skin'].get('id') == skin_id:
            s['skin'] = {'type': 'steve', 'id': None}
        _save(s)
        return s
