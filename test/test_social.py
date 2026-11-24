"""Друзья: клиент social.py разбирает ответы сервера и передаёт ключ кошелька."""
import io
import json
import unittest
from unittest import mock

from beluvu import coins, social


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class SocialClientTest(unittest.TestCase):
    def test_calls_send_wallet_key_and_return_server_json(self):
        body = json.dumps({'registered': False}).encode('utf-8')
        with mock.patch.object(coins, '_wallet_key', return_value='a' * 32), \
                mock.patch('urllib.request.urlopen', return_value=FakeResponse(body)) as op:
            out = social.me()
        self.assertEqual(out, {'registered': False})
        req = op.call_args[0][0]
        self.assertTrue(req.full_url.endswith('/rest/v1/rpc/social_me'))
        self.assertEqual(json.loads(req.data)['p_key'], 'a' * 32)

    def test_rejected_message_becomes_social_error(self):
        r = {'ok': False, 'error': 'Сообщение от 1 до 300 символов'}
        with mock.patch.object(coins, '_rpc', return_value=r):
            with self.assertRaisesRegex(social.SocialError, '1 до 300'):
                social.chat_send('')

    def test_server_error_text_is_passed_through(self):
        import urllib.error
        err = urllib.error.HTTPError('u', 400, 'bad', {}, io.BytesIO(
            json.dumps({'message': 'Этот ник уже занят'}).encode('utf-8')))
        with mock.patch('urllib.request.urlopen', side_effect=err):
            with self.assertRaisesRegex(ValueError, 'ник уже занят'):
                coins._rpc('social_register', p_nick='x')


if __name__ == '__main__':
    unittest.main()
