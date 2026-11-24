"""Java нужной версии (Eclipse Temurin) скачивается в папку лаунчера при первом запуске."""
import os
import platform
import sys
import tarfile
import zipfile

from . import paths
from .util import download, rm_rf

WIN = sys.platform == 'win32'


def find_java(folder, depth=0):
    try:
        entries = sorted(os.scandir(folder), key=lambda e: e.name)
    except OSError:
        return None
    if any(e.is_dir() and e.name == 'bin' for e in entries):
        f = os.path.join(folder, 'bin', 'javaw.exe' if WIN else 'java')   # javaw — без чёрного окна
        if os.path.exists(f):
            return f
    if depth >= 4:
        return None
    for e in entries:
        if e.is_dir():
            r = find_java(e.path, depth + 1)
            if r:
                return r
    return None


def _target():
    os_name = {'win32': 'windows', 'darwin': 'mac', 'linux': 'linux'}.get(sys.platform)
    machine = platform.machine().lower()
    arch = {'amd64': 'x64', 'x86_64': 'x64', 'arm64': 'aarch64', 'aarch64': 'aarch64'}.get(machine)
    if not os_name or not arch:
        raise RuntimeError('Эта система не поддерживается для автоустановки Java')
    return os_name, arch


def ensure(major, on_progress=None):
    folder = os.path.join(paths.java(), f'jre-{major}')
    have = find_java(folder)
    if have:
        return have
    os_name, arch = _target()
    url = f'https://api.adoptium.net/v3/binary/latest/{major}/ga/{os_name}/{arch}/jre/hotspot/normal/eclipse'
    archive = os.path.join(paths.java(), f'jre-{major}.{"zip" if WIN else "tar.gz"}')
    download(url, archive, on_progress=on_progress)
    rm_rf(folder)
    os.makedirs(folder, exist_ok=True)
    if WIN:
        with zipfile.ZipFile(archive) as z:
            z.extractall(folder)
    else:
        with tarfile.open(archive, 'r:gz') as t:
            t.extractall(folder, filter='data')
    os.remove(archive)
    exe = find_java(folder)
    if not exe:
        raise RuntimeError('Не нашёл Java после распаковки')
    return exe
