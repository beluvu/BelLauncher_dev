"""Проверка логики без сети: Mojang, Modrinth и Fabric подменены, данные — во временной папке.
Запуск: python -m unittest discover -s test -v   (из папки BeluvuLauncher)"""
import json
import os
import shutil
import struct
import sys
import tempfile
import unittest
import zlib
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from beluvu import paths, settings, instance, modrinth, launch, java, skins, installs, api as api_mod  # noqa: E402
from beluvu import util  # noqa: E402


def png_bytes(w, h):
    raw = b''.join(b'\x00' + b'\x00' * (w * 4) for _ in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='beluvu-test-')
        paths.init(os.path.join(self.tmp, 'data'))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestRules(unittest.TestCase):
    def test_os_rules(self):
        self.assertTrue(launch.rules_allow(None))
        win = [{'action': 'allow', 'os': {'name': 'windows'}}]
        self.assertEqual(launch.rules_allow(win), launch.OS_KEY == 'windows')
        mac_only = [{'action': 'allow', 'os': {'name': 'osx'}}]
        self.assertFalse(launch.rules_allow(mac_only))
        x86 = [{'action': 'allow', 'os': {'name': 'windows', 'arch': 'x86'}}]
        self.assertFalse(launch.rules_allow(x86))

    def test_feature_rules_are_not_applied(self):
        demo = [{'action': 'allow', 'features': {'is_demo_user': True}}]
        self.assertFalse(launch.rules_allow(demo))

    def test_maven_and_keys(self):
        self.assertEqual(launch.maven_path('org.lwjgl:lwjgl:3.3.3:natives-windows'),
                         'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar')
        self.assertEqual(launch.maven_path('net.fabricmc:fabric-loader:0.16.9'),
                         'net/fabricmc/fabric-loader/0.16.9/fabric-loader-0.16.9.jar')
        self.assertEqual(launch.lib_key('org.lwjgl:lwjgl:3.3.3:natives-windows'), 'org.lwjgl:lwjgl:natives-windows')
        self.assertEqual(launch.lib_key('com.x:y:1.0'), 'com.x:y')

    def test_offline_uuid_matches_known_value(self):
        # md5("OfflinePlayer:Notch") с битами версии 3 и варианта — по алгоритму Minecraft
        import hashlib
        b = bytearray(hashlib.md5(b'OfflinePlayer:Notch').digest())
        b[6] = (b[6] & 0x0F) | 0x30
        b[8] = (b[8] & 0x3F) | 0x80
        h = b.hex()
        self.assertEqual(launch.offline_uuid('Notch'), f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}')
        self.assertEqual(launch.offline_uuid('Notch')[14], '3')


class TestVersionChain(Base):
    def _write(self, vid, data):
        d = os.path.join(paths.root(), 'versions', vid)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, vid + '.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f)

    def test_fabric_inherits_vanilla(self):
        self._write('1.21.4', {
            'id': '1.21.4', 'mainClass': 'net.minecraft.client.main.Main',
            'assetIndex': {'id': '17', 'url': 'x', 'sha1': 'y'},
            'downloads': {'client': {'url': 'u', 'sha1': 'h'}},
            'libraries': [{'name': 'com.a:lib:1.0'}],
            'arguments': {'game': ['--username', '${auth_player_name}'],
                          'jvm': ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']}})
        self._write('fabric-loader-0.16.9-1.21.4', {
            'id': 'fabric-loader-0.16.9-1.21.4', 'inheritsFrom': '1.21.4',
            'mainClass': 'net.fabricmc.loader.impl.launch.knot.KnotClient',
            'libraries': [{'name': 'com.a:lib:2.0', 'url': 'https://maven.fabricmc.net/'}],
            'arguments': {'game': [], 'jvm': []}})
        chain = launch.load_version_chain('fabric-loader-0.16.9-1.21.4')
        self.assertEqual(chain['mainClass'], 'net.fabricmc.loader.impl.launch.knot.KnotClient')
        self.assertEqual(chain['jarId'], '1.21.4')
        self.assertEqual(chain['assetIndex']['id'], '17')
        self.assertEqual(chain['libraries'][0]['name'], 'com.a:lib:2.0')   # дочерняя версия идёт первой
        self.assertEqual(len(chain['libraries']), 2)
        cmd = launch.build_command(chain, '/j/javaw.exe', {
            'auth_player_name': 'Nick', 'natives_directory': '/n', 'classpath': 'a;b'}, 4, [])
        self.assertEqual(cmd[0], '/j/javaw.exe')
        self.assertIn('-Xmx4G', cmd)
        self.assertIn('-cp', cmd)
        self.assertIn('a;b', cmd)
        self.assertIn('Nick', cmd)
        self.assertEqual(cmd[cmd.index('--username') + 1], 'Nick')
        self.assertIn('net.fabricmc.loader.impl.launch.knot.KnotClient', cmd)

    def test_missing_version_raises(self):
        with self.assertRaises(RuntimeError):
            launch.load_version_chain('9.9.9')


class TestLibraries(Base):
    def test_prepare_libraries_builds_classpath_and_downloads_missing(self):
        vchain = {'libraries': [
            {'name': 'a:one:1', 'downloads': {'artifact': {'path': 'a/one/1/one-1.jar', 'url': 'https://h/one.jar', 'sha1': 'x'}}},
            {'name': 'a:mac:1', 'rules': [{'action': 'allow', 'os': {'name': 'osx'}}],
             'downloads': {'artifact': {'path': 'a/mac/1/mac-1.jar', 'url': 'https://h/mac.jar'}}},
            {'name': 'a:fab:1', 'url': 'https://maven.fabricmc.net/'},
        ]}
        calls = []
        with mock.patch.object(launch, 'download', lambda url, dest, **kw: calls.append((url, dest))):
            cp = launch.prepare_libraries(vchain, os.path.join(self.tmp, 'nat'), lambda t: None, lambda t, p=None: None)
        urls = [u for u, _ in calls]
        self.assertIn('https://h/one.jar', urls)
        self.assertNotIn('https://h/mac.jar', urls)
        self.assertTrue(any(u.endswith('a/fab/1/fab-1.jar') for u in urls))
        self.assertEqual(len(cp), 2)   # one и fab; mac-библиотека на Windows пропущена


class TestSettings(Base):
    def test_defaults_and_update(self):
        s = settings.get()
        self.assertRegex(s['nick'], r'^BeluvuLauncher\d{1,2}$')
        self.assertEqual(s['loader'], 'fabric')
        s = settings.update({'version': '1.21.4', 'loader': 'fabric', 'ramGb': 6})
        self.assertEqual(settings.get()['ramGb'], 6)
        with self.assertRaises(ValueError):
            settings.update({'nick': 'a b'})
        # неизвестные поля молча отбрасываются: настройки не принимают произвольный мусор
        self.assertNotIn('accentColor', settings.update({'accentColor': 'red'}))
        with open(paths.settings(), encoding='utf-8') as f:
            self.assertEqual(json.load(f)['version'], '1.21.4')
        self.assertEqual(settings.update({'theme': 'dark'})['theme'], 'dark')
        with self.assertRaises(ValueError):
            settings.update({'theme': 'neon'})


class TestModsFiles(Base):
    def test_set_enabled_and_list(self):
        inst = os.path.join(self.tmp, 'inst')
        os.makedirs(os.path.join(inst, 'mods'))
        with open(os.path.join(inst, 'mods', 'Foo-1.0.jar'), 'wb') as f:
            f.write(b'x')
        mods = modrinth.list_mods(inst)
        self.assertEqual(len(mods), 1)
        pid = mods[0]['id']
        modrinth.set_enabled(pid, False, inst)
        self.assertTrue(os.path.exists(os.path.join(inst, 'mods-disabled', 'Foo-1.0.jar')))
        modrinth.set_enabled(pid, True, inst)
        self.assertTrue(os.path.exists(os.path.join(inst, 'mods', 'Foo-1.0.jar')))


class TestSkins(Base):
    def test_validate(self):
        self.assertEqual(skins.validate(png_bytes(64, 64)), (64, 64))
        self.assertEqual(skins.validate(png_bytes(64, 32)), (64, 32))
        with self.assertRaises(ValueError):
            skins.validate(png_bytes(100, 100))
        with self.assertRaises(ValueError):
            skins.validate(b'not png at all, nope nope nope nope')


class TestJava(Base):
    def test_find_java_in_tree(self):
        base = os.path.join(self.tmp, 'jre')
        os.makedirs(os.path.join(base, 'jdk-21', 'bin'))
        exe = 'javaw.exe' if sys.platform == 'win32' else 'java'
        open(os.path.join(base, 'jdk-21', 'bin', exe), 'w').close()
        self.assertEqual(java.find_java(base), os.path.join(base, 'jdk-21', 'bin', exe))


class TestApiSmoke(Base):
    def test_state_and_catalog(self):
        a = api_mod.Api()
        st = a.state_get()
        self.assertIn('settings', st)
        self.assertFalse(st['running'])
        self.assertIsInstance(a.installs_list(), list)
        self.assertEqual(a.packs_clear()['selectedModpack'], None)


@unittest.skipIf(sys.platform == 'win32', 'поддельная java — shell-скрипт, Windows его не запускает')
class TestPlayEndToEnd(Base):
    """play() целиком: сеть подменена, Java — фейковый скрипт, который печатает аргументы и выходит."""

    def _fake_java(self):
        d = os.path.join(self.tmp, 'fakejava', 'bin')
        os.makedirs(d)
        p = os.path.join(d, 'java')
        with open(p, 'w') as f:
            f.write('#!/bin/sh\necho "ARGS:$@"\nexit 3\n')
        os.chmod(p, 0o755)
        return p

    def _vanilla(self):
        return {'id': '1.21.4', 'mainClass': 'net.minecraft.client.main.Main', 'javaVersion': {'majorVersion': 21},
                'assetIndex': {'id': '17', 'url': 'https://x/idx', 'sha1': None},
                'downloads': {'client': {'url': 'https://x/c', 'sha1': 'deadbeef'}},
                'libraries': [],
                'arguments': {'game': ['--username', '${auth_player_name}', '--gameDir', '${game_directory}'],
                              'jvm': ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']}}

    def _patches(self, java_path):
        def fake_download(url, dest, **kw):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'w') as f:
                f.write('{"objects": {}}' if url.endswith('idx') else 'x')
        return [
            mock.patch.object(launch.versions, 'version_json', lambda vid: self._vanilla()),
            mock.patch.object(launch.java, 'ensure', lambda major, cb=None: java_path),
            mock.patch.object(launch, 'download', fake_download),
            mock.patch.object(launch.skins, 'apply_for_launch', lambda *a, **k: None),
        ]

    def _run(self, emitted):
        ps = self._patches(self._fake_java())
        for p in ps:
            p.start()
            self.addCleanup(p.stop)
        launch.play(emitted.append)
        import time
        for _ in range(100):
            if not launch.is_running():
                break
            time.sleep(0.05)

    def test_vanilla_play_starts_and_reports_exit(self):
        settings.update({'version': '1.21.4', 'loader': 'vanilla'})
        emitted = []
        self._run(emitted)
        types = [e['type'] for e in emitted]
        self.assertIn('started', types)
        closed = [e for e in emitted if e['type'] == 'closed']
        self.assertEqual(closed and closed[0]['code'], 3)
        with open(os.path.join(paths.logs(), 'latest.log'), encoding='utf-8') as f:
            log = f.read()
        self.assertIn('ARGS:', log)
        self.assertIn('-Xmx4G', log)
        self.assertIn('net.minecraft.client.main.Main', log)


def write_pack(slug, pid='P1', mc='1.21.4', loader='fabric'):
    d = instance.pack_dir(slug)
    os.makedirs(os.path.join(d, 'mods'), exist_ok=True)
    with open(modrinth._meta_file(d), 'w', encoding='utf-8') as f:
        json.dump({'id': pid, 'slug': slug, 'title': slug.title(), 'mc': mc, 'loader': loader,
                   'versionId': 'v1', 'versionName': '1.0'}, f)
    return d


class TestInstalls(Base):
    def test_version_entry_is_listed_and_active(self):
        settings.update({'version': '1.21.4', 'loader': 'fabric'})
        items = installs.list_installs(settings.get())
        keys = {x['key']: x for x in items}
        self.assertIn('ver:1.21.4|fabric', keys)
        self.assertTrue(keys['ver:1.21.4|fabric']['active'])

    def test_select_version_clears_modpack(self):
        settings.update({'selectedModpack': {'id': 'P1', 'slug': 'foo', 'title': 'Foo'}})
        s = installs.select('ver:1.20.1|forge')
        self.assertIsNone(s['selectedModpack'])
        self.assertEqual((s['version'], s['loader']), ('1.20.1', 'forge'))

    def test_pack_entry_has_id_and_can_be_selected(self):
        write_pack('foo', pid='P1', mc='1.21.4', loader='fabric')
        items = installs.list_installs(settings.get())
        pack = [x for x in items if x['key'] == 'pack:foo'][0]
        self.assertEqual(pack['id'], 'P1')
        self.assertEqual(pack['kind'], 'pack')
        s = installs.select('pack:foo')
        self.assertEqual(s['selectedModpack']['slug'], 'foo')
        self.assertEqual(s['version'], '1.21.4')
        self.assertTrue([x for x in installs.list_installs(settings.get()) if x['key'] == 'pack:foo'][0]['active'])

    def test_unknown_or_missing_install_raises(self):
        with self.assertRaises(ValueError):
            installs.select('pack:nope')
        with self.assertRaises(ValueError):
            installs.select('zzz')


class TestPackUpdateId(Base):
    def test_check_update_takes_id_from_disk(self):
        write_pack('foo', pid='P1')
        seen = {}

        def fake_check(pid, d):
            seen['pid'] = pid
            return {'available': False, 'current': '1.0', 'latest': '1.0', 'latestId': 'v1'}
        with mock.patch.object(modrinth, 'check_pack_update', fake_check):
            r = api_mod.Api().packs_check_update({'slug': 'foo'})
        self.assertTrue(r['ok'])
        self.assertEqual(seen['pid'], 'P1')


class TestIcons(Base):
    def test_enrich_icons_fills_missing_icons(self):
        inst = os.path.join(self.tmp, 'inst')
        os.makedirs(inst)
        with open(modrinth._rec_file(inst), 'w', encoding='utf-8') as f:
            json.dump({'projects': {'AAA': {'title': 'A', 'file': 'a.jar', 'enabled': True}}}, f)
        with mock.patch.object(modrinth, 'fetch_json',
                               lambda url, **kw: [{'id': 'AAA', 'icon_url': 'https://cdn.example/a.png'}]):
            modrinth.enrich_icons(inst)
        rec = modrinth._load_rec(inst)
        self.assertEqual(rec['projects']['AAA']['icon'], 'https://cdn.example/a.png')

    def test_enrich_icons_without_network_is_silent(self):
        inst = os.path.join(self.tmp, 'inst2')
        os.makedirs(inst)
        with open(modrinth._rec_file(inst), 'w', encoding='utf-8') as f:
            json.dump({'projects': {'BBB': {'title': 'B', 'file': 'b.jar', 'enabled': True}}}, f)

        def boom(url, **kw):
            raise OSError('no network')
        with mock.patch.object(modrinth, 'fetch_json', boom):
            modrinth.enrich_icons(inst)   # не должно падать
        self.assertIsNone(modrinth._load_rec(inst)['projects']['BBB'].get('icon'))


if __name__ == '__main__':
    unittest.main()
