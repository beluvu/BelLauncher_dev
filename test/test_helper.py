import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from beluvu import helper  # noqa: E402


class HelperTest(unittest.TestCase):
    def test_empty_message_is_refused_without_network(self):
        with self.assertRaises(helper.HelperError):
            helper.chat('   ')

    def test_limits_are_constants(self):
        self.assertEqual(helper.MAX_MODS, 30)
        self.assertTrue(helper._SLUG.match('sodium'))
        self.assertFalse(helper._SLUG.match('Bad Slug!'))


if __name__ == '__main__':
    unittest.main()
