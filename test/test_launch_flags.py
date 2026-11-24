import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from beluvu.launch import build_command, gc_flags  # noqa: E402


class LaunchFlagsTest(unittest.TestCase):
    def test_heap_is_preallocated_to_same_size(self):
        cmd = build_command({'mainClass': 'M', 'arguments': {'jvm': [], 'game': []}}, 'java', {}, 8, [])
        self.assertIn('-Xmx8G', cmd)
        self.assertIn('-Xms8G', cmd)
        self.assertNotIn('-Xms1G', cmd)

    def test_small_heap_gets_base_flags_only(self):
        flags = gc_flags(8)
        self.assertIn('-XX:+UseG1GC', flags)
        self.assertNotIn('-XX:G1HeapRegionSize=8M', flags)

    def test_large_heap_gets_region_tuning(self):
        flags = gc_flags(16)
        self.assertIn('-XX:G1HeapRegionSize=8M', flags)
        self.assertIn('-XX:+UseG1GC', flags)


if __name__ == '__main__':
    unittest.main()
