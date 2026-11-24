"""Кристаллики: баланс, кейсы и награды считает сервер (Supabase), а не этот файл.

Лаунчер шлёт в функции wallet_* ключ кошелька: хэш от MachineGuid и метки установки. Баланс,
шансы кейсов, цены и даты наград проверяются в базе. Таблицы закрыты для прямого доступа, поэтому
подменить баланс правкой файла или запросом таблицы нельзя. Ограничение: публичный ключ Supabase
есть в программе, поэтому можно вызвать функции вручную с любым ключом кошелька. Полной защиты
от этого нет; серверные функции защищают от правки кошелька в лаунчере и от подделки шансов."""
import ctypes
import hashlib
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

from . import paths

SUPABASE_URL = 'https://clugtadhkstnwijqythc.supabase.co'
# публичный (anon) ключ: он открыт в любом клиенте; права даёт база, а не ключ
SUPABASE_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdWd0YWRoa3N0bndpanF5'
                'dGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NzY4MzAsImV4cCI6MjEwOTE1MjgzMH0.'
                'EU8tev_fyCQiUBvR9cPlXwQFSSoHnalUK0fmN28QL-c')
PLAY_PER_HOUR = 100
PLAY_DAY_MAX = 500
DAILY_BASE = 50
DAILY_BONUS_MAX = 20
STREAK_MAX = 70
STREAK_STEP = 10
FREE_CHANCE = 0.5
# цены для отображения; настоящие цены и правила считает база (таблица catalog)
_lock = threading.RLock()
_TOKEN = None
INSTALL_DIR = None          # для тестов; в обычной работе — папка лаунчера

THEMES = [
    {'id': 'red', 'name': 'Рубиновый', 'price': 150, 'hue': 155, 'accent': '#ff5a6a', 'accent2': '#d8334a',
     'glow': 'rgba(255,80,100,.22)',
     'sky': {'light': ['#ffffff', '#fff5f6', '#fde3e7'], 'dark': ['#1e0a10', '#0c0508', '#050204']}},
    {'id': 'green', 'name': 'Изумрудный', 'price': 150, 'hue': 275, 'accent': '#4ade80', 'accent2': '#16a34a',
     'glow': 'rgba(74,222,128,.22)',
     'sky': {'light': ['#ffffff', '#f3fff6', '#dcfce7'], 'dark': ['#071a10', '#040e09', '#020604']}},
    {'id': 'orange', 'name': 'Янтарный', 'price': 200, 'hue': 185, 'accent': '#ffa94d', 'accent2': '#f08c00',
     'glow': 'rgba(255,169,77,.24)',
     'sky': {'light': ['#ffffff', '#fff9f0', '#ffe8cc'], 'dark': ['#1c1206', '#0c0903', '#050301']}},
    {'id': 'purple', 'name': 'Аметистовый', 'price': 250, 'hue': 70, 'accent': '#b197fc', 'accent2': '#7048e8',
     'glow': 'rgba(177,151,252,.24)',
     'sky': {'light': ['#ffffff', '#f8f5ff', '#ede4ff'], 'dark': ['#130a20', '#080512', '#040209']}},
]
# Плащи — только из кейсов. Файлы лежат в web/assets/cloaks/<id>.png.
CLOAKS = [
    {'id': 'creeper', 'name': 'Крипер'},
    {'id': 'endermen', 'name': 'Эндермены'},
    {'id': 'aynull', 'name': 'Aynull'},
    {'id': 'experience', 'name': 'Minecraft Experience'},
    {'id': 'golden', 'name': 'Золотой'},
    {'id': 'milk', 'name': 'Молочный'},
    {'id': 'warden', 'name': 'Страж'},
    {'id': 'femboy', 'name': 'Femboy'},
    {'id': 'copper', 'name': 'Медный'},
]


# ---------- связь с сервером ----------

def _rpc(fn, **args):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/rpc/{fn}', data=json.dumps(args).encode('utf-8'), method='POST',
        headers={'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
                 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode('utf-8')).get('message') or ''
        except (ValueError, OSError):
            msg = ''
        raise ValueError(msg or 'Ошибка сервера кристалликов') from None
    except OSError:
        raise ValueError('Нет связи с сервером кристалликов') from None
    return json.loads(body) if body else {}


def _machine_guid():
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography') as k:
            return str(winreg.QueryValueEx(k, 'MachineGuid')[0])
    except (ImportError, OSError):
        return str(uuid.getnode())


def _hide(path):
    try:
        ctypes.windll.kernel32.SetFileAttributesW(path, 0x02 | 0x04)   # скрытый + системный
    except (AttributeError, OSError):
        pass


def _install_dir():
    if INSTALL_DIR:
        return INSTALL_DIR
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _install_token():
    """Метка установки хранится в папке данных (%APPDATA%\\BeluvuLauncher), а не рядом с exe:
    обновление, переезд или новая папка с лаунчером не должны менять кошелёк.
    Старая метка рядом с exe переносится один раз."""
    global _TOKEN
    if _TOKEN:
        return _TOKEN
    try:
        data_dir = paths.data()
    except RuntimeError:           # paths.init() ещё не вызван (тесты, ранний запуск)
        data_dir = _install_dir()
    path = os.path.join(data_dir, 'install.id')
    legacy = os.path.join(_install_dir(), 'install.id')
    tok = _read_token(path) or _read_token(legacy)
    if not tok:
        tok = secrets.token_hex(16)
    if _read_token(path) != tok:
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(tok)
            _hide(path)
        except OSError:
            return None
    _TOKEN = tok
    return tok


def _read_token(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            tok = f.read().strip()
    except OSError:
        return None
    return tok if re.fullmatch(r'[0-9a-f]{32}', tok) else None


_KEY_RE = re.compile(r'[0-9a-f]{16,128}')


def _account_path():
    try:
        return os.path.join(paths.data(), 'account.key')
    except RuntimeError:
        return None


def _read_account():
    """Ключ аккаунта, полученный при входе по паролю (на этом ПК). Нет файла — обычный ключ установки."""
    path = _account_path()
    if not path:
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            key = f.read().strip()
    except OSError:
        return None
    return key if _KEY_RE.fullmatch(key) else None


def set_account_key(key):
    """Сохраняет ключ аккаунта после входа по паролю: дальше кошелёк и ник берутся из него."""
    path = _account_path()
    if not path or not _KEY_RE.fullmatch(str(key or '')):
        raise ValueError('Не получилось войти: сервер вернул неверный ключ')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(key)
    _hide(path)


def _wallet_key():
    """Ключ кошелька: ключ аккаунта (после входа по паролю) или железо + установка.
    Переустановка в той же папке без метки даёт новый кошелёк."""
    acc = _read_account()
    if acc:
        return acc
    raw = f'{_machine_guid()}|{_install_token() or ""}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:48]


def _call(fn, **args):
    with _lock:
        return _rpc(fn, p_key=_wallet_key(), **args)


# ---------- публичные действия (их вызывает api.py) ----------

def state():
    w = _call('wallet_get')
    return {
        **w,
        'playTarget': w.get('playTarget'),
        'playDayMax': PLAY_DAY_MAX, 'playPerHour': PLAY_PER_HOUR,
        'dailyMax': DAILY_BASE + DAILY_BONUS_MAX + STREAK_MAX, 'streakMax': STREAK_MAX,
        'tampered': False,
        'themes': THEMES, 'cloaks': CLOAKS,
        'nftCloaks': [],   # плащи-NFT убраны; подарки приходят полем gifts
    }


def claim_daily():
    return _call('wallet_claim_daily')


def tick(seconds):
    """Каждые ~30 секунд, пока запущен Minecraft. Сервер сам считает часы, дневной лимит и вехи."""
    return _call('wallet_tick', p_sec=int(seconds))


def start_ticker():
    def run():
        from . import launch          # локально: launch сам импортирует coins
        while True:
            time.sleep(30)
            try:
                if launch.is_running():
                    tick(30)
            except Exception:  # noqa: BLE001 — таймер не должен падать
                pass
    threading.Thread(target=run, daemon=True).start()


def buy_theme(tid):
    return _call('wallet_buy_theme', p_theme=tid)


def roll_free():
    return _call('wallet_roll_free')


def open_case(cid):
    return _call('wallet_open_case', p_case=cid)


def sell_nft(cid):
    return _call('wallet_sell_nft', p_cloak=cid)


def equip(kind, iid):
    """iid пустой — снять. Надеть можно только то, что куплено или выпало (проверяет сервер)."""
    return _call('wallet_equip', p_kind=kind, p_item=iid or None)


# ---------- плащ (виден только владельцу) ----------

def cloak_file(cid):
    """Путь к файлу плаща внутри программы (лежит рядом с web/)."""
    return os.path.join(paths.resource_root(), 'web', 'assets', 'cloaks', f'{cid}.png')


def apply_cloak(inst, nick):
    """Кладёт выбранный плащ в папку загрузчика скинов этой сборки. Остальные игроки его не видят:
    файл есть только у владельца. Возвращает путь к файлу или False."""
    cid = (_call('wallet_get').get('equipped') or {}).get('cloak')
    # CustomSkinLoader читает локальные плащи из LocalSkin/capes (папка cloaks в нём не используется)
    target_dir = os.path.join(inst, 'CustomSkinLoader', 'LocalSkin', 'capes')
    target = os.path.join(target_dir, f'{nick}.png')
    if not cid:
        for stale in (target, os.path.join(inst, 'CustomSkinLoader', 'LocalSkin', 'cloaks', f'{nick}.png')):
            try:
                os.remove(stale)
            except OSError:
                pass
        return False
    src = cloak_file(cid)
    if not os.path.exists(src):
        return False
    os.makedirs(target_dir, exist_ok=True)
    with open(src, 'rb') as a, open(target, 'wb') as b:
        b.write(a.read())
    return target
