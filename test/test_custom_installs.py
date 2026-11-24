import os
import tempfile
import unittest

from beluvu import custom_installs, paths


class CustomInstallsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        paths.init(self.tmp)

    def test_create_isolated_and_shared(self):
        a = custom_installs.create('Тест', '1.21.1', 'fabric', 'isolated')
        b = custom_installs.create('Общая', '1.21.1', 'fabric', 'shared')
        self.assertTrue(os.path.isdir(custom_installs.dir_of(a)))
        self.assertEqual(os.path.basename(custom_installs.dir_of(b)), '1.21.1-fabric')
        self.assertIn(os.path.basename(custom_installs.dir_of(a)), 'custom-' + a['id'])

    def test_rejects_bad_input(self):
        with self.assertRaises(ValueError):
            custom_installs.create('x' * 41, '1.21.1', 'fabric')
        with self.assertRaises(ValueError):
            custom_installs.create('ok', '1.21.1', 'bukkit')
        with self.assertRaises(ValueError):
            custom_installs.create('ok', '', 'fabric')

    def test_update_fields_and_limits(self):
        r = custom_installs.create('a', '1.21.1', 'fabric')
        custom_installs.update(r['id'], {'ramGb': 8, 'jvmArgs': '-XX:+UseG1GC', 'name': 'Новое'})
        got = custom_installs.get(r['id'])
        self.assertEqual((got['ramGb'], got['jvmArgs'], got['name']), (8, '-XX:+UseG1GC', 'Новое'))
        custom_installs.update(r['id'], {'ramGb': None})
        self.assertIsNone(custom_installs.get(r['id'])['ramGb'])
        with self.assertRaises(ValueError):
            custom_installs.update(r['id'], {'ramGb': 40})
        with self.assertRaises(ValueError):
            custom_installs.update(r['id'], {'jvmArgs': 'a\nb'})
        with self.assertRaises(ValueError):
            custom_installs.update(r['id'], {'javaPath': os.path.join(self.tmp, 'nope.exe')})

    def test_delete_removes_isolated_folder_but_keeps_shared(self):
        iso = custom_installs.create('iso', '1.21.1', 'fabric', 'isolated')
        sh = custom_installs.create('sh', '1.21.1', 'fabric', 'shared')
        iso_dir, sh_dir = custom_installs.dir_of(iso), custom_installs.dir_of(sh)
        custom_installs.delete(iso['id'])
        custom_installs.delete(sh['id'])
        self.assertFalse(os.path.exists(iso_dir))
        self.assertTrue(os.path.exists(sh_dir))
        self.assertIsNone(custom_installs.get(iso['id']))

    def test_duplicate_copies_mods_not_saves(self):
        src = custom_installs.create('src', '1.21.1', 'fabric', 'isolated')
        d = custom_installs.dir_of(src)
        open(os.path.join(d, 'mods', 'a.jar'), 'w').close()
        open(os.path.join(d, 'saves', 'world.dat'), 'w').close()
        copy = custom_installs.duplicate(src['id'])
        cd = custom_installs.dir_of(copy)
        self.assertTrue(os.path.exists(os.path.join(cd, 'mods', 'a.jar')))
        self.assertFalse(os.path.exists(os.path.join(cd, 'saves', 'world.dat')))
        self.assertEqual(copy['name'], 'src (копия)')


if __name__ == '__main__':
    unittest.main()
