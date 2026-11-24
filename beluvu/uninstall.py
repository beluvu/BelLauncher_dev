"""Удаление лаунчера с этого компьютера. Аккаунт на сервере остаётся: войти можно по нику и паролю.

Лаунчер не может стереть сам себя, пока работает, поэтому батник ждёт выхода процесса,
удаляет данные (и, если выбрано, игру со сборками) и сам exe, затем удаляет себя.
"""
import os
import sys

from . import paths

# Что лежит в папке данных и принадлежит лаунчеру (настройки, Java, логи, скины, обновления, ключ аккаунта)
LAUNCHER_ITEMS = ('settings.json', 'java', 'logs', 'skins', 'update', 'install.id')
# Игра: общие версии/библиотеки и папки сборок с модами и сохранениями
GAME_ITEMS = ('minecraft', 'instances')


def _rm_lines(path, is_dir):
    if is_dir:
        return f'if exist "{path}" rmdir /S /Q "{path}"\r\n'
    return f'if exist "{path}" del /F /Q "{path}"\r\n'


def script(data_dir, exe_path, pid, remove_games):
    """Текст батника. exe_path — None, если лаунчер запущен не из собранного exe."""
    items = list(LAUNCHER_ITEMS) + (list(GAME_ITEMS) if remove_games else [])
    lines = [
        '@echo off\r\n',
        'chcp 65001 >nul\r\n',
        'set /a waited=0\r\n',
        ':wait\r\n',
        f'tasklist /FI "PID eq {int(pid)}" 2>nul | find "{int(pid)}" >nul\r\n',
        'if errorlevel 1 goto remove\r\n',
        'set /a waited+=1\r\n',
        'if %waited% GEQ 30 goto kill\r\n',
        'timeout /t 1 /nobreak >nul\r\n',
        'goto wait\r\n',
        ':kill\r\n',
        f'taskkill /PID {int(pid)} /F >nul 2>nul\r\n',
        'timeout /t 2 /nobreak >nul\r\n',
        ':remove\r\n',
    ]
    for name in items:
        p = os.path.join(data_dir, name)
        lines.append(_rm_lines(p, is_dir=not name.endswith('.json') and name != 'install.id'))
    # если папка данных пуста, убираем и её
    lines.append(f'rmdir "{data_dir}" >nul 2>nul\r\n')
    if exe_path:
        # exe удаляется уже после выхода процесса; батник удаляет себя последним
        lines.append(f'set /a tries=0\r\n')
        lines.append(':exe\r\n')
        lines.append(f'del /F /Q "{exe_path}" >nul 2>nul\r\n')
        lines.append(f'if exist "{exe_path}" (\r\n')
        lines.append('  set /a tries+=1\r\n')
        lines.append('  if %tries% GEQ 60 goto done\r\n')
        lines.append('  timeout /t 1 /nobreak >nul & goto exe\r\n')
        lines.append(')\r\n')
    lines.append(':done\r\n')
    lines.append('del "%~f0"\r\n')
    return ''.join(lines)


def start(remove_games, data_dir=None, exe_path=None):
    """Запускает батник. Возвращает путь к нему. Вне собранного exe пишет только в папку данных (для проверки)."""
    import subprocess
    import tempfile
    data_dir = data_dir or paths.data()
    if exe_path is None and getattr(sys, 'frozen', False):
        exe_path = sys.executable
    bat_dir = tempfile.mkdtemp(prefix='beluvu-uninstall-')
    bat = os.path.join(bat_dir, 'uninstall.bat')
    with open(bat, 'w', encoding='utf-8', newline='') as f:
        f.write(script(data_dir, exe_path, os.getpid(), remove_games))
    subprocess.Popen(['cmd', '/c', bat], creationflags=0x08000000 | 0x00000008, close_fds=True)
    return bat
