"""Загрузчики: Fabric и Quilt (профиль JSON), Forge и NeoForge (тихий установщик)."""
import json
import os
import subprocess
import sys
import urllib.parse

from . import paths
from .util import download, fetch_json

FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader'
QUILT_META = 'https://meta.quiltmc.org/v3/versions/loader'
FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
NEO_VERSIONS = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'


def _versions_dir():
    return os.path.join(paths.root(), 'versions')


def _has_version(vid):
    return os.path.exists(os.path.join(_versions_dir(), vid, vid + '.json'))


def _write_profile(prof):
    vid = prof['id']
    d = os.path.join(_versions_dir(), vid)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, vid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(prof, f)
    return vid


def _old_local(prefix, mc):
    try:
        names = os.listdir(_versions_dir())
    except OSError:
        return None
    hits = sorted(n for n in names if n.startswith(prefix) and n.endswith('-' + mc))
    return hits[-1] if hits else None


def _pick_stable(loaders):
    return next((l for l in loaders if (l.get('loader') or {}).get('stable')), loaders[0])


def ensure_fabric(mc):
    try:
        loaders = fetch_json(f'{FABRIC_META}/{urllib.parse.quote(mc)}')
        if not isinstance(loaders, list) or not loaders:
            raise RuntimeError('Fabric пока не поддерживает версию ' + mc)
        pick = _pick_stable(loaders)
        lv = pick['loader']['version']
        prof = fetch_json(f'{FABRIC_META}/{urllib.parse.quote(mc)}/{urllib.parse.quote(lv)}/profile/json')
        return _write_profile(prof)
    except Exception:
        old = _old_local('fabric-loader-', mc)   # без интернета — уже установленный профиль
        if old:
            return old
        raise


def ensure_quilt(mc):
    try:
        loaders = fetch_json(f'{QUILT_META}/{urllib.parse.quote(mc)}')
        if not isinstance(loaders, list) or not loaders:
            raise RuntimeError('Quilt не поддерживает ' + mc)
        pick = _pick_stable(loaders)
        prof = fetch_json(f'{QUILT_META}/{urllib.parse.quote(mc)}/{urllib.parse.quote(pick["loader"]["version"])}/profile/json')
        return _write_profile(prof)
    except Exception:
        old = _old_local('quilt-loader-', mc)
        if old:
            return old
        raise


# ---------- Forge / NeoForge ----------

def forge_version(mc, wanted=None):
    if wanted:
        return str(wanted)
    p = (fetch_json(FORGE_PROMOS) or {}).get('promos') or {}
    v = p.get(f'{mc}-recommended') or p.get(f'{mc}-latest')
    if not v:
        raise RuntimeError('Для Forge нет сборки под ' + mc)
    return v


def _num_key(v):
    out = []
    for x in str(v).replace('-', '.').split('.'):
        try:
            out.append(int(x))
        except ValueError:
            out.append(0)
    return out


def neo_version(mc, wanted=None):
    if wanted:
        return str(wanted)
    import re
    m = re.match(r'^1\.(\d+)(?:\.(\d+))?$', mc)
    if not m or int(m.group(1)) < 20:
        raise RuntimeError('NeoForge есть только для 1.20.2 и новее')
    prefix = f'{m.group(1)}.{m.group(2) or "0"}.'
    allv = [v for v in (fetch_json(NEO_VERSIONS) or {}).get('versions', []) if str(v).startswith(prefix)]
    if not allv:
        raise RuntimeError('Для NeoForge нет сборки под ' + mc)
    stable = [v for v in allv if not re.search(r'-(beta|alpha|rc)', str(v), re.I)]
    return sorted(stable or allv, key=_num_key)[-1]


def _console_java(java_path):
    # для установщика нужна обычная java, а не javaw (иначе не видно вывода)
    alt = java_path[:-len('javaw.exe')] + 'java.exe' if java_path.lower().endswith('javaw.exe') else java_path
    return alt if os.path.exists(alt) else java_path


def _run_installer(java_path, jar, say):
    creation = 0x08000000 if sys.platform == 'win32' else 0   # CREATE_NO_WINDOW
    try:
        p = subprocess.run([_console_java(java_path), '-jar', jar, '--installClient', paths.root()],
                           capture_output=True, text=True, timeout=20 * 60, creationflags=creation)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Установщик не отработал: таймаут') from None
    tail = '\n'.join((p.stdout or '').splitlines()[-12:]) + '\n' + '\n'.join((p.stderr or '').splitlines()[-6:])
    if p.returncode != 0:
        raise RuntimeError('Установщик не отработал: код ' + str(p.returncode) + '\n' + tail)
    if say:
        say(tail)


def _via_installer(vid, url, jar, java_path, say, status):
    if _has_version(vid):
        return vid
    if not java_path:
        raise RuntimeError('Нет Java для установки загрузчика')
    before = set(os.listdir(_versions_dir())) if os.path.isdir(_versions_dir()) else set()
    prof = os.path.join(paths.root(), 'launcher_profiles.json')
    if not os.path.exists(prof):   # установщику нужен launcher_profiles.json
        os.makedirs(paths.root(), exist_ok=True)
        with open(prof, 'w', encoding='utf-8') as f:
            json.dump({'profiles': {}, 'version': 3}, f)
    dest = os.path.join(paths.data(), 'installers', jar)
    if status:
        status('Скачиваю установщик загрузчика…', None)
    download(url, dest)
    if status:
        status('Устанавливаю загрузчик (первый раз — несколько минут)…', None)
    _run_installer(java_path, dest, say)
    if _has_version(vid):
        return vid
    after = [n for n in os.listdir(_versions_dir()) if n not in before and _has_version(n)]
    guess = next((n for n in after if 'forge' in n.lower()), None)
    if not guess:
        raise RuntimeError('Установщик закончил работу, но версия загрузчика не появилась')
    return guess


def ensure_forge(mc, o):
    v = forge_version(mc, o.get('loaderVersion'))
    full = v if v.startswith(mc + '-') else f'{mc}-{v}'
    vid = f'{mc}-forge-{full[len(mc) + 1:]}'
    url = f'https://maven.minecraftforge.net/net/minecraftforge/forge/{full}/forge-{full}-installer.jar'
    return _via_installer(vid, url, f'forge-{full}-installer.jar', o.get('javaPath'), o.get('say'), o.get('status'))


def ensure_neoforge(mc, o):
    v = neo_version(mc, o.get('loaderVersion'))
    vid = f'neoforge-{v}'
    url = f'https://maven.neoforged.net/releases/net/neoforged/neoforge/{v}/neoforge-{v}-installer.jar'
    return _via_installer(vid, url, f'neoforge-{v}-installer.jar', o.get('javaPath'), o.get('say'), o.get('status'))


def ensure(loader, mc, o=None):
    o = o or {}
    if not loader or loader == 'vanilla':
        return None
    if loader == 'fabric':
        return ensure_fabric(mc)
    if loader == 'quilt':
        return ensure_quilt(mc)
    if loader == 'forge':
        return ensure_forge(mc, o)
    if loader == 'neoforge':
        return ensure_neoforge(mc, o)
    raise RuntimeError('Неизвестный загрузчик: ' + str(loader))
