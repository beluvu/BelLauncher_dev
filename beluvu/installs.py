"""Установки: сборки (модпаки) и обычные версии. Одна запись = одна папка игры."""
import os
import re

from . import instance, modrinth, paths, settings

LOADERS = ('vanilla', 'fabric', 'forge', 'neoforge', 'quilt')


def _mod_count(d):
    try:
        return len([x for x in os.listdir(os.path.join(d, 'mods')) if x.lower().endswith('.jar')])
    except OSError:
        return 0


def list_installs(s):
    cur = s.get('selectedModpack')
    out = []
    for p in modrinth.list_packs(paths.instances_root()):
        out.append({'key': 'pack:' + p['slug'], 'kind': 'pack', 'id': p.get('id'), 'slug': p['slug'],
                    'title': p['title'], 'icon': p.get('icon'),
                    'version': p.get('mc'), 'loader': p.get('loader'), 'mods': p.get('modCount', 0),
                    'active': bool(cur and cur.get('slug') == p['slug'])})
    have_version_active = False
    try:
        names = os.listdir(paths.instances_root())
    except OSError:
        names = []
    for n in sorted(names):
        m = re.match(r'^(.+)-(' + '|'.join(LOADERS) + r')$', n)
        if n.startswith('modpack-') or not m:
            continue
        ver, loader = m.group(1), m.group(2)
        active = not cur and ver == s.get('version') and loader == s.get('loader')
        have_version_active = have_version_active or active
        out.append({'key': f'ver:{ver}|{loader}', 'kind': 'version', 'title': f'Minecraft {ver}', 'icon': None,
                    'version': ver, 'loader': loader, 'mods': _mod_count(os.path.join(paths.instances_root(), n)),
                    'active': active})
    if not cur and s.get('version') and not have_version_active:
        ver, loader = s['version'], s.get('loader') or 'vanilla'
        out.insert(0, {'key': f'ver:{ver}|{loader}', 'kind': 'version', 'title': f'Minecraft {ver}', 'icon': None,
                       'version': ver, 'loader': loader, 'mods': 0, 'active': True})
    return out


def select(key):
    if key.startswith('pack:'):
        slug = key[len('pack:'):]
        meta = modrinth.read_pack_meta(instance.pack_dir(slug))
        if not meta:
            raise ValueError('Сборка не найдена на диске')
        return settings.update({'selectedModpack': {'id': meta['id'], 'slug': slug, 'title': meta['title']},
                                'version': meta['mc'], 'loader': meta['loader']})
    if key.startswith('ver:'):
        ver, loader = key[len('ver:'):].split('|', 1)
        return settings.update({'selectedModpack': None, 'version': ver, 'loader': loader})
    raise ValueError('Неизвестная установка')
