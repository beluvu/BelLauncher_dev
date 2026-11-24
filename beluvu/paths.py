"""Пути данных. Та же папка, что была у Electron-версии: %APPDATA%\\BeluvuLauncher."""
import os
import sys

_base = None


def resource_root():
    """Папка с web/ и visuals/: внутри .exe это временная папка PyInstaller."""
    return getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def default_data_dir():
    appdata = os.environ.get('APPDATA') or os.path.join(os.path.expanduser('~'), '.config')
    return os.path.join(appdata, 'BeluvuLauncher')


def init(data_dir=None):
    global _base
    _base = data_dir or default_data_dir()
    os.makedirs(_base, exist_ok=True)
    # Все рабочие папки сразу, чтобы не падать при первом запуске
    for sub in ('minecraft', 'instances', 'java', 'skins', 'logs'):
        os.makedirs(os.path.join(_base, sub), exist_ok=True)
    # Подпапки под игру
    mc = os.path.join(_base, 'minecraft')
    for sub in ('versions', 'libraries', 'assets', 'assets/indexes', 'assets/objects'):
        os.makedirs(os.path.join(mc, *sub.split('/')), exist_ok=True)


def _need():
    if not _base:
        raise RuntimeError('paths.init() не вызван')
    return _base


def data():
    return _need()


def root():
    return os.path.join(_need(), 'minecraft')          # общие versions / libraries / assets


def instance(name):
    return os.path.join(_need(), 'instances', name)    # моды, сохранения, настройки игры


def instances_root():
    return os.path.join(_need(), 'instances')


def java():
    return os.path.join(_need(), 'java')


def skins():
    return os.path.join(_need(), 'skins')


def logs():
    return os.path.join(_need(), 'logs')


def settings():
    return os.path.join(_need(), 'settings.json')
