/* Друзья: список игроков, общий чат, личные сообщения, профиль с NFT. Вход не нужен: ник привязан к установке. */
const POLL = {};
function stopPolls() { for (const k of Object.keys(POLL)) { clearInterval(POLL[k]); delete POLL[k]; } }
function startPoll(name, fn, ms) { clearInterval(POLL[name]); POLL[name] = setInterval(fn, ms); }
const FR = { helper: [], helperState: null, tab: 'chat', q: '', players: [], peer: null, chat: [], chatLast: 0, chatSeen: new Set(), dm: [], dmLast: 0, dmSeen: new Set(), prof: null, owned: [], nfts: [], emo: false, busy: false };
const EMOJI = ['😀', '😂', '🥹', '😎', '🤔', '😭', '😡', '👍', '👎', '🔥', '❤️', '💎', '⛏️', '🗡️', '🛡️', '🏆', '🎉', '👀', '🙏', '💀', '🤝', '🐸', '🐱', '🐷', '🟩', '⭐', '✨', '🎮'];
const timeOf = (iso) => { try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const frErr = (r, fallback) => (r && r.error) || fallback || 'Нет связи с сервером';

function resetSocial() { FR.emo = false; }
function scrollMsgs() { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; }
// Ник с префиксом игрока (например красный [Bot]); цвет принимаем только как #rrggbb
// Бейджи игрока: иконки из assets/badges (выставляются админами)
const BADGE_IDS = ['verified', 'plus', 'minus', 'heart', 'broken_heart', 'up', 'down', 'like', 'dislike', 'warning', 'fake', 'scam', 'aml', 'kyc', 'ban', 'new'];
function badgesHtml(badges) {
  return (Array.isArray(badges) ? badges : []).filter((b) => BADGE_IDS.includes(b))
    .map((b) => `<img class="bdg" src="assets/badges/${b}.png" alt="" title="${b}" data-hide-err>`).join('');
}
function nickHtml(nick, prefix, color, badges) {
  const c = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#ff3b3b';
  const pf = prefix ? `<span class="pfx" style="color:${c}">[${esc(prefix)}]</span> ` : '';
  const bg = badgesHtml(badges);
  const bear = nick === 'Support Account' ? '<img class="nk-bear" src="assets/bots/support.png" alt="" data-hide-err>' : '';
  const inner = pf + esc(nick || '') + bear + (bg ? ` <span class="bdgs">${bg}</span>` : '');
  return nick ? `<span class="nk" data-act="fr-profile" data-nick="${esc(nick)}">${inner}</span>` : inner;
}
function msgHtml(m) {
  const who = m.mine === true ? (S.acc ? S.acc.nick : '') : (m.nick || (FR.peer || ''));
  const name = m.mine === true ? esc(who) : nickHtml(who, m.prefix, m.prefixColor, m.badges);
  return `<div class="msg ${m.mine ? 'mine' : ''}"><div class="who">${name} <span>${timeOf(m.at)}</span></div><div class="txt">${bodyHtml(m.body)}</div></div>`;
}
// текст сообщения; ссылка «nft:<id>» превращается в кнопку, по которой открывается превью подарка
function bodyHtml(body) {
  return esc(body).replace(/nft:(\d+)/g, (_, id) => `<span class="nft-chip" data-act="fr-nft" data-id="${id}">🎁 NFT #${id}</span>`);
}
function emojiPanel(target) {
  return `<div class="emo-pop" id="emoPop" ${FR.emo ? '' : 'hidden'}>${EMOJI.map((e) => `<button type="button" data-act="fr-emo" data-e="${e}" data-target="${target}">${e}</button>`).join('')}</div>`;
}
function composer(form, target, placeholder) {
  return `<form class="fr-compose" data-form="${form}">
    <button class="btn ghost emo-btn" type="button" data-act="fr-emotoggle" title="Эмодзи">😊</button>
    <input class="input" name="text" id="${target}" maxlength="300" placeholder="${placeholder}" autocomplete="off">
    <button class="btn primary" type="submit">Отправить</button>
  </form>${emojiPanel(target)}`;
}

/* ---------- регистрация ---------- */
function registerBox() {
  return `<div class="panel pad authbox">
    <h2 style="font-size:20px">Выбери ник</h2>
    <p class="muted" style="margin:8px 0 14px">Ник виден всем игрокам. Менять его можно раз в 30 дней.</p>
    <form class="form" data-form="fr-register">
      <input class="input" name="nick" placeholder="Ник (3–16: латиница, цифры, _)" required maxlength="16">
      <div class="err" id="frErr" style="min-height:18px"></div>
      <button class="btn primary" type="submit">Продолжить</button>
    </form>
    <div class="kicker" style="margin-top:18px">Уже есть аккаунт?</div>
    <form class="form" data-form="fr-login" style="margin-top:8px">
      <input class="input" name="nick" placeholder="Ник" autocomplete="username" maxlength="16">
      <input class="input" name="password" type="password" placeholder="Пароль" autocomplete="current-password" maxlength="64">
      <div class="err" id="frLoginErr" style="min-height:18px"></div>
      <button class="btn" type="submit">Войти по паролю</button>
    </form></div>`;
}

/* ---------- мессенджер: вкладка «Друзья» заменяет весь интерфейс лаунчера ---------- */
const MI = (n) => `<span class="mi mi-${n}" aria-hidden="true"></span>`;
function messengerOn() { return !!S.social && S.view === 'friends'; }
// настройки мессенджера (тема и размер окна) хранятся локально; без хранилища — по умолчанию
function msgPref(key, def) { try { return localStorage.getItem('beluvu-msg-' + key) || def; } catch (e) { return def; } }
function msgSetPref(key, val) { try { localStorage.setItem('beluvu-msg-' + key, val); } catch (e) { /* без хранилища — не страшно */ } }
function messengerShell() {
  const app = $('#app');
  app.classList.add('msg-on');
  const theme = msgPref('theme', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const compact = msgPref('size', 'full') === 'compact';
  app.innerHTML = `
    <div class="msg-app ${compact ? 'compact' : ''}" data-mtheme="${theme}">
      <header class="msg-top pywebview-drag-region">
        <span class="msg-title">${tr('fr_title')}</span><span class="spacer"></span>
        <button class="msg-ctl pywebview-no-drag" data-act="fr-theme" title="${tr('msg_theme')}">${theme === 'dark' ? '☀' : '☾'}</button>
        <button class="msg-ctl pywebview-no-drag" data-act="fr-size" title="${compact ? tr('msg_full') : tr('msg_small')}">${compact ? '⤢' : '⤡'}</button>
        <a class="tg-link pywebview-no-drag" data-act="fr-tg" href="#">${tr('tg_link')}</a>
        <div class="win pywebview-no-drag">
          <button data-win="min" title="${tr('win_min')}">${ICON.min}</button>
          <button data-win="max" title="${tr('win_max')}">${ICON.max}</button>
          <button data-win="close" class="x" title="${tr('win_close')}">${ICON.close}</button>
        </div>
      </header>
      <div class="msg-body">
        <nav class="msg-rail">
          <button data-act="fr-back" title="${tr('menu')}">${MI('menu')}</button>
          <button data-act="fr-rail" data-rail="chat" title="${tr('fr_general')}">${MI('chat')}</button>
          <button data-act="fr-rail" data-rail="profile" title="Мой профиль">${MI('person')}</button>
          ${S.social ? `<button data-nav="news" title="Новости">${MI('bell')}</button>` : ''}
          <span class="spacer"></span>
          <button data-nav="settings" title="Настройки">${MI('gear')}</button>
        </nav>
        <aside class="msg-list">
          <div class="msg-search">${MI('search')}<input class="input" id="frSearch" placeholder="${tr('fr_search')}" autocomplete="off" value="${esc(FR.q)}"></div>
          <button class="fr-row chat-row" data-act="fr-general"><span class="av">#</span><span>${tr('fr_general')}</span></button>
          <button class="fr-row helper-row" data-act="fr-helper"><span class="av">✨</span><span>Помогатор</span></button>
          <div class="msg-sect">${tr('fr_players')} <span class="muted" id="frCount"></span></div>
          <div class="fr-list" id="frList"></div>
        </aside>
        <section class="msg-convo" id="frConvo"><div id="frBody" class="fr-body"></div></section>
      </div>
    </div>`;
  paintRail();
}
function paintRail() {
  document.querySelectorAll('[data-act="fr-rail"]').forEach((b) => b.classList.toggle('on', b.dataset.rail === FR.tab));
  document.querySelectorAll('[data-act="fr-general"]').forEach((b) => b.classList.toggle('on', FR.tab === 'chat' && !FR.peer));
  document.querySelectorAll('[data-act="fr-helper"]').forEach((b) => b.classList.toggle('on', FR.tab === 'helper'));
}

/* ---------- помогатор (ИИ) ---------- */
const PACK_RE = /```pack\s*(\{[\s\S]*?\})\s*```/;
// блок ```pack {...}``` из ответа модели → список модов для кнопки «Установить моды»
function splitPack(text) {
  const src = String(text || '');
  const m = PACK_RE.exec(src);
  let pack = null;
  if (m) {
    try {
      const d = JSON.parse(m[1]);
      const mods = (Array.isArray(d.mods) ? d.mods : [])
        .filter((x) => typeof x === 'string')
        .map((x) => x.trim().toLowerCase())
        .filter((x) => /^[a-z0-9][a-z0-9_.-]{1,63}$/.test(x))
        .slice(0, 30);
      if (mods.length) pack = { name: String(d.name || 'Сборка').slice(0, 60), mods };
    } catch (e) { /* битый блок: показываем только текст */ }
  }
  return { text: src.replace(PACK_RE, '').trim(), pack };
}
function helperMsgHtml(m) {
  if (m.role === 'user') return `<div class="msg mine"><div class="who">${esc(S.acc ? S.acc.nick : '')}</div><div class="txt">${esc(m.body)}</div></div>`;
  const pack = m.pack ? `<div class="helper-pack"><b>${esc(m.pack.name)}</b><small>${m.pack.mods.length} модов: ${esc(m.pack.mods.join(', '))}</small><button class="btn small primary" type="button" data-act="fr-helper-install" data-mods="${esc(JSON.stringify(m.pack.mods))}">Установить моды</button></div>` : '';
  return `<div class="msg"><div class="who">Помогатор</div><div class="txt">${esc(m.body)}${pack}</div></div>`;
}
function paintHelper(body) {
  // Помогатор временно отключён: API-ключ пока не решён (см. Beta-плашку)
  body.innerHTML = `<div class="chat-head"><b>Помогатор</b><span class="muted helper-info">Beta</span></div>
    <div class="helper-beta">(Beta) бот не поддерживается. ИИ-помощник временно отключён, пока решаем вопрос с API-ключами.</div>
    <div class="msgs" id="msgs">${FR.helper.map(helperMsgHtml).join('')}</div>`;
  scrollMsgs();
}
async function loadHelper() {
  const [st, hist] = await Promise.all([api.helper.state(), api.helper.history()]);
  if (st && st.ok && st.data) FR.helperState = st.data;
  if (hist && hist.ok && Array.isArray(hist.data)) {
    FR.helper = hist.data.map((m) => {
      if (m.role !== 'assistant') return { role: 'user', body: m.body };
      const p = splitPack(m.body);
      return { role: 'assistant', body: p.text, pack: p.pack };
    });
  }
  if (FR.tab === 'helper') paintTab();
}
async function buyHelper() {
  const r = await api.helper.buy();
  if (!r || !r.ok || !r.data || r.data.ok === false) return toast(frErr(r, 'Не получилось купить'), true);
  FR.helperState = r.data;
  toast('Докуплено: +100 запросов');
  paintTab();
}
async function installHelper(raw) {
  let mods = [];
  try { mods = JSON.parse(raw || '[]'); } catch (e) { return toast('Список модов повреждён', true); }
  const r = await api.helper.install(mods);
  if (!r || !r.ok || !r.data) return toast(frErr(r), true);
  const ok = r.data.installed.length; const bad = r.data.failed.length;
  toast(`Установлено модов в текущую установку: ${ok}${bad ? `, не удалось: ${bad}` : ''}`, ok === 0);
}

/* ---------- вкладка ---------- */
function renderFriends() {
  if (!S.acc) { const box = $('#frConvo'); if (box) box.innerHTML = registerBox(); return; }
  paintPlayers();
  paintTab();
}
function paintPlayers() {
  const box = $('#frList'); if (!box) return;
  const online = FR.players.filter((p) => p.online).length;
  const cnt = $('#frCount'); if (cnt) cnt.textContent = `${online} ${tr('fr_online')} · ${FR.players.length}`;
  const q = FR.q.trim().toLowerCase();
  const list = q ? FR.players.filter((p) => p.nick.toLowerCase().includes(q)) : FR.players;
  box.innerHTML = list.map((p) => `<button class="fr-row ${FR.peer === p.nick ? 'on' : ''} ${p.me ? 'me' : ''}" data-act="fr-peer" data-nick="${esc(p.nick)}">
      <span class="av">${avatarInner(p.avatar, p.nick)}<i class="dot ${p.online ? 'on' : ''}"></i></span><span>${unreadDot(p.nick)}${nickHtml(p.nick, p.prefix, p.prefixColor, p.badges)}${p.me ? ' <small class="muted">(ты)</small>' : ''}${p.where ? `<small class="muted" style="display:block">${esc(p.where)}</small>` : ''}</span></button>`).join('')
    || `<div class="empty">${q ? tr('fr_notfound') : tr('fr_nobody')}</div>`;
}
function paintTab() {
  const body = $('#frBody'); if (!body) return;
  paintRail();
  if (FR.tab === 'chat') {
    body.innerHTML = `<div class="chat-head"><b>${tr('fr_general')}</b></div>
      <div class="msgs" id="msgs">${FR.chat.map(msgHtml).join('') || '<div class="empty">Сообщений пока нет.</div>'}</div>${composer('fr-chat', 'frChatIn', 'Сообщение в общий чат')}`;
    scrollMsgs();
  } else if (FR.tab === 'dm') {
    if (!FR.peer) { body.innerHTML = '<div class="empty">Выбери игрока в списке.</div>'; return; }
    body.innerHTML = `<div class="chat-head"><b>${esc(FR.peer)}</b><span style="flex:1"></span><button class="btn small" data-act="fr-profile" data-nick="${esc(FR.peer)}">Профиль</button></div>
      <div class="msgs" id="msgs">${FR.dm.map(msgHtml).join('') || '<div class="empty">Пока нет сообщений.</div>'}</div>${composer('fr-dm', 'frDmIn', 'Личное сообщение')}`;
    scrollMsgs();
  } else if (FR.tab === 'helper') {
    paintHelper(body);
  } else if (FR.tab === 'profile') {
    if (FR.viewNick) renderOtherProfile(body, FR.viewNick); else renderOwnProfile(body);
  }
}

/* ---------- профиль ---------- */
const CLOAK_PREVIEW = (id) => `assets/cloak-previews/${esc(id)}.png`;
// содержимое круга-аватарки: свой плащ (картинка) или первая буква ника
function avatarInner(av, nick) {
  if (av && av.startsWith('emoji:')) return esc(av.slice(6));
  if (av && av.startsWith('bot:')) return `<img src="assets/bots/${esc(av.slice(4).replace(/[^a-z0-9-]/gi, ''))}.png" alt="" data-hide-err>`;
  if (av && av.startsWith('cloak:')) return `<img src="${CLOAK_PREVIEW(av.slice(6))}" alt="" data-hide-err>`;
  return esc(String(nick || '?').slice(0, 1).toUpperCase());
}
async function renderOwnProfile(body) {
  body.innerHTML = '<div class="empty">Загружаю…</div>';
  const [st, me, prof, bl] = await Promise.all([
    api.coins.state().catch(() => null),
    api.social.me().catch(() => null),
    api.social.profile(S.acc.nick).catch(() => null),
    api.social.build().catch(() => null)]);
  if (FR.tab !== 'profile') return;
  const build = (bl && bl.ok && bl.data) || {};
  const data = st && st.ok && st.data ? st.data : null;
  const ownedAll = data ? [...new Set(data.owned)] : [];
  const gifts = (prof && prof.ok && prof.data.gifts) || [];
  const p = prof && prof.ok ? prof.data : { avatar: 'letter', items: [] };
  const shownItems = new Set(p.showItems || []);
  const others = ownedAll;
  if (build.support) { body.innerHTML = supportProfileHtml(p, gifts); return; }
  body.innerHTML = `<div class="prof">
    <div class="prof-head"><div class="prof-av">${avatarInner(p.avatar, S.acc.nick)}</div>
      <div><div class="kicker">Ник</div><div class="prof-nick">${nickHtml(S.acc.nick, p.prefix, p.prefixColor, p.badges)}</div></div></div>
    <form class="fr-nickform" data-form="fr-nick">
      <input class="input" name="text" maxlength="16" placeholder="Новый ник" autocomplete="off">
      <button class="btn" type="submit">Сменить ник</button>
    </form>
    <div class="muted fr-hint">Ник меняется раз в 30 дней.</div>
    <div class="kicker" style="margin-top:14px">Пароль для входа на другом ПК</div>
    <form class="fr-nickform" data-form="fr-password">
      <input class="input" name="text" type="password" minlength="6" maxlength="64" placeholder="Новый пароль (от 6 символов)" autocomplete="new-password">
      <button class="btn" type="submit">Сохранить пароль</button>
    </form>
    <div class="muted fr-hint">Нужен, чтобы войти в этот аккаунт на другом компьютере. Без пароля вход с другого ПК невозможен.</div>
    <div class="kicker" style="margin-top:14px">Описание (до 140 символов)</div>
    <textarea class="input" id="frBio" maxlength="140" rows="3" placeholder="Описание">${esc((me && me.ok && me.data.bio) || '')}</textarea>
    <div class="kicker" style="margin-top:14px">Мои подарки (NFT): ${gifts.length}</div>
    <div class="gift-grid">${gifts.length ? gifts.map(giftHtml).join('') : '<div class="empty">Подарков пока нет</div>'}</div>
    <div class="err" id="frErr" style="min-height:18px"></div>
    <button class="btn primary" data-act="fr-save-profile">Сохранить описание</button>
    <div class="kicker" style="margin-top:18px">Аватарка</div>
    <div class="fr-nft">
      <label class="nft-pick"><input type="radio" name="avatar" value="letter" ${p.avatar === 'letter' ? 'checked' : ''}><span class="av-letter">${esc(S.acc.nick.slice(0, 1).toUpperCase())}</span><span>Буква</span></label>
      ${EMOJI.map((e) => `<label class="nft-pick nft-emo"><input type="radio" name="avatar" value="emoji:${e}" ${p.avatar === 'emoji:' + e ? 'checked' : ''}><span class="av-letter">${e}</span></label>`).join('')}
    </div>
    <div class="kicker" style="margin-top:18px">Предметы</div>
    <label class="check-row"><input type="checkbox" id="frShowAll" ${p.showAllItems !== false ? 'checked' : ''}> Показывать все мои предметы</label>
    <div class="fr-nft" id="frItemPick" ${p.showAllItems !== false ? 'hidden' : ''}>${others.length ? others.map((id) => `<label class="nft-pick"><input type="checkbox" name="item" value="${esc(id)}" ${shownItems.has(id) ? 'checked' : ''}><span>${esc(id.split(':')[1] || id)}</span></label>`).join('') : '<div class="muted">Предметов нет</div>'}</div>
    <button class="btn primary" style="margin-top:12px" data-act="fr-save-appearance">Сохранить аватарку и предметы</button>
  </div>`;
}
// Профиль аккаунта поддержки: только шапка и подарки, менять здесь нечего
function supportProfileHtml(p, gifts) {
  return `<div class="prof">
    <div class="prof-head"><div class="prof-av">${avatarInner(p.avatar, p.nick)}</div>
      <div><div class="kicker">Аккаунт поддержки</div><div class="prof-nick">${nickHtml(p.nick, p.prefix, p.prefixColor, p.badges)}</div></div></div>
    <div class="muted fr-hint">Ник, аватарка и описание этого аккаунта меняются только администрацией.</div>
    <div class="kicker" style="margin-top:14px">Подарки (NFT): ${gifts.length}</div>
    <div class="gift-grid">${gifts.length ? gifts.map(giftHtml).join('') : '<div class="empty">Подарков пока нет</div>'}</div>
  </div>`;
}
// Профиль другого игрока в стиле Telegram: шапка, статус, строки, вкладки «Подарки» и «Предметы»
const PROF_TABS = [['gifts', 'Подарки'], ['items', 'Предметы']];
function itemPic(kind, id) {
  if (kind === 'nft') return `assets/nft/${esc(id)}.png`;
  if (kind === 'cloak') return CLOAK_PREVIEW(id);
  if (kind === 'theme') return `assets/themes/${esc(id)}.jpg`;
  return '';
}
function tileHtml(src, name, sub) {
  return `<div class="gift-tile"><div class="gift-img">${src ? `<img src="${src}" alt="" data-hide-err>` : ''}</div>`
    + `<div class="gift-name">${esc(name)}</div>${sub ? `<div class="gift-sub">${esc(sub)}</div>` : ''}</div>`;
}
// подарок-NFT: фон + фигурка (вариант), подпись — фон и цена
const TIER_NAME = { common: 'обычный', rare: 'редкий', epic: 'эпический' };
const money = (n) => Number(n || 0).toLocaleString('ru-RU') + ' кр.';
function nftArt(g) {
  return `<div class="nft-art"><img class="nft-bg" src="assets/nft/${esc(g.bg)}.png" alt="" data-hide-err>`
    + `<img class="nft-fig" src="assets/nft/fig/${esc(g.family)}-v${Number(g.variant) || 1}.png" alt="" data-hide-err></div>`;
}
function giftHtml(g) {
  return `<button class="gift-tile gift-btn" data-act="fr-nft" data-id="${Number(g.id)}"><div class="gift-img">${nftArt(g)}</div>`
    + `<div class="gift-name">${esc(g.name)}</div><div class="gift-sub">${esc(g.bgName || '')} · ${money(g.value)}</div></button>`;
}
function profileHtml(p) {
  const tab = FR.pTab || 'gifts';
  const seen = p.online ? 'в сети' : (p.lastSeen
    ? 'был(а) ' + new Date(p.lastSeen).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'не в сети');
  const gifts = (p.gifts || []).map(giftHtml);
  const items = (p.items || []).filter((i) => i.kind !== 'nft')
    .map((i) => tileHtml(itemPic(i.kind, i.id.split(':')[1]), i.name, i.kind === 'cloak' ? 'плащ' : 'тема'));
  const counts = { gifts: gifts.length, items: items.length };
  const list = tab === 'gifts' ? gifts : items;
  return `<div class="tgp">
    <button class="tgp-back" data-act="fr-pback" title="Назад">&larr;</button>
    <div class="tgp-cover"></div>
    <div class="tgp-av">${avatarInner(p.avatar, p.nick)}</div>
    <div class="tgp-name">${nickHtml(p.nick, p.prefix, p.prefixColor, p.badges)}</div>
    <div class="tgp-status"><span class="dot ${p.online ? 'on' : ''}"></span> ${esc(seen)}</div>
    <div class="tgp-rows">
      <div class="tgp-row"><div class="tgp-k">${esc(p.nick)}</div><div class="tgp-l">Имя пользователя</div></div>
      <div class="tgp-row"><div class="tgp-k">${esc(p.bio || '—')}</div><div class="tgp-l">О себе</div></div>
    </div>
    <div class="tgp-tabs">${PROF_TABS.map(([id, label]) =>
      `<button class="tgp-tab ${tab === id ? 'on' : ''}" data-act="fr-ptab" data-t="${id}">${label} · ${counts[id]}</button>`).join('')}</div>
    <div class="gift-grid">${list.join('') || '<div class="empty">Пока пусто</div>'}</div>
    <button class="btn primary tgp-write" data-act="fr-write" data-nick="${esc(p.nick)}">Написать</button>
  </div>`;
}
// превью NFT: картинка, владелец, модель, фон, цена, сколько выпущено; ссылка и отправка
function closeNft() { const el = document.getElementById('nftModal'); if (el) el.remove(); }
async function openNft(id) {
  if (!id) return;
  const r = await api.social.nftInfo(Number(id)).catch(() => null);
  if (!r || !r.ok) return toast(frErr(r) || 'NFT не найден', true);
  showNft(r.data);
}
function showNft(g) {
  closeNft();
  const mine = !!S.acc && g.owner === S.acc.nick;
  const el = document.createElement('div');
  el.className = 'nft-modal';
  el.id = 'nftModal';
  el.innerHTML = `<div class="nft-box">
    ${nftArt(g)}
    <div class="nft-title">${esc(g.name)}</div>
    <div class="nft-sub">Коллекционный подарок #${Number(g.id)}</div>
    <div class="nft-rows">
      <div><span>Владелец</span><b>${esc(g.owner || '—')}</b></div>
      <div><span>Модель</span><b>${esc(g.name)} · вариант ${Number(g.variant)}</b></div>
      <div><span>Фон</span><b>${esc(g.bgName || '')} (${esc(TIER_NAME[g.tier] || g.tier || '')})</b></div>
      <div><span>Цена</span><b>${money(g.value)}</b></div>
      <div><span>Выпущено</span><b>${Number(g.minted) || 0} шт.</b></div>
    </div>
    <div class="nft-actions">
      <button class="btn" data-act="fr-nft-link" data-id="${Number(g.id)}">Ссылка</button>
      <button class="btn" data-act="fr-nft-close">Закрыть</button>
    </div>
    ${mine ? `<form class="nft-send" data-form="fr-nft-send" data-id="${Number(g.id)}">
      <input class="input" name="text" maxlength="16" placeholder="Ник получателя" autocomplete="off">
      <button class="btn primary" type="submit">Отправить</button>
    </form>` : ''}
    <div class="err" id="nftErr" style="min-height:18px"></div>
  </div>`;
  el.addEventListener('click', (e) => { if (e.target === el) closeNft(); });
  document.body.appendChild(el);
}
async function copyNftLink(id) {
  const link = `nft:${Number(id)}`;
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована: ' + link); }
  catch { toast('Не получилось скопировать', true); }
}
// отправка подарка: владелец передаёт NFT, получателю уходит личное сообщение со ссылкой
async function sendNft(f) {
  const id = Number(f.dataset.id);
  const to = (f.text.value || '').trim();
  const err = $('#nftErr');
  if (!to) { if (err) err.textContent = 'Укажите ник получателя'; return; }
  const r = await api.social.nftSend(id, to).catch(() => null);
  if (!r || !r.ok) { if (err) err.textContent = frErr(r); return; }
  await api.social.dmSend(to, `nft:${id}`).catch(() => null);
  toast(`NFT #${id} отправлен игроку ${to}`);
  closeNft();
}
async function renderOtherProfile(body, nick) {
  body.innerHTML = '<div class="empty">Загружаю…</div>';
  const r = await api.social.profile(nick).catch(() => null);
  if (FR.tab !== 'profile' || FR.viewNick !== nick) return;
  if (!r || !r.ok) { body.innerHTML = `<div class="empty">${esc(frErr(r) || 'Профиль не найден')}</div>`; return; }
  FR.viewData = r.data;
  body.innerHTML = profileHtml(r.data);
}
async function openProfile(nick) {
  if (!nick) return;
  if (FR.tab !== 'profile') FR.prevTab = FR.tab;
  FR.tab = 'profile';
  FR.pTab = 'gifts';
  FR.viewData = null;
  // свой ник открывает свой профиль (с настройками), чужой — просмотр
  FR.viewNick = nick === S.acc.nick ? null : nick;
  paintTab();
}

/* ---------- опросы ---------- */
async function loadPlayers() {
  if (!S.acc) return;
  const r = await api.social.players();
  if (!r || !r.ok) return;
  FR.players = r.data;
  paintPlayers();
}
async function pollChat(first) {
  if (!S.acc || S.view !== 'friends' || FR.tab !== 'chat') return;
  const r = await api.social.chat(FR.chatLast);
  if (!r || !r.ok) { if (first) toast(frErr(r), true); return; }
  const fresh = r.data.filter((m) => !FR.chatSeen.has(m.id));
  if (!fresh.length) return;
  fresh.forEach((m) => { FR.chatSeen.add(m.id); FR.chat.push(m); });
  FR.chatLast = fresh[fresh.length - 1].id;
  if (FR.tab === 'chat') {
    const box = $('#msgs');
    if (box) {
      if (box.querySelector('.empty')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', fresh.map(msgHtml).join(''));
      scrollMsgs();
    }
  }
}
async function pollDm(first) {
  if (!S.acc || S.view !== 'friends' || !FR.peer) return;
  const peer = FR.peer;
  const r = await api.social.dm(peer, FR.dmLast);
  if (peer !== FR.peer) return;
  if (!r || !r.ok) { if (first) toast(frErr(r), true); return; }
  const fresh = r.data.filter((m) => !FR.dmSeen.has(m.id));
  if (!fresh.length) return;
  fresh.forEach((m) => { FR.dmSeen.add(m.id); FR.dm.push(m); });
  FR.dmLast = fresh[fresh.length - 1].id;
  if (FR.tab === 'dm') {
    const box = $('#msgs');
    if (box) {
      if (box.querySelector('.empty')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', fresh.map(msgHtml).join(''));
      scrollMsgs();
    }
  }
}
function openPeer(nick) {
  markPeerRead(nick);
  if (FR.peer !== nick) { FR.peer = nick; FR.dm = []; FR.dmLast = 0; FR.dmSeen = new Set(); }
  FR.tab = 'dm';
  paintPlayers();
  paintTab();
  pollDm(true);
}

function enterView(view) {
  if (!S.acc) return;
  if (view === 'friends') {
    loadPlayers();
    startPoll('players', loadPlayers, 15000);
    if (FR.tab === 'chat') { pollChat(true); startPoll('chat', () => pollChat(false), 3000); }
    if (FR.tab === 'dm' && FR.peer) { pollDm(true); startPoll('dm', () => pollDm(false), 3000); }
  }
}

/* ---------- настройки ---------- */
function accountRow() {
  if (S.acc) return `<div class="set-row"><div class="l"><b>Аккаунт</b><small>Ник в лаунчере: ${esc(S.acc.nick)}</small></div><div class="field"><button class="btn" data-nav="friends">Друзья</button></div></div>`;
  return `<div class="set-row"><div class="l"><b>Аккаунт</b><small>Ник ещё не выбран</small></div><div class="field"><button class="btn" data-nav="friends">Выбрать ник</button></div></div>`;
}

/* ---------- действия ---------- */
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form^="fr-"]');
  if (!f) return;
  e.preventDefault();
  if (FR.busy) return;
  const kind = f.dataset.form;
  let r;
  FR.busy = true;
  try {
    if (kind === 'fr-nft-send') { await sendNft(f); return; }
    if (kind === 'fr-register') {
      const nick = f.nick.value.trim();
      r = await api.social.register(nick);
      if (!r || !r.ok) { const err = $('#frErr'); if (err) err.textContent = frErr(r); return; }
      S.acc = { nick: r.data.nick || nick };
      toast('Добро пожаловать, ' + S.acc.nick);
      go('friends');
      return;
    }
    if (kind === 'fr-login') {
      const nick = f.nick.value.trim();
      const password = f.password.value;
      r = await api.social.login(nick, password);
      if (!r || !r.ok || r.data.ok === false) {
        const err = $('#frLoginErr');
        if (err) err.textContent = (r && r.data && r.data.error) || frErr(r);
        return;
      }
      S.acc = { nick: r.data.nick || nick };
      toast('Вход выполнен: ' + S.acc.nick);
      go('friends');
      return;
    }
    if (kind === 'fr-password') {
      const password = f.text.value;
      r = await api.social.passwordSet(password);
      if (!r || !r.ok || r.data.ok === false) return toast((r && r.data && r.data.error) || frErr(r), true);
      f.text.value = '';
      toast('Пароль сохранён');
      return;
    }
    if (kind === 'fr-nick') {
      const nick = f.text.value.trim();
      r = await api.social.nickChange(nick);
      if (!r || !r.ok) return toast(frErr(r), true);
      S.acc = { ...S.acc, nick: r.data.nick || nick };
      toast('Ник изменён: ' + S.acc.nick);
      shell(); go('friends');
      return;
    }
    if (kind === 'fr-helper') {
      return toast('(Beta) бот не поддерживается, сейчас он отключён', true);
      const q = f.text.value.trim();
      if (!q) return;
      f.text.value = '';
      FR.helper.push({ role: 'user', body: q });
      paintTab();
      r = await api.helper.chat(q);
      if (!r || !r.ok || !r.data || r.data.ok === false) {
        FR.helper.pop();
        f.text.value = q;
        paintTab();
        return toast((r && r.data && r.data.error) || frErr(r), true);
      }
      const p = splitPack(r.data.reply);
      FR.helper.push({ role: 'assistant', body: p.text, pack: p.pack });
      if (r.data.state) FR.helperState = r.data.state;
      paintTab();
      return;
    }
    const input = f.text;
    const text = input.value.trim();
    if (!text) return;
    if (kind === 'fr-chat') {
      r = await api.social.chatSend(text);
      if (!r || !r.ok || r.data.ok === false) return toast(r && r.data && r.data.error ? r.data.error : frErr(r), true);
      input.value = ''; pollChat(false); return;
    }
    if (kind === 'fr-dm') {
      r = await api.social.dmSend(FR.peer, text);
      if (!r || !r.ok || r.data.ok === false) return toast(r && r.data && r.data.error ? r.data.error : frErr(r), true);
      input.value = ''; pollDm(false);
    }
  } finally { FR.busy = false; }
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'frShowAll') return;
  const pick = $('#frItemPick'); if (pick) pick.hidden = e.target.checked;
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'frSearch') return;
  FR.q = e.target.value;
  paintPlayers();
});

document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act^="fr-"]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'fr-tab') { FR.tab = a.dataset.tab; FR.viewNick = null; paintTab(); if (FR.tab === 'chat') pollChat(true); if (FR.tab === 'dm') pollDm(true); return; }
  if (act === 'fr-peer') { return openPeer(a.dataset.nick); }
  if (act === 'fr-write') { return openPeer(a.dataset.nick); }
  if (act === 'fr-profile') { return openProfile(a.dataset.nick); }
  if (act === 'fr-nft') { return openNft(a.dataset.id); }
  if (act === 'fr-nft-link') { return copyNftLink(a.dataset.id); }
  if (act === 'fr-nft-close') { return closeNft(); }
  if (act === 'fr-emotoggle') { FR.emo = !FR.emo; const p = $('#emoPop'); if (p) p.hidden = !FR.emo; return; }
  if (act === 'fr-emo') {
    const input = $('#' + a.dataset.target);
    if (input) { input.value += a.dataset.e; input.focus(); }
    return;
  }
  if (act === 'fr-save-appearance') {
    const avatar = (document.querySelector('input[name="avatar"]:checked') || {}).value || 'letter';
    const items = [...document.querySelectorAll('input[name="item"]:checked')].map((x) => x.value);
    const all = !!(document.getElementById('frShowAll') || {}).checked;
    const r = await api.social.appearanceSet(avatar, items, all);
    if (!r || !r.ok) return toast(frErr(r), true);
    toast('Аватарка и предметы сохранены');
    return;
  }
  if (act === 'fr-save-profile') {
    const show = [];
    const bio = $('#frBio').value;
    const r = await api.social.profileSet(bio, show);
    if (!r || !r.ok) { const err = $('#frErr'); if (err) err.textContent = frErr(r); return; }
    toast('Профиль сохранён');
    return;
  }
  if (act === 'fr-back') { return go('home'); }
  if (act === 'fr-theme') {
    const root = document.querySelector('.msg-app'); if (!root) return;
    const next = root.dataset.mtheme === 'dark' ? 'light' : 'dark';
    root.dataset.mtheme = next; msgSetPref('theme', next);
    a.textContent = next === 'dark' ? '☀' : '☾';
    return;
  }
  if (act === 'fr-size') {
    const root = document.querySelector('.msg-app'); if (!root) return;
    const on = !root.classList.contains('compact');
    root.classList.toggle('compact', on); msgSetPref('size', on ? 'compact' : 'full');
    a.textContent = on ? '⤢' : '⤡'; a.title = on ? 'На весь экран' : 'Маленькое окно';
    return;
  }
  if (act === 'fr-helper') { FR.tab = 'helper'; FR.peer = null; FR.viewNick = null; paintPlayers(); paintTab(); return loadHelper(); }
  if (act === 'fr-helper-buy') { return buyHelper(); }
  if (act === 'fr-helper-install') { return installHelper(a.dataset.mods); }
  if (act === 'fr-general') { FR.tab = 'chat'; FR.peer = null; paintPlayers(); paintTab(); pollChat(true); return; }
  if (act === 'fr-rail') { FR.tab = a.dataset.rail; FR.viewNick = null; paintPlayers(); paintTab(); if (FR.tab === 'chat') pollChat(true); return; }
  if (act === 'fr-ptab') { FR.pTab = a.dataset.t; const b = $('#frBody'); if (b && FR.viewData) b.innerHTML = profileHtml(FR.viewData); return; }
  if (act === 'fr-pback') { FR.tab = FR.prevTab && FR.prevTab !== 'profile' ? FR.prevTab : 'chat'; FR.viewNick = null; paintPlayers(); paintTab(); if (FR.tab === 'chat') pollChat(true); return; }
  if (act === 'fr-tg') {
    const r = await api.social.openLink('https://t.me/BeluvuLauncher');
    if (!r || !r.ok) toast(frErr(r), true);
    return;
  }
});

/* ---------- новости ---------- */
async function renderNews() {
  content().innerHTML = '<div class="news"><div class="news-head"><b>Новости</b></div><div id="newsList"><div class="empty">Загружаю…</div></div></div>';
  const r = await api.social.news();
  const box = $('#newsList'); if (!box) return;
  if (!r || !r.ok) { box.innerHTML = `<div class="empty">${esc(frErr(r))}</div>`; return; }
  box.innerHTML = r.data.map((n) => `<article class="panel pad news-item">
      <div class="muted news-date">${esc(String(n.created_at || '').slice(0, 16).replace('T', ' '))}</div>
      <h3>${esc(n.title)}</h3><div class="news-body">${esc(n.body)}</div></article>`).join('')
    || '<div class="empty">Новостей пока нет</div>';
}
