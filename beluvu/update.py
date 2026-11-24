"""Обновление лаунчера. Версию и ссылку публикует администрация (launcher_latest в Supabase).
Файл скачивается только по https, проверяется размер и SHA-256, и только потом заменяет текущий .exe."""
import hashlib
import os
import re
import subprocess
import sys
import urllib.request

from . import coins, paths
from .config import APP_VERSION

MAX_SIZE = 300 * 1024 * 1024


class UpdateError(Exception):
    pass


def parse(v):
    m = re.fullmatch(r'(\d+)\.(\d+)\.(\d+)', str(v or '').strip())
    if not m:
        raise UpdateError('Некорректная версия: ' + str(v))
    return tuple(int(x) for x in m.groups())


def is_newer(latest, current):
    return parse(latest) > parse(current)


def check():
    try:
        rel = coins._rpc('launcher_latest')
    except ValueError as e:
        raise UpdateError(str(e)) from None
    if not rel:
        return {'current': APP_VERSION, 'available': False}
    return {'current': APP_VERSION, 'available': is_newer(rel['version'], APP_VERSION),
            'latest': rel['version'], 'notes': rel.get('notes') or '', 'url': rel['url'],
            'sha256': rel['sha256'], 'size': int(rel['size'])}


def download(url, sha256, size, dest, on_progress=None):
    if not str(url).startswith('https://'):
        raise UpdateError('Обновление грузится только по https')
    if not (0 < int(size) <= MAX_SIZE):
        raise UpdateError('Недопустимый размер обновления')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    part = dest + '.part'
    h = hashlib.sha256()
    got = 0
    req = urllib.request.Request(url, headers={'User-Agent': 'BeluvuLauncher'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(part, 'wb') as f:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                got += len(chunk)
                if got > int(size):
                    raise UpdateError('Файл больше заявленного размера')
                h.update(chunk)
                f.write(chunk)
                if on_progress:
                    on_progress(got, int(size))
    except OSError as e:
        raise UpdateError('Не удалось скачать обновление: ' + str(e)) from None
    if got != int(size):
        raise UpdateError('Файл скачан не полностью')
    if h.hexdigest() != str(sha256).lower():
        os.remove(part)
        raise UpdateError('Контрольная сумма не совпадает, обновление отменено')
    os.replace(part, dest)
    return dest


def build_script(new_exe, current_exe, pid):
    """Батник ждёт, пока закроется лаунчер, заменяет exe и запускает новый. Сам себя удаляет."""
    return (
        '@echo off\r\n'
        'chcp 65001 >nul\r\n'
        'set /a tries=0\r\n'
        ':wait\r\n'
        f'tasklist /FI "PID eq {int(pid)}" 2>nul | find "{int(pid)}" >nul\r\n'
        'if not errorlevel 1 (timeout /t 1 /nobreak >nul & goto wait)\r\n'
        ':move\r\n'
        'set /a tries+=1\r\n'
        f'move /Y "{new_exe}" "{current_exe}" >nul 2>nul\r\n'
        'if errorlevel 1 (\r\n'
        '  if %tries% GEQ 60 goto fail\r\n'
        '  timeout /t 1 /nobreak >nul & goto move\r\n'
        ')\r\n'
        f'start "" "{current_exe}"\r\n'
        'del "%~f0"\r\n'
        'exit /b 0\r\n'
        ':fail\r\n'
        'exit /b 1\r\n'
    )


def apply(new_exe):
    if not getattr(sys, 'frozen', False):
        raise UpdateError('Автообновление работает только в собранном BeluvuLauncher.exe')
    bat = os.path.join(os.path.dirname(new_exe), 'apply_update.bat')
    with open(bat, 'w', encoding='utf-8', newline='') as f:
        f.write(build_script(new_exe, sys.executable, os.getpid()))
    subprocess.Popen(['cmd', '/c', bat], creationflags=0x08000000 | 0x00000008, close_fds=True)
    return bat


def new_exe_path():
    return os.path.join(paths.data(), 'update', 'BeluvuLauncher.new.exe')
