"""Beluvu Launcher — точка входа. Окно на системном WebView2."""
import ctypes
import os
import sys
import threading
import time
import traceback


def _log(msg):
    try:
        from beluvu import paths
        paths.init()
        log_dir = paths.logs()
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, 'startup.log'), 'a', encoding='utf-8') as f:
            f.write(msg + '\n')
    except Exception:
        pass


def _single_instance():
    """Вторая копия не запускается. Если мьютекс занят — выходим."""
    if sys.platform != 'win32':
        return True
    kernel = ctypes.windll.kernel32
    kernel.CreateMutexW(None, False, 'BeluvuLauncher.SingleInstance')
    return kernel.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def _index_url():
    from beluvu import paths
    root = paths.resource_root()
    index = os.path.abspath(os.path.join(root, 'web', 'index.html'))
    if not os.path.isfile(index):
        raise FileNotFoundError(
            'Не найден интерфейс:\n' + index +
            '\n\nПересобери лаунчер (build.bat). Не удаляй папку web из сборки.'
        )
    # file:///C:/... — надёжнее для WebView2, чем сырой путь
    return 'file:///' + index.replace('\\', '/')


def _watchdog(holder):
    """Если за 30 с интерфейс не подал признаков жизни (зависло где угодно: импорты, Qt, Python API),
    сообщаем и выходим, а не висим вечно. holder['api'] появляется, когда API уже создан."""
    time.sleep(30)
    api = holder.get('api')
    if api is not None and api.ui_started:
        return
    _log('watchdog: интерфейс не ответил за 30 с, api=' + ('создан' if api else 'не создан'))
    try:
        ctypes.windll.user32.MessageBoxW(
            0,
            'Интерфейс не запустился.\n\nЗакрой все окна Beluvu Launcher и процессы msedgewebview2 в Диспетчере задач, затем запусти снова.\nЛог: %APPDATA%\\BeluvuLauncher\\logs\\startup.log',
            'Beluvu Launcher',
            0x10,
        )
    finally:
        os._exit(1)


PROBE_JS = (
    "JSON.stringify({ready: document.readyState, bridge: typeof (window.pywebview && window.pywebview.api),"
    " app: (document.getElementById('app') || {innerHTML: 'NO_APP'}).innerHTML.length,"
    " errors: (window.__errs || []).slice(0, 5)})"
)


def _attach_probe(window):
    """Пишет в startup.log, загрузилась ли страница, видит ли она мост к Python и какие JS-ошибки были.
    Нужно только для поиска причины, когда интерфейс не открывается."""
    def probe(when):
        try:
            _log(f'probe {when}: ' + str(window.evaluate_js(PROBE_JS)))
        except Exception as e:  # noqa: BLE001
            _log(f'probe {when} failed: {e!r}')

    def on_loaded():
        _log('page loaded event')
        threading.Timer(12, probe, args=('12s',)).start()

    try:
        window.events.loaded += on_loaded
    except Exception as e:  # noqa: BLE001
        _log(f'probe attach failed: {e!r}')


def main():
    holder = {'api': None}
    threading.Thread(target=_watchdog, args=(holder,), daemon=True).start()
    _log(f'main: begin pid={os.getpid()}')
    try:
        from beluvu import paths
        from beluvu.api import Api
        from beluvu import support_build
        support_build.seed_account()
        import webview
        _log('main: imports ok')

        paths.init()
        _log('start resource_root=' + paths.resource_root())
        _log('_MEIPASS=' + str(getattr(sys, '_MEIPASS', None)))
        _log('cwd=' + os.getcwd())

        if not _single_instance():
            _log('exit: already running')
            # Сообщение, чтобы не казалось, что «ничего не открылось»
            try:
                ctypes.windll.user32.MessageBoxW(
                    0,
                    'Beluvu Launcher уже запущен.\nЗакрой другое окно или заверши процесс в Диспетчере задач.',
                    'Beluvu Launcher',
                    0x40,
                )
            except Exception:
                pass
            return

        api = Api()
        holder['api'] = api
        _log('main: api created')
        url = _index_url()
        _log('url=' + url)

        window = webview.create_window(
            'Beluvu Launcher',
            url=url,
            js_api=api,
            width=1280,
            height=720,
            min_size=(1100, 640),
            frameless=True,
            easy_drag=False,
            background_color='#0D1017',
        )
        api._window = window  # с подчёркиванием: pywebview не обходит и не отдаёт интерфейсу
        _log('main: window created')
        _attach_probe(window)
        # BELUVU_DEBUG=1 — открыть DevTools (ошибки JavaScript видны в консоли)
        # Движок окна — Qt (QtWebEngine, Chromium внутри): не зависит от системного WebView2
        _log('gui=qt')
        webview.start(gui='qt', debug=os.environ.get('BELUVU_DEBUG') == '1')
    except Exception as e:
        tb = traceback.format_exc()
        _log('FATAL\n' + tb)
        try:
            ctypes.windll.user32.MessageBoxW(
                0,
                'Не удалось запустить Beluvu Launcher:\n\n' + str(e) +
                '\n\nПодробности: %APPDATA%\\BeluvuLauncher\\logs\\startup.log',
                'Beluvu Launcher — ошибка',
                0x10,
            )
        except Exception:
            pass
        raise


if __name__ == '__main__':
    main()
