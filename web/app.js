/* Beluvu Launcher — интерфейс. Логика и данные — в Python (см. beluvu/api.py). */
const api = window.beluvu;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOADER = { vanilla: 'Vanilla', fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' };
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];
const MODRINTH = 'assets/modrinth.png';
const LOGO = 'assets/logo.png';
const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0));
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  chat: SVG('<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>'),
  users: SVG('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 016 5"/>'),
  home: SVG('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  versions: SVG('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  packs: SVG('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'),
  mods: SVG('<path d="M14 4h3a2 2 0 012 2v3a2 2 0 010 4v3a2 2 0 01-2 2h-3a2 2 0 00-4 0H7a2 2 0 01-2-2v-3a2 2 0 000-4V6a2 2 0 012-2h3a2 2 0 014 0z"/>'),
  res: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/>'),
  shaders: SVG('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/>'),
  skins: SVG('<path d="M8 3l-5 3 2 4 2-1v11h10V9l2 1 2-4-5-3-2 2h-2z"/>'),
  coin: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3 4.5-3 4.5-3-4.5z"/>'),
  settings: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  folder: SVG('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>'),
  trash: SVG('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  refresh: SVG('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>'),
  play: SVG('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  min: SVG('<path d="M5 12h14"/>'), max: SVG('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'), close: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const VIEWS = [
  ['home', tr('nav_home'), 'home'], ['friends', tr('nav_friends'), 'users'], ['news', tr('nav_news'), 'info'], ['versions', tr('nav_versions'), 'versions'], ['packs', tr('nav_packs'), 'packs'],
  ['mods', tr('nav_mods'), 'mods'], ['resourcepacks', tr('nav_resourcepacks'), 'res'], ['shaders', tr('nav_shaders'), 'shaders'],
  ['skins', tr('nav_skins'), 'skins'], ['crystals', tr('nav_crystals'), 'coin'], ['settings', tr('nav_settings'), 'settings'], ['about', tr('nav_about'), 'info'],
];
const TITLES = Object.fromEntries(VIEWS.map(([k, t]) => [k, t]));

const S = {
  st: null, info: null, installs: [], running: false, status: null, view: 'home', headUrl: null,
  vers: { list: null, loading: false, q: '', error: null, latest: null },
  pack: { tab: 'find', q: '', source: 'modrinth', onlyMc: false, items: [], loading: false, error: null, busy: {}, seq: 0, mine: null, confirm: null },
  mods: { q: '', source: 'modrinth', items: [], loading: false, error: null, busy: null, seq: 0, installed: [], installedLoading: false, filter: '', confirm: null },
  skins: { previews: {}, busy: false },
  busyPlay: false, pal: null, coins: null, crys: { tab: 'shop', spinning: false, timer: null },
};

/* ---------- утилиты ---------- */
function toast(msg, err = false) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = trMsg(msg);
  box.appendChild(el);
  setTimeout(() => el.remove(), err ? 5200 : 3000);
}
function ico(item, cls = '') {
  const letter = esc(String((item && item.title) || '?').trim().charAt(0).toUpperCase());
  const src = item && item.icon;
  return `<div class="ico ${cls}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" data-hide-err>` : letter}</div>`;
}
const fail = (r, fallback) => (r && r.error) || fallback;
async function safe(p, fallback) { try { return await p; } catch (e) { return { ok: false, error: String(e && e.message || e) }; } }

/* ---------- данные ---------- */
async function reloadState() {
  // состояние и установки запрашиваем параллельно
  const [r, inst] = await Promise.all([api.state.get(), api.installs.list().catch(() => [])]);
  S.info = r.info; S.running = r.running; S.st = r.settings; S.installs = inst;
  S.social = !!(r.info && r.info.social);
  // аккаунт друзей — сетевой запрос к серверу; не даём ему держать весь интерфейс:
  // ждём максимум 4 с, а если сервер медленный — дообновляем вкладку, когда ответ придёт
  if (!S.social) { S.acc = null; return; }
  let late = false;
  const accP = api.social.me().then((acc) => {
    S.acc = acc && acc.ok && acc.data && acc.data.registered ? acc.data : null;
  }).catch(() => { S.acc = null; }).then(() => {
    if (late && S.view === 'friends') go('friends');
  });
  const limit = new Promise((res) => setTimeout(() => { late = true; res(); }, 4000));
  await Promise.race([accP, limit]);
}
async function loadHead() {
  const sk = S.st.skin || {};
  try {
    S.headUrl = sk.type === 'custom' && sk.id ? await api.skins.data(sk.id) : await api.skins.builtin(sk.type || 'steve');
  } catch (e) { S.headUrl = null; }
  const h = $('#head');
  if (h) h.style.backgroundImage = S.headUrl ? `url('${S.headUrl}')` : 'none';
}
const activeInstall = () => S.installs.find((x) => x.active) || null;
function currentTitle() {
  const a = activeInstall();
  if (a) return a.title;
  return S.st && S.st.version ? `Minecraft ${S.st.version}` : tr('version_none');
}
function currentSub() {
  const a = activeInstall();
  const v = a ? a.version : S.st.version;
  const l = a ? a.loader : S.st.loader;
  return `${v || '—'} · ${LOADER[l] || l || '—'}${a && a.kind === 'pack' ? ` · ${tr('app_mods_count')}: ${a.mods}` : ''}`;
}

/* ---------- оболочка ---------- */
// Обновления: проверяем один раз за запуск; кнопка появляется внизу бокового меню
async function checkUpdate() {
  const r = await api.update.check().catch(() => null);
  if (r && r.ok && r.data.available) { S.upd = r.data; paintUpdate(); }
}
function paintUpdate() {
  const slot = $('#updSlot');
  if (slot) slot.innerHTML = S.upd ? `<button class="btn primary upd-btn" data-act="upd-install" title="${esc(S.upd.notes || '')}">${esc(tr('app_upd_btn', S.upd.latest))}</button>` : '';
}
async function installUpdate() {
  if (!S.upd) return;
  toast(tr('app_upd_loading', S.upd.latest));
  const r = await api.update.install().catch(() => null);
  if (!r || !r.ok) toast(r && r.error ? r.error : tr('app_upd_fail'), true);
}

function shell() {
  if (messengerOn()) return messengerShell();
  $('#app').classList.remove('msg-on');
  // «Друзья» и «Новости» показываются только когда чат включён (SOCIAL_ENABLED в config.py)
  const nav = VIEWS.filter(([k]) => S.social || (k !== 'friends' && k !== 'news')).map(([k, label, ic]) => {
    const GROUP = { home: 'grp_game', friends: 'grp_social', packs: 'grp_packs', skins: 'grp_skins' };
    const group = GROUP[k] ? `<div class="nav-label">${tr(GROUP[k])}</div>` : '';
    return group + `<button data-nav="${k}" class="${S.view === k ? 'on' : ''}">${ICON[ic]}<span>${tr('nav_' + k)}</span></button>`;
  }).join('');
  if (!S.updChecked) { S.updChecked = true; checkUpdate(); }
  $('#app').innerHTML = `
    <aside class="side">
      <div class="brand"><img src="${LOGO}" alt=""><div><b>Beluvu</b><small>Launcher</small></div></div>
      <div class="profile" data-nav="skins" title="${tr('app_profile_title')}">
        <div class="head" id="head" style="background-image:url('${S.headUrl || ''}')"></div>
        <div><div class="nm">${esc(S.acc ? S.acc.nick : S.st.nick)}</div><div class="st">${S.social && S.acc ? tr('online') : tr('offline')}</div></div>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot"><div id="updSlot"></div>Beluvu Launcher ${S.info ? esc(S.info.version) : ''}</div>
    </aside>
    <section class="main">
      <header class="topbar pywebview-drag-region">
        <h1 id="ttl"></h1><span id="badge"></span><span class="spacer"></span>
        <a class="tg-link pywebview-no-drag" data-act="fr-tg" href="#">${tr('tg_link')}</a>
        <div class="win pywebview-no-drag">
          <button data-win="min" title="${tr('win_min')}">${ICON.min}</button>
          <button data-win="max" title="${tr('win_max')}">${ICON.max}</button>
          <button data-win="close" class="x" title="${tr('win_close')}">${ICON.close}</button>
        </div>
      </header>
      <div class="content" id="content"></div>
    </section>`;
  paintUpdate();
}
function setNav() {
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === S.view && b.tagName === 'BUTTON'));
  const t = $('#ttl'); if (t) t.textContent = TITLES[S.view] ? tr('nav_' + S.view) : '';
  const b = $('#badge');
  if (b) {
    const src = S.view === 'packs' ? S.pack.source : (['mods', 'resourcepacks', 'shaders'].includes(S.view) ? S.mods.source : null);
    b.innerHTML = src ? `<span class="badge ok"><img src="${MODRINTH}" alt="Modrinth">Modrinth</span>` : '';
  }
}

/* ---------- маршруты ---------- */
const RENDER = {
  home: renderHome, friends: () => renderFriends(), news: () => renderNews(), versions: renderVersions, packs: renderPacks, mods: renderMods,
  resourcepacks: renderMods, shaders: renderMods, skins: renderSkins, crystals: renderCrystals, settings: renderSettings, about: renderAbout,
  newinstall: () => renderNewInstall(),
};
function go(view) {
  stopPolls();
  resetSocial(view);
  const was = S.view;
  S.view = view;
  // Вход в «Друзья» и выход из них меняют всю оболочку (мессенджер <-> обычный лаунчер)
  if (view === 'friends' || was === 'friends') shell();
  if (view === 'mods') S.mods.kind = 'mod';
  if (view === 'resourcepacks') S.mods.kind = 'resourcepack';
  if (view === 'shaders') S.mods.kind = 'shader';
  if (['mods', 'resourcepacks', 'shaders'].includes(view)) { S.mods.q = ''; S.mods.items = []; S.mods.error = null; S.mods.confirm = null; S.mods.filter = ''; }
  setNav();
  RENDER[view]();
  if (['mods', 'resourcepacks', 'shaders'].includes(view)) { loadInstalled(); if (!S.mods.items.length) searchMods(); }
  if (view === 'packs') { if (S.pack.tab === 'find') searchPacks(); else loadMinePacks(); }
  if (view === 'versions' && !S.vers.list && !S.vers.loading) loadVersions();
  enterView(view);
}
const content = () => $('#content');

/* ---------- главная ---------- */
function renderHome() {
  const a = activeInstall();
  const busy = S.running || S.busyPlay;
  const cards = S.installs.map((x) => `
    <div class="panel inst ${x.active ? 'on' : ''}" data-select-install="${esc(x.key)}">
      <button class="inst-more" data-inst-menu="${esc(x.key)}" title="${tr('app_actions')}" aria-label="${tr('app_actions')}">⋯</button>
      <div class="row">${ico(x, 'sm')}<div style="min-width:0"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.version)} · ${esc(LOADER[x.loader] || x.loader)}</div></div></div>
      <div class="foot"><span>${x.kind === 'pack' ? tr('app_pack') : tr('app_version')} · ${tr('app_mods_count')}: ${x.mods}</span>${x.active ? `<span class="badge ok">${tr('app_selected')}</span>` : ''}</div>
    </div>`).join('');
  content().innerHTML = `
    <div class="panel hero">
      <img class="gem" src="assets/crystal-b.png" alt="">
      <div class="info">
        <span class="badge ${S.running ? 'ok' : ''}" id="hstate">${S.running ? tr('running') : tr('ready')}</span>
        <h2>${esc(currentTitle())}</h2>
        <div class="sub">${esc(currentSub())}</div>
      </div>
      <div class="play">
        <button class="btn primary play-btn" data-act="play" ${busy || !S.st.version ? 'disabled' : ''}>${ICON.play}<span>${tr('app_play')}</span></button>
        <div class="progress ${S.status && S.status.pct == null ? 'ind' : ''}" id="prog" style="display:${S.status ? 'block' : 'none'}"><i style="width:${S.status && S.status.pct != null ? Math.round(S.status.pct * 100) : 0}%"></i></div>
        <div class="status" id="stxt">${S.status ? esc(S.status.text) : ''}</div>
      </div>
    </div>
    <div class="section-h"><h3>${tr('app_your_installs')}</h3><button class="btn small" data-nav="newinstall">${ICON.plus}<span>${tr('app_new_install')}</span></button></div>
    <div class="grid">${cards || `<div class="empty" style="grid-column:1/-1">${tr('app_no_installs')}</div>`}
      <button class="newcard" data-nav="packs"><span>${tr('app_pack_from_catalog')}</span></button></div>
    <p class="muted" style="margin-top:14px;font-size:12px">${a ? tr('app_game_folder') + ': ' + esc(a.kind === 'pack' ? tr('app_pack_lc') : tr('app_version_lc')) : ''}</p>`;
}
function updateProgressDom() {
  const p = $('#prog'); if (!p) return;
  const st = S.status;
  p.style.display = st ? 'block' : 'none';
  p.classList.toggle('ind', !!st && st.pct == null);
  const i = p.querySelector('i'); if (i) i.style.width = st && st.pct != null ? Math.round(st.pct * 100) + '%' : '0%';
  const t = $('#stxt'); if (t) t.textContent = st ? st.text : '';
  const b = $('#hstate'); if (b) { b.textContent = S.running ? tr('running') : tr('ready'); b.classList.toggle('ok', S.running); }
  const pb = document.querySelector('[data-act="play"]'); if (pb) pb.disabled = S.running || S.busyPlay || !S.st.version;
}

/* ---------- версии ---------- */
function renderVersions() {
  const v = S.vers;
  content().innerHTML = `
    <div class="toolbar">
      <div class="chips" role="group" aria-label="${tr('app_loader_aria')}">${LOADERS.map((l) => `<button class="chip ${S.st.loader === l ? 'on' : ''}" data-loader="${l}">${LOADER[l]}</button>`).join('')}</div>
      <span style="flex:1"></span>
      <input class="input" style="max-width:240px" placeholder="${tr('app_search_version')}" value="${esc(v.q)}" data-in="vq">
    </div>
    <div class="panel pad"><div id="vlist">${versionRows()}</div></div>
    <p class="muted" style="font-size:12px;margin-top:10px">${tr('app_versions_hint')}</p>`;
}
function versionRows() {
  const v = S.vers;
  if (v.loading) return `<div class="empty">${tr('app_loading_versions')}</div>`;
  if (v.error) return `<div class="empty err">${esc(v.error)}</div>`;
  if (!v.list) return `<div class="empty">${tr('app_no_data')}</div>`;
  const q = v.q.trim().toLowerCase();
  const rows = v.list.filter((x) => !q || x.id.toLowerCase().includes(q)).slice(0, 120);
  if (!rows.length) return `<div class="empty">${tr('app_nothing_found')}</div>`;
  return rows.map((x) => {
    const on = S.st.version === x.id;
    return `<div class="vrow ${on ? 'on' : ''}">
      <div><b>${esc(x.id)}</b> <span class="muted" style="font-size:12px;margin-left:8px">${esc((x.releaseTime || '').slice(0, 10))}</span></div>
      <button class="btn small ${on ? '' : 'primary'}" data-pickver="${esc(x.id)}" ${on ? 'disabled' : ''}>${on ? tr('app_pick') : tr('app_pick_btn')}</button>
    </div>`;
  }).join('');
}
async function loadVersions() {
  S.vers.loading = true; S.vers.error = null;
  if (S.view === 'versions') renderVersions();
  const r = await safe(api.versions());
  S.vers.loading = false;
  if (r && r.versions) { S.vers.list = r.versions; S.vers.latest = r.latest; }
  else { S.vers.error = tr('app_versions_load_fail'); }
  if (S.view === 'versions') { const l = $('#vlist'); if (l) l.innerHTML = versionRows(); }
}

/* ---------- модпаки ---------- */
function renderPacks() {
  const p = S.pack;
  const tabs = `<div class="tabs">
    <button class="${p.tab === 'find' ? 'on' : ''}" data-ptab="find">${tr('pk_find')}</button>
    <button class="${p.tab === 'mine' ? 'on' : ''}" data-ptab="mine">${tr('pk_mine')}</button></div>`;
  let body = '';
  if (p.tab === 'find') {
    body = `<div class="toolbar">
        <div class="chips" role="group">${srcChips()}</div>
        <span class="muted" style="font-size:12px">${tr('pk_shown_for')} ${esc(S.st.version || tr('app_version_lc'))} · ${esc(LOADER[S.st.loader] || '')}</span>
        <span style="flex:1"></span>
        <input class="input" style="max-width:300px" placeholder="${tr('pk_search')}" value="${esc(p.q)}" data-in="pq">
      </div>
      <div id="presults">${packResults()}</div>`;
  } else {
    body = `<div id="pmine">${packMine()}</div>`;
  }
  content().innerHTML = tabs + body;
}
function srcChips() {
  return `<span class="chip on"><img src="${MODRINTH}" alt="">Modrinth</span>`;
}
function packResults() {
  const p = S.pack;
  if (p.loading) return `<div class="empty">${tr('pk_searching')}</div>`;
  if (p.error) return `<div class="empty err">${esc(p.error)}</div>`;
  if (!p.items.length) return `<div class="empty">${tr('app_nothing_found')}</div>`;
  return p.items.map((x) => {
    const b = p.busy[x.slug];
    const installed = S.installs.some((i) => i.kind === 'pack' && i.key === 'pack:' + x.slug);
    return `<div class="proj">
      ${ico(x)}
      <div style="min-width:0">
        <div style="font-weight:600">${esc(x.title)} <span class="muted" style="font-weight:400;font-size:12px">${esc(x.author || '')}</span></div>
        <div class="d">${esc(x.description || '')}</div>
        <div class="m"><span class="tag">${tr('app_downloads', fmtNum(x.downloads))}</span>${(x.mc ? `<span class="tag">${esc(x.mc)}</span>` : '')}</div>
      </div>
      <div class="a">
        ${b ? `<span class="muted" style="font-size:12px">${esc(b.text || tr('app_installing'))}</span><div class="bar"><i style="width:${Math.round((b.pct || 0) * 100)}%"></i></div>`
          : `<button class="btn small primary" data-act="packinstall" data-idx="${esc(x.slug)}" ${installed ? 'disabled' : ''}>${installed ? tr('pk_installed') : tr('app_install')}</button>`}
      </div></div>`;
  }).join('');
}
function packMine() {
  const packs = S.installs.filter((i) => i.kind === 'pack');
  if (!packs.length) return `<div class="empty">${tr('pk_none_yet')}</div>`;
  return packs.map((x) => {
    const busy = S.pack.busy[x.slug];
    return `<div class="proj">
      ${ico(x)}
      <div style="min-width:0"><div style="font-weight:600">${esc(x.title)}</div>
        <div class="d">${esc(x.version)} · ${esc(LOADER[x.loader] || x.loader)} · ${tr('app_mods_count')}: ${x.mods}</div></div>
      <div class="a" style="flex-direction:row;align-items:center">
        ${x.active ? `<span class="badge ok">${tr('app_selected')}</span>` : `<button class="btn small" data-select-install="${esc(x.key)}">${tr('app_pick_btn')}</button>`}
        <button class="btn small" data-act="editpack" data-key="${esc(x.key)}">${tr('app_edit')}</button>
        <button class="btn icon" data-act="packfolder" data-slug="${esc(x.slug)}" title="${tr('pk_folder')}">${ICON.folder}</button>
        <button class="btn icon" data-act="packupd" data-slug="${esc(x.slug)}" title="${tr('pk_check_updates')}">${ICON.refresh}</button>
        <button class="btn icon danger" data-act="packdel" data-slug="${esc(x.slug)}" title="${S.pack.confirm === x.slug ? tr('pk_confirm_delete') : tr('pk_delete')}">${S.pack.confirm === x.slug ? '✓' : ICON.trash}</button>
      </div></div>${busy ? `<div class="muted" style="font-size:12px;margin:-4px 0 8px 12px">${esc(busy.text)}</div>` : ''}`;
  }).join('');
}
async function searchPacks() {
  const p = S.pack; const seq = ++p.seq;
  p.loading = true; p.error = null; p.items = [];
  if (p.tab === 'find') { const el = $('#presults'); if (el) el.innerHTML = packResults(); }
  const r = await safe(api.modrinth.search({ kind: 'modpack', query: p.q, source: p.source }));
  if (seq !== p.seq) return;
  p.loading = false;
  if (Array.isArray(r)) p.items = r;
  else p.error = tr('net_catalog_modrinth');
  const el = $('#presults'); if (el) el.innerHTML = packResults();
}
async function loadMinePacks() { await reloadInstalls(); const el = $('#pmine'); if (el) el.innerHTML = packMine(); }

/* ---------- моды / ресурспаки / шейдеры ---------- */
function renderMods() {
  const m = S.mods;
  const kindName = { mod: tr('nav_mods'), resource: tr('nav_resourcepacks'), resourcepack: tr('nav_resourcepacks'), shader: tr('nav_shaders') }[S.mods.kind];
  const a = activeInstall();
  const ph = { mod: tr('mod_search_mod'), resourcepack: tr('mod_search_res'), shader: tr('mod_search_shader') }[S.mods.kind];
  content().innerHTML = `
    <div class="split">
      <div class="col">
        <div class="panel pad">
          <div class="kicker">${tr('mod_install_kicker')}</div>
          <div style="margin-top:8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(currentTitle())}</div>
          <div class="muted" style="font-size:12px">${esc(currentSub())}</div>
          <div class="muted" style="font-size:11px;margin-top:6px">${a && a.kind === 'pack' ? tr('mod_change_in_pack') : tr('mod_pick_pack')}</div>
        </div>
        <div class="panel pad" style="flex:1;min-height:0;display:flex;flex-direction:column">
          <div class="kicker" id="instHead">${kindName} · ${tr('mod_installed_word')}</div>
          <input class="input" style="margin:10px 0" placeholder="${tr('mod_filter')}" value="${esc(m.filter)}" data-in="mfilter">
          <div class="scroll" id="installed" style="max-height:none;flex:1">${installedRows()}</div>
        </div>
      </div>
      <div class="col">
        <div class="toolbar" style="margin:0">
          <div class="chips">${srcChips()}</div>
          <span style="flex:1"></span>
          <input class="input" style="max-width:320px" placeholder="${ph}" value="${esc(m.q)}" data-in="mq">
        </div>
        <div class="scroll" id="results" style="max-height:none">${resultRows()}</div>
      </div>
    </div>`;
  setNav();
}
function installedRows() {
  const m = S.mods;
  if (m.installedLoading) return `<div class="empty">${tr('app_loading')}</div>`;
  const q = m.filter.trim().toLowerCase();
  const list = m.installed.filter((x) => !q || String(x.title || '').toLowerCase().includes(q));
  if (!list.length) return `<div class="empty">${tr('app_empty')}</div>`;
  return list.map((x) => {
    const isMod = S.mods.kind === 'mod';
    const toggle = isMod ? `<label class="switch"><input type="checkbox" data-toggle="${esc(x.id)}" ${x.enabled ? 'checked' : ''}><span></span></label>` : '';
    const del = `<button class="btn icon danger" data-act="rmmod" data-id="${esc(x.id)}" title="${tr('app_delete')}">${S.mods.confirm === x.id ? '✓' : ICON.trash}</button>`;
    return `<div class="row-item ${x.enabled === false ? 'off' : ''}">${ico(x, 'xs')}
      <div class="meta"><div class="n">${esc(x.title)}</div><div class="f">${esc(x.file || '')}</div></div>${toggle}${del}</div>`;
  }).join('');
}
function resultRows() {
  const m = S.mods;
  if (m.loading) return `<div class="empty">${tr('app_searching')}</div>`;
  if (m.error) return `<div class="empty err">${esc(m.error)}</div>`;
  if (!m.items.length) return `<div class="empty">${tr('app_nothing_found')}</div>`;
  const installedIds = new Set(m.installed.map((x) => x.id));
  return m.items.map((x) => {
    const done = installedIds.has(x.id) || installedIds.has(String(x.id));
    const busy = m.busy === x.id;
    return `<div class="proj">${ico(x)}
      <div style="min-width:0"><div style="font-weight:600">${esc(x.title)} <span class="muted" style="font-weight:400;font-size:12px">${esc(x.author || '')}</span></div>
        <div class="d">${esc(x.description || '')}</div>
        <div class="m"><span class="tag">${tr('app_downloads', fmtNum(x.downloads))}</span>${x.mc ? `<span class="tag">${esc(x.mc)}</span>` : ''}</div></div>
      <div class="a"><button class="btn small ${done ? '' : 'primary'}" data-act="minstall" data-id="${esc(x.id)}" ${done || busy ? 'disabled' : ''}>${done ? tr('mod_installed') : busy ? tr('app_installing') : tr('app_install')}</button></div></div>`;
  }).join('');
}
async function loadInstalled() {
  const m = S.mods; m.installedLoading = true;
  if (['mods', 'resourcepacks', 'shaders'].includes(S.view)) { const el = $('#installed'); if (el) el.innerHTML = installedRows(); }
  let list;
  if (S.mods.kind === 'mod') {
    const r = await safe(api.modrinth.listMods());
    list = Array.isArray(r) ? r : [];
  } else {
    const dict = await safe(api.modrinth.installed());
    list = Object.entries(dict && typeof dict === 'object' ? dict : {}).filter(([, p]) => p.kind === S.mods.kind)
      .map(([id, p]) => ({ id, title: p.title || p.file, file: p.file, icon: p.icon, enabled: true }));
  }
  m.installed = list; m.installedLoading = false;
  const el = $('#installed'); if (el) el.innerHTML = installedRows();
  const hd = $('#instHead'); if (hd) hd.textContent = `${{ mod: tr('nav_mods'), resourcepack: tr('nav_resourcepacks'), shader: tr('nav_shaders') }[S.mods.kind]} · ${tr('mod_installed_word')}: ${list.length}`;
  const rs = $('#results'); if (rs) rs.innerHTML = resultRows();
}
async function searchMods() {
  const m = S.mods; const seq = ++m.seq;
  m.loading = true; m.error = null;
  const r = await safe(api.modrinth.search({ kind: S.mods.kind, query: m.q, source: m.source }));
  if (seq !== m.seq) return;
  m.loading = false;
  if (Array.isArray(r)) m.items = r; else { m.items = []; m.error = tr('net_catalog'); }
  const rs = $('#results'); if (rs) rs.innerHTML = resultRows();
}


/* ---------- 3D превью скина: модель игрока из кубоидов, ортографическая проекция ----------
   Каждая грань текстуры рисуется аффинным преобразованием (точно для ортопроекции),
   база и слой «шапки/куртки» рисуются отдельно, затемнение — через ctx.filter (прозрачность не портится). */
const Skin3D = (() => {
  const LIGHT = (() => { const v = [0.35, 0.6, 0.75]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
  // box — [x0,x1,y0,y1,z0,z1] в пикселях скина (1 ед. = 1/16 блока), ноги от y=0, голова до y=32.
  // uv — начало развёртки кубоида (как в скине Minecraft: у головы (0,0), у тела (16,16)); over — слой поверх; swing — знак качания при ходьбе.
  const PARTS = [
    { box: [-4, 0, 0, 12, -2, 2],  uv: [0, 16],  over: [0, 32],  pivot: 12, swing: 1 },
    { box: [0, 4, 0, 12, -2, 2],   uv: [16, 48], over: [0, 48],  pivot: 12, swing: -1, legacy: [0, 16] },
    { box: [-4, 4, 12, 24, -2, 2], uv: [16, 16], over: [16, 32], pivot: null, swing: 0 },
    { box: [-8, -4, 12, 24, -2, 2], uv: [40, 16], over: [40, 32], pivot: 22, swing: -1 },
    { box: [4, 8, 12, 24, -2, 2],  uv: [32, 48], over: [48, 48], pivot: 22, swing: 1, legacy: [40, 16] },
    { box: [-4, 4, 24, 32, -4, 4], uv: [0, 0],   over: [32, 0],  pivot: null, swing: 0 },
  ];

  // Грани одного кубоида: положение в текстуре, начальный угол P0, векторы U (по ширине текстуры) и V (вниз), нормаль
  function faceSet(box, e, uv, k, mirror) {
    const x0 = box[0] - e, x1 = box[1] + e, y0 = box[2] - e, y1 = box[3] + e, z0 = box[4] - e, z1 = box[5] + e;
    const w = box[1] - box[0], h = box[3] - box[2], d = box[5] - box[4];
    const X = x1 - x0, Y = y1 - y0, Z = z1 - z0;
    const u = uv[0], v = uv[1];
    const defs = [
      [u + d, v + d, w, h, [x0, y1, z1], [X, 0, 0], [0, -Y, 0], [0, 0, 1]],        // перед
      [u + 2 * d + w, v + d, w, h, [x1, y1, z0], [-X, 0, 0], [0, -Y, 0], [0, 0, -1]], // зад
      [u, v + d, d, h, [x0, y1, z0], [0, 0, Z], [0, -Y, 0], [-1, 0, 0]],          // сторона -x
      [u + d + w, v + d, d, h, [x1, y1, z1], [0, 0, -Z], [0, -Y, 0], [1, 0, 0]],  // сторона +x
      [u + d, v, w, d, [x0, y1, z0], [X, 0, 0], [0, 0, Z], [0, 1, 0]],            // верх
      [u + d + w, v, w, d, [x0, y0, z1], [X, 0, 0], [0, 0, -Z], [0, -1, 0]],      // низ
    ];
    return defs.map(([sx, sy, sw, sh, P0, U, V, n]) => {
      let p0 = P0, uu = U;
      if (mirror) { p0 = [P0[0] + U[0], P0[1] + U[1], P0[2] + U[2]]; uu = [-U[0], -U[1], -U[2]]; }
      return { sx: sx * k, sy: sy * k, sw: sw * k, sh: sh * k, P0: p0, U: uu, V, n };
    });
  }

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  // поворот части вокруг оси X в шарнире (для ходьбы)
  function pose(p, part, a) {
    if (!part.pivot || !a) return p;
    const s = Math.sin(a), c = Math.cos(a), dy = p[1] - part.pivot;
    return [p[0], part.pivot + dy * c - p[2] * s, dy * s + p[2] * c];
  }
  function poseV(v, part, a) {
    if (!part.pivot || !a) return v;
    const s = Math.sin(a), c = Math.cos(a);
    return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  }
  // камера: поворот по yaw (вокруг Y), затем по pitch (вокруг X)
  function camera(p, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
    return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
  }

  function buildFaces(img, yaw, pitch, phase) {
    const legacy = img.height < img.width;   // старый скин 64×32
    const k = img.width / 64;
    const amp = 0.35 * Math.sin(phase);
    const out = [];
    const parts = SLIM ? PARTS.map((p, i) => (i === 3 ? { ...p, box: [-7, -4, ...p.box.slice(2)] }
      : i === 4 ? { ...p, box: [4, 7, ...p.box.slice(2)] } : p)) : PARTS;
    for (const part of parts) {
      const a = part.pivot ? amp * part.swing : 0;
      const useLegacy = legacy && !!part.legacy;
      const base = useLegacy ? faceSet(part.box, 0, part.legacy, k, true) : faceSet(part.box, 0, part.uv, k, false);
      const layers = useLegacy ? base : base.concat(faceSet(part.box, 0.5, part.over, k, false));
      for (const f of layers) {
        const pts = [f.P0, add(f.P0, f.U), add(add(f.P0, f.U), f.V), add(f.P0, f.V)];
        const cs = pts.map((p) => { const q = pose(p, part, a); return camera([q[0], q[1] - 16, q[2]], yaw, pitch); });
        const n = camera(poseV(f.n, part, a), yaw, pitch);
        if (n[2] <= 0) continue;                          // грань смотрит от камеры
        const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        out.push({ f, cs, z: (cs[0][2] + cs[1][2] + cs[2][2] + cs[3][2]) / 4, b: 0.62 + 0.38 * lit });
      }
    }
    out.sort((p, q) => p.z - q.z);                        // сначала дальние грани
    return out;
  }

  let canvas = null, ctx = null, img = null, raf = 0, yaw = 0.6, pitch = 0.12, drag = null, running = false;
  let SLIM = false;   // тонкие руки (модель Alex): рука 3 пикселя вместо 4

  function render(now) {
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, 'rgba(120,180,255,0.18)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (!img || !img.width) {
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = `${Math.round(14 * (W / 280))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tr('skin_no_texture'), W / 2, H / 2);
      return;
    }
    const S = Math.min(W / 18, H / 36);                   // пикселей на единицу модели
    const cx = W / 2, cy = H / 2;
    // тень под ногами
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 16.5 * S, 6 * S, 1.1 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const phase = now * 0.004;
    for (const it of buildFaces(img, yaw, pitch, phase)) {
      const P = it.cs.map((c) => [cx + c[0] * S, cy - c[1] * S]);
      const f = it.f;
      const O = P[0];
      ctx.filter = `brightness(${it.b.toFixed(3)})`;
      ctx.setTransform((P[1][0] - O[0]) / f.sw, (P[1][1] - O[1]) / f.sw, (P[3][0] - O[0]) / f.sh, (P[3][1] - O[1]) / f.sh, O[0], O[1]);
      ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
  }

  function tick(now) {
    if (!canvas || !canvas.isConnected) { stop(); return; }
    if (!drag) yaw += 0.006;
    render(now);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    drag = null;
    if (canvas) canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = null;
  }

  function mount(el, dataUrl, slim) {
    SLIM = !!slim;
    stop();
    canvas = el;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, Math.floor((rect.width || 280) * dpr));
    canvas.height = Math.max(280, Math.floor((rect.height || 360) * dpr));
    ctx = canvas.getContext('2d');
    img = null;
    if (dataUrl) {
      const im = new Image();
      im.onload = () => { img = im; start(); };
      im.onerror = () => { img = null; render(performance.now()); };
      im.src = dataUrl;
    } else {
      render(performance.now());
    }
    if (!dataUrl) render(performance.now());
    canvas.onpointerdown = (e) => {
      drag = { x: e.clientX, y: e.clientY, yaw, pitch };
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = (e) => {
      if (!drag) return;
      yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
      pitch = Math.max(-0.6, Math.min(0.6, drag.pitch + (e.clientY - drag.y) * 0.008));
    };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
  }

  function setSkin(dataUrl) {
    if (!canvas) return;
    const im = new Image();
    im.onload = () => { img = im; if (!running) render(performance.now()); };
    im.src = dataUrl || '';
  }

  return { mount, stop, setSkin };
})();



/* ---------- скины ---------- */
async function renderSkins() {
  const sk = S.st.skin || {};
  const uploads = S.st.uploads || [];
  content().innerHTML = `
    <div class="skins-layout">
      <div class="skins-main">
        <div class="toolbar">
          <button class="btn primary" data-act="upskin">${ICON.plus}<span>${tr('skin_upload')}</span></button>
          <div class="field" style="flex:1;max-width:360px"><input class="input" placeholder="${tr('skin_nick_ph')}" data-in="snick"><button class="btn" data-act="dlskin">${tr('skin_download')}</button></div>
        </div>
        <div class="skins" id="skins"></div>
      </div>
      <aside class="skin-preview-panel panel">
        <div class="skin-preview-title">${tr('skin_preview_3d')}</div>
        <div id="skinmodels" class="pill-row" style="justify-content:center;margin-bottom:8px"></div>
        <canvas id="skin3d" class="skin3d" width="280" height="360" title="${tr('skin_drag_title')}"></canvas>
        <div class="muted" style="font-size:12px;text-align:center;margin-top:8px">${tr('skin_drag_hint')}</div>
      </aside>
    </div>`;
  const cards = [{ id: null, type: 'steve', name: 'Steve' }, { id: null, type: 'alex', name: 'Alex' }]
    .concat(uploads.map((u) => ({ id: u.id, type: 'custom', name: u.name })));
  let selectedUrl = '';
  const html = await Promise.all(cards.map(async (c) => {
    const on = (sk.type === c.type) && (c.type !== 'custom' || sk.id === c.id);
    let img = '';
    try { img = c.type === 'custom' ? await api.skins.data(c.id) : await api.skins.builtin(c.type); } catch (e) { img = ''; }
    if (on && img) selectedUrl = img;
    return `<div class="panel skin-card ${on ? 'on' : ''}">
      <img class="skin-img" src="${img}" alt="">
      <div style="font-weight:600">${esc(c.name)}</div>
      <div class="pill-row">
        <button class="btn small ${on ? '' : 'primary'}" data-act="pickskin" data-stype="${c.type}" data-sid="${esc(c.id || '')}" ${on ? 'disabled' : ''}>${on ? tr('skin_selected') : tr('app_pick_btn')}</button>
        ${c.type === 'custom' ? `<button class="btn small danger" data-act="rmskin" data-sid="${esc(c.id)}">${S.skins.confirm === c.id ? tr('skin_sure') : tr('app_delete')}</button>` : ''}
      </div></div>`;
  }));
  const box = $('#skins'); if (box) box.innerHTML = html.join('');
  const models = $('#skinmodels');
  if (models) models.innerHTML = [['classic', tr('skin_classic')], ['slim', tr('skin_slim')]].map(([m, t]) =>
    `<button class="btn small ${(sk.model || 'classic') === m ? 'primary' : ''}" data-act="skinmodel" data-model="${m}">${t}</button>`).join('');
  const cv = $('#skin3d');
  if (cv) {
    requestAnimationFrame(() => Skin3D.mount(cv, selectedUrl || S.headUrl || '', sk.model === 'slim'));
  }
}

/* ---------- настройки и о программе ---------- */
function renderSettings() {
  const s = S.st;
  content().innerHTML = `
    <div class="panel" style="margin-bottom:14px">
      ${accountRow()}
      <div class="set-row"><div class="l"><b>${tr('set_theme')}</b><small>${tr('set_theme_sub')}</small></div>
        <div class="chips">${[['light', tr('theme_light')], ['dark', tr('theme_dark')]].map(([k, l]) => `<button class="chip ${(s.theme || 'light') === k ? 'on' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><div class="l"><b>${tr('set_lang')}</b><small>${tr('set_lang_sub')}</small></div>
        <div class="chips">${LANGS.map(([k, l]) => `<button class="chip ${LANG === k ? 'on' : ''}" data-lang-set="${k}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><div class="l"><b>${tr('presence')}</b><small>${tr('presence_sub')}</small></div>
        <div class="chips">${[[true, tr('presence_on')], [false, tr('presence_off')]].map(([v, l]) => `<button class="chip ${(s.showPresence !== false) === v ? 'on' : ''}" data-presence="${v}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><div class="l"><b>${tr('set_nick')}</b><small>${tr('set_nick_sub')}</small></div>
        <div class="field" style="max-width:300px"><input class="input" value="${esc(s.nick)}" data-in="nick"><button class="btn" data-act="savenick">${tr('save')}</button></div></div>
      <div class="set-row"><div class="l"><b>${tr('set_ram')}</b><small>${tr('set_ram_sub', s.ramGb)}</small></div>
        <div class="ram">${[2, 3, 4, 6, 8, 12].map((n) => `<button class="chip ${s.ramGb === n ? 'on' : ''}" data-ram="${n}">${n} ${tr('app_gb')}</button>`).join('')}</div></div>
    </div>
    <div class="panel">
      <div class="set-row"><div class="l"><b>${tr('set_gamedir')}</b><small>${tr('set_gamedir_sub')}</small></div><button class="btn" data-act="openfolder" data-what="game">${tr('open')}</button></div>
      <div class="set-row"><div class="l"><b>${tr('set_ldir')}</b><small>${tr('set_ldir_sub')}</small></div><button class="btn" data-act="openfolder" data-what="data">${tr('open')}</button></div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="set-row"><div class="l"><b>${tr('uninstall')}</b><small>${tr('uninstall_sub')}</small></div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <label class="check-row"><input type="checkbox" data-act="uninst-games" ${S.uninst && S.uninst.games ? 'checked' : ''}> ${tr('uninstall_games')}</label>
          <button class="btn danger" data-act="uninst">${S.uninst && S.uninst.confirm ? tr('uninstall_confirm') : tr('uninstall')}</button>
        </div></div>
    </div>${logsPanelHtml()}`;
  loadLogs();
}
function renderAbout() {
  content().innerHTML = `<div class="panel" style="padding:30px;display:flex;gap:26px;align-items:center">
    <img class="about-logo" src="${LOGO}" alt="">
    <div><h2 style="font-size:24px">Beluvu Launcher</h2>
      <div class="muted" style="margin-top:6px">${tr('about_version')} ${S.info ? esc(S.info.version) : ''}</div>
      <div class="muted" style="margin-top:12px;font-size:12px">${tr('about_sources')}</div></div></div>`;
}

/* ---------- установки ---------- */
/* ---------- Кристаллики: валюта, магазин, кейсы, палитра ---------- */
const COIN = '<img class="coin-ico" src="assets/coin.png" alt="">';
const PALETTE_VARS = ['--blue', '--blue-2', '--accent-strong', '--grad-a', '--glow', '--sky-a', '--sky-b', '--sky-c'];
const ctabs = () => [['shop', tr('crys_shop')], ['cases', tr('crys_cases')], ['items', tr('crys_items')]];
const themeById = (id) => (S.coins && S.coins.themes.find((t) => t.id === id)) || null;
const playPct = (c) => Math.min(100, Math.round((100 * c.playSec) / c.playTarget));
const playText = (c) => {
  const left = Math.max(0, c.playTarget - c.playSec);
  return tr('crys_today', c.playToday, c.playDayMax, Math.floor(left / 3600), Math.floor((left % 3600) / 60));
};

// Палитра темы: цвета акцентов, неба и оттенок кристаллов на фоне (см. bg.js)
function applyPalette(th) {
  S.pal = th || null;
  const root = document.documentElement;
  if (!th) {
    PALETTE_VARS.forEach((v) => root.style.removeProperty(v));
    delete root.dataset.palette;
  } else {
    const sky = th.sky[root.dataset.theme === 'dark' ? 'dark' : 'light'];
    const vars = { '--blue': th.accent, '--blue-2': th.accent2, '--accent-strong': th.accent2, '--grad-a': th.accent, '--glow': th.glow, '--sky-a': sky[0], '--sky-b': sky[1], '--sky-c': sky[2] };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.palette = th.id;
  }
  try { if (th) localStorage.setItem('beluvu-palette', JSON.stringify(th)); else localStorage.removeItem('beluvu-palette'); } catch (e) { /* без кэша — не страшно */ }
  if (window.BeluvuBg) window.BeluvuBg.setPalette(th ? th.hue : 0, th ? th.id : '');
}
function applyCachedPalette() {
  try { const raw = localStorage.getItem('beluvu-palette'); if (raw) applyPalette(JSON.parse(raw)); } catch (e) { /* испорченный кэш — игнорируем */ }
}
async function loadCoins() {
  const r = await safe(api.coins.state());
  if (!r || r.ok === false) return null;
  S.coins = r.data;
  applyPalette(themeById(S.coins.equipped.theme));
  return S.coins;
}
// Ежедневная награда при открытии лаунчера: тихо, один раз в день
async function dailyOnOpen() {
  const r = await safe(api.coins.daily());
  if (r && r.ok) toast(tr('crys_daily_toast', r.data.amount));
  const f = await safe(api.coins.rollFree());
  if (f && f.ok && f.data.won) toast(tr('crys_free_case'));
  await loadCoins();
  if (S.view === 'crystals') renderCrystals();
}

function renderCrystals() {
  clearInterval(S.crys.timer);
  if (!S.coins) {
    content().innerHTML = `<div class="panel" style="padding:24px"><span class="muted">${tr('crys_loading')}</span></div>`;
    loadCoins().then(() => { if (S.view === 'crystals') renderCrystals(); });
    return;
  }
  const c = S.coins;
  content().innerHTML = `
    <div class="crys">
      <div class="crys-top">
        <div class="panel crys-card">
          <div class="crys-label">${tr('crys_balance')}</div>
          <div class="crys-num">${COIN}<span id="cbal">${fmtNum(c.balance)}</span></div>
        </div>
        <div class="panel crys-card">
          <div class="crys-label">${tr('crys_daily')}</div>
          <div class="muted" style="font-size:12px">${tr('crys_daily_sub', c.streakMax, c.streak)}</div>
          <button class="btn primary" id="cdaily" data-act="cdaily" ${c.dailyAvailable ? '' : 'disabled'}>${c.dailyAvailable ? tr('crys_claim') : tr('crys_claimed')}</button>
        </div>
        <div class="panel crys-card">
          <div class="crys-label">${tr('crys_play')}</div>
          <div class="muted" style="font-size:12px">${tr('crys_play_sub', c.playPerHour, c.playDayMax)}</div>
          <div class="progress"><i id="cplay" style="width:${playPct(c)}%"></i></div>
          <div class="muted" id="cplaytxt" style="font-size:12px">${playText(c)}</div>
        </div>
      </div>
      <div class="panel promo-row">
        <input class="input" id="promo-in" maxlength="32" placeholder="${tr('promo_placeholder')}" autocomplete="off">
        <button class="btn primary" data-act="promo">${tr('promo_activate')}</button>
      </div>
      <div class="ctabs">${ctabs().map(([k, l]) => `<button class="${S.crys.tab === k ? 'on' : ''}" data-act="ctab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="cbody"></div>
    </div>`;
  paintCrysBody();
  S.crys.timer = setInterval(async () => {
    if (S.view !== 'crystals') { clearInterval(S.crys.timer); return; }
    if (S.crys.spinning) return;
    await loadCoins();
    if (S.view !== 'crystals' || S.crys.spinning) return;
    // в апгрейдере не перерисовываем тело: иначе пропадает фокус в поиске
    updateCrysTop(); paintCrysBody();
  }, 15000);
}

// Обновляем только шапку, без перерисовки (во время открытия кейса это важно)
function updateCrysTop() {
  const c = S.coins;
  if (!c) return;
  const bal = $('#cbal'); if (bal) bal.textContent = fmtNum(c.balance);
  const pl = $('#cplay'); if (pl) pl.style.width = playPct(c) + '%';
  const pt = $('#cplaytxt'); if (pt) pt.textContent = playText(c);
  const dl = $('#cdaily');
  if (dl) { dl.disabled = !c.dailyAvailable; dl.textContent = c.dailyAvailable ? tr('crys_claim') : tr('crys_claimed'); }
  document.querySelectorAll('[data-act="copen"]').forEach((b) => {
    const free = b.dataset.id === 'free';
    b.disabled = S.crys.spinning || (free ? c.freeCases <= 0 : c.balance < Number(b.dataset.price));
  });
  document.querySelectorAll('[data-act="cbuy"]').forEach((b) => { b.disabled = S.crys.spinning || c.balance < Number(b.dataset.price); });
}

const UPG_C = 2 * Math.PI * 88;
function paintCrysBody() {
  const box = $('#cbody');
  if (!box || !S.coins) return;
  const c = S.coins;
  document.querySelectorAll('[data-act="ctab"]').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.crys.tab));
  if (S.crys.tab === 'shop') box.innerHTML = shopHtml(c);
  else if (S.crys.tab === 'cases') box.innerHTML = casesHtml(c);
  else box.innerHTML = itemsHtml(c);
  updateCrysTop();
}

function shopHtml(c) {
  const cards = c.themes.map((t) => {
    const owned = c.owned.includes('theme:' + t.id);
    const on = c.equipped.theme === t.id;
    const btn = on
      ? `<button class="btn small" data-act="cequip" data-kind="theme" data-id="">${tr('crys_unequip_theme')}</button>`
      : owned
        ? `<button class="btn small primary" data-act="cequip" data-kind="theme" data-id="${esc(t.id)}">${tr('crys_apply')}</button>`
        : `<button class="btn small primary" data-act="cbuy" data-id="${esc(t.id)}" data-price="${t.price}">${COIN} ${t.price}</button>`;
    return `<div class="panel tcard">
      <div class="swatch photo" style="--a:${t.accent};--b:${t.accent2};background-image:url('assets/themes/${esc(t.id)}.jpg')"></div>
      <b>${esc(t.name)}</b>
      <div class="muted" style="font-size:12px">${on ? tr('app_selected') : owned ? tr('crys_bought') : tr('crys_theme_sub')}</div>
      ${btn}
    </div>`;
  }).join('');
  return `<div class="cgrid">${cards}
    <div class="panel tcard soon">
      <div class="swatch anim"></div>
      <b>${tr('crys_animated')}</b>
      <div class="muted" style="font-size:12px">${tr('crys_soon')}</div>
    </div>
  </div>`;
}

function casesHtml(c) {
  const f = c.freeCase || {};
  const hasFree = c.freeCases > 0;
  const freeCard = `
    <div class="panel case free-case">
      <div class="case-img"><img src="${esc(f.image || '')}" alt="" data-hide-err></div>
      <div class="case-name">${esc(f.name || tr('crys_free'))}</div>
      <div class="case-odds">${(f.odds || []).map((o) => `<div><span>${esc(o.label)}</span><b>${o.percent}%</b></div>`).join('')}</div>
      <button class="btn primary" data-act="copen" data-id="free" data-price="0" ${hasFree && !S.crys.spinning ? '' : 'disabled'}>${hasFree ? tr('crys_open_free') : tr('crys_no_free')}</button>
      <div class="muted" style="font-size:12px">${hasFree ? tr('crys_queued') + ': ' + c.freeCases : tr('crys_next_roll', Math.ceil((c.freeIn || 0) / 3600))}</div>
    </div>`;
  const cards = c.cases.map((k) => `
    <div class="panel case">
      <div class="case-img"><img src="${esc(k.image)}" alt="" data-hide-err></div>
      <div class="case-name">${esc(k.name)}</div>
      <div class="case-odds">${k.odds.map((o) => `<div><span>${esc(o.label)}</span><b>${o.percent}%</b></div>`).join('')}</div>
      <button class="btn primary" data-act="copen" data-id="${esc(k.id)}" data-price="${k.price}" ${c.balance < k.price || S.crys.spinning ? 'disabled' : ''}>${COIN} ${tr('crys_open')} · ${k.price}</button>
    </div>`).join('');
  return `<div class="opener" id="reel" hidden></div><div class="cgrid cases">${freeCard}${cards}</div>`;
}

// Подарок-NFT в инвентаре: фон + фигурка, клик открывает превью (владелец, цена, ссылка, отправка)
function giftCardHtml(g) {
  return `
    <button class="panel tcard nft gift-card" data-act="fr-nft" data-id="${Number(g.id)}">
      <div class="gift-prev"><img class="nft-bg" src="assets/nft/${esc(g.bg)}.png" alt="" data-hide-err><img class="nft-fig" src="assets/nft/fig/${esc(g.family)}-v${Number(g.variant) || 1}.png" alt="" data-hide-err></div>
      <b>${esc(g.name)} #${Number(g.id)}</b>
      <div class="muted" style="font-size:12px"><span class="badge ok">NFT</span> ${esc(g.bgName || '')} · ${fmtNum(g.value)} ${tr('crys_short_cr')}</div>
    </button>`;
}
function itemsHtml(c) {
  const owned = c.cloaks.filter((k) => c.owned.includes('cloak:' + k.id));
  const collectCards = (c.gifts || []).map(giftCardHtml);
  const nft = owned.filter((k) => k.nft).map((k) => `
    <div class="panel tcard nft">
      <div class="cape-prev" style="background-image:url('assets/cloak-previews/${esc(k.id)}.png')"></div>
      <b>${esc(k.name)}</b><div class="muted" style="font-size:12px"><span class="badge ok">NFT</span> ${tr('crys_kind_cloak')}</div>
      ${c.equipped.cloak === k.id
        ? `<button class="btn small" data-act="cequip" data-kind="cloak" data-id="">${tr('crys_unequip_cloak')}</button>`
        : `<button class="btn small primary" data-act="cequip" data-kind="cloak" data-id="${esc(k.id)}">${tr('crys_wear')}</button>`}
    </div>`);
  const themes = c.themes.filter((t) => c.owned.includes('theme:' + t.id)).map((t) => `
    <div class="panel tcard">
      <div class="swatch photo" style="--a:${t.accent};--b:${t.accent2};background-image:url('assets/themes/${esc(t.id)}.jpg')"></div>
      <b>${esc(t.name)}</b><div class="muted" style="font-size:12px">${tr('crys_kind_theme')}</div>
      ${c.equipped.theme === t.id
        ? `<button class="btn small" data-act="cequip" data-kind="theme" data-id="">${tr('crys_take_off')}</button>`
        : `<button class="btn small primary" data-act="cequip" data-kind="theme" data-id="${esc(t.id)}">${tr('crys_apply')}</button>`}
    </div>`);
  const cloaks = owned.filter((k) => !k.nft).map((k) => `
    <div class="panel tcard">
      <div class="cape-prev" style="background-image:url('assets/cloak-previews/${esc(k.id)}.png')"></div>
      <b>${esc(k.name)}</b><div class="muted" style="font-size:12px">${tr('crys_kind_cloak')}</div>
      ${c.equipped.cloak === k.id
        ? `<button class="btn small" data-act="cequip" data-kind="cloak" data-id="">${tr('crys_unequip_cloak')}</button>`
        : `<button class="btn small primary" data-act="cequip" data-kind="cloak" data-id="${esc(k.id)}">${tr('crys_wear')}</button>`}
    </div>`);
  if (!collectCards.length && !nft.length && !themes.length && !cloaks.length) return `<div class="panel" style="padding:24px"><span class="muted">${tr('crys_empty')}</span></div>`;
  return `<div class="cgrid">${collectCards.join('')}${nft.join('')}${themes.join('')}${cloaks.join('')}</div>
    <p class="muted" style="font-size:12px;margin-top:12px">${tr('crys_cloak_only')}</p>`;
}

async function crysAct(act, a) {
  if (!['ctab', 'cdaily', 'cbuy', 'cequip', 'copen', 'csell', 'promo'].includes(act)) return false;
  if (act === 'ctab') { S.crys.tab = a.dataset.tab; paintCrysBody(); return true; }
  if (S.crys.spinning) { toast(tr('crys_wait_case'), true); return true; }
  if (act === 'promo') {
    const inp = $('#promo-in');
    const r = await safe(api.promo.redeem(inp ? inp.value.trim() : ''));
    if (!r || !r.ok) { toast(fail(r, tr('promo_bad')), true); return true; }
    if (inp) inp.value = '';
    toast(promoText(r.data));
    if (r.data.kind !== 'crystals') reloadState();
  } else if (act === 'cdaily') {
    const r = await safe(api.coins.daily());
    if (!r || !r.ok) toast(fail(r, tr('err_failed')), true); else toast(tr('crys_plus_amount', r.data.amount));
  } else if (act === 'cbuy') {
    const r = await safe(api.coins.buyTheme(a.dataset.id));
    if (!r || !r.ok) toast(fail(r, tr('err_failed')), true); else toast(tr('crys_theme_bought'));
  } else if (act === 'cequip') {
    const r = await safe(api.coins.equip(a.dataset.kind, a.dataset.id || ''));
    if (!r || !r.ok) toast(fail(r, tr('err_failed')), true);
  } else if (act === 'csell') {
    const r = await safe(api.coins.sellNft(a.dataset.id));
    if (!r || !r.ok) toast(fail(r, tr('crys_sell_fail')), true); else toast(tr('crys_sold', r.data.price));
  } else if (act === 'copen') {
    await openCase(a.dataset.id);
    return true;
  }
  await loadCoins();
  renderCrystals();
  return true;
}


// Открытие кейса: предметы пролетают над сундуком, сундук трясётся, потом открывается
function ritemHtml(it) {
  const img = it.kind === 'cloak' ? `assets/cloak-previews/${esc(it.id)}.png`
    : it.kind === 'nft' ? `assets/nft/${esc(it.id)}.png`
    : 'assets/coin.png';
  return `<div class="ritem"><img src="${img}" alt=""><span>${esc(it.name)}</span></div>`;
}
async function openCase(id) {
  if (S.crys.spinning) return;
  const r = await safe(api.coins.openCase(id));
  if (!r || !r.ok) { toast(fail(r, tr('crys_open_fail')), true); return; }
  const res = r.data;
  const opener = $('#reel');
  if (!opener) return;
  const cs = (S.coins && (id === 'free' ? S.coins.freeCase : S.coins.cases.find((k) => k.id === id))) || {};
  S.crys.spinning = true;
  opener.hidden = false;
  opener.innerHTML = `
    <div class="reel-box">
      <div class="reel-mark"></div>
      <div class="reel-track">${res.reel.map(ritemHtml).join('')}</div>
    </div>
    <div class="cstage spin" id="cstage">
      <img class="cs-closed" src="${esc(cs.image || '')}" alt="" data-hide-err>
      <img class="cs-open" src="${esc(cs.open || cs.image || '')}" alt="" data-hide-err>
      <div class="cs-glow"></div>
    </div>
    <div class="reel-res" id="rres"><span class="muted">${tr('crys_opening')}</span></div>`;
  opener.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  updateCrysTop();
  const box = opener.querySelector('.reel-box');
  const track = box.querySelector('.reel-track');
  const win = track.children[res.index];
  const target = win.offsetLeft + win.offsetWidth / 2;   // центр выигрыша относительно ленты
  const half = box.clientWidth / 2;
  track.style.transform = 'translateX(0px)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    track.style.transform = `translateX(${half - target}px)`;
  }));
  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    S.crys.spinning = false;
    track.children[res.index] && track.children[res.index].classList.add('win');
    const stage = $('#cstage');
    if (stage) { stage.classList.remove('spin'); stage.classList.add('opened'); }
    const rr = $('#rres');
    if (rr) {
      rr.innerHTML = `${tr('crys_dropped')}: <b>${esc(res.item.name)}</b>` +
        (res.duplicateRefund ? ` <span class="muted">· ${tr('crys_duplicate', res.duplicateRefund)}</span>` : '');
    }
    await loadCoins();
    updateCrysTop();
  };
  track.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 5600);
  return res;
}

async function reloadInstalls() { S.installs = await api.installs.list().catch(() => S.installs); }

/* ---------- события ---------- */
function onEvent(ev) {
  if (!ev) return;
  if (ev.type === 'status') { S.status = { text: ev.text, pct: ev.pct }; if (S.view === 'home') updateProgressDom(); }
  if (ev.type === 'started') { S.running = true; S.status = null; S.busyPlay = false; toast(tr('play_started')); if (S.view === 'home') renderHome(); }
  if (ev.type === 'closed') {
    S.running = false; S.status = null;
    toast(ev.code ? tr('play_exit_code', ev.code) : tr('play_closed'));
    if (S.view === 'home') renderHome();
  }
  if (ev.type === 'pack' && ev.slug) {
    if (ev.done) { delete S.pack.busy[ev.slug]; if (ev.error) toast(ev.error, true); }
    else S.pack.busy[ev.slug] = { text: ev.text, pct: ev.pct };
    if (S.view === 'packs') { const el = S.pack.tab === 'find' ? $('#presults') : $('#pmine'); if (el) el.innerHTML = S.pack.tab === 'find' ? packResults() : packMine(); }
  }
}

/* ---------- действия ---------- */
async function selectInstall(key) {
  const r = await safe(api.installs.select(key));
  if (r && r.error) return toast(r.error, true);
  S.st = r; await reloadInstalls(); await loadHead(); shell(); setNav(); go(S.view);
}
async function installPack(slug) {
  const x = S.pack.items.find((i) => i.slug === slug); if (!x) return;
  S.pack.busy[slug] = { text: tr('pk_starting'), pct: null };
  if (S.view === 'packs') { const el = $('#presults'); if (el) el.innerHTML = packResults(); }
  const r = await safe(api.packs.install({ id: x.id, slug: x.slug, title: x.title, icon: x.icon, source: S.pack.source }));
  if (r && r.warning) toast(r.warning, true);
  delete S.pack.busy[slug];
  if (r && r.ok) { S.st = r.settings; toast(tr('pk_installed_selected', r.info.title)); await reloadState(); shell(); go(S.view); }
  else toast(fail(r, tr('pk_install_fail')), true);
}
async function installMod(id) {
  const x = S.mods.items.find((i) => i.id === id); if (!x) return;
  S.mods.busy = id; const rs = $('#results'); if (rs) rs.innerHTML = resultRows();
  const r = await safe(api.modrinth.install({ id: x.id, slug: x.slug, kind: S.mods.kind, title: x.title, icon: x.icon, source: S.mods.source }));
  S.mods.busy = null;
  if (r && r.ok) toast(tr('mod_installed_msg', x.title)); else toast(fail(r, tr('mod_install_fail')), true);
  await loadInstalled();
  await reloadInstalls();
}

document.addEventListener('click', async (e) => {
  try {
  const t = e.target;
  if (await handleInstallClick(e)) return;
  const nav = t.closest('[data-nav]');
  if (nav) { go(nav.dataset.nav); return; }
  if (t.closest('[data-act="upd-install"]')) { return installUpdate(); }
  const win = t.closest('[data-win]');
  if (win) { api.win[win.dataset.win](); return; }
  const sel = t.closest('[data-select-install]');
  if (sel) { await selectInstall(sel.dataset.selectInstall); return; }
  const lo = t.closest('[data-loader]');
  if (lo) {
    const r = await safe(api.state.set({ loader: lo.dataset.loader, selectedModpack: null }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; await reloadInstalls(); shell(); go('versions'); return;
  }
  const pv = t.closest('[data-pickver]');
  if (pv) {
    const r = await safe(api.state.set({ version: pv.dataset.pickver, selectedModpack: null }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; await reloadInstalls(); await loadHead(); shell(); go('versions'); toast(tr('ver_selected', pv.dataset.pickver)); return;
  }
  const pt = t.closest('[data-ptab]');
  if (pt) { S.pack.tab = pt.dataset.ptab; renderPacks(); if (S.pack.tab === 'find') searchPacks(); else loadMinePacks(); setNav(); return; }
  const ms = t.closest('[data-msrc]');
  if (ms) { S.mods.source = ms.dataset.msrc; S.mods.items = []; setNav(); renderMods(); loadInstalled(); searchMods(); return; }
  const ps = t.closest('[data-psrc]');
  if (ps) { S.pack.source = ps.dataset.psrc; S.pack.items = []; renderPacks(); searchPacks(); return; }
  const pr = t.closest('[data-presence]');
  if (pr) {
    const r = await safe(api.state.set({ showPresence: pr.dataset.presence === 'true' }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; renderSettings();
    return;
  }
  const lg = t.closest('[data-lang-set]');
  if (lg) {
    setLang(lg.dataset.langSet);
    shell(); setNav(); go(S.view);
    return;
  }
  const th = t.closest('[data-theme-set]');
  if (th) {
    const r = await safe(api.state.set({ theme: th.dataset.themeSet }));
    if (r && r.error) return toast(r.error, true);
    S.st = r;
    applyTheme((r && r.theme) || th.dataset.themeSet);
    renderSettings();
    return;
  }
  const rm = t.closest('[data-ram]');
  if (rm) { const r = await safe(api.state.set({ ramGb: Number(rm.dataset.ram) })); if (r && r.error) return toast(r.error, true); S.st = r; renderSettings(); return; }
  const tg = t.closest('[data-toggle]');
  if (tg) {
    const enabled = tg.checked;
    const r = await safe(api.modrinth.setEnabled({ id: tg.dataset.toggle, enabled }));
    if (!(r && r.ok)) { toast(fail(r, tr('mod_toggle_fail')), true); tg.checked = !enabled; }
    else { const m = S.mods.installed.find((x) => x.id === tg.dataset.toggle); if (m) m.enabled = enabled; const el = $('#installed'); if (el) el.innerHTML = installedRows(); }
    return;
  }
  const a = t.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (await crysAct(act, a)) return;
  if (act === 'play') {
    S.busyPlay = true; renderHome();
    const r = await safe(api.play());
    S.busyPlay = false;
    if (!(r && r.ok)) { S.status = null; toast(fail(r, tr('play_fail')), true); renderHome(); }
    return;
  }
  if (act === 'packinstall') return installPack(a.dataset.idx);
  if (act === 'editpack') { await selectInstall(a.dataset.key); S.view = 'mods'; go('mods'); return; }
  if (act === 'packfolder') { await safe(api.packs.openFolder(a.dataset.slug)); return; }
  if (act === 'packupd') {
    const slug = a.dataset.slug; const x = S.installs.find((i) => i.kind === 'pack' && i.key === 'pack:' + slug);
    const meta = x || {};
    const r = await safe(api.packs.checkUpdate({ id: meta.id || '', slug }));
    if (!(r && r.ok)) return toast(fail(r, tr('pk_check_fail')), true);
    if (!r.available) return toast(tr('pk_latest'));
    S.pack.busy[slug] = { text: tr('pk_updating'), pct: null }; renderPacks();
    const u = await safe(api.packs.update({ id: meta.id || '', slug, title: meta.title, icon: meta.icon, source: 'modrinth' }));
    delete S.pack.busy[slug];
    if (u && u.ok) { S.st = u.settings; toast(tr('pk_updated')); await reloadState(); shell(); go('packs'); }
    else toast(fail(u, tr('pk_update_fail')), true);
    return;
  }
  if (act === 'packdel') {
    const slug = a.dataset.slug;
    if (S.pack.confirm !== slug) { S.pack.confirm = slug; renderPacks(); setTimeout(() => { if (S.pack.confirm === slug) { S.pack.confirm = null; if (S.view === 'packs') renderPacks(); } }, 3500); return; }
    S.pack.confirm = null;
    const r = await safe(api.packs.remove(slug));
    if (r && r.ok) { S.st = r.settings; toast(tr('pk_deleted')); await reloadState(); shell(); go('packs'); }
    else toast(fail(r, tr('pk_delete_fail')), true);
    return;
  }
  if (act === 'minstall') return installMod(a.dataset.id);
  if (act === 'rmmod') {
    const id = a.dataset.id;
    if (S.mods.confirm !== id) { S.mods.confirm = id; const el = $('#installed'); if (el) el.innerHTML = installedRows(); setTimeout(() => { if (S.mods.confirm === id) { S.mods.confirm = null; const e2 = $('#installed'); if (e2) e2.innerHTML = installedRows(); } }, 3500); return; }
    S.mods.confirm = null;
    const r = await safe(api.modrinth.remove({ id }));
    if (r && r.error) toast(r.error, true); else toast(tr('app_deleted'));
    await loadInstalled(); await reloadInstalls(); return;
  }
  if (act === 'savenick') {
    const v = $('[data-in="nick"]').value.trim();
    const r = await safe(api.state.set({ nick: v }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; toast(tr('nick_saved')); shell(); setNav(); renderSettings(); return;
  }
  if (act === 'openfolder') { await safe(api.openFolder(a.dataset.what)); return; }
  if (act === 'logs-refresh' || act === 'logs-all' || act === 'logs-copy') { await logsAct(act); return; }
  if (act === 'upskin') {
    const r = await safe(api.skins.upload());
    if (!r) return;
    if (r.ok) { S.st = r.settings; toast(tr('skin_uploaded')); renderSkins(); } else toast(fail(r, tr('skin_upload_fail')), true);
    return;
  }
  if (act === 'dlskin') {
    const nick = $('[data-in="snick"]').value.trim();
    const r = await safe(api.skins.download(nick));
    if (r && r.ok) { S.st = r.settings; toast(tr('skin_downloaded')); renderSkins(); } else toast(fail(r, tr('skin_download_fail')), true);
    return;
  }
  if (act === 'skinmodel') {
    const sk = S.st.skin || {};
    const r = await safe(api.state.set({ skin: { type: sk.type || 'steve', id: sk.id || null, model: a.dataset.model } }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; renderSkins(); return;
  }
  if (act === 'pickskin') {
    const stype = a.dataset.stype; const sid = a.dataset.sid || null;
    const r = await safe(api.state.set({ skin: { type: stype, id: sid } }));
    if (r && r.error) return toast(r.error, true);
    S.st = r; await loadHead(); shell(); setNav(); renderSkins(); return;
  }
  if (act === 'uninst-games') { S.uninst = { ...(S.uninst || {}), games: !!a.checked }; return; }
  if (act === 'uninst') {
    if (!(S.uninst && S.uninst.confirm)) {
      S.uninst = { ...(S.uninst || {}), confirm: true };
      renderSettings();
      setTimeout(() => { if (S.uninst && S.uninst.confirm) { S.uninst.confirm = false; if (S.view === 'settings') renderSettings(); } }, 4000);
      return;
    }
    const r = await safe(api.uninstall(!!(S.uninst && S.uninst.games)));
    if (!r || !r.ok) { S.uninst.confirm = false; renderSettings(); return toast((r && r.error) || tr('uninstall_fail'), true); }
    toast(tr('uninstall_done'));
    return;
  }
  if (act === 'rmskin') {
    const sid = a.dataset.sid;
    if (S.skins.confirm !== sid) { S.skins.confirm = sid; renderSkins(); setTimeout(() => { if (S.skins.confirm === sid) { S.skins.confirm = null; if (S.view === 'skins') renderSkins(); } }, 3500); return; }
    S.skins.confirm = null;
    S.st = await safe(api.skins.remove(sid)); await loadHead(); shell(); setNav(); renderSkins(); return;
  }
} catch (err) {
  console.error(err);
  try { toast(String(err && err.message || err), true); } catch (e2) {}
}
});

// картинка не загрузилась — убираем её, остаётся запасной вариант (CSP не даёт inline onerror)
document.addEventListener('error', (e) => { if (e.target && e.target.dataset && 'hideErr' in e.target.dataset) e.target.remove(); }, true);
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.in === 'vq') { S.vers.q = t.value; const l = $('#vlist'); if (l) l.innerHTML = versionRows(); return; }
  if (t.dataset.in === 'pq') { S.pack.q = t.value; clearTimeout(S._pt); S._pt = setTimeout(searchPacks, 380); return; }
  if (t.dataset.in === 'mq') { S.mods.q = t.value; clearTimeout(S._mt); S._mt = setTimeout(searchMods, 380); return; }
  if (t.dataset.in === 'mfilter') { S.mods.filter = t.value; const el = $('#installed'); if (el) el.innerHTML = installedRows(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'snick') document.querySelector('[data-act="dlskin"]').click();
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'nick') document.querySelector('[data-act="savenick"]').click();
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'mq') { clearTimeout(S._mt); searchMods(); }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'pq') { clearTimeout(S._pt); searchPacks(); }
});

/* ---------- старт ---------- */
let booted = false;
function applyTheme(t) {
  document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
  if (S.pal) applyPalette(S.pal);
  try { localStorage.setItem('beluvu-theme', document.documentElement.dataset.theme); } catch (e) { /* без хранилища — не страшно */ }
}
async function boot() {
  if (booted) return;
  booted = true;
  try {
    api.onEvent(onEvent);
    try { applyTheme(localStorage.getItem('beluvu-theme') || 'light'); } catch (e) { applyTheme('light'); }
    applyCachedPalette();
    // не висим вечно, если Python API не отвечает
    const stateP = reloadState();
    const timeout = new Promise((res) => setTimeout(() => res('timeout'), 15000));
    const raced = await Promise.race([stateP.then(() => 'ok'), timeout]);
    if (raced === 'timeout') {
      document.getElementById('app').innerHTML = `<div style="padding:40px;color:#fff;font-family:sans-serif"><h2>${tr('boot_slow_title')}</h2><p>${tr('boot_slow_text')}</p></div>`;
      return;
    }
    if (!S.st) S.st = { nick: 'Player', theme: 'light', version: null, loader: 'fabric' };
    applyTheme((S.st && S.st.theme) || 'light');
    dailyOnOpen();
    shell();
    go('home');
    loadHead();
    loadVersions();
    startDmWatch();
  } catch (e) {
    document.getElementById('app').innerHTML = '<div style="padding:40px;color:#fff;font-family:sans-serif"><h2>' + tr('boot_error_title') + '</h2><p>' + String(e && e.message || e) + '</p></div>';
  }
}
window.addEventListener('pywebviewready', boot);
if (window.pywebview && window.pywebview.api) boot();
// запасной старт, если событие потерялось (бывает в onefile)
setTimeout(() => { if (!booted && window.pywebview && window.pywebview.api) boot(); }, 2000);
setTimeout(() => {
  if (!booted) {
    const app = document.getElementById('app');
    if (app && !app.innerHTML.trim()) {
      app.innerHTML = `<div style="padding:40px;color:#fff;font-family:sans-serif"><h2>${tr('boot_stuck_title')}</h2><p>${tr('boot_stuck_text')}</p></div>`;
    }
  }
}, 5000);
