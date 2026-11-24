"""Сеть, загрузка файлов с проверкой хеша, чтение/запись JSON. Только стандартная библиотека."""
import hashlib
import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request

UA = 'BeluvuLauncher/1.0.0 (contact: beluvu-launcher@local)'

try:  # certifi есть в сборке PyInstaller, но не обязателен
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _SSL = ssl.create_default_context()


class HttpError(Exception):
    pass


def _open(url, headers=None, timeout=30, data=None, method=None):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h, data=data, method=method)
    try:
        return urllib.request.urlopen(req, timeout=timeout, context=_SSL)
    except urllib.error.HTTPError as e:
        raise HttpError(f'HTTP {e.code}: {url}') from None


def fetch_json(url, headers=None, timeout=30):
    h = {'Accept': 'application/json'}
    if headers:
        h.update(headers)
    with _open(url, h, timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def post_json(url, body, timeout=30):
    data = json.dumps(body).encode('utf-8')
    h = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    with _open(url, h, timeout, data=data, method='POST') as r:
        return json.loads(r.read().decode('utf-8'))


def download(url, dest, sha1=None, sha512=None, on_progress=None, timeout=1200):
    """Качает в dest.part, сверяет хеш, потом переименовывает. on_progress(got, total)."""
    os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
    tmp = dest + '.part'
    h1 = hashlib.sha1() if sha1 else None
    h5 = hashlib.sha512() if sha512 else None
    try:
        with _open(url, None, timeout) as r, open(tmp, 'wb') as f:
            total = int(r.headers.get('Content-Length') or 0)
            got = 0
            while True:
                chunk = r.read(64 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                got += len(chunk)
                if h1:
                    h1.update(chunk)
                if h5:
                    h5.update(chunk)
                if on_progress:
                    on_progress(got, total)
    except BaseException:
        _rm(tmp)
        raise
    if h1 and h1.hexdigest() != str(sha1).lower():
        _rm(tmp)
        raise HttpError('Не совпала контрольная сумма (sha1): ' + os.path.basename(dest))
    if h5 and h5.hexdigest() != str(sha512).lower():
        _rm(tmp)
        raise HttpError('Не совпала контрольная сумма (sha512): ' + os.path.basename(dest))
    os.replace(tmp, dest)


def file_hash(path, algo):
    try:
        h = hashlib.new(algo)
        with open(path, 'rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):
                h.update(block)
        return h.hexdigest()
    except OSError:
        return None


def read_json(path, fallback=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return fallback


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _rm(path):
    try:
        os.remove(path)
    except OSError:
        pass


def rm_rf(path):
    import shutil
    if os.path.isdir(path) and not os.path.islink(path):
        shutil.rmtree(path, ignore_errors=True)
    else:
        _rm(path)


def quote(s):
    return urllib.parse.quote(str(s), safe='')
