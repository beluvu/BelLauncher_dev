"""Мост «интерфейс ↔ Python». Каждый метод соответствует одному каналу ipcMain из Electron-версии.

JS-сторона (web/bridge.js) называет методы так же, как старый preload: state.get → state_get и т.д.
События (прогресс, запуск, закрытие) уходят в интерфейс через window.__beluvuEmit.
"""
import json
import os
import subprocess
import sys
import threading
import time

from . import coins, helper, installs, instance, launch, modrinth, paths, promo, settings, skins, social, support_build, uninstall, update, versions
from .config import APP_VERSION, SOCIAL_ENABLED
from .util import rm_rf


class Api:
    def __init__(self):
        self._window = None
        self._maximized = False
        self._last_emit = 0.0
        self._emit_lock = threading.Lock()
        self.ui_started = False        # ставится, когда интерфейс впервые запросил состояние
        coins.start_ticker()

    # ---------- события к интерфейсу ----------

    def emit(self, ev):
        if self._window is None:
            return
        # прогресс не чаще ~8 раз в секунду, финальные события — всегда
        if ev.get('type') in ('status', 'pack') and not ev.get('done'):
            now = time.monotonic()
            with self._emit_lock:
                if now - self._last_emit < 0.12:
                    return
                self._last_emit = now
        payload = json.dumps(ev, ensure_ascii=False)
        try:
            self._window.evaluate_js(f'window.__beluvuEmit && window.__beluvuEmit({payload})')
        except Exception:  # noqa: BLE001 — окно могло закрыться
            pass

    # ---------- состояние ----------

    def state_get(self):
        self.ui_started = True
        return {
            'settings': settings.get(),
            'info': {'dataDir': paths.data(), 'version': APP_VERSION, 'social': SOCIAL_ENABLED,
                     'logFile': os.path.join(paths.logs(), 'latest.log')},
            'running': launch.is_running(),
        }

    def state_set(self, patch):
        return settings.update(patch or {})

    def versions_list(self):
        return versions.list_versions()

    # ---------- Кристаллики ----------

    def _coins(self, fn, *a):
        try:
            return {'ok': True, 'data': fn(*a)}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    def coins_state(self):
        return self._coins(coins.state)

    def coins_daily(self):
        return self._coins(coins.claim_daily)

    def coins_buy_theme(self, tid=None):
        return self._coins(coins.buy_theme, tid)

    def coins_open_case(self, cid=None):
        return self._coins(coins.open_case, cid)

    def coins_roll_free(self):
        return self._coins(coins.roll_free)

    def coins_sell_nft(self, cid=None):
        return self._coins(coins.sell_nft, cid)

    def coins_equip(self, kind=None, iid=None):
        return self._coins(coins.equip, kind, iid)

    def play_start(self):
        try:
            launch.play(self.emit)
            return {'ok': True}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    # ---------- моды ----------

    def modrinth_search(self, a):
        a = a or {}
        s = settings.get()
        return modrinth.search(kind=a.get('kind'), query=str(a.get('query') or '')[:100],
                               mc=s.get('version'), loader=s.get('loader'))

    def modrinth_install(self, a):
        a = a or {}
        s = settings.get()
        try:
            inst = instance.dir_for(s)
            os.makedirs(inst, exist_ok=True)
            kwargs = dict(kind=a.get('kind'), mc=s.get('version'), loader=s.get('loader'), inst=inst,
                          slug=a.get('slug') and str(a['slug']), title=a.get('title') and str(a['title']),
                          icon=a.get('icon') and str(a['icon']))
            done = modrinth.install(str(a.get('id')), kwargs['kind'], kwargs['mc'], kwargs['loader'],
                                    inst, kwargs['slug'], kwargs['title'], icon=kwargs['icon'])
            # мод запоминаем: при запуске другой версии подтянется, если есть сборка под неё
            if a.get('kind') == 'mod' and a.get('slug') and not s.get('selectedModpack'):
                prefs = list(s.get('preferredMods') or [])
                if str(a['slug']) not in prefs:
                    prefs.append(str(a['slug']))
                    settings.update({'preferredMods': prefs})
            return {'ok': True, 'done': done}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    # ---------- друзья: общий чат, личные сообщения, профили, новости ----------

    def _social(self, fn, *a, **k):
        try:
            return {'ok': True, 'data': fn(*a, **k)}
        except social.SocialError as e:
            return {'ok': False, 'error': str(e)}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': 'Ошибка: ' + str(e)}

    def social_me(self):
        return self._social(social.me)

    def social_build(self):
        return self._social(lambda: {'support': bool(support_build.ENABLED)})

    def social_register(self, a=None):
        return self._social(social.register, (a or {}).get('nick'))

    def social_players(self):
        return self._social(social.players)

    def social_profile(self, a=None):
        return self._social(social.profile, (a or {}).get('nick'))

    def social_nft_info(self, a=None):
        return self._social(social.nft_info, (a or {}).get('id'))

    def social_nft_send(self, a=None):
        a = a or {}
        return self._social(social.nft_send, a.get('id'), a.get('to'))

    def social_profile_set(self, a=None):
        a = a or {}
        return self._social(social.profile_set, a.get('bio'), a.get('show'))

    def social_password_set(self, a=None):
        return self._social(social.password_set, (a or {}).get('password'))

    def social_login(self, a=None):
        a = a or {}
        return self._social(social.login, a.get('nick'), a.get('password'))

    def social_nick_change(self, a=None):
        return self._social(social.nick_change, (a or {}).get('nick'))

    def update_check(self):
        try:
            return {'ok': True, 'data': update.check()}
        except update.UpdateError as e:
            return {'ok': False, 'error': str(e)}

    def app_uninstall(self, a=None):
        """Удаляет лаунчер с компьютера. Аккаунт на сервере не трогается."""
        remove_games = bool((a or {}).get('removeGames'))
        try:
            uninstall.start(remove_games)
        except OSError as e:
            return {'ok': False, 'error': 'Не получилось запустить удаление: ' + str(e)}
        if self._window is not None:
            self._window.destroy()
        threading.Timer(1.5, os._exit, args=(0,)).start()
        return {'ok': True}

    def update_install(self):
        try:
            info = update.check()
            if not info['available']:
                return {'ok': False, 'error': 'Новая версия не нужна: у тебя последняя'}
            dest = update.download(info['url'], info['sha256'], info['size'], update.new_exe_path())
            update.apply(dest)
        except update.UpdateError as e:
            return {'ok': False, 'error': str(e)}
        if self._window is not None:
            self._window.destroy()
        # Батник ждёт выхода этого процесса: выходим сами, даже если остались фоновые потоки
        import os
        import threading
        threading.Timer(1.5, os._exit, args=(0,)).start()
        return {'ok': True}

    def social_appearance_set(self, a=None):
        a = a or {}
        return self._social(social.appearance_set, a.get('avatar'), a.get('items'), a.get('all', True))

    def social_chat(self, after=None):
        return self._social(social.chat, after)

    def social_chat_send(self, text=None):
        return self._social(social.chat_send, text)

    def social_dm(self, a=None):
        a = a or {}
        return self._social(social.dm, a.get('peer'), a.get('after'))

    def social_dm_send(self, a=None):
        a = a or {}
        return self._social(social.dm_send, a.get('peer'), a.get('text'))

    def social_news(self):
        return self._social(social.news)

    def social_dm_unread(self):
        return self._social(promo.unread)

    def social_dm_mark_read(self, a=None):
        return self._social(promo.mark_read, (a or {}).get('peer'))

    def promo_redeem(self, a=None):
        return self._social(promo.redeem, (a or {}).get('code'))

    def logs_list(self):
        return self._social(promo.logs_list)

    def logs_read(self, a=None):
        return self._social(promo.logs_read, (a or {}).get('name'))

    def helper_state(self):
        return self._social(helper.state)

    def helper_buy(self):
        return self._social(helper.buy)

    def helper_history(self):
        return self._social(helper.history)

    def helper_chat(self, a=None):
        a = a or {}
        return self._social(helper.chat, a.get('text'))

    def helper_install(self, a=None):
        a = a or {}
        return self._social(helper.install_mods, a.get('mods'))

    def open_link(self, url=None):
        import webbrowser
        if str(url) not in ('https://t.me/BeluvuLauncher',):
            return {'ok': False, 'error': 'Недоступная ссылка'}
        webbrowser.open(str(url))
        return {'ok': True}

    def installs_list(self):
        return installs.list_installs(settings.get())

    def installs_select(self, key):
        return installs.select(str(key))

    def installs_create(self, a):
        a = a or {}
        try:
            rec = custom_installs.create(a.get('name'), a.get('version'), a.get('loader'), a.get('folder') or 'isolated')
        except ValueError as e:
            return {'ok': False, 'error': str(e)}
        return {'ok': True, 'data': rec}

    def installs_get(self, item_id):
        rec = custom_installs.get(str(item_id))
        if rec is None:
            return {'ok': False, 'error': 'Установка не найдена'}
        return {'ok': True, 'data': rec}

    def installs_update(self, a):
        a = a or {}
        try:
            rec = custom_installs.update(str(a.get('id')), a.get('patch') or {})
        except ValueError as e:
            return {'ok': False, 'error': str(e)}
        return {'ok': True, 'data': rec}

    def installs_duplicate(self, item_id):
        try:
            rec = custom_installs.duplicate(str(item_id))
        except ValueError as e:
            return {'ok': False, 'error': str(e)}
        return {'ok': True, 'data': rec}

    def installs_delete(self, item_id):
        try:
            custom_installs.delete(str(item_id))
        except ValueError as e:
            return {'ok': False, 'error': str(e)}
        s = settings.get()
        if s.get('selectedInstall') == str(item_id):
            settings.update({'selectedInstall': None})
        return {'ok': True}

    def installs_open(self, key):
        key = str(key)
        if key.startswith('inst:'):
            rec = custom_installs.get(key[len('inst:'):])
            if rec is None:
                return {'ok': False, 'error': 'Установка не найдена'}
            d = custom_installs.dir_of(rec)
        elif key.startswith('pack:'):
            d = instance.pack_dir(key[len('pack:'):])
        else:
            ver, loader = key[len('ver:'):].split('|', 1)
            d = paths.instance(f'{ver}-{loader}')
        os.makedirs(d, exist_ok=True)
        self._open(d)
        return {'ok': True}

    def modrinth_remove(self, a):
        modrinth.remove(str((a or {}).get('id')), instance.dir_for(settings.get()))
        return {'ok': True}

    def modrinth_installed(self):
        return modrinth.installed(instance.dir_for(settings.get()))

    def modrinth_list_mods(self):
        return modrinth.list_mods(instance.dir_for(settings.get()))

    def modrinth_set_enabled(self, a):
        a = a or {}
        try:
            p = modrinth.set_enabled(str(a.get('id')), bool(a.get('enabled')), instance.dir_for(settings.get()))
            return {'ok': True, 'mod': p}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    # ---------- сборки (модпаки) ----------

    def packs_list(self):
        return modrinth.list_packs(instance.instances_root())

    def _pack_flow(self, a, select_after):
        a = a or {}
        slug = str(a.get('slug') or 'pack')
        d = instance.pack_dir(slug)
        title = a.get('title') and str(a['title'])

        def prog(text, pct=None):
            self.emit({'type': 'pack', 'slug': slug, 'text': text, 'pct': pct})
        try:
            info = modrinth.install_modpack(str(a.get('id')), slug, title or slug, a.get('icon') and str(a['icon']), d,
                                            on_progress=prog, version_id=a.get('versionId') and str(a['versionId']))
            info = dict(info)
            info.setdefault('id', str(a.get('id')))
            info.setdefault('slug', slug)
            info['title'] = info.get('title') or a.get('title') or slug
            # мод для скинов и плащей — в каждой сборке; если не вышло, сама сборка уже установлена
            warning = None
            try:
                modrinth.ensure_custom_skin_loader(info.get('mc'), info.get('loader'), d)
            except Exception as e:  # noqa: BLE001
                warning = 'Сборка установлена, но мод для скинов и плащей не поставился: ' + str(e)
            self.emit({'type': 'pack', 'slug': slug, 'done': True})
            nxt = (settings.update({'selectedModpack': {'id': info['id'], 'slug': slug, 'title': info['title']},
                                    'version': info.get('mc'), 'loader': info.get('loader')})
                   if select_after else settings.get())
            return {'ok': True, 'settings': nxt, 'info': info, 'warning': warning}
        except Exception as e:  # noqa: BLE001
            self.emit({'type': 'pack', 'slug': slug, 'done': True, 'error': str(e)})
            return {'ok': False, 'error': str(e)}

    def packs_install(self, a):
        return self._pack_flow(a, True)

    def packs_update(self, a):
        return self._pack_flow(self._with_pack_id(a), False)

    def _with_pack_id(self, a):
        # id сборки берём с диска, если фронт его не передал
        a = dict(a or {})
        if not a.get('id') and a.get('slug'):
            meta = modrinth.read_pack_meta(instance.pack_dir(str(a['slug']))) or {}
            a['id'] = meta.get('id')
            a.setdefault('title', meta.get('title'))
        return a

    def packs_select(self, slug):
        try:
            meta = modrinth.read_pack_meta(instance.pack_dir(str(slug)))
            if not meta:
                return {'ok': False, 'error': 'Сборка не найдена'}
            return {'ok': True, 'settings': settings.update({
                'selectedModpack': {'id': meta['id'], 'slug': meta['slug'], 'title': meta['title']},
                'version': meta['mc'], 'loader': meta['loader']})}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    def packs_clear(self):
        return settings.update({'selectedModpack': None})

    def packs_remove(self, slug):
        try:
            modrinth.remove_pack(instance.pack_dir(str(slug)))
            s = settings.get()
            sm = s.get('selectedModpack')
            nxt = settings.update({'selectedModpack': None}) if (sm and sm.get('slug') == str(slug)) else s
            return {'ok': True, 'settings': nxt}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    def packs_check_update(self, a):
        a = self._with_pack_id(a)
        try:
            return {'ok': True, **modrinth.check_pack_update(str(a.get('id')), instance.pack_dir(str(a.get('slug'))))}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    def packs_open_folder(self, slug):
        d = instance.pack_dir(str(slug))
        os.makedirs(d, exist_ok=True)
        return self._open(d)

    # ---------- скины ----------

    def skins_upload(self):
        import webview
        kind = webview.FileDialog.OPEN if hasattr(webview, 'FileDialog') else webview.OPEN_DIALOG
        files = self._window.create_file_dialog(kind, allow_multiple=False, file_types=('PNG (*.png)',))
        if not files:
            return None
        try:
            entry = skins.import_file(files[0])
            return {'ok': True, 'id': entry['id'], 'settings': settings.add_upload(entry)}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    def skins_remove(self, sid):
        skins.remove(str(sid))
        return settings.remove_upload(str(sid))

    def skins_data(self, sid):
        return skins.data_url(str(sid))

    def skins_builtin(self, stype):
        return skins.builtin_data_url(str(stype), settings.get().get('version'))

    def skins_download(self, nick):
        try:
            entry = skins.download_by_nick(str(nick or ''))
            return {'ok': True, 'id': entry['id'], 'settings': settings.add_upload(entry)}
        except Exception as e:  # noqa: BLE001
            return {'ok': False, 'error': str(e)}

    # ---------- папки и окно ----------

    def _open(self, folder):
        if sys.platform == 'win32':
            os.startfile(folder)  # noqa: S606 — открываем папку в проводнике
        else:
            subprocess.Popen(['xdg-open', folder])

    def app_open_folder(self, what):
        s = settings.get()
        d = instance.dir_for(s) if what == 'game' else paths.data()
        os.makedirs(d, exist_ok=True)
        self._open(d)

    def win_min(self):
        if self._window:
            self._window.minimize()

    def win_max(self):
        if not self._window:
            return
        if self._maximized:
            self._window.restore()
        else:
            self._window.maximize()
        self._maximized = not self._maximized

    def win_close(self):
        if self._window:
            self._window.destroy()


if not SOCIAL_ENABLED:
    # Друзья выключены: убираем соцметоды из того, что pywebview отдаёт интерфейсу.
    # Так при выключенном чате мост к интерфейсу совпадает с версией до чата.
    for _name in [n for n in vars(Api) if n.startswith('social_') or n == '_social']:
        delattr(Api, _name)
