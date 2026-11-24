"""Клиент кристалликов: ключ кошелька, разбор ответов сервера и плащ. Правила наград и шансы
проверяются в базе (функции wallet_*), их тесты — в SQL, см. supabase/migrations/0001_wallet.sql."""
import io
import json
import os
import shutil
import tempfile
import unittest
import urllib.error
from unittest import mock

from beluvu import coins


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class ClientTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._old = (coins.INSTALL_DIR, coins._TOKEN)
        coins.INSTALL_DIR, coins._TOKEN = self.tmp, None

    def tearDown(self):
        coins.INSTALL_DIR, coins._TOKEN = self._old
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_wallet_key_is_stable_hex_and_per_install(self):
        k1 = coins._wallet_key()
        self.assertRegex(k1, r'^[0-9a-f]{32,64}$')
        self.assertEqual(k1, coins._wallet_key())
        coins._TOKEN = None
        os.remove(os.path.join(self.tmp, 'install.id'))
        self.assertNotEqual(k1, coins._wallet_key())      # удалили папку — новая установка, новый кошелёк

    def test_rpc_sends_key_and_returns_json(self):
        body = json.dumps({'balance': 5}).encode('utf-8')
        with mock.patch('urllib.request.urlopen', return_value=FakeResponse(body)) as op:
            out = coins.claim_daily()
        self.assertEqual(out, {'balance': 5})
        req = op.call_args[0][0]
        self.assertTrue(req.full_url.endswith('/rest/v1/rpc/wallet_claim_daily'))
        self.assertEqual(json.loads(req.data)['p_key'], coins._wallet_key())

    def test_server_message_becomes_error_text(self):
        err = urllib.error.HTTPError('u', 400, 'bad', {}, io.BytesIO(
            json.dumps({'message': 'Не хватает кристалликов'}).encode('utf-8')))
        with mock.patch('urllib.request.urlopen', side_effect=err):
            with self.assertRaisesRegex(ValueError, 'Не хватает кристалликов'):
                coins.buy_theme('red')

    def test_no_network_gives_readable_error(self):
        with mock.patch('urllib.request.urlopen', side_effect=OSError('down')):
            with self.assertRaisesRegex(ValueError, 'Нет связи'):
                coins.state()

    def test_state_keeps_ui_fields(self):
        server = {'balance': 10, 'owned': [], 'equipped': {'theme': None, 'cloak': None}, 'cases': [],
                  'freeCase': {'id': 'free'}, 'freeCases': 0, 'freeIn': 0, 'playTarget': 36000}
        with mock.patch.object(coins, '_call', return_value=server):
            s = coins.state()
        for key in ('balance', 'owned', 'equipped', 'cases', 'freeCase', 'themes', 'cloaks', 'nftCloaks',
                    'playDayMax', 'dailyMax', 'tampered'):
            self.assertIn(key, s)

    def test_every_cloak_has_a_file(self):
        for c in coins.CLOAKS:
            self.assertTrue(os.path.exists(coins.cloak_file(c['id'])), c['id'])

    def test_cloak_written_for_owner_and_removed_on_unequip(self):
        inst = os.path.join(self.tmp, 'inst')
        with mock.patch.object(coins, '_call', return_value={'equipped': {'cloak': 'creeper'}}):
            path = coins.apply_cloak(inst, 'Nick')
        self.assertTrue(path and os.path.exists(path))
        self.assertEqual(os.path.basename(os.path.dirname(path)), 'capes')
        with mock.patch.object(coins, '_call', return_value={'equipped': {'cloak': None}}):
            self.assertFalse(coins.apply_cloak(inst, 'Nick'))
        self.assertFalse(os.path.exists(path))


if __name__ == '__main__':
    unittest.main()
