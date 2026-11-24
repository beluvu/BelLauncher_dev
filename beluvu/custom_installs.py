"""Свои установки: имя, версия, загрузчик, папка (изолированная или общая), память и JVM-аргументы.

Хранятся в installs.json в папке данных. Сборки из каталога и «голые» версии сюда не входят —
у них свои записи (см. installs.py).
"""
import json
import os
import re
import shutil
import threading
import uuid

from . import paths

LOADERS = ('vanilla', 'fabric', 'forge', 'neoforge', 'quilt')
FOLDERS = ('isolated', 'shared')
SUBDIRS = ('mods', 'resourcepacks', 'shaderpacks', 'saves', 'config')
_lock = threading.Lock()
_VER = re.compile(r'^[A-Za-z0-9._\- ]{1,40}$')


def _file():
    return os.path.join(paths.data(), 'installs.json')


def _load():
    try:
        with open(_file(), encoding='utf-8') as f:
            items = json.load(f).get('items') or []
    except (OSError, ValueError, AttributeError):
        return []
    return [i for i in items if isinstance(i, dict) and i.get('id')]


def _save(items):
    path = _file()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'items': items}, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def list_items():
    with _lock:
        return [dict(i) for i in _load()]


def get(item_id):
    for i in list_items():
        if i['id'] == item_id:
            return i
    return None


def current(s):
    sid = (s or {}).get('selectedInstall')
    return get(sid) if sid else None


def dir_of(rec):
    """Папка игры для установки. Общая папка одна на версию и загрузчик, изолированная — своя."""
    if rec.get('folder') == 'shared':
        d = paths.instance(f"{rec['version']}-{rec['loader']}")
    else:
        d = paths.instance('custom-' + rec['id'])
    os.makedirs(d, exist_ok=True)
    for sub in SUBDIRS:
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    return d


def _check(version, loader, name=None):
    if not isinstance(version, str) or not _VER.match(version):
        raise ValueError('Выбери версию Minecraft')
    if loader not in LOADERS:
        raise ValueError('Этот загрузчик пока не поддерживается')
    if name is not None:
        if not isinstance(name, str) or not name.strip():
            raise ValueError('Введи название установки')
        if len(name.strip()) > 40:
            raise ValueError('Название не длиннее 40 символов')


def create(name, version, loader, folder='isolated'):
    if folder not in FOLDERS:
        raise ValueError('Неизвестный тип папки')
    name = str(name or '').strip() or 'Моя установка'
    _check(version, loader, name)
    with _lock:
        items = _load()
        rec = {'id': uuid.uuid4().hex[:10], 'name': name, 'version': version, 'loader': loader,
               'folder': folder, 'ramGb': None, 'jvmArgs': '', 'javaPath': ''}
        items.append(rec)
        _save(items)
    dir_of(rec)
    return rec


def update(item_id, patch):
    patch = patch or {}
    with _lock:
        items = _load()
        rec = next((i for i in items if i['id'] == item_id), None)
        if rec is None:
            raise ValueError('Установка не найдена')
        if 'name' in patch:
            name = str(patch['name'] or '').strip()
            _check(rec['version'], rec['loader'], name)
            rec['name'] = name
        if 'version' in patch or 'loader' in patch:
            v = patch.get('version', rec['version'])
            l_ = patch.get('loader', rec['loader'])
            _check(v, l_)
            rec['version'], rec['loader'] = v, l_
        if 'ramGb' in patch:
            if patch['ramGb'] in (None, '', 0):
                rec['ramGb'] = None
            else:
                try:
                    n = int(patch['ramGb'])
                except (TypeError, ValueError):
                    raise ValueError('Некорректный объём памяти')
                if not (1 <= n <= 16):
                    raise ValueError('Память от 1 до 16 ГБ')
                rec['ramGb'] = n
        if 'jvmArgs' in patch:
            args = str(patch['jvmArgs'] or '').strip()
            if len(args) > 500 or '\n' in args:
                raise ValueError('Аргументы JVM: одна строка до 500 символов')
            rec['jvmArgs'] = args
        if 'javaPath' in patch:
            jp = str(patch['javaPath'] or '').strip()
            if jp and not os.path.isfile(jp):
                raise ValueError('Файл Java не найден')
            rec['javaPath'] = jp
        _save(items)
    dir_of(rec)
    return rec


def duplicate(item_id):
    src = get(item_id)
    if src is None:
        raise ValueError('Установка не найдена')
    rec = create(src['name'] + ' (копия)', src['version'], src['loader'], 'isolated')
    rec.update({'ramGb': src.get('ramGb'), 'jvmArgs': src.get('jvmArgs', ''), 'javaPath': src.get('javaPath', '')})
    with _lock:
        items = _load()
        for i in items:
            if i['id'] == rec['id']:
                i.update({k: rec[k] for k in ('ramGb', 'jvmArgs', 'javaPath')})
        _save(items)
    # копируем моды и настройки; сохранения тоже, поэтому копия может быть большой
    for sub in ('mods', 'config', 'resourcepacks', 'shaderpacks'):
        s_dir = os.path.join(dir_of(src), sub)
        if os.path.isdir(s_dir):
            shutil.copytree(s_dir, os.path.join(dir_of(rec), sub), dirs_exist_ok=True)
    return rec


def delete(item_id):
    """Удаляет запись. Изолированная папка удаляется вместе с модами и сохранениями; общая остаётся."""
    with _lock:
        items = _load()
        rec = next((i for i in items if i['id'] == item_id), None)
        if rec is None:
            raise ValueError('Установка не найдена')
        items = [i for i in items if i['id'] != item_id]
        _save(items)
    if rec.get('folder') != 'shared':
        shutil.rmtree(paths.instance('custom-' + rec['id']), ignore_errors=True)
    return rec
