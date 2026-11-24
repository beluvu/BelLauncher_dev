"""Вход по паролю: ключ аккаунта сохраняется в папке данных и заменяет ключ установки."""
import os
import tempfile
import unittest
from unittest import mock

from beluvu import coins


class AccountKeyTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.patch = mock.patch.object(coins.paths, 'data', return_value=self.dir)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def test_no_file_uses_install_key(self):
        self.assertIsNone(coins._read_account())

    def test_set_and_read_back(self):
        key = 'a1b2c3d4e5f60718293a4b5c'
        coins.set_account_key(key)
        self.assertEqual(coins._read_account(), key)
        with mock.patch.object(coins, '_read_account', return_value=key):
            self.assertEqual(coins._wallet_key(), key)

    def test_rejects_bad_key(self):
        with self.assertRaises(ValueError):
            coins.set_account_key('../../evil')
        with self.assertRaises(ValueError):
            coins.set_account_key('')
        self.assertIsNone(coins._read_account())


if __name__ == '__main__':
    unittest.main()
