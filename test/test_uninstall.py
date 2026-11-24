import os
import unittest

from beluvu import uninstall


class UninstallScriptTest(unittest.TestCase):
    def test_keeps_game_when_not_asked(self):
        s = uninstall.script('C:\\data', 'C:\\app\\BeluvuLauncher.exe', 4242, remove_games=False)
        self.assertIn('taskkill /PID 4242 /F', s)
        self.assertIn('settings.json', s)
        self.assertNotIn('instances', s)
        self.assertNotIn('"C:\\data\\minecraft"', s)

    def test_removes_game_when_asked(self):
        s = uninstall.script('C:\\data', None, 1, remove_games=True)
        self.assertIn(os.path.join('C:\\data', 'instances'), s)
        self.assertIn(os.path.join('C:\\data', 'minecraft'), s)

    def test_deletes_exe_and_itself_only_when_frozen(self):
        with_exe = uninstall.script('C:\\data', 'C:\\app\\BeluvuLauncher.exe', 1, False)
        self.assertIn('del /F /Q "C:\\app\\BeluvuLauncher.exe"', with_exe)
        self.assertIn('del "%~f0"', with_exe)
        without = uninstall.script('C:\\data', None, 1, False)
        self.assertNotIn('BeluvuLauncher.exe', without)

    def test_waits_for_process_before_removing(self):
        s = uninstall.script('C:\\data', None, 77, False)
        self.assertLess(s.index('tasklist /FI "PID eq 77"'), s.index(':remove'))
        self.assertIn('if %waited% GEQ 30 goto kill', s)


if __name__ == '__main__':
    unittest.main()
