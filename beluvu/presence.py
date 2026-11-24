"""«Где играет»: лаунчер читает лог игры и сообщает друзьям сервер или одиночную игру.

Статус живёт на сервере 10 минут, поэтому пока игра запущена, он обновляется каждую минуту.
Без аккаунта друзей или с выключенной настройкой ничего не отправляется.
"""
import os
import re
import threading
import time

from . import settings, social

CONNECT = re.compile(r'Connecting to ([^,\s]+)(?:, (\d+))?')
SINGLE = re.compile(r'Starting integrated (?:minecraft )?server', re.I)
HEARTBEAT = 60


def enabled():
    return settings.get().get('showPresence') is not False


def _send(text):
    try:
        social._call('social_presence_set', p_where=text or '')
    except Exception:  # noqa: BLE001 — нет аккаунта или сети: статус необязателен
        pass


def parse_line(line):
    """Возвращает текст статуса для строки лога или None."""
    m = CONNECT.search(line)
    if m:
        host = m.group(1)
        return 'Сервер: ' + host
    if SINGLE.search(line):
        return 'Одиночная игра'
    return None


def watch(log_path, alive):
    """Следит за логом, пока alive() истинно. В конце сбрасывает статус."""
    def run():
        pos = 0
        where = 'В игре'
        sent = None
        sent_at = 0.0
        if enabled():
            _send(where)
            sent, sent_at = where, time.time()
        while alive():
            try:
                if os.path.exists(log_path):
                    with open(log_path, 'rb') as f:
                        f.seek(pos)
                        chunk = f.read()
                        pos = f.tell()
                    for line in chunk.decode('utf-8', 'replace').splitlines():
                        found = parse_line(line)
                        if found:
                            where = found
            except OSError:
                pass
            on = enabled()
            want = where if on else ''
            if on and (want != sent or time.time() - sent_at > HEARTBEAT):
                _send(want)
                sent, sent_at = want, time.time()
            elif not on and sent:
                _send('')
                sent = ''
            time.sleep(1)
        if sent:
            _send('')
    t = threading.Thread(target=run, name='beluvu-presence', daemon=True)
    t.start()
    return t
