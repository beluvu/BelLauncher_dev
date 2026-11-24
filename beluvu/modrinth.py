"""Modrinth: поиск, установка модов с зависимостями, ресурспаков, шейдеров и модпаков (.mrpack)."""
import json
import os
import re
import time
import urllib.parse
import zipfile
from concurrent.futures import ThreadPoolExecutor

from .util import download, fetch_json, post_json, read_json, write_json, rm_rf

API = 'https://api.modrinth.com/v2'
KINDS = {
    'mod': {'type': 'mod', 'dir': 'mods'},
    'resourcepack': {'type': 'resourcepack', 'dir': 'resourcepacks'},
    'shader': {'type': 'shader', 'dir': 'shaderpacks'},
    'modpack': {'type': 'modpack', 'dir': 'modpacks'},
}
LOADERS = ['fabric', 'forge', 'neoforge', 'quilt']
PACK_HOSTS = re.compile(r'(^|\.)(modrinth\.com|github\.com|githubusercontent\.com|gitlab\.com)$')


def _rec_file(inst):
    return os.path.join(inst, 'beluvu-installed.json')


def _load_rec(inst):
    r = read_json(_rec_file(inst), None)
    return r if isinstance(r, dict) and isinstance(r.get('projects'), dict) else {'projects': {}}


def _check_kind(kind):
    if kind not in KINDS:
        raise ValueError('Неизвестный тип: ' + str(kind))


def _enc(s):
    return urllib.parse.quote(str(s), safe='')


def search(kind, query='', mc=None, loader=None, offset=0):
    _check_kind(kind)
    if kind == 'mod' and loader == 'vanilla':
        return []
    facets = [[f'project_type:{KINDS[kind]["type"]}']]
    if mc:
        facets.append([f'versions:{mc}'])
    if kind in ('mod', 'modpack') and loader and loader != 'vanilla':
        facets.append([f'categories:{loader}'])
    q = urllib.parse.urlencode({
        'query': query or '', 'facets': json.dumps(facets), 'limit': '20',
        'offset': str(offset), 'index': 'relevance' if query else 'downloads'})
    r = fetch_json(f'{API}/search?{q}')
    out = []
    for h in r.get('hits', []):
        vs = h.get('versions') or []
        out.append({
            'id': h.get('project_id'), 'slug': h.get('slug'), 'title': h.get('title'),
            'description': h.get('description'), 'icon': h.get('icon_url') or None,
            'downloads': h.get('downloads'), 'author': h.get('author'),
            'mc': vs[-1] if vs else None,
            'loaders': [c for c in (h.get('categories') or []) if c in LOADERS],
        })
    return out


def _pick_version(pid, kind, mc, loader):
    q = {'game_versions': json.dumps([mc])}
    if kind == 'mod':
        q['loaders'] = json.dumps([loader])
    lst = fetch_json(f'{API}/project/{_enc(pid)}/version?{urllib.parse.urlencode(q)}')
    if not isinstance(lst, list) or not lst:
        return None
    return next((v for v in lst if v.get('version_type') == 'release'), lst[0])   # от новых к старым


def _check_url(u):
    host = urllib.parse.urlparse(u).hostname or ''
    if not re.search(r'(^|\.)modrinth\.com$', host):
        raise ValueError('Файл лежит не на Modrinth, пропускаю: ' + host)


def install(pid, kind, mc, loader, inst, slug=None, title=None, _seen=None, icon=None):
    """Ставит проект и все обязательные зависимости (для модов). Возвращает список названий."""
    _check_kind(kind)
    if kind == 'mod' and loader == 'vanilla':
        raise ValueError('Для модов нужен Fabric / Forge / NeoForge / Quilt')
    seen = _seen if _seen is not None else set()
    if pid in seen:
        return []
    seen.add(pid)
    ver = _pick_version(pid, kind, mc, loader)
    if not ver:
        raise ValueError(f'Нет подходящей версии для {mc}' + (f' / {loader}' if kind == 'mod' else ''))
    files = ver.get('files') or []
    file = next((f for f in files if f.get('primary')), None) or (files[0] if files else None)
    if not file:
        raise ValueError('У версии нет файлов')
    _check_url(file['url'])

    done = []
    rec = _load_rec(inst)
    if kind == 'mod':
        for d in ver.get('dependencies') or []:
            if d.get('dependency_type') == 'required' and d.get('project_id') and d['project_id'] not in rec['projects']:
                done.extend(install(d['project_id'], 'mod', mc, loader, inst, _seen=seen))
                rec = _load_rec(inst)

    filename = os.path.basename(file['filename'])
    dest = os.path.join(inst, KINDS[kind]['dir'], filename)
    old = rec['projects'].get(ver['project_id'])
    download(file['url'], dest, sha512=(file.get('hashes') or {}).get('sha512'))
    if old and old.get('file') != filename:
        rm_rf(os.path.join(inst, KINDS[kind]['dir'], os.path.basename(old['file'])))

    rec = _load_rec(inst)
    rec['projects'][ver['project_id']] = {
        'kind': kind, 'file': filename, 'versionId': ver.get('id'),
        'slug': slug or (old or {}).get('slug'),
        'title': title or (old or {}).get('title') or ver.get('name') or filename,
        'icon': icon or (old or {}).get('icon'),
        'enabled': True,
    }
    write_json(_rec_file(inst), rec)
    done.append(rec['projects'][ver['project_id']]['title'])
    return done


def remove(pid, inst):
    rec = _load_rec(inst)
    p = rec['projects'].get(pid)
    if not p:
        return
    name = os.path.basename(p['file'])
    rm_rf(os.path.join(inst, KINDS[p['kind']]['dir'], name))
    rm_rf(os.path.join(inst, 'mods-disabled', name))
    del rec['projects'][pid]
    write_json(_rec_file(inst), rec)


def installed(inst):
    return _load_rec(inst)['projects']


def enrich_icons(inst):
    """Для модов, поставленных раньше, иконок в записи не было: берём их с Modrinth одним запросом."""
    rec = _load_rec(inst)
    need = [pid for pid, p in rec['projects'].items() if not p.get('icon') and not str(pid).startswith('file:')]
    if not need:
        return
    try:
        projs = fetch_json(f'{API}/projects?ids={_enc(json.dumps(need[:100]))}') or []
    except Exception:  # noqa: BLE001 — нет сети: просто без иконок
        return
    icons = {p['id']: p.get('icon_url') for p in projs if p.get('id')}
    changed = False
    for pid in need:
        if icons.get(pid):
            rec['projects'][pid]['icon'] = icons[pid]
            changed = True
    if changed:
        write_json(_rec_file(inst), rec)


def install_by_slug(slug, kind, mc, loader, inst):
    proj = fetch_json(f'{API}/project/{_enc(slug)}')
    return install(proj['id'], kind or 'mod', mc, loader, inst, slug=proj.get('slug'), title=proj.get('title'))


def ensure_custom_skin_loader(mc, loader, inst):
    rec = _load_rec(inst)
    if any((p.get('slug') == 'customskinloader') or re.search('customskinloader', str(p.get('title') or ''), re.I)
           for p in rec['projects'].values()):
        return False
    try:
        install_by_slug('customskinloader', 'mod', mc, loader, inst)
    except Exception as e:  # noqa: BLE001
        hits = search('mod', 'CustomSkinLoader', mc, loader)
        hit = next((h for h in hits if h['slug'] == 'customskinloader'), hits[0] if hits else None)
        if not hit:
            raise e
        install(hit['id'], 'mod', mc, loader, inst, slug=hit['slug'], title=hit['title'])
    return True


def set_enabled(pid, enabled, inst):
    rec = _load_rec(inst)
    p = rec['projects'].get(pid)
    if not p or p.get('kind') != 'mod':
        raise ValueError('Мод не найден')
    on_dir = os.path.join(inst, 'mods')
    off_dir = os.path.join(inst, 'mods-disabled')
    os.makedirs(on_dir, exist_ok=True)
    os.makedirs(off_dir, exist_ok=True)
    name = os.path.basename(p['file'])
    in_on, in_off = os.path.join(on_dir, name), os.path.join(off_dir, name)
    to, src = (in_on, in_off) if enabled else (in_off, in_on)
    if not os.path.exists(to):
        if not os.path.exists(src):
            raise ValueError('Файл мода не найден: ' + name)
        os.replace(src, to)
    p['enabled'] = bool(enabled)
    write_json(_rec_file(inst), rec)
    return p


def list_mods(inst):
    enrich_icons(inst)
    rec = _load_rec(inst)
    known = {os.path.basename(p['file']) for p in rec['projects'].values() if p.get('kind') == 'mod'}
    changed = False
    for d, enabled in (('mods', True), ('mods-disabled', False)):
        try:
            names = os.listdir(os.path.join(inst, d))
        except OSError:
            names = []
        for n in names:
            if not n.lower().endswith('.jar') or n in known:
                continue
            rec['projects']['file:' + n] = {'kind': 'mod', 'file': n, 'versionId': None, 'slug': None,
                                            'title': re.sub(r'\.jar$', '', n, flags=re.I), 'enabled': enabled}
            known.add(n)
            changed = True
    if changed:
        write_json(_rec_file(inst), rec)
    out = [{'id': pid, 'title': p.get('title') or p.get('file'), 'slug': p.get('slug'), 'file': p.get('file'),
            'icon': p.get('icon'), 'enabled': p.get('enabled') is not False, 'fromPack': bool(p.get('fromPack'))}
           for pid, p in rec['projects'].items() if p.get('kind') == 'mod']
    return sorted(out, key=lambda x: str(x['title']).lower())


# ---------- модпаки (.mrpack) ----------

def _meta_file(inst):
    return os.path.join(inst, 'pack.json')


def read_pack_meta(inst):
    return read_json(_meta_file(inst), None)


def _inside(base, rel):
    full = os.path.abspath(os.path.join(base, rel))
    b = os.path.abspath(base)
    return full if full == b or full.startswith(b + os.sep) else None


def _lookup_projects(hashes):
    out = {}
    if not hashes:
        return out
    try:
        by_hash = post_json(f'{API}/version_files', {'hashes': hashes, 'algorithm': 'sha1'}) or {}
        ids = list({v.get('project_id') for v in by_hash.values() if v and v.get('project_id')})
        projs = fetch_json(f'{API}/projects?ids={_enc(json.dumps(ids))}') if ids else []
        pm = {p['id']: p for p in (projs or [])}
        for h, v in by_hash.items():
            p = pm.get(v.get('project_id')) if v else None
            if p:
                out[h] = {'id': p['id'], 'slug': p.get('slug'), 'title': p.get('title'),
                          'icon': p.get('icon_url'), 'versionId': v.get('id')}
    except Exception:  # noqa: BLE001 — без сети названия остаются именами файлов
        pass
    return out


def _pick_pack_version(pid, version_id):
    lst = fetch_json(f'{API}/project/{_enc(pid)}/version')
    if not isinstance(lst, list) or not lst:
        raise ValueError('У модпака нет версий')
    if version_id:
        v = next((x for x in lst if x.get('id') == version_id), None)
        if v:
            return v
    return next((v for v in lst if v.get('version_type') == 'release'), lst[0])


def install_modpack(pid, slug, title, icon, inst, on_progress=None, version_id=None):
    """Ставит или обновляет модпак. Старые файлы прошлой версии удаляются; сохранения и свои моды остаются."""
    def say(text, pct=None):
        if on_progress:
            on_progress(text, pct)

    say('Ищу версию сборки…')
    ver = _pick_pack_version(pid, version_id)
    files = ver.get('files') or []
    file = next((f for f in files if f.get('primary')), None) or (files[0] if files else None)
    if not file:
        raise ValueError('Нет файла модпака')
    _check_url(file['url'])

    os.makedirs(inst, exist_ok=True)
    prev = read_pack_meta(inst)
    pack_path = os.path.join(inst, 'pack.mrpack')
    say('Скачиваю сборку…', 0)
    download(file['url'], pack_path, sha512=(file.get('hashes') or {}).get('sha512'),
             on_progress=lambda g, t: say('Скачиваю сборку…', g / t if t else None))

    with zipfile.ZipFile(pack_path) as zf:
        if 'modrinth.index.json' not in zf.namelist():
            raise ValueError('Это не mrpack (нет modrinth.index.json)')
        index = json.loads(zf.read('modrinth.index.json').decode('utf-8'))
        deps = index.get('dependencies') or {}
        if not deps.get('minecraft'):
            raise ValueError('В сборке не указана версия Minecraft')

        if prev and isinstance(prev.get('files'), list):
            for rel in prev['files']:
                f = _inside(inst, rel)
                if f:
                    rm_rf(f)
        rm_rf(os.path.join(inst, 'mods-disabled'))

        for name in zf.namelist():
            if name.endswith('/'):
                continue
            m = re.match(r'^(?:client-)?overrides/(.+)$', name)
            if not m:
                continue
            dest = _inside(inst, m.group(1))
            if not dest:
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as out:
                out.write(zf.read(name))

    files = [f for f in (index.get('files') or []) if f.get('path') and (f.get('env') or {}).get('client') != 'unsupported']
    installed_rel = []
    failed = []
    done = [0]

    def one(f):
        dest = _inside(inst, f['path'])
        if not dest:
            raise ValueError('Сборка содержит файл с небезопасным путём: ' + f['path'])
        urls = []
        for u in f.get('downloads') or []:
            try:
                if u.startswith('https://') and PACK_HOSTS.search(urllib.parse.urlparse(u).hostname or ''):
                    urls.append(u)
            except ValueError:
                pass
        if not urls:
            failed.append(f['path'])
            return
        ok = False
        h = f.get('hashes') or {}
        for u in urls:
            try:
                download(u, dest, sha1=h.get('sha1'), sha512=h.get('sha512'))
                ok = True
                break
            except Exception:  # noqa: BLE001 — пробуем зеркало
                pass
        if ok:
            installed_rel.append(f['path'])
        else:
            failed.append(f['path'])
        done[0] += 1
        say(f'Скачиваю файлы сборки: {done[0]} из {len(files)}', done[0] / len(files))

    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(one, files))
    if failed:
        raise ValueError(f'Не удалось скачать {len(failed)} файл(ов) сборки, например {os.path.basename(failed[0])}. Проверь интернет и повтори.')

    say('Читаю список модов…')
    mod_files = [f for f in files if re.match(r'^mods/[^/]+\.jar$', f['path'], re.I)]
    found = _lookup_projects([(f.get('hashes') or {}).get('sha1') for f in mod_files if (f.get('hashes') or {}).get('sha1')])
    rec = _load_rec(inst)
    for k in [k for k, p in rec['projects'].items() if p.get('fromPack')]:
        del rec['projects'][k]
    for f in mod_files:
        fname = os.path.basename(f['path'])
        hit = found.get((f.get('hashes') or {}).get('sha1'))
        pid2 = hit['id'] if hit else 'file:' + fname
        rec['projects'][pid2] = {'kind': 'mod', 'file': fname, 'versionId': hit['versionId'] if hit else None,
                                 'slug': hit['slug'] if hit else None,
                                 'title': hit['title'] if hit else re.sub(r'\.jar$', '', fname, flags=re.I),
                                 'icon': hit['icon'] if hit else None, 'enabled': True, 'fromPack': True}
    write_json(_rec_file(inst), rec)

    loader = ('fabric' if deps.get('fabric-loader') else 'quilt' if deps.get('quilt-loader') else
              'neoforge' if deps.get('neoforge') else 'forge' if deps.get('forge') else 'vanilla')
    loader_version = deps.get('fabric-loader') or deps.get('quilt-loader') or deps.get('neoforge') or deps.get('forge')
    meta = {
        'id': pid, 'slug': slug, 'title': title or index.get('name') or slug,
        'icon': icon or (prev or {}).get('icon'), 'mc': deps['minecraft'], 'loader': loader,
        'loaderVersion': loader_version, 'versionId': ver.get('id'),
        'versionName': ver.get('version_number') or ver.get('name') or '', 'installedAt': int(time.time() * 1000),
        'files': installed_rel,
    }
    write_json(_meta_file(inst), meta)
    try:
        os.remove(pack_path)
    except OSError:
        pass
    return {**meta, 'modCount': len(mod_files)}


def list_packs(root):
    try:
        names = os.listdir(root)
    except OSError:
        return []
    out = []
    for n in names:
        if not n.startswith('modpack-'):
            continue
        d = os.path.join(root, n)
        m = read_pack_meta(d)
        if not m:
            continue
        try:
            mod_count = len([x for x in os.listdir(os.path.join(d, 'mods')) if x.lower().endswith('.jar')])
        except OSError:
            mod_count = 0
        out.append({'id': m.get('id'), 'slug': m.get('slug'), 'title': m.get('title'), 'icon': m.get('icon'),
                    'mc': m.get('mc'), 'loader': m.get('loader'), 'loaderVersion': m.get('loaderVersion'),
                    'versionId': m.get('versionId'), 'versionName': m.get('versionName'), 'modCount': mod_count})
    return sorted(out, key=lambda x: str(x['title']).lower())


def remove_pack(d):
    if not read_pack_meta(d):
        raise ValueError('Это не папка сборки')
    rm_rf(d)


def check_pack_update(pid, inst):
    meta = read_pack_meta(inst)
    if not meta:
        raise ValueError('Сборка не найдена')
    latest = _pick_pack_version(pid, None)
    return {'available': latest.get('id') != meta.get('versionId'), 'current': meta.get('versionName'),
            'latest': latest.get('version_number') or latest.get('name') or '', 'latestId': latest.get('id')}
