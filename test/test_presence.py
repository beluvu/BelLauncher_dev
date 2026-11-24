import json
import os
import tempfile
import unittest
from unittest import mock

from beluvu import launch, presence


class PresenceParseTest(unittest.TestCase):
    def test_server_and_single_player(self):
        self.assertEqual(presence.parse_line('[12:00:00] [Render thread/INFO]: Connecting to play.example.ru, 25565'),
                         'Сервер: play.example.ru')
        self.assertEqual(presence.parse_line('[12:00:00] [Server thread/INFO]: Starting integrated minecraft server version 1.21.1'),
                         'Одиночная игра')
        self.assertIsNone(presence.parse_line('[12:00:00] some other line'))


class AgentArgsTest(unittest.TestCase):
    def setUp(self):
        self.data = tempfile.mkdtemp()

    def test_agent_arg_points_to_config_with_token(self):
        with mock.patch('beluvu.paths.data', return_value=self.data):
            args = launch.agent_args({'friendsOverlay': True})
        self.assertEqual(len(args), 1)
        self.assertTrue(args[0].startswith('-javaagent:'))
        cfg = json.load(open(os.path.join(self.data, 'agent', 'config.json')))
        self.assertGreater(cfg['port'], 0)
        self.assertGreaterEqual(len(cfg['token']), 32)

    def test_disabled_gives_no_agent(self):
        self.assertEqual(launch.agent_args({'friendsOverlay': False}), [])


if __name__ == '__main__':
    unittest.main()
