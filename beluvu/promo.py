"""Промокоды: кристаллики начисляются на сервере, файлы (мод, ресурспак, сборка) качаются с GitHub
и ставятся в установку. Проверку кода, лимиты и срок делает база (promo_redeem)."""
import json
import os
import re
import shutil
import tempfile
import zipfile

from . import custom_installs, instance, paths, settings, social, update

KIND_MOD = 'mod'
KIND_PACK = 'modpack'
KIND_RES = 'resource_pack'
KIND_CRYSTALS = 'crystals'

MAX_EXTRACT = 3 * 1024 * 1024 * 1024          # сколько можно распаковать из сборки всего
PACK_DIRS = ('mods', 'config', 'resourcepacks', 'shaderpacks')
_SAFE_NAME = re.compile(r'[^A-Za-z0-9._\- ]+')


PromoError = social.SocialError


def _safe_file_name(text, fallback):
    name = _SAFE_NAME.sub('_', str(text or '')).strip(' ._')
    return (name[:80] or fallback)


def _url_name(url):
    return str(url or '').rsplit('/', 1)[-1].split('?', 1)[0]


def _ext_ok(name, exts):
    return os.path.splitext(name.lower())[1] in exts


def _download(info, dest_dir, file_name):
    url, sha, size = info.get('url'), info.get('sha256'), info.get('size')
    if not url or not sha or not size:
        raise PromoError('Файл промокода не настроен, напиши администрации')
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, file_name)
    try:
        update.download(url, sha, size, dest)
    except update.UpdateError as e:
        raise PromoError(str(e)) from None
    return dest


def _extract_pack(zip_path, target_dir):
    """Распаковка сборки. Берём только папки PACK_DIRS и ни одного пути наружу."""
    total = 0
    written = 0
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            name = info.filename.replace('\\', '/')
            if info.is_dir() or name.endswith('/'):
                continue
            parts = [p for p in name.split('/') if p not in ('', '.')]
            if not parts or any(p == '..' for p in parts) or name.startswith('/') or ':' in parts[0]:
                raise PromoError('В сборке есть небезопасный путь, она отклонена')
            if parts[0] not in PACK_DIRS:
                continue
            total += info.file_size
            if total > MAX_EXTRACT:
                raise PromoError('Сборка слишком большая для распаковки')
            dest = os.path.join(target_dir, *parts)
            real_root = os.path.realpath(target_dir)
            if not os.path.realpath(dest).startswith(real_root + os.sep):
                raise PromoError('В сборке есть небезопасный путь, она отклонена')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(info) as src, open(dest, 'wb') as out:
                shutil.copyfileobj(src, out, 1024 * 1024)
            written += 1
    return written


def _read_pack_meta(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        try:
            raw = z.read('pack.json')
        except KeyError:
            raise PromoError('В сборке нет pack.json (название, версия Minecraft, загрузчик)') from None
    try:
        meta = json.loads(raw.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        raise PromoError('pack.json в сборке повреждён') from None
    if not isinstance(meta, dict):
        raise PromoError('pack.json в сборке повреждён')
    return meta


def _install_pack(info, tmp_dir):
    zip_path = _download(info, tmp_dir, 'pack.zip')
    meta = _read_pack_meta(zip_path)
    name = str(meta.get('name') or info.get('title') or 'Сборка').strip()[:60]
    try:
        rec = custom_installs.create(name, str(meta.get('mc') or ''), str(meta.get('loader') or 'vanilla'),
                                     folder='isolated')
    except ValueError as e:
        raise PromoError(str(e)) from None
    target = custom_installs.dir_of(rec)
    _extract_pack(zip_path, target)
    return {'kind': KIND_PACK, 'name': name, 'installId': rec['id']}


def _install_file(info, s, kind):
    d = instance.dir_for(s)
    if kind == KIND_MOD:
        sub, exts = 'mods', ('.jar',)
    else:
        sub, exts = 'resourcepacks', ('.zip',)
    raw = _url_name(info.get('url'))
    file_name = _safe_file_name(raw, '') or _safe_file_name(info.get('code'), 'promo')
    if not _ext_ok(file_name, exts):
        file_name = _safe_file_name(info.get('code'), 'promo') + exts[0]
    tmp = tempfile.mkdtemp(prefix='promo-')
    try:
        tmp_file = _download(info, tmp, file_name)
        dest = os.path.join(d, sub, file_name)
        shutil.move(tmp_file, dest)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {'kind': kind, 'name': file_name, 'where': sub}


def redeem(code):
    code = str(code or '').strip()
    if not code:
        raise PromoError('Введи промокод')
    r = social._call('promo_redeem', p_code=code)
    if not r.get('ok'):
        raise PromoError(r.get('error') or 'Промокод не подошёл')
    kind = r.get('kind')
    if kind == KIND_CRYSTALS:
        return {'kind': kind, 'amount': int(r.get('amount') or 0), 'title': r.get('title') or ''}
    s = settings.get()
    tmp = tempfile.mkdtemp(prefix='promo-')
    try:
        if kind == KIND_PACK:
            return _install_pack(r, tmp)
        if kind in (KIND_MOD, KIND_RES):
            return _install_file(r, s, kind)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    raise PromoError('Неизвестный тип промокода')


def unread():
    rows = social._call('social_dm_unread') or []
    return {r['nick']: int(r.get('count') or 0) for r in rows if r.get('nick')}


def mark_read(peer):
    if not peer:
        raise PromoError('Не выбран собеседник')
    return social._ok(social._call('social_dm_mark_read', p_peer=str(peer)))


LOG_FILES = ('startup.log', 'latest.log')
LOG_TAIL_LINES = 3000


def logs_list():
    d = paths.logs()
    out = []
    for n in LOG_FILES:
        p = os.path.join(d, n)
        if os.path.isfile(p):
            out.append({'name': n, 'size': os.path.getsize(p)})
    return out


def logs_read(name):
    name = os.path.basename(str(name or 'latest.log'))
    if name not in LOG_FILES:
        raise PromoError('Этот файл логов не открываем')
    p = os.path.join(paths.logs(), name)
    if not os.path.isfile(p):
        return {'name': name, 'text': '', 'lines': 0}
    with open(p, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    tail = lines[-LOG_TAIL_LINES:]
    return {'name': name, 'text': ''.join(tail), 'lines': len(lines), 'shown': len(tail)}
