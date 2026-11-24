"""Скины: загрузка PNG, скин из клиента Steve/Alex, CustomSkinLoader для оффлайн-ника."""
import base64
import json
import os
import re
import time
import zipfile

from . import paths
from .util import download, write_json

ID = re.compile(r'^u\d+$')
BUILTIN = {
    'steve': ['assets/minecraft/textures/entity/player/wide/steve.png', 'assets/minecraft/textures/entity/steve.png'],
    'alex': ['assets/minecraft/textures/entity/player/slim/alex.png', 'assets/minecraft/textures/entity/alex.png'],
}


def _png_size(buf):
    ok = len(buf) >= 24 and buf[:8] == b'\x89PNG\r\n\x1a\n' and buf[12:16] == b'IHDR'
    if not ok:
        raise ValueError('Это не PNG-файл')
    return int.from_bytes(buf[16:20], 'big'), int.from_bytes(buf[20:24], 'big')


def validate(buf):
    if len(buf) > 1024 * 1024:
        raise ValueError('Файл слишком большой для скина')
    w, h = _png_size(buf)
    if not ((w in (64, 128)) and (h == w or h == w // 2)):
        raise ValueError(f'Скин должен быть 64×64 (или 64×32), а у файла {w}×{h}')
    return w, h


def import_file(src):
    with open(src, 'rb') as f:
        buf = f.read()
    validate(buf)
    sid = 'u' + str(int(time.time() * 1000))
    os.makedirs(paths.skins(), exist_ok=True)
    with open(os.path.join(paths.skins(), sid + '.png'), 'wb') as f:
        f.write(buf)
    name = os.path.splitext(os.path.basename(src))[0][:24] or 'Скин'
    return {'id': sid, 'name': name}


def remove(sid):
    if not ID.match(str(sid)):
        return
    try:
        os.remove(os.path.join(paths.skins(), sid + '.png'))
    except OSError:
        pass


def data_url(sid):
    if not ID.match(str(sid)):
        raise ValueError('Некорректный id скина')
    with open(os.path.join(paths.skins(), sid + '.png'), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')


def _jar_path(mc):
    return os.path.join(paths.root(), 'versions', mc, mc + '.jar')


def builtin_buffer(stype, mc):
    names = BUILTIN.get(stype)
    jar = _jar_path(mc) if mc else None
    if not names or not jar or not os.path.exists(jar):
        return None
    with zipfile.ZipFile(jar) as z:
        for n in names:
            if n in z.namelist():
                return z.read(n)
    return None


def builtin_data_url(stype, mc):
    buf = builtin_buffer(stype, mc)
    return ('data:image/png;base64,' + base64.b64encode(buf).decode('ascii')) if buf else None


def csl_config():
    return {
        'version': '14.20', 'buildNumber': 0,
        'loadlist': [
            {'name': 'LocalSkin', 'type': 'Legacy', 'checkPNG': False, 'root': 'LocalSkin/skins'},
            {'name': 'Mojang', 'type': 'MojangAPI', 'apiRoot': 'https://api.mojang.com/',
             'sessionRoot': 'https://sessionserver.mojang.com/'},
        ],
    }


def apply_for_launch(nick, skin, mc, inst):
    """Кладёт скин для оффлайн-ника и пишет CustomSkinLoader.json."""
    skin = skin or {}
    if skin.get('type') == 'custom':
        if not ID.match(str(skin.get('id'))):
            raise ValueError('Некорректный id скина')
        with open(os.path.join(paths.skins(), skin['id'] + '.png'), 'rb') as f:
            buf = f.read()
    else:
        stype = skin.get('type') or 'steve'
        buf = builtin_buffer(stype, mc)
        if not buf:
            raise ValueError(f'Не нашёл текстуру {stype} в клиенте {mc}. Скин применится после первой загрузки версии.')

    safe = re.sub(r'[^\w.\-]', '_', str(nick or 'Player'))
    csl_root = os.path.join(inst, 'CustomSkinLoader')
    local_dir = os.path.join(csl_root, 'LocalSkin', 'skins')
    os.makedirs(local_dir, exist_ok=True)
    with open(os.path.join(local_dir, safe + '.png'), 'wb') as f:
        f.write(buf)
    if safe != safe.lower():
        with open(os.path.join(local_dir, safe.lower() + '.png'), 'wb') as f:
            f.write(buf)
    write_json(os.path.join(csl_root, 'CustomSkinLoader.json'), csl_config())
    for d in (os.path.join(inst, 'skins'), os.path.join(csl_root, 'LocalSkin')):
        os.makedirs(d, exist_ok=True)
        try:
            with open(os.path.join(d, safe + '.png'), 'wb') as f:
                f.write(buf)
        except OSError:
            pass


def download_by_nick(nick):
    n = str(nick or '').strip()
    if not re.match(r'^[A-Za-z0-9_]{1,16}$', n):
        raise ValueError('Ник для скина: 1–16 символов (латиница, цифры, _)')
    url = 'https://mc-heads.net/skin/' + urllib_quote(n)
    os.makedirs(paths.skins(), exist_ok=True)
    tmp = os.path.join(paths.skins(), f'tmp-{int(time.time() * 1000)}.png')
    try:
        download(url, tmp)
        with open(tmp, 'rb') as f:
            buf = f.read()
        validate(buf)
        sid = 'u' + str(int(time.time() * 1000))
        with open(os.path.join(paths.skins(), sid + '.png'), 'wb') as f:
            f.write(buf)
        return {'id': sid, 'name': n[:24]}
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def urllib_quote(s):
    import urllib.parse
    return urllib.parse.quote(s, safe='')
