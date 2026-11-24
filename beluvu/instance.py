"""Папка игры для связки версия+загрузчик или для сборки."""
import os
import re

from . import paths


def _safe(name):
    return re.sub(r'[^a-zA-Z0-9._-]', '_', str(name))


def pack_dir_name(slug):
    return 'modpack-' + _safe(slug)


def dir_for(s):
    """Единственное место, где решается, из какой папки запускается игра и где лежат моды."""
    sm = s.get('selectedModpack')
    from . import custom_installs  # импорт здесь, чтобы не было цикла
    rec = custom_installs.current(s) if not (sm and sm.get('slug')) else None
    if sm and sm.get('slug'):
        d = paths.instance(pack_dir_name(sm['slug']))
    elif rec:
        d = custom_installs.dir_of(rec)
    else:
        d = paths.instance(f"{s.get('version')}-{s.get('loader')}")
    os.makedirs(d, exist_ok=True)
    for sub in ('mods', 'resourcepacks', 'shaderpacks', 'saves', 'config'):
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    return d


def pack_dir(slug):
    d = paths.instance(pack_dir_name(slug))
    os.makedirs(d, exist_ok=True)
    for sub in ('mods', 'resourcepacks', 'shaderpacks', 'saves', 'config'):
        os.makedirs(os.path.join(d, sub), exist_ok=True)
    return d


def instances_root():
    os.makedirs(paths.instances_root(), exist_ok=True)
    return paths.instances_root()
