/* Уведомления о личных сообщениях (звук, красная точка у ника, тост), промокоды и логи лаунчера.
   Опирается на глобалы app.js (S, api, toast, safe, $) и social.js (FR, paintPlayers). */
const DMW = { unread: {}, seeded: false, timer: null };
const DM_POLL_MS = 15000;

function unreadDot(nick) {
  return DMW.unread[nick] ? `<i class="unread-dot" title="${tr('dm_new')}"></i>` : '';
}

function unreadTotal() {
  return Object.values(DMW.unread).reduce((a, b) => a + (b || 0), 0);
}

function paintUnread() {
  const btn = document.querySelector('[data-nav="friends"]');
  if (btn) btn.classList.toggle('has-unread', unreadTotal() > 0);
  if ($('#frList') && typeof paintPlayers === 'function') paintPlayers();
}

// короткий двойной сигнал через WebAudio, без файлов
function dmSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const t0 = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const at = t0 + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.22);
    });
    setTimeout(() => { try { ctx.close(); } catch (e) { /* ничего */ } }, 900);
  } catch (e) { /* звук не обязателен */ }
}

async function dmTick() {
  if (!S.acc) return;
  const r = await safe(api.social.dmUnread());
  if (!r || !r.ok || !r.data) return;
  const counts = r.data;
  // открытый сейчас диалог считаем прочитанным: точку и звук не показываем
  if (FR.tab === 'dm' && FR.peer && counts[FR.peer]) {
    api.social.dmMarkRead(FR.peer);
    delete counts[FR.peer];
  }
  const rose = Object.keys(counts).filter((nick) => counts[nick] > (DMW.unread[nick] || 0));
  DMW.unread = counts;
  if (DMW.seeded && rose.length) {
    dmSound();
    toast(rose.length === 1 ? tr('dm_new_from', rose[0]) : tr('dm_new_many', rose.length));
  }
  DMW.seeded = true;
  paintUnread();
}

function startDmWatch() {
  if (DMW.timer) return;
  DMW.timer = setInterval(dmTick, DM_POLL_MS);
  dmTick();
}

// вызывается при открытии диалога: точка гаснет, на сервере отмечаем прочитанным
function markPeerRead(nick) {
  if (!nick || !DMW.unread[nick]) return;
  delete DMW.unread[nick];
  paintUnread();
  safe(api.social.dmMarkRead(nick));
}

/* ---------- промокоды ---------- */
function promoText(d) {
  if (d.kind === 'crystals') return `${tr('crys_plus_amount', d.amount)}${d.title ? ' · ' + d.title : ''}`;
  if (d.kind === 'mod') return tr('promo_mod', d.name);
  if (d.kind === 'resource_pack') return tr('promo_res', d.name);
  if (d.kind === 'modpack') return tr('promo_modpack', d.name);
  return tr('promo_ok');
}

/* ---------- логи ---------- */
const LOGS = { name: 'latest.log' };

function logsPanelHtml() {
  return `<div class="panel" style="margin-top:14px">
    <div class="set-row"><div class="l"><b>${tr('logs_title')}</b><small>${tr('logs_sub')}</small></div>
      <select id="logsel" class="input" style="max-width:180px">
        <option value="latest.log">latest.log</option>
        <option value="startup.log">startup.log</option>
      </select></div>
    <div class="logs-bar">
      <button class="btn small" data-act="logs-refresh">${tr('logs_refresh')}</button>
      <button class="btn small" data-act="logs-all">${tr('logs_select_all')}</button>
      <button class="btn small primary" data-act="logs-copy">${tr('logs_copy')}</button>
      <span class="muted" id="logsmeta" style="font-size:12px"></span>
    </div>
    <textarea id="logtxt" class="logbox" readonly spellcheck="false" placeholder="${tr('logs_empty')}"></textarea>
  </div>`;
}

async function loadLogs(name) {
  if (name) LOGS.name = name;
  const sel = document.getElementById('logsel');
  if (sel) sel.value = LOGS.name;
  const r = await safe(api.logs.read(LOGS.name));
  const box = document.getElementById('logtxt');
  const meta = document.getElementById('logsmeta');
  if (!r || !r.ok) {
    if (meta) meta.textContent = trMsg(r && r.error) || tr('logs_read_fail');
    return;
  }
  if (box) { box.value = r.data.text || ''; box.scrollTop = box.scrollHeight; }
  if (meta) meta.textContent = r.data.lines ? tr('logs_count', r.data.shown, r.data.lines) : tr('logs_no_file');
}

async function logsAct(act) {
  if (act === 'logs-refresh') return loadLogs();
  const box = document.getElementById('logtxt');
  if (!box) return;
  if (act === 'logs-all') { box.focus(); box.select(); return; }
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(box.value); ok = true; }
  } catch (e) { ok = false; }
  if (!ok) {
    box.focus(); box.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  }
  toast(ok ? tr('logs_copied') : tr('logs_copy_fail'), !ok);
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'logsel') loadLogs(e.target.value);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target && e.target.id === 'promo-in') {
    const b = document.querySelector('[data-act="promo"]');
    if (b) b.click();
  }
});
