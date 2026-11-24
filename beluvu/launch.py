"""Запуск игры. Замена minecraft-launcher-core: цепочка версий, правила ОС, библиотеки, natives, ассеты, Java."""
import hashlib
import os
import re
import subprocess
import sys
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor

from . import coins, instance, java, loaders, modrinth, paths, settings, skins, versions
from .util import download, file_hash, read_json, write_json

WIN = sys.platform == 'win32'
OS_KEY = {'win32': 'windows', 'darwin': 'osx'}.get(sys.platform, 'linux')
NICK_RE = settings.NICK
LAUNCHER_NAME, LAUNCHER_VERSION = 'beluvu-launcher', '1.0.0'
ASSET_HOST = 'https://resources.download.minecraft.net'

_state = {'busy': False}
_lock = threading.Lock()


def is_running():
    return _state['busy']


def offline_uuid(name):
    """Тот же UUID, который считает оффлайн-сервер: md5("OfflinePlayer:" + ник)."""
    b = bytearray(hashlib.md5(('OfflinePlayer:' + name).encode('utf-8')).digest())
    b[6] = (b[6] & 0x0F) | 0x30
    b[8] = (b[8] & 0x3F) | 0x80
    h = b.hex()
    return f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}'


# ---------- правила и списки аргументов ----------

def rules_allow(rules):
    if not rules:
        return True
    result = False
    for r in rules:
        if 'features' in r:          # функций (демо, своё разрешение) у лаунчера нет
            continue
        os_ok = True
        o = r.get('os')
        if o:
            if 'name' in o and o['name'] != OS_KEY:
                os_ok = False
            if 'arch' in o and o['arch'] not in ('x64', 'amd64', 'x86_64'):
                os_ok = False
        if os_ok:
            result = r.get('action') == 'allow'
    return result


def resolve_args(items):
    out = []
    for a in items or []:
        if isinstance(a, str):
            out.append(a)
        elif isinstance(a, dict) and rules_allow(a.get('rules')):
            v = a.get('value')
            out.extend(v if isinstance(v, list) else [v])
    return [x for x in out if isinstance(x, str)]


def subst(text, values):
    return re.sub(r'\$\{(\w+)\}', lambda m: str(values.get(m.group(1), m.group(0))), text)


def maven_path(name):
    coords, _, ext = name.partition('@')
    ext = ext or 'jar'
    g, a, v, *rest = coords.split(':')
    classifier = rest[0] if rest else None
    base = f'{a}-{v}' + (f'-{classifier}' if classifier else '')
    return f'{g.replace(".", "/")}/{a}/{v}/{base}.{ext}'


def lib_key(name):
    parts = name.partition('@')[0].split(':')
    return ':'.join(parts[:2] + parts[3:4])


def _merge(parent, child):
    out = dict(parent)
    for k, v in child.items():
        if k not in ('libraries', 'arguments', 'minecraftArguments', 'inheritsFrom'):
            out[k] = v
    out['libraries'] = list(child.get('libraries') or []) + list(parent.get('libraries') or [])
    pa, ca = parent.get('arguments') or {}, child.get('arguments') or {}
    if pa or ca:
        out['arguments'] = {'game': list(pa.get('game') or []) + list(ca.get('game') or []),
                            'jvm': list(pa.get('jvm') or []) + list(ca.get('jvm') or [])}
    if 'minecraftArguments' in child:
        out['minecraftArguments'] = child['minecraftArguments']
    elif 'minecraftArguments' in parent:
        out['minecraftArguments'] = parent['minecraftArguments']
    out['jarId'] = parent.get('jarId') or parent.get('id')
    return out


def load_version_chain(vid):
    p = os.path.join(paths.root(), 'versions', vid, vid + '.json')
    v = read_json(p, None)
    if not v:
        raise RuntimeError('Нет файла версии ' + vid + '. Запусти игру ещё раз при подключении к интернету')
    if 'inheritsFrom' in v:
        return _merge(load_version_chain(v['inheritsFrom']), v)
    v['jarId'] = v.get('id')
    return v


# ---------- скачивание ----------

def _parallel(items, fn, workers=12, on_done=None):
    if not items:
        return
    done = [0]
    total = len(items)

    def wrap(item):
        fn(item)
        done[0] += 1
        if on_done:
            on_done(done[0], total)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for f in [ex.submit(wrap, it) for it in items]:
            f.result()


def ensure_client(vjson, on_progress=None):
    vid = vjson['id']
    d = os.path.join(paths.root(), 'versions', vid)
    os.makedirs(d, exist_ok=True)
    write_json(os.path.join(d, vid + '.json'), vjson)
    c = (vjson.get('downloads') or {}).get('client')
    if not c:
        return
    jar = os.path.join(d, vid + '.jar')
    if file_hash(jar, 'sha1') != c.get('sha1'):
        download(c['url'], jar, sha1=c.get('sha1'), on_progress=on_progress)


def prepare_libraries(vchain, natives_dir, say, status):
    lib_root = os.path.join(paths.root(), 'libraries')
    classpath, seen, todo, natives = [], set(), [], []
    for lib in vchain.get('libraries') or []:
        if not rules_allow(lib.get('rules')):
            continue
        name = lib.get('name') or ''
        downloads = lib.get('downloads') or {}
        if 'natives' in lib:                         # старые версии: natives распаковываются
            cls = (lib['natives'].get(OS_KEY) or '').replace('${arch}', '64')
            art = (downloads.get('classifiers') or {}).get(cls) if cls else None
            if art:
                natives.append((art, (lib.get('extract') or {}).get('exclude') or []))
            continue
        key = lib_key(name) if name else (downloads.get('artifact') or {}).get('path')
        if key in seen:
            continue
        seen.add(key)
        if downloads.get('artifact'):
            art = downloads['artifact']
            rel, url, sha1, size = art['path'], art.get('url'), art.get('sha1'), art.get('size')
        elif name:
            rel = maven_path(name)
            base = lib.get('url')
            url = (base.rstrip('/') + '/' + rel) if base else None
            sha1, size = lib.get('sha1'), lib.get('size')
        else:
            continue
        dest = os.path.join(lib_root, *rel.split('/'))
        classpath.append(dest)
        if not os.path.exists(dest) or (size and os.path.getsize(dest) != size):
            if url:
                todo.append((url, dest, sha1))
            elif not os.path.exists(dest):
                say('Нет файла библиотеки: ' + name)

    status('Загрузка библиотек…', 0)
    _parallel(todo, lambda t: download(t[0], t[1], sha1=t[2]),
              on_done=lambda d, t: status('Загрузка библиотек…', d / t))

    os.makedirs(natives_dir, exist_ok=True)
    for art, excludes in natives:
        dest = os.path.join(lib_root, *art['path'].split('/'))
        if not os.path.exists(dest) and art.get('url'):
            download(art['url'], dest, sha1=art.get('sha1'))
        with zipfile.ZipFile(dest) as z:
            for n in z.namelist():
                if n.endswith('/') or n.startswith('META-INF') or any(n.startswith(e) for e in excludes):
                    continue
                with open(os.path.join(natives_dir, os.path.basename(n)), 'wb') as out:
                    out.write(z.read(n))
    return classpath


def prepare_assets(vchain, status):
    ai = vchain.get('assetIndex') or {}
    if not ai:
        return None
    assets = os.path.join(paths.root(), 'assets')
    idx = os.path.join(assets, 'indexes', ai['id'] + '.json')
    if file_hash(idx, 'sha1') != ai.get('sha1'):
        download(ai['url'], idx, sha1=ai.get('sha1'))
    objects = (read_json(idx, {}) or {}).get('objects') or {}
    todo = []
    for o in objects.values():
        h = o['hash']
        dest = os.path.join(assets, 'objects', h[:2], h)
        if not os.path.exists(dest) or (o.get('size') and os.path.getsize(dest) != o['size']):
            todo.append((f'{ASSET_HOST}/{h[:2]}/{h}', dest, h))
    status('Загрузка ресурсов…', 0)
    _parallel(todo, lambda t: download(t[0], t[1], sha1=t[2]), workers=16,
              on_done=lambda d, t: status('Загрузка ресурсов…', d / t))
    return ai['id']


def logging_args(vchain):
    lg = ((vchain.get('logging') or {}).get('client')) or None
    if not lg:
        return []
    f = lg['file']
    dest = os.path.join(paths.root(), 'assets', 'log_configs', f['id'])
    if file_hash(dest, 'sha1') != f.get('sha1'):
        download(f['url'], dest, sha1=f.get('sha1'))
    return [(lg.get('argument') or '-Dlog4j.configurationFile=${path}').replace('${path}', dest)]


# ---------- запуск ----------

# Флаги сборщика мусора G1 (набор, который используют для Minecraft): меньше подвисаний и рывков.
# Xms = Xmx выделяет память сразу, игра не тратит время на её расширение.
# Java 21+ (Minecraft 1.21 и новее) поддерживает все эти флаги.
def gc_flags(ram_gb):
    base = ['-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200',
            '-XX:+DisableExplicitGC', '-XX:+PerfDisableSharedMem']
    if ram_gb < 12:
        return base
    # крупная куча: тонкая настройка регионов и молодого поколения
    return base + ['-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40',
                   '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20', '-XX:G1HeapWastePercent=5',
                   '-XX:G1MixedGCCountTarget=4', '-XX:InitiatingHeapOccupancyPercent=15',
                   '-XX:G1MixedGCLiveThresholdPercent=90', '-XX:G1RSetUpdatingPauseTimePercent=5',
                   '-XX:SurvivorRatio=32', '-XX:MaxTenuringThreshold=1']


def build_command(vchain, java_path, values, ram_gb, log_args):
    args = vchain.get('arguments') or {}
    jvm = resolve_args(args.get('jvm'))
    game = resolve_args(args.get('game'))
    if 'minecraftArguments' in vchain:
        game = vchain['minecraftArguments'].split()
    if not (args.get('jvm')):
        jvm = ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']
    jvm = [subst(a, values) for a in jvm]
    game = [subst(a, values) for a in game]
    return [java_path, f'-Xmx{ram_gb}G', f'-Xms{ram_gb}G', *gc_flags(ram_gb), *log_args, *jvm, vchain['mainClass'], *game]


def _open_log():
    d = paths.logs()
    os.makedirs(d, exist_ok=True)
    return open(os.path.join(d, 'latest.log'), 'w', encoding='utf-8', buffering=1)


def play(emit):
    with _lock:
        if _state['busy']:
            raise RuntimeError('Игра уже запускается')
        _state['busy'] = True
    log = _open_log()

    def say(text):
        try:
            log.write(text + '\n')
        except OSError:
            pass

    def status(text, pct=None):
        emit({'type': 'status', 'text': text, 'pct': pct})

    try:
        s = settings.get()
        pack = None
        if s.get('selectedModpack') and s['selectedModpack'].get('slug'):
            pack = modrinth.read_pack_meta(instance.dir_for(s))
            if not pack:
                raise RuntimeError('Сборка «' + str(s['selectedModpack'].get('title') or '') +
                                   '» не найдена на диске. Скачай её заново во вкладке «Модпаки»')
            s = {**s, 'version': pack['mc'], 'loader': pack['loader']}
        if not NICK_RE.match(str(s.get('nick') or '')):
            raise RuntimeError('Некорректный ник — поправь его в профиле')
        if not s.get('version'):
            raise RuntimeError('Сначала выбери версию')

        status('Получаю данные версии…')
        vjson = versions.version_json(s['version'])
        major = (vjson.get('javaVersion') or {}).get('majorVersion') or 8

        status(f'Проверяю Java {major}…')
        java_path = java.ensure(major, lambda g, t: status(f'Скачиваю Java {major}…', g / t if t else None))
        say('Java: ' + java_path)

        status('Проверяю клиент игры…')
        ensure_client(vjson, lambda g, t: status('Скачиваю клиент игры…', g / t if t else None))

        loader = s.get('loader')
        custom = None
        if loader and loader != 'vanilla':
            status('Устанавливаю ' + loader + '…')
            custom = loaders.ensure(loader, s['version'], {
                'loaderVersion': pack and pack.get('loaderVersion'), 'javaPath': java_path,
                'say': say, 'status': status})
            say(f'{loader}: {custom}')

        inst = instance.dir_for(s)
        os.makedirs(inst, exist_ok=True)

        if loader and loader != 'vanilla':
            try:
                status('Настраиваю скин…')
                modrinth.ensure_custom_skin_loader(s['version'], loader, inst)
                skins.apply_for_launch(s['nick'], s.get('skin'), s['version'], inst)
            except Exception as e:  # noqa: BLE001
                say('Скин не применён: ' + str(e))
            try:
                cloak = coins.apply_cloak(inst, s['nick'])
                say('Плащ: ' + (cloak if cloak else 'не выбран или файл плаща не найден'))
            except Exception as e:  # noqa: BLE001
                say('Плащ не применён: ' + str(e))
        else:
            say('Ванильный запуск: скины и плащи не работают, нужен загрузчик модов')

        # любимые моды подтягиваем только в обычную игру: в сборку ничего чужого не добавляем
        if not s.get('selectedModpack') and loader != 'vanilla':
            for slug in s.get('preferredMods') or []:
                try:
                    modrinth.install_by_slug(slug, 'mod', s['version'], loader, inst)
                except Exception as e:  # noqa: BLE001
                    say(f'Мод {slug}: {e}')

        uuid = offline_uuid(s['nick'])
        vchain = load_version_chain(custom or s['version'])
        version_name = custom or s['version']
        natives_dir = os.path.join(paths.root(), 'natives', version_name)
        classpath = prepare_libraries(vchain, natives_dir, say, status)
        jar = os.path.join(paths.root(), 'versions', vchain['jarId'], vchain['jarId'] + '.jar')
        classpath.append(jar)
        asset_index = prepare_assets(vchain, status)
        log_args = logging_args(vchain)

        assets_root = os.path.join(paths.root(), 'assets')
        values = {
            'auth_player_name': s['nick'], 'version_name': version_name, 'game_directory': inst,
            'assets_root': assets_root, 'assets_index_name': asset_index or s['version'],
            'auth_uuid': uuid, 'auth_access_token': uuid, 'auth_session': uuid, 'clientid': '', 'auth_xuid': '',
            'user_type': 'legacy', 'version_type': 'release', 'natives_directory': natives_dir,
            'launcher_name': LAUNCHER_NAME, 'launcher_version': LAUNCHER_VERSION,
            'classpath': os.pathsep.join(classpath), 'classpath_separator': os.pathsep,
            'library_directory': os.path.join(paths.root(), 'libraries'),
            'resolution_width': '854', 'resolution_height': '480', 'user_properties': '{}',
        }
        cmd = build_command(vchain, java_path, values, s.get('ramGb') or 4, log_args)
        status('Запускаю игру…')
        say('Команда: ' + ' '.join(cmd[:3]) + ' … ' + vchain['mainClass'])
        creation = 0x08000000 if WIN else 0   # CREATE_NO_WINDOW
        proc = subprocess.Popen(cmd, cwd=inst, stdin=subprocess.DEVNULL, stdout=log,
                                stderr=subprocess.STDOUT, creationflags=creation)
    except BaseException as e:
        _state['busy'] = False
        say('Ошибка: ' + str(e))
        log.close()
        raise

    emit({'type': 'started'})

    def watch():
        code = proc.wait()
        _state['busy'] = False
        say(f'Игра закрыта, код {code}')
        log.close()
        emit({'type': 'closed', 'code': code})

    threading.Thread(target=watch, daemon=True).start()
    return proc
