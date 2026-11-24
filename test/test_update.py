import os
import tempfile
import unittest
from unittest import mock

from beluvu import update


class VersionTests(unittest.TestCase):
    def test_newer(self):
        self.assertTrue(update.is_newer('1.0.1', '1.0.0'))
        self.assertTrue(update.is_newer('1.10.0', '1.9.9'))
        self.assertFalse(update.is_newer('1.0.0', '1.0.0'))
        self.assertFalse(update.is_newer('0.9.0', '1.0.0'))

    def test_bad_version(self):
        with self.assertRaises(update.UpdateError):
            update.parse('1.0')


class DownloadTests(unittest.TestCase):
    def test_refuses_non_https(self):
        with self.assertRaises(update.UpdateError):
            update.download('http://example.com/a.exe', 'ab' * 32, 10, os.path.join(tempfile.gettempdir(), 'x.exe'))

    def test_rejects_bad_checksum(self):
        class Resp:
            def __init__(self, data): self._d = data
            def read(self, n): d, self._d = self._d, b''; return d
            def __enter__(self): return self
            def __exit__(self, *a): return False
        data = b'hello world'
        with tempfile.TemporaryDirectory() as tmp:
            dest = os.path.join(tmp, 'new.exe')
            with mock.patch('urllib.request.urlopen', return_value=Resp(data)):
                with self.assertRaises(update.UpdateError):
                    update.download('https://example.com/a.exe', '0' * 64, len(data), dest)
            self.assertFalse(os.path.exists(dest))
            self.assertFalse(os.path.exists(dest + '.part'))

    def test_accepts_matching_checksum(self):
        import hashlib
        class Resp:
            def __init__(self, data): self._d = data
            def read(self, n): d, self._d = self._d, b''; return d
            def __enter__(self): return self
            def __exit__(self, *a): return False
        data = b'exe-bytes'
        with tempfile.TemporaryDirectory() as tmp:
            dest = os.path.join(tmp, 'new.exe')
            with mock.patch('urllib.request.urlopen', return_value=Resp(data)):
                update.download('https://example.com/a.exe', hashlib.sha256(data).hexdigest(), len(data), dest)
            with open(dest, 'rb') as f:
                self.assertEqual(f.read(), data)


class ApplyTests(unittest.TestCase):
    def test_refuses_when_not_frozen(self):
        with mock.patch('sys.frozen', False, create=True):
            with self.assertRaises(update.UpdateError):
                update.apply('C:\\tmp\\new.exe')

    def test_script_replaces_and_restarts(self):
        s = update.build_script('C:\\d\\new.exe', 'C:\\g\\BeluvuLauncher.exe', 4242)
        self.assertIn('PID eq 4242', s)
        self.assertIn('move /Y "C:\\d\\new.exe" "C:\\g\\BeluvuLauncher.exe"', s)
        self.assertIn('start "" "C:\\g\\BeluvuLauncher.exe"', s)
        self.assertIn('\r\n', s)


if __name__ == '__main__':
    unittest.main()
