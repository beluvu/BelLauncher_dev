import io
import os
import tempfile
import unittest
import zipfile

from beluvu import paths, promo


def make_zip(entries):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for name, data in entries:
            z.writestr(name, data)
    path = os.path.join(tempfile.mkdtemp(), 'pack.zip')
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    return path


class ExtractPackTest(unittest.TestCase):
    def test_extracts_only_game_dirs(self):
        z = make_zip([('mods/a.jar', 'x'), ('config/c.toml', 'y'), ('pack.json', '{}'), ('readme.txt', 'z')])
        target = tempfile.mkdtemp()
        n = promo._extract_pack(z, target)
        self.assertEqual(n, 2)
        self.assertTrue(os.path.isfile(os.path.join(target, 'mods', 'a.jar')))
        self.assertTrue(os.path.isfile(os.path.join(target, 'config', 'c.toml')))
        self.assertFalse(os.path.exists(os.path.join(target, 'pack.json')))

    def test_rejects_path_traversal(self):
        z = make_zip([('mods/../../evil.jar', 'x')])
        with self.assertRaises(promo.PromoError):
            promo._extract_pack(z, tempfile.mkdtemp())

    def test_rejects_absolute_path(self):
        z = make_zip([('/mods/evil.jar', 'x')])
        with self.assertRaises(promo.PromoError):
            promo._extract_pack(z, tempfile.mkdtemp())

    def test_pack_meta_required(self):
        z = make_zip([('mods/a.jar', 'x')])
        with self.assertRaises(promo.PromoError):
            promo._read_pack_meta(z)

    def test_pack_meta_read(self):
        z = make_zip([('pack.json', '{"name": "Мой пак", "mc": "1.21.1", "loader": "fabric"}')])
        meta = promo._read_pack_meta(z)
        self.assertEqual(meta['mc'], '1.21.1')
        self.assertEqual(meta['loader'], 'fabric')


class NamesTest(unittest.TestCase):
    def test_safe_file_name_strips_bad_chars(self):
        self.assertEqual(promo._safe_file_name('../../bad name?.jar', 'x'), 'bad name_.jar')

    def test_safe_file_name_fallback(self):
        self.assertEqual(promo._safe_file_name('???', 'fallback'), 'fallback')

    def test_url_name(self):
        self.assertEqual(promo._url_name('https://github.com/a/b/releases/download/v1/mod.jar?x=1'), 'mod.jar')


class LogsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        paths.init(self.tmp)
        os.makedirs(paths.logs(), exist_ok=True)
        with open(os.path.join(paths.logs(), 'latest.log'), 'w', encoding='utf-8') as f:
            f.write(''.join(f'line {i}\n' for i in range(5000)))

    def test_tail_only(self):
        r = promo.logs_read('latest.log')
        self.assertEqual(r['lines'], 5000)
        self.assertEqual(r['shown'], promo.LOG_TAIL_LINES)
        self.assertTrue(r['text'].endswith('line 4999\n'))

    def test_whitelist_blocks_other_files(self):
        with self.assertRaises(promo.PromoError):
            promo.logs_read('../settings.json')
        with self.assertRaises(promo.PromoError):
            promo.logs_read('other.log')

    def test_missing_file_is_empty(self):
        r = promo.logs_read('startup.log')
        self.assertEqual(r['lines'], 0)
        self.assertEqual(r['text'], '')

    def test_list_shows_existing(self):
        names = [x['name'] for x in promo.logs_list()]
        self.assertEqual(names, ['latest.log'])


if __name__ == '__main__':
    unittest.main()
