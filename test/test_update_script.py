import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from beluvu import update  # noqa: E402


class UpdateScriptTest(unittest.TestCase):
    def test_script_waits_then_kills_stuck_launcher(self):
        script = update.build_script('C:\\new.exe', 'C:\\old.exe', 4242)
        self.assertIn('if %waited% GEQ 30 goto kill', script)
        self.assertIn('taskkill /PID 4242 /F', script)
        self.assertIn('move /Y "C:\\new.exe" "C:\\old.exe"', script)


if __name__ == '__main__':
    unittest.main()
