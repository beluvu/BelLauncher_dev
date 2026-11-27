/* Мост интерфейса к Python (pywebview). Названия методов — см. beluvu/api.py. */
// Копим ошибки JS, чтобы Python мог записать их в startup.log (см. main.py, _attach_probe)
window.__errs = [];
window.addEventListener('error', (e) => { try { window.__errs.push(String(e.message) + ' @' + e.lineno); } catch (x) { /* ignore */ } });
window.addEventListener('unhandledrejection', (e) => { try { window.__errs.push('promise: ' + String((e.reason && e.reason.message) || e.reason)); } catch (x) { /* ignore */ } });
(() => {
  const listeners = [];
  const call = async (name, ...args) => {
    if (!(window.pywebview && window.pywebview.api)) {
      await new Promise((res) => window.addEventListener('pywebviewready', res, { once: true }));
    }
    return window.pywebview.api[name](...args);
  };
  window.__beluvuEmit = (ev) => { for (const cb of listeners) { try { cb(ev); } catch (e) { console.error(e); } } };
  window.beluvu = {
    state: { get: () => call('state_get'), set: (patch) => call('state_set', patch) },
    versions: () => call('versions_list'),
    play: () => call('play_start'),
    installs: {
      list: () => call('installs_list'), select: (key) => call('installs_select', key),
      create: (a) => call('installs_create', a), get: (id) => call('installs_get', id),
      update: (id, patch) => call('installs_update', { id, patch }), duplicate: (id) => call('installs_duplicate', id),
      delete: (id) => call('installs_delete', id), open: (key) => call('installs_open', key)
    },
    modrinth: {
      search: (a) => call('modrinth_search', a),
      install: (a) => call('modrinth_install', a),
      remove: (a) => call('modrinth_remove', a),
      installed: () => call('modrinth_installed'),
      listMods: () => call('modrinth_list_mods'),
      setEnabled: (a) => call('modrinth_set_enabled', a)
    },
    packs: {
      list: () => call('packs_list'),
      install: (a) => call('packs_install', a),
      select: (slug) => call('packs_select', slug),
      clear: () => call('packs_clear'),
      remove: (slug) => call('packs_remove', slug),
      checkUpdate: (a) => call('packs_check_update', a),
      update: (a) => call('packs_update', a),
      openFolder: (slug) => call('packs_open_folder', slug)
    },
    skins: {
      upload: () => call('skins_upload'),
      remove: (id) => call('skins_remove', id),
      data: (id) => call('skins_data', id),
      builtin: (type) => call('skins_builtin', type),
      download: (nick) => call('skins_download', nick)
    },
    update: {
      check: () => call('update_check'),
      install: () => call('update_install'),
    },
    social: {
      me: () => call('social_me'),
      build: () => call('social_build'),
      register: (nick) => call('social_register', { nick }),
      players: () => call('social_players'),
      profile: (nick) => call('social_profile', { nick }),
      profileSet: (bio, show) => call('social_profile_set', { bio, show }),
      nickChange: (nick) => call('social_nick_change', { nick }),
      passwordSet: (password) => call('social_password_set', { password }),
      login: (nick, password) => call('social_login', { nick, password }),
      appearanceSet: (avatar, items, all) => call('social_appearance_set', { avatar, items, all }),
      chat: (after) => call('social_chat', after || 0),
      chatSend: (text) => call('social_chat_send', text),
      dm: (peer, after) => call('social_dm', { peer, after: after || 0 }),
      dmSend: (peer, text) => call('social_dm_send', { peer, text }),
      nftInfo: (id) => call('social_nft_info', { id }),
      nftSend: (id, to) => call('social_nft_send', { id, to }),
      news: () => call('social_news'),
      dmUnread: () => call('social_dm_unread'),
      dmMarkRead: (peer) => call('social_dm_mark_read', { peer }),
      openLink: (url) => call('open_link', url)
    },
    helper: {
      state: () => call('helper_state'),
      buy: () => call('helper_buy'),
      history: () => call('helper_history'),
      chat: (text) => call('helper_chat', { text }),
      install: (mods) => call('helper_install', { mods })
    },
    coins: {
      state: () => call('coins_state'),
      daily: () => call('coins_daily'),
      buyTheme: (id) => call('coins_buy_theme', id),
      openCase: (id) => call('coins_open_case', id),
      rollFree: () => call('coins_roll_free'),
      sellNft: (id) => call('coins_sell_nft', id),
      equip: (kind, id) => call('coins_equip', kind, id)
    },
    promo: { redeem: (code) => call('promo_redeem', { code }) },
    logs: { list: () => call('logs_list'), read: (name) => call('logs_read', { name }) },
    openFolder: (what) => call('app_open_folder', what),
    uninstall: (removeGames) => call('app_uninstall', { removeGames }),
    win: { min: () => call('win_min'), max: () => call('win_max'), close: () => call('win_close') },
    onEvent: (cb) => { listeners.push(cb); }
  };
})();
