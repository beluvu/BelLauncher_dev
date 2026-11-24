import os
import tempfile
import unittest
from unittest import mock

from beluvu import coins, paths


class InstallTokenTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.data = os.path.join(self.tmp, 'data')
        self.exe_dir = os.path.join(self.tmp, 'app')
        os.makedirs(self.exe_dir)
        paths.init(self.data)
        coins._TOKEN = None

    def tearDown(self):
        coins._TOKEN = None

    def _run(self):
        with mock.patch.object(coins, '_install_dir', return_value=self.exe_dir):
            return coins._install_token()

    def test_token_created_in_data_dir_and_stable(self):
        t1 = self._run()
        self.assertTrue(os.path.isfile(os.path.join(self.data, 'install.id')))
        coins._TOKEN = None
        self.assertEqual(self._run(), t1)

    def test_legacy_token_migrated_from_exe_folder(self):
        legacy = 'a' * 32
        with open(os.path.join(self.exe_dir, 'install.id'), 'w') as f:
            f.write(legacy)
        self.assertEqual(self._run(), legacy)
        with open(os.path.join(self.data, 'install.id')) as f:
            self.assertEqual(f.read(), legacy)

    def test_new_folder_keeps_account(self):
        t1 = self._run()
        coins._TOKEN = None
        other = os.path.join(self.tmp, 'other')
        os.makedirs(other)
        with mock.patch.object(coins, '_install_dir', return_value=other):
            self.assertEqual(coins._install_token(), t1)


if __name__ == '__main__':
    unittest.main()
