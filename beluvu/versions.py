"""Список версий Mojang (release). Без интернета берётся последний сохранённый список."""
import json
import os

from . import paths
from .util import fetch_json, read_json

MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
_mem = {'t': 0.0, 'data': None}


def _manifest():
    import time
    if _mem['data'] is not None and time.time() - _mem['t'] < 600:
        return _mem['data']
    cache = os.path.join(paths.data(), 'manifest-cache.json')
    try:
        data = fetch_json(MANIFEST)
        _mem.update(t=time.time(), data=data)
        os.makedirs(paths.data(), exist_ok=True)
        with open(cache, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        return data
    except Exception:
        data = read_json(cache, None)
        if not data:
            raise
        _mem.update(t=time.time() - 540, data=data)
        return data


def list_versions():
    m = _manifest()
    return {
        'latest': (m.get('latest') or {}).get('release'),
        'versions': [{'id': v['id'], 'type': v['type'], 'releaseTime': v.get('releaseTime')}
                     for v in m.get('versions', []) if v.get('type') == 'release'],
    }


def version_json(vid):
    try:
        m = _manifest()
        v = next((x for x in m['versions'] if x['id'] == vid), None)
        if not v:
            raise ValueError('Версия ' + vid + ' не найдена в списке Mojang')
        return fetch_json(v['url'])
    except Exception:
        local = read_json(os.path.join(paths.root(), 'versions', vid, vid + '.json'), None)
        if local:
            return local      # уже скачанная версия запустится и без интернета
        raise
