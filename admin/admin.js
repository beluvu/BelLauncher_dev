/* Beluvu · админка. Один файл, без сборки. Работает напрямую с RPC Supabase.
   Токен сессии лежит только в sessionStorage: закрыл вкладку — нужно войти снова. */
(() => {
  'use strict';

  const SB_URL = 'https://clugtadhkstnwijqythc.supabase.co';
  // публичный anon-ключ (он же в лаунчере): права даёт база, каждая админ-функция проверяет токен
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdWd0YWRoa3N0bndpanF5' +
    'dGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NzY4MzAsImV4cCI6MjEwOTE1MjgzMH0.' +
    'EU8tev_fyCQiUBvR9cPlXwQFSSoHnalUK0fmN28QL-c';
  const TOK_KEY = 'beluvu-admin-token';

  const BADGES = ['verified', 'plus', 'minus', 'heart', 'broken_heart', 'up', 'down', 'like', 'dislike',
    'warning', 'fake', 'scam', 'aml', 'kyc', 'ban', 'new'];
  const PROMO_KINDS = { crystals: 'Кристаллики', modpack: 'Сборка', mod: 'Мод', resource_pack: 'Ресурспак' };
  const CATALOG_KINDS = { cloak: 'Плащ', nft: 'NFT', theme: 'Тема' };
  const SECTIONS = {
    players: 'Игроки', promo: 'Промокоды', news: 'Новости', releases: 'Релизы', chat: 'Чат',
    support: 'Поддержка', catalog: 'Каталог и NFT', log: 'Журнал действий',
  };

  const state = {
    sec: 'players', q: '', curNick: null, catalog: null,
    support: { peer: null, tab: 'chat', players: [] },
  };

  /* ---------- утилиты ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (d) => (d ? new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const num = (v) => (v == null || v === '' ? null : Number(v));
  const isFuture = (d) => !!d && new Date(d).getTime() > Date.now();
  const isHttps = (u) => /^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(u);
  const sha = (s) => /^[0-9a-fA-F]{64}$/.test(s);
  const toIso = (v) => (v ? new Date(v).toISOString() : null);

  function token() {
    try { return sessionStorage.getItem(TOK_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { if (t) sessionStorage.setItem(TOK_KEY, t); else sessionStorage.removeItem(TOK_KEY); } catch (e) { /* ничего */ }
  }

  function toast(msg, err = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), err ? 5200 : 2600);
  }

  /* ---------- сеть ---------- */
  async function rpc(fn, args = {}) {
    let res;
    try {
      res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
    } catch (e) {
      throw new Error('Нет связи с сервером');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && data.message) || 'Ошибка сервера';
      const err = new Error(msg);
      err.authLost = /Нужен вход/.test(msg);
      throw err;
    }
    return data;
  }

  // вызов админ-функции: токен добавляется сам; если сессия кончилась — назад ко входу
  async function call(fn, args = {}) {
    try {
      return await rpc(fn, { p_token: token(), ...args });
    } catch (e) {
      if (e.authLost) {
        setToken('');
        showLogin('Сессия закончилась, войди снова');
      }
      throw e;
    }
  }

  // действие с сообщением об успехе и ошибкой
  async function act(fn, okMsg, after) {
    try {
      const r = await fn();
      if (okMsg) toast(okMsg);
      if (after) await after(r);
      return r;
    } catch (e) {
      toast(e.message || 'Ошибка', true);
      return null;
    }
  }

  // диалог подтверждения; если typeWord задан — надо ввести его целиком
  function confirmBox({ title, text, okText = 'Подтвердить', typeWord = null }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'mback';
      wrap.innerHTML = `<div class="modal" role="alertdialog" style="max-width:440px">
        <h2>${esc(title)}</h2>
        <p class="muted" style="margin:8px 0 0">${esc(text)}</p>
        ${typeWord ? `<label class="field" style="margin-top:14px"><span>Введи «${esc(typeWord)}» для подтверждения</span>
          <input class="input" id="cfTyped" autocomplete="off"></label>` : ''}
        <div class="modal-actions">
          <button class="btn" data-no>Отмена</button>
          <button class="btn danger solid" data-yes ${typeWord ? 'disabled' : ''}>${esc(okText)}</button>
        </div></div>`;
      document.body.appendChild(wrap);
      const done = (v) => { wrap.remove(); resolve(v); };
      const yes = $('[data-yes]', wrap);
      if (typeWord) {
        $('#cfTyped', wrap).addEventListener('input', (e) => { yes.disabled = e.target.value.trim() !== typeWord; });
      }
      $('[data-no]', wrap).onclick = () => done(false);
      yes.onclick = () => done(true);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
      setTimeout(() => (typeWord ? $('#cfTyped', wrap) : yes).focus(), 0);
    });
  }

  function openModal(html, wide = false) {
    $('#modal').innerHTML = `<div class="mback"><div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div></div>`;
    $('#modal .mback').addEventListener('click', (e) => { if (e.target.classList.contains('mback')) closeModal(); });
  }
  function closeModal() { $('#modal').innerHTML = ''; }

  /* ---------- вход ---------- */
  function showLogin(msg = '') {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginErr').textContent = msg;
    closeModal();
  }

  async function enter(t) {
    setToken(t);
    $('#login').hidden = true;
    $('#app').hidden = false;
    await show(state.sec);
  }

  async function onLoginKey(e) {
    e.preventDefault();
    const key = $('#loginKey').value.trim();
    $('#loginErr').textContent = '';
    try {
      const t = await rpc('admin_activate', { p_key: key });
      if (!t) throw new Error('Не получилось войти');
      $('#loginKey').value = '';
      await enter(String(t));
    } catch (err) {
      $('#loginErr').textContent = err.message;
    }
  }

  async function onLoginToken() {
    const t = $('#loginToken').value.trim();
    $('#loginErr').textContent = '';
    if (!t) return;
    try {
      await rpc('admin_check', { p_token: t });
      $('#loginToken').value = '';
      await enter(t);
    } catch (err) {
      $('#loginErr').textContent = err.message;
    }
  }

  async function logout() {
    try { await call('admin_logout'); } catch (e) { /* токен уже не нужен */ }
    setToken('');
    showLogin('Ты вышел из админки');
  }

  /* ---------- разделы ---------- */
  async function show(sec) {
    state.sec = sec;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
    $('#secTitle').textContent = SECTIONS[sec];
    $('#secActions').innerHTML = '';
    closeModal();
    $('#view').innerHTML = '<div class="card empty">Загрузка…</div>';
    try {
      await VIEWS[sec]();
    } catch (e) {
      if (!e.authLost) $('#view').innerHTML = `<div class="card empty">Не получилось загрузить: ${esc(e.message)}</div>`;
    }
  }

  const VIEWS = {};

  /* ---------- игроки ---------- */
  VIEWS.players = async () => {
    $('#view').innerHTML = `
      <div class="card toolbar">
        <input class="input grow" id="pq" placeholder="Поиск по нику (с начала ника)" value="${esc(state.q)}" autocomplete="off">
        <button class="btn" data-act="players-reload">Обновить</button>
        <small id="pcount"></small>
      </div>
      <div class="table-wrap" id="ptable"></div>`;
    await loadPlayers();
  };

  async function loadPlayers() {
    const rows = (await call('admin_players', { p_search: state.q })) || [];
    const cnt = $('#pcount');
    if (cnt) cnt.textContent = `Найдено: ${rows.length}`;
    const box = $('#ptable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Никого не нашли</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Ник</th><th class="num">Кристаллики</th><th>Был в сети</th><th>Статус</th></tr></thead>
      <tbody>${rows.map((p) => `
        <tr class="click" data-act="player" data-nick="${esc(p.nick)}">
          <td><b>${esc(p.nick)}</b></td>
          <td class="num">${esc(p.balance)}</td>
          <td>${fmt(p.last_seen)}</td>
          <td>${statusPills(p)}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  function statusPills(p) {
    const out = [];
    if (p.ban_forever) out.push('<span class="pill red">бан навсегда</span>');
    else if (isFuture(p.ban_until)) out.push(`<span class="pill red">бан до ${fmt(p.ban_until)}</span>`);
    if (isFuture(p.mute_until)) out.push(`<span class="pill amber">мут до ${fmt(p.mute_until)}</span>`);
    return out.join(' ') || '<span class="muted">—</span>';
  }

  async function openPlayer(nick) {
    state.curNick = nick;
    const [p, cat] = await Promise.all([
      call('admin_player_info', { p_nick: nick }),
      state.catalog ? Promise.resolve(state.catalog) : call('admin_catalog_list'),
    ]);
    state.catalog = cat || [];
    renderPlayer(p);
  }

  function parseItem(s) {
    const m = /^(\w+):(.+) x(\d+)$/s.exec(String(s));
    return m ? { kind: m[1], item: m[2], count: Number(m[3]) } : { kind: '?', item: String(s), count: 1 };
  }

  function renderPlayer(p) {
    const nick = p.nick;
    const banned = p.banForever || isFuture(p.banUntil);
    const muted = isFuture(p.muteUntil);
    const items = (p.items || []).map(parseItem);
    const gifts = p.gifts || [];
    const giftFamilies = {};
    gifts.forEach((g) => { giftFamilies[g.family] = giftFamilies[g.family] || { name: g.name, count: 0 }; giftFamilies[g.family].count++; });
    const kinds = Object.keys(CATALOG_KINDS);
    const catOptions = (kind) => (state.catalog || []).filter((c) => c.kind === kind)
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    const badgeSet = new Set(p.badges || []);

    openModal(`
      <div class="row" style="justify-content:space-between">
        <div><h2>${esc(nick)}</h2>
          <small>Создан ${fmt(p.createdAt)} · был в сети ${fmt(p.lastSeen)}</small></div>
        <button class="btn ghost small" data-act="modal-close">Закрыть</button>
      </div>
      <dl class="kv" style="margin-top:14px">
        <dt>Кристаллики</dt><dd><b>${esc(p.balance)}</b></dd>
        <dt>Тема</dt><dd>${esc(p.equipped && p.equipped.theme || '—')}</dd>
        <dt>Плащ</dt><dd>${esc(p.equipped && p.equipped.cloak || '—')}</dd>
        <dt>Статус</dt><dd>${banned ? `<span class="pill red">бан${p.banForever ? ' навсегда' : ' до ' + fmt(p.banUntil)}</span>` : ''}
          ${muted ? `<span class="pill amber">мут до ${fmt(p.muteUntil)}</span>` : ''}
          ${!banned && !muted ? '<span class="pill green">в порядке</span>' : ''}</dd>
        ${p.banReason ? `<dt>Причина бана</dt><dd>${esc(p.banReason)}</dd>` : ''}
      </dl>

      <div class="section-title">Кристаллики</div>
      <div class="row">
        <input class="input" id="pc-delta" type="number" placeholder="Например 100 или -50" style="max-width:200px">
        <button class="btn" data-act="p-crys">Начислить</button>
      </div>

      <div class="section-title">Наказания</div>
      <div class="grid2">
        <div>
          <label class="field"><span>Мут, минут (0 — снять)</span><input class="input" id="pm-min" type="number" min="0" value="10"></label>
          <label class="field"><span>Причина</span><input class="input" id="pm-reason" maxlength="200"></label>
          <button class="btn" data-act="p-mute">Применить мут</button>
        </div>
        <div>
          <label class="field"><span>Бан</span>
            <select class="select" id="pb-days">
              <option value="1">1 день</option><option value="3">3 дня</option><option value="7" selected>7 дней</option>
              <option value="30">30 дней</option><option value="0">навсегда</option>
            </select></label>
          <label class="field"><span>Причина бана</span><input class="input" id="pb-reason" maxlength="200"></label>
          <div class="row">
            <button class="btn danger" data-act="p-ban">Забанить</button>
            ${banned ? '<button class="btn" data-act="p-unban">Снять бан</button>' : ''}
          </div>
        </div>
      </div>

      <div class="section-title">Предметы</div>
      ${items.length ? items.map((it) => `<div class="item-row">
          <span><span class="pill">${esc(CATALOG_KINDS[it.kind] || it.kind)}</span> ${esc(it.item)} <small>×${it.count}</small></span>
          <button class="btn small danger" data-act="p-revoke" data-kind="${esc(it.kind)}" data-item="${esc(it.item)}">Забрать</button>
        </div>`).join('') : '<small>Предметов нет</small>'}
      ${Object.keys(giftFamilies).length ? `<div style="margin-top:10px"><small>NFT</small></div>` + Object.entries(giftFamilies).map(([fam, g]) => `
        <div class="item-row"><span><span class="pill">NFT</span> ${esc(g.name)} <small>×${g.count}</small></span>
          <button class="btn small danger" data-act="p-revoke" data-kind="nft" data-item="${esc(fam)}">Забрать один</button></div>`).join('') : ''}
      <div class="grid3" style="margin-top:12px">
        <label class="field"><span>Вид</span>
          <select class="select" id="pg-kind" data-act="p-kind-change">${kinds.map((k) => `<option value="${k}">${CATALOG_KINDS[k]}</option>`).join('')}</select></label>
        <label class="field" style="grid-column: span 2"><span>Что выдать</span>
          <select class="select" id="pg-item">${catOptions('cloak')}</select></label>
      </div>
      <button class="btn" data-act="p-grant">Выдать</button>

      <div class="section-title">Витрина профиля</div>
      <label class="field"><span>ID плащей через запятую, до 6 (пусто — убрать всё)</span>
        <input class="input" id="pv-show" value="${esc((p.showNfts || []).join(', '))}"></label>
      <button class="btn" data-act="p-showcase">Сохранить витрину</button>

      <div class="section-title">Профиль</div>
      <label class="field"><span>Описание (до 140 символов)</span>
        <textarea class="textarea" id="pn-bio" maxlength="140">${esc(p.bio || '')}</textarea></label>
      <button class="btn" data-act="p-bio">Сохранить описание</button>
      <label class="field" style="margin-top:12px"><span>Бейджи</span>
        <div class="chips">${BADGES.map((b) => `<label class="chip-check"><input type="checkbox" class="pbadge" value="${b}" ${badgeSet.has(b) ? 'checked' : ''}> ${b}</label>`).join('')}</div></label>
      <button class="btn" data-act="p-badges">Сохранить бейджи</button>
      <label class="field" style="margin-top:12px"><span>Новый ник</span>
        <input class="input" id="pn-nick" maxlength="16" placeholder="${esc(nick)}"></label>
      <button class="btn" data-act="p-nick">Сменить ник</button>

      <div class="section-title">Опасные действия</div>
      <div class="row">
        <button class="btn danger" data-act="p-pwreset">Сбросить пароль</button>
        <button class="btn danger" data-act="p-profreset">Сбросить профиль</button>
        <button class="btn danger solid" data-act="p-delete">Удалить аккаунт</button>
      </div>
    `, true);
    state.curNick = nick;
  }

  // после действия над игроком перечитываем карточку
  async function refreshPlayer(nick = state.curNick) {
    if (!nick) return;
    state.curNick = nick;
    await loadPlayers().catch(() => {});
    if ($('#modal .modal')) await openPlayer(nick).catch(() => {});
  }

  /* ---------- промокоды ---------- */
  VIEWS.promo = async () => {
    $('#view').innerHTML = `
      <div class="card">
        <h2>Новый промокод</h2>
        <form id="promoForm" data-form="promo" autocomplete="off">
          <div class="grid2">
            <label class="field"><span>Код (A–Z, 0–9, _ и -, 3–32 знака)</span>
              <input class="input" name="code" required maxlength="32" style="text-transform:uppercase"></label>
            <label class="field"><span>Тип</span>
              <select class="select" name="kind">${Object.entries(PROMO_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
            <label class="field"><span>Название (показывается игроку)</span><input class="input" name="title" maxlength="80"></label>
            <label class="field"><span>Кристаллики (только для типа «Кристаллики»)</span><input class="input" name="amount" type="number" min="0" value="0"></label>
            <label class="field"><span>Ссылка на файл (github.com, https)</span><input class="input" name="url" placeholder="https://github.com/…"></label>
            <label class="field"><span>SHA-256 файла (64 знака)</span><input class="input mono" name="sha256" maxlength="64"></label>
            <label class="field"><span>Размер файла, байт</span><input class="input" name="size" type="number" min="1"></label>
            <label class="field"><span>Лимит использований (пусто — без лимита)</span><input class="input" name="maxUses" type="number" min="1"></label>
            <label class="field"><span>Действует до (пусто — бессрочно)</span><input class="input" name="expires" type="datetime-local"></label>
          </div>
          <div class="row"><button class="btn primary" type="submit">Создать промокод</button></div>
        </form>
      </div>
      <div class="table-wrap" id="promoTable"></div>`;
    await loadPromo();
  };

  async function loadPromo() {
    const rows = (await call('admin_promo_list')) || [];
    const box = $('#promoTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Промокодов пока нет</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Код</th><th>Тип</th><th>Название</th><th class="num">Кристаллики</th><th>Использовано</th><th>Срок</th><th>Статус</th><th></th></tr></thead>
      <tbody>${rows.map((c) => `<tr>
        <td class="mono"><b>${esc(c.code)}</b></td>
        <td>${esc(PROMO_KINDS[c.kind] || c.kind)}</td>
        <td>${esc(c.title || '—')}</td>
        <td class="num">${c.kind === 'crystals' ? esc(c.amount) : '—'}</td>
        <td>${esc(c.uses)} / ${c.maxUses == null ? '∞' : esc(c.maxUses)}</td>
        <td>${c.expiresAt ? fmt(c.expiresAt) : 'бессрочно'}</td>
        <td>${c.active ? '<span class="pill green">вкл</span>' : '<span class="pill">выкл</span>'}</td>
        <td><div class="row" style="flex-wrap:nowrap">
          <button class="btn small" data-act="promo-toggle" data-code="${esc(c.code)}" data-on="${c.active ? '0' : '1'}">${c.active ? 'Выключить' : 'Включить'}</button>
          <button class="btn small danger" data-act="promo-delete" data-code="${esc(c.code)}">Удалить</button>
        </div></td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- новости ---------- */
  VIEWS.news = async () => {
    $('#view').innerHTML = `
      <div class="card">
        <h2>Опубликовать новость</h2>
        <form data-form="news" autocomplete="off">
          <label class="field"><span>Заголовок</span><input class="input" name="title" required maxlength="120"></label>
          <label class="field"><span>Текст</span><textarea class="textarea" name="body" required rows="5"></textarea></label>
          <div class="row"><button class="btn primary" type="submit">Опубликовать</button></div>
        </form>
      </div>
      <div class="table-wrap" id="newsTable"></div>`;
    await loadNews();
  };

  async function loadNews() {
    const rows = (await rpc('news_list')) || [];
    const box = $('#newsTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Новостей нет</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Дата</th><th>Заголовок</th><th></th></tr></thead>
      <tbody>${rows.map((n) => `<tr>
        <td>${fmt(n.created_at)}</td>
        <td><b>${esc(n.title)}</b><div class="muted" style="font-size:13px">${esc(String(n.body || '').slice(0, 160))}</div></td>
        <td><button class="btn small danger" data-act="news-delete" data-id="${esc(n.id)}">Удалить</button></td>
      </tr>`).join('')}</tbody></table>`;
  }

  /* ---------- релизы ---------- */
  VIEWS.releases = async () => {
    $('#view').innerHTML = `
      <div class="card">
        <h2>Новый релиз лаунчера</h2>
        <form data-form="release" autocomplete="off">
          <div class="grid2">
            <label class="field"><span>Версия (например 1.2.0)</span><input class="input" name="version" required maxlength="20"></label>
            <label class="field"><span>Размер, байт</span><input class="input" name="size" type="number" min="1" required></label>
            <label class="field"><span>Ссылка на файл (github.com, https)</span><input class="input" name="url" required></label>
            <label class="field"><span>SHA-256 (64 знака)</span><input class="input mono" name="sha256" required maxlength="64"></label>
          </div>
          <label class="field"><span>Что нового</span><textarea class="textarea" name="notes" rows="3"></textarea></label>
          <div class="row"><button class="btn primary" type="submit">Опубликовать релиз</button></div>
        </form>
      </div>
      <div class="table-wrap" id="relTable"></div>`;
    await loadReleases();
  };

  async function loadReleases() {
    const rows = (await call('admin_release_list')) || [];
    const box = $('#relTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Релизов пока нет</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Версия</th><th>Дата</th><th class="num">Размер</th><th>Заметки</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><b>${esc(r.version)}</b></td><td>${fmt(r.created_at)}</td>
        <td class="num">${esc(r.size)}</td><td>${esc(r.notes || '—')}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- чат ---------- */
  VIEWS.chat = async () => {
    $('#secActions').innerHTML = '<button class="btn" data-act="chat-reload">Обновить</button>';
    $('#view').innerHTML = '<div class="table-wrap" id="chatTable"></div>';
    await loadChat();
  };

  async function loadChat() {
    const rows = (await call('admin_chat_list', { p_after: 0 })) || [];
    const box = $('#chatTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Сообщений нет</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Время</th><th>Ник</th><th>Сообщение</th><th></th></tr></thead>
      <tbody>${rows.slice().reverse().map((m) => `<tr>
        <td>${fmt(m.at)}</td><td><b>${esc(m.nick)}</b></td><td>${esc(m.body)}</td>
        <td><button class="btn small danger" data-act="chat-delete" data-id="${esc(m.id)}">Удалить</button></td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- поддержка ---------- */
  VIEWS.support = async () => {
    $('#view').innerHTML = `<div class="split">
      <div class="table-wrap" id="supPlayers"><div class="empty">Загрузка…</div></div>
      <div class="card" id="supPane"><div class="empty">Выбери игрока слева или открой общий чат поддержки</div></div>
    </div>`;
    const rows = (await call('admin_sup_players')) || [];
    state.support.players = rows;
    $('#supPlayers').innerHTML = `<table><tbody>
      <tr class="click" data-act="sup-tab" data-tab="chat" data-peer=""><td><b>Общий чат</b><div class="muted" style="font-size:12px">чат команды</div></td></tr>
      ${rows.map((p) => `<tr class="click" data-act="sup-tab" data-tab="dm" data-peer="${esc(p.nick)}">
        <td><span class="dot ${p.online ? 'on' : ''}"></span>${esc(p.nick)}</td></tr>`).join('')}
    </tbody></table>`;
    await supTab('chat');
  };

  async function supTab(tab, peer = state.support.peer) {
    state.support.tab = tab;
    state.support.peer = peer || null;
    const pane = $('#supPane');
    if (!pane) return;
    const tabs = `<div class="row" style="margin-bottom:12px">
      <button class="btn small ${tab === 'chat' ? 'primary' : ''}" data-act="sup-go" data-tab="chat">Общий чат</button>
      <button class="btn small ${tab === 'dm' ? 'primary' : ''}" data-act="sup-go" data-tab="dm" ${peer ? '' : 'disabled'}>Личка${peer ? ' · ' + esc(peer) : ''}</button>
      <button class="btn small ${tab === 'profile' ? 'primary' : ''}" data-act="sup-go" data-tab="profile" ${peer ? '' : 'disabled'}>Профиль</button>
      <button class="btn small ${tab === 'nft' ? 'primary' : ''}" data-act="sup-go" data-tab="nft">NFT по ID</button>
    </div>`;
    if (tab === 'chat') {
      const rows = (await call('admin_sup_chat', { p_after: 0 })) || [];
      pane.innerHTML = tabs + msgList(rows, (m) => `<b>${esc(m.nick)}</b>`) + `
        <form data-form="sup-chat" class="row" style="margin-top:12px"><input class="input grow" name="body" maxlength="300" placeholder="Сообщение в общий чат" required><button class="btn primary" type="submit">Отправить</button></form>`;
    } else if (tab === 'dm') {
      const rows = (await call('admin_sup_dm', { p_peer: peer, p_after: 0 })) || [];
      pane.innerHTML = tabs + msgList(rows, (m) => (m.mine ? '<b>Поддержка</b>' : `<b>${esc(peer)}</b>`)) + `
        <form data-form="sup-dm" class="row" style="margin-top:12px"><input class="input grow" name="body" maxlength="300" placeholder="Сообщение игроку" required><button class="btn primary" type="submit">Отправить</button></form>`;
    } else if (tab === 'profile') {
      const p = await call('admin_sup_profile', { p_nick: peer });
      pane.innerHTML = tabs + `<dl class="kv">
        <dt>Ник</dt><dd>${esc(p.nick)}</dd>
        <dt>Описание</dt><dd>${esc(p.bio || '—')}</dd>
        <dt>Был в сети</dt><dd>${fmt(p.lastSeen)}</dd>
        <dt>Бейджи</dt><dd>${esc((p.badges || []).join(', ') || '—')}</dd>
        <dt>NFT</dt><dd>${esc((p.gifts || []).length)}</dd></dl>`;
    } else {
      pane.innerHTML = tabs + `<form data-form="sup-nft" class="row"><input class="input grow" name="id" type="number" min="1" placeholder="ID NFT" required><button class="btn" type="submit">Показать</button></form><div id="supNft" style="margin-top:12px"></div>`;
    }
  }

  function msgList(rows, who) {
    if (!rows.length) return '<div class="empty">Пока пусто</div>';
    return `<div style="display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto">${rows.map((m) =>
      `<div style="padding:8px 10px;border:1px solid var(--line);border-radius:10px"><small>${fmt(m.at)}</small> ${who(m)}<div style="white-space:pre-wrap">${esc(m.body)}</div></div>`).join('')}</div>`;
  }

  /* ---------- каталог и NFT ---------- */
  VIEWS.catalog = async () => {
    const [cat, nfts] = await Promise.all([call('admin_catalog_list'), call('admin_nft_list')]);
    state.catalog = cat || [];
    const groups = Object.keys(CATALOG_KINDS).map((k) => {
      const list = state.catalog.filter((c) => c.kind === k);
      return `<div class="card"><h2>${CATALOG_KINDS[k]} · ${list.length}</h2>
        ${list.length ? `<table><tbody>${list.map((c) => `<tr><td>${esc(c.name)}</td><td class="mono muted">${esc(c.id)}</td></tr>`).join('')}</tbody></table>` : '<small>Пусто</small>'}</div>`;
    }).join('');
    const nftRows = (nfts || []).map((n) => `<tr><td>${esc(n.name)}</td><td class="mono muted">${esc(n.id)}</td><td class="num">${esc(n.price)}</td></tr>`).join('');
    $('#view').innerHTML = `
      <div class="card"><h2>NFT в продаже · ${(nfts || []).length}</h2>
        ${nftRows ? `<div class="table-wrap"><table><thead><tr><th>Название</th><th>ID</th><th class="num">Цена</th></tr></thead><tbody>${nftRows}</tbody></table></div>` : '<small>NFT с ценой нет</small>'}</div>
      <div class="grid3">${groups}</div>`;
  };

  /* ---------- журнал ---------- */
  VIEWS.log = async () => {
    $('#secActions').innerHTML = '<button class="btn" data-act="log-reload">Обновить</button>';
    $('#view').innerHTML = '<div class="table-wrap" id="logTable"></div>';
    await loadLog();
  };

  async function loadLog() {
    const rows = (await call('admin_log_list')) || [];
    const box = $('#logTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="empty">Журнал пуст</div>'; return; }
    box.innerHTML = `<table>
      <thead><tr><th>Время</th><th>Действие</th><th>Игрок</th><th>Детали</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${fmt(r.at)}</td><td>${esc(r.action)}</td><td>${esc(r.target || '—')}</td><td>${esc(r.detail || '')}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- обработчики действий ---------- */
  const ACT = {
    'players-reload': () => loadPlayers(),
    player: (el) => openPlayer(el.dataset.nick),
    'modal-close': () => closeModal(),

    'p-crys': async () => {
      const nick = state.curNick;
      const delta = num($('#pc-delta').value);
      if (!delta) return toast('Введи сумму', true);
      await act(() => call('admin_add_crystals', { p_nick: nick, p_delta: delta }),
        `Кристаллики: ${delta > 0 ? '+' : ''}${delta}`, () => refreshPlayer(nick));
    },
    'p-mute': async () => {
      const nick = state.curNick;
      const minutes = num($('#pm-min').value) || 0;
      await act(() => call('admin_mute', { p_nick: nick, p_minutes: minutes, p_reason: $('#pm-reason').value.trim() }),
        minutes > 0 ? `Мут на ${minutes} мин` : 'Мут снят', () => refreshPlayer(nick));
    },
    'p-ban': async () => {
      const nick = state.curNick;
      const days = Number($('#pb-days').value);
      const forever = days === 0;
      const ok = await confirmBox({ title: 'Забанить игрока?',
        text: forever ? `${nick} будет заблокирован навсегда.` : `${nick} будет заблокирован на ${days} дн.`,
        okText: 'Забанить' });
      if (!ok) return;
      await act(() => call('admin_ban', { p_nick: nick, p_days: forever ? null : days, p_reason: $('#pb-reason').value.trim() }),
        'Бан выдан', () => refreshPlayer(nick));
    },
    'p-unban': async () => {
      const nick = state.curNick;
      await act(() => call('admin_unban', { p_nick: nick }), 'Бан снят', () => refreshPlayer(nick));
    },
    'p-revoke': async (el) => {
      const nick = state.curNick;
      const ok = await confirmBox({ title: 'Забрать предмет?', text: `У ${nick} пропадёт «${el.dataset.item}».`, okText: 'Забрать' });
      if (!ok) return;
      await act(() => call('admin_revoke_item', { p_nick: nick, p_kind: el.dataset.kind, p_item: el.dataset.item }),
        'Предмет забран', () => refreshPlayer(nick));
    },
    'p-kind-change': () => {
      const kind = $('#pg-kind').value;
      $('#pg-item').innerHTML = (state.catalog || []).filter((c) => c.kind === kind)
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    },
    'p-grant': async () => {
      const nick = state.curNick;
      const kind = $('#pg-kind').value;
      const item = $('#pg-item').value;
      if (!item) return toast('Нечего выдавать: в каталоге нет предметов этого вида', true);
      await act(() => call('admin_grant_item', { p_nick: nick, p_kind: kind, p_item: item }),
        'Выдано', () => refreshPlayer(nick));
    },
    'p-showcase': async () => {
      const nick = state.curNick;
      const ids = $('#pv-show').value.split(',').map((s) => s.trim()).filter(Boolean);
      await act(() => call('admin_set_showcase', { p_nick: nick, p_show: ids }), 'Витрина сохранена', () => refreshPlayer(nick));
    },
    'p-bio': async () => {
      const nick = state.curNick;
      await act(() => call('admin_set_bio', { p_nick: nick, p_bio: $('#pn-bio').value }), 'Описание сохранено', () => refreshPlayer(nick));
    },
    'p-badges': async () => {
      const nick = state.curNick;
      const badges = [...document.querySelectorAll('.pbadge:checked')].map((i) => i.value);
      await act(() => call('admin_set_badges', { p_nick: nick, p_badges: badges }), 'Бейджи сохранены', () => refreshPlayer(nick));
    },
    'p-nick': async () => {
      const nick = state.curNick;
      const nw = $('#pn-nick').value.trim();
      if (!nw) return toast('Введи новый ник', true);
      await act(() => call('admin_set_nick', { p_nick: nick, p_new: nw }), 'Ник изменён', () => refreshPlayer(nw));
    },
    'p-pwreset': async () => {
      const nick = state.curNick;
      const ok = await confirmBox({ title: 'Сбросить пароль?', text: `У ${nick} пропадёт пароль входа, он сможет задать новый.`, okText: 'Сбросить' });
      if (ok) await act(() => call('admin_password_reset', { p_nick: nick }), 'Пароль сброшен', () => refreshPlayer(nick));
    },
    'p-profreset': async () => {
      const nick = state.curNick;
      const ok = await confirmBox({ title: 'Сбросить профиль?', text: 'Описание, витрина и аватар вернутся к исходным.', okText: 'Сбросить' });
      if (ok) await act(() => call('admin_profile_reset', { p_nick: nick }), 'Профиль сброшен', () => refreshPlayer(nick));
    },
    'p-delete': async () => {
      const nick = state.curNick;
      const ok = await confirmBox({ title: 'Удалить аккаунт?', text: 'Кошелёк и баланс пропадут. Отменить нельзя.', okText: 'Удалить', typeWord: nick });
      if (!ok) return;
      await act(() => call('admin_delete_account', { p_nick: nick }), 'Аккаунт удалён', async () => {
        closeModal();
        await loadPlayers();
      });
    },

    'promo-toggle': async (el) => {
      await act(() => call('admin_promo_set_active', { p_code: el.dataset.code, p_active: el.dataset.on === '1' }),
        'Сохранено', () => loadPromo());
    },
    'promo-delete': async (el) => {
      const ok = await confirmBox({ title: 'Удалить промокод?', text: `«${el.dataset.code}» и его история активаций пропадут.`, okText: 'Удалить' });
      if (ok) await act(() => call('admin_promo_delete', { p_code: el.dataset.code }), 'Промокод удалён', () => loadPromo());
    },
    'news-delete': async (el) => {
      const ok = await confirmBox({ title: 'Удалить новость?', text: 'Новость пропадёт у всех игроков.', okText: 'Удалить' });
      if (ok) await act(() => call('admin_news_delete', { p_id: Number(el.dataset.id) }), 'Новость удалена', () => loadNews());
    },
    'chat-reload': () => loadChat(),
    'chat-delete': async (el) => {
      const ok = await confirmBox({ title: 'Удалить сообщение?', text: 'Сообщение пропадёт из общего чата.', okText: 'Удалить' });
      if (ok) await act(() => call('admin_delete_chat', { p_id: Number(el.dataset.id) }), 'Удалено', () => loadChat());
    },
    'log-reload': () => loadLog(),

    'sup-tab': (el) => supTab(el.dataset.tab, el.dataset.peer || null),
    'sup-go': (el) => supTab(el.dataset.tab),
  };

  /* ---------- формы ---------- */
  const FORMS = {
    async promo(f) {
      const code = f.code.value.trim().toUpperCase();
      const kind = f.kind.value;
      const url = f.url.value.trim();
      const hash = f.sha256.value.trim();
      const size = num(f.size.value);
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return toast('Код: 3–32 знака, A–Z, 0–9, _ и -', true);
      if (kind !== 'crystals' && (!url || !isHttps(url))) return toast('Для файла нужна https-ссылка на github.com', true);
      if (kind !== 'crystals' && !sha(hash)) return toast('SHA-256 — 64 шестнадцатеричных знака', true);
      if (kind !== 'crystals' && !size) return toast('Укажи размер файла в байтах', true);
      if (kind === 'crystals' && !(num(f.amount.value) > 0)) return toast('Для кристаллов сумма больше нуля', true);
      const r = await act(() => call('admin_promo_create', {
        p_code: code, p_kind: kind, p_title: f.title.value.trim(),
        p_amount: num(f.amount.value) || 0,
        p_url: url || null, p_sha256: hash || null, p_size: size,
        p_max_uses: num(f.maxUses.value), p_expires: toIso(f.expires.value),
      }));
      if (r && r.ok === false) return toast(r.error || 'Не создалось', true);
      if (r) {
        toast('Промокод создан');
        f.reset();
        await loadPromo();
      }
    },
    async news(f) {
      const r = await act(() => call('admin_news_publish', { p_title: f.title.value.trim(), p_body: f.body.value.trim() }), 'Новость опубликована');
      if (r) { f.reset(); await loadNews(); }
    },
    async release(f) {
      const url = f.url.value.trim();
      if (!isHttps(url)) return toast('Ссылка на файл — https на github.com', true);
      if (!sha(f.sha256.value.trim())) return toast('SHA-256 — 64 знака', true);
      const r = await act(() => call('admin_release_publish', {
        p_version: f.version.value.trim(), p_url: url, p_sha256: f.sha256.value.trim(),
        p_size: num(f.size.value), p_notes: f.notes.value.trim(),
      }), 'Релиз опубликован');
      if (r) { f.reset(); await loadReleases(); }
    },
    async 'sup-chat'(f) {
      const r = await act(() => call('admin_sup_chat_send', { p_body: f.body.value.trim() }));
      if (r) { f.reset(); await supTab('chat'); }
    },
    async 'sup-dm'(f) {
      const peer = state.support.peer;
      const r = await act(() => call('admin_sup_dm_send', { p_peer: peer, p_body: f.body.value.trim() }));
      if (r) { f.reset(); await supTab('dm', peer); }
    },
    async 'sup-nft'(f) {
      const r = await act(() => call('admin_sup_nft', { p_id: Number(f.id.value) }));
      const box = $('#supNft');
      if (!box || !r) return;
      box.innerHTML = `<dl class="kv"><dt>Название</dt><dd>${esc(r.name || r.family || '—')}</dd>
        <dt>Владелец</dt><dd>${esc(r.owner || r.ownerNick || '—')}</dd>
        <dt>Вариант</dt><dd>${esc(r.variant || '—')}</dd>
        <dt>Фон</dt><dd>${esc(r.bgName || r.bg || '—')}</dd>
        <dt>Оценка</dt><dd>${esc(r.value ?? '—')}</dd></dl>`;
    },
  };

  /* ---------- события ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); Promise.resolve(fn(el)).catch((err) => { if (!err.authLost) toast(err.message, true); }); }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) Promise.resolve(fn(f)).catch((err) => { if (!err.authLost) toast(err.message, true); });
  });

  let qTimer = null;
  document.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.act === 'p-kind-change') ACT['p-kind-change'](e.target);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'pq') return;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value.trim(); loadPlayers().catch(() => {}); }, 300);
  });

  document.querySelectorAll('#nav button').forEach((b) => {
    b.addEventListener('click', () => show(b.dataset.sec));
  });
  $('#loginForm').addEventListener('submit', onLoginKey);
  $('#loginTokenBtn').addEventListener('click', onLoginToken);
  $('#logoutBtn').addEventListener('click', logout);

  /* ---------- старт ---------- */
  (async function boot() {
    const t = token();
    if (!t) return showLogin();
    try {
      await rpc('admin_check', { p_token: t });
      $('#login').hidden = true;
      $('#app').hidden = false;
      await show(state.sec);
    } catch (e) {
      setToken('');
      showLogin('Сессия закончилась, войди снова');
    }
  })();
})();
