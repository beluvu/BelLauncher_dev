/* Установки: новая установка, меню карточки (редактировать, дублировать, открыть папку, удалить),
   окно редактирования. Подключается после app.js; вызывается из его обработчика кликов. */
const NI_LOADERS = [['vanilla', 'Vanilla'], ['fabric', 'Fabric'], ['forge', 'Forge'], ['neoforge', 'Neoforge']];
const NI_RAM = [1, 2, 3, 4, 6, 8, 12, 16];
const NI = () => (S.newInst = S.newInst || { tab: 'own', name: '', ver: null, snap: false, loader: 'vanilla', folder: 'shared', error: '' });
const INST = () => (S.instUi = S.instUi || { menu: null, confirm: null, edit: null, editErr: '' });

/* ---------- новая установка ---------- */
function renderNewInstall() {
  const n = NI();
  if (!S.vers.list && !S.vers.loading) loadVersions().then(() => { if (S.view === 'newinstall') renderNewInstall(); });
  const all = S.vers.list || [];
  const list = all.filter((v) => v.type === 'release' || (n.snap && v.type === 'snapshot'));
  if (!n.ver && S.vers.latest) n.ver = S.vers.latest;
  content().innerHTML = `
    <div class="ni-wrap">
      <div class="ni-head"><button class="btn icon" data-nav="home" title="${tr('app_back')}">←</button><h2>${tr('app_new_install')}</h2></div>
      <div class="ni-tabs">
        <button class="ni-tab ${n.tab === 'own' ? 'on' : ''}" data-ni-tab="own">${tr('ni_own')}</button>
        <button class="ni-tab" data-ni-tab="pack">${tr('ni_pack')}</button>
      </div>
      <div class="panel ni-form">
        <label class="cap" for="niName">${tr('ni_name_label')}</label>
        <input class="input" id="niName" placeholder="${tr('ni_default_name')}" maxlength="40" value="${esc(n.name)}">
        <div class="ni-row"><span class="cap">${tr('ni_version')}</span>
          <label class="ni-snap"><input type="checkbox" data-ni-snap ${n.snap ? 'checked' : ''}> ${tr('ni_snapshots')}</label></div>
        <select class="input" id="niVer">${list.length ? '' : `<option value="">${tr('ni_pick_version')}</option>`}${list.map((v) => `<option value="${esc(v.id)}" ${n.ver === v.id ? 'selected' : ''}>${esc(v.id)}</option>`).join('')}</select>
        <span class="cap">${tr('ni_game_type')}</span>
        <div class="ni-seg">${NI_LOADERS.map(([k, l]) => `<button class="${n.loader === k ? 'on' : ''}" data-ni-loader="${k}">${l}</button>`).join('')}</div>
        <span class="cap">${tr('ni_folder_type')}</span>
        <div class="ni-seg">
          <button class="${n.folder === 'isolated' ? 'on' : ''}" data-ni-folder="isolated" title="${tr('ni_isolated_hint')}">${tr('ni_isolated')}</button>
          <button class="${n.folder === 'shared' ? 'on' : ''}" data-ni-folder="shared" title="${tr('ni_shared_hint')}">${tr('ni_shared')}</button>
        </div>
        ${n.error ? `<div class="err">${esc(n.error)}</div>` : ''}
        <div class="ni-foot"><button class="btn primary" data-ni-create>${tr('ni_create')}</button></div>
      </div>
    </div>`;
}
function niSync() {
  const n = NI();
  const nm = $('#niName'); if (nm) n.name = nm.value;
  const v = $('#niVer'); if (v && v.value) n.ver = v.value;
}
async function niCreate() {
  niSync();
  const n = NI();
  n.error = '';
  const r = await safe(api.installs.create({ name: n.name, version: n.ver, loader: n.loader, folder: n.folder }));
  if (!r || !r.ok) { n.error = trMsg(r && r.error) || tr('ni_create_fail'); renderNewInstall(); return; }
  n.name = ''; n.error = '';
  await reloadInstalls();
  const sel = await safe(api.installs.select('inst:' + r.data.id));
  if (sel && sel.error) toast(sel.error, true);
  if (sel && !sel.error) S.st = sel;
  toast(tr('ni_created', r.data.name));
  go('home');
}

/* ---------- меню карточки ---------- */
function closeInstMenu() {
  const m = document.getElementById('instMenu'); if (m) m.remove();
  INST().menu = null; INST().confirm = null;
}
function openInstMenu(btn, key) {
  const x = S.installs.find((i) => i.key === key); if (!x) return;
  const wasSure = INST().confirm === key;
  closeInstMenu();
  const ui = INST(); ui.menu = key; ui.confirm = wasSure ? key : null;
  const r = btn.getBoundingClientRect();
  const items = [];
  if (x.kind === 'custom') items.push(['im-edit', tr('im_edit')], ['im-dup', tr('im_dup')]);
  items.push(['im-open', tr('im_open_folder')]);
  if (x.kind === 'custom' || x.kind === 'pack') {
    items.push(['im-del', ui.confirm === key ? tr('im_sure_delete') : tr('app_delete'), true]);
  }
  const m = document.createElement('div');
  m.id = 'instMenu'; m.className = 'inst-menu';
  m.innerHTML = items.map(([a, l, d]) => `<button class="${d ? 'danger' : ''}" data-im="${a}" data-key="${esc(key)}">${l}</button>`).join('');
  document.body.appendChild(m);
  const left = Math.min(r.right - 200, window.innerWidth - 216);
  m.style.left = Math.max(8, left) + 'px';
  const below = r.bottom + 6;
  m.style.top = (below + 200 > window.innerHeight ? Math.max(8, r.top - m.offsetHeight - 6) : below) + 'px';
}

/* ---------- окно редактирования ---------- */
async function openInstEdit(key) {
  const x = S.installs.find((i) => i.key === key); if (!x || x.kind !== 'custom') return;
  const r = await safe(api.installs.get(x.id));
  if (!r || !r.ok) return toast(trMsg(r && r.error) || tr('im_open_fail'), true);
  const rec = r.data;
  INST().edit = { id: rec.id, name: rec.name, version: rec.version, loader: rec.loader, ramGb: rec.ramGb || null, jvmArgs: rec.jvmArgs || '', javaPath: rec.javaPath || '' };
  INST().editErr = '';
  paintInstEdit();
  if (!S.vers.list && !S.vers.loading) loadVersions().then(() => paintInstEdit());
}
function paintInstEdit() {
  const e = INST().edit; if (!e) return;
  const list = (S.vers.list || []).filter((v) => v.type === 'release' || v.id === e.version);
  const ram = e.ramGb ? `${e.ramGb} ${tr('app_gb')}` : tr('ni_global');
  let box = document.getElementById('instModal');
  if (!box) { box = document.createElement('div'); box.id = 'instModal'; box.className = 'inst-modal'; document.body.appendChild(box); }
  box.innerHTML = `
    <div class="inst-dlg" role="dialog" aria-modal="true">
      <header>${tr('im_edit_title')}</header>
      <div class="body">
        <div class="ni-row"><div class="ico">${esc((e.name || '?').trim().charAt(0).toUpperCase())}</div>
          <div style="flex:1;min-width:0"><span class="cap">${tr('ni_name_label')}</span><input class="input" id="ieName" maxlength="40" value="${esc(e.name)}"></div></div>
        <div class="ni-row" style="gap:10px;align-items:flex-start">
          <div style="flex:1"><span class="cap">${tr('ni_version')}</span>
            <select class="input" id="ieVer">${list.map((v) => `<option value="${esc(v.id)}" ${v.id === e.version ? 'selected' : ''}>${esc(v.id)}</option>`).join('')}</select></div>
          <div style="flex:1"><span class="cap">${tr('ni_game_type')}</span>
            <select class="input" id="ieLoader">${NI_LOADERS.map(([k, l]) => `<option value="${k}" ${k === e.loader ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div><span class="cap">${tr('ie_memory')}: ${esc(ram)}</span>
          <div class="ni-ram" style="margin-top:6px">
            <button class="chip ${e.ramGb ? '' : 'on'}" data-ie-ram="0">${tr('ie_global')}</button>
            ${NI_RAM.map((n) => `<button class="chip ${e.ramGb === n ? 'on' : ''}" data-ie-ram="${n}">${n}G</button>`).join('')}
          </div>
          <input type="range" min="1" max="16" step="1" id="ieRamSlider" value="${e.ramGb || 4}" style="width:100%;margin-top:8px" ${e.ramGb ? '' : 'disabled'}>
        </div>
        <div><span class="cap">${tr('ie_jvm')}</span>
          <input class="input" id="ieJvm" placeholder="${tr('ie_jvm_ph')}" value="${esc(e.jvmArgs)}">
          <small class="muted">${tr('ie_hint_jvm')}</small></div>
        <div><span class="cap">${tr('ie_java')}</span>
          <input class="input" id="ieJava" placeholder="${tr('ie_java_ph')}" value="${esc(e.javaPath)}">
          <small class="muted">${tr('ie_hint_java')}</small></div>
        ${INST().editErr ? `<div class="err">${esc(INST().editErr)}</div>` : ''}
      </div>
      <footer><button class="btn" data-ie="cancel">${tr('app_cancel')}</button><button class="btn primary" data-ie="save">${tr('save')}</button></footer>
    </div>`;
  box.onclick = (ev) => { if (ev.target === box) closeInstEdit(); };
  const sl = document.getElementById('ieRamSlider');
  if (sl) sl.oninput = () => { ieSync(); INST().edit.ramGb = Number(sl.value); paintInstEdit(); };
}
function closeInstEdit() { const b = document.getElementById('instModal'); if (b) b.remove(); INST().edit = null; }
function ieSync() {
  const e = INST().edit; if (!e) return;
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  if (g('ieName') !== null) e.name = g('ieName');
  if (g('ieVer') !== null) e.version = g('ieVer');
  if (g('ieLoader') !== null) e.loader = g('ieLoader');
  if (g('ieJvm') !== null) e.jvmArgs = g('ieJvm');
  if (g('ieJava') !== null) e.javaPath = g('ieJava');
}
async function ieSave() {
  ieSync();
  const e = INST().edit; if (!e) return;
  const patch = { name: e.name, version: e.version, loader: e.loader, ramGb: e.ramGb || null, jvmArgs: e.jvmArgs, javaPath: e.javaPath };
  const r = await safe(api.installs.update(e.id, patch));
  if (!r || !r.ok) { INST().editErr = trMsg(r && r.error) || tr('ie_save_fail'); paintInstEdit(); return; }
  closeInstEdit();
  await reloadInstalls();
  toast(tr('ie_saved'));
  if (S.view === 'home') renderHome();
}

/* ---------- клики ---------- */
// Возвращает true, если клик обработан здесь
async function handleInstallClick(e) {
  const t = e.target;
  const ui = INST();
  const m = t.closest('[data-im]');
  if (m) {
    const act = m.dataset.im, key = m.dataset.key;
    const x = S.installs.find((i) => i.key === key);
    if (!x) { closeInstMenu(); return true; }
    if (act === 'im-del') {
      if (ui.confirm !== key) { ui.confirm = key; openInstMenu(document.querySelector(`[data-inst-menu="${CSS.escape(key)}"]`) || m, key); return true; }
      closeInstMenu();
      const r = x.kind === 'custom' ? await safe(api.installs.delete(x.id)) : await safe(api.packs.remove(x.slug));
      if (!r || r.ok === false || r.error) return toast((r && r.error) || tr('im_delete_fail'), true), true;
      await reloadInstalls(); toast(tr('app_deleted')); renderHome(); return true;
    }
    closeInstMenu();
    if (act === 'im-edit') { await openInstEdit(key); return true; }
    if (act === 'im-dup') {
      const r = await safe(api.installs.duplicate(x.id));
      if (!r || !r.ok) toast((r && r.error) || tr('im_dup_fail'), true); else toast(tr('im_duplicated'));
      await reloadInstalls(); renderHome(); return true;
    }
    if (act === 'im-open') { const r = await safe(api.installs.open(key)); if (r && r.error) toast(r.error, true); return true; }
    return true;
  }
  const more = t.closest('[data-inst-menu]');
  if (more) {
    if (ui.menu === more.dataset.instMenu) { closeInstMenu(); return true; }
    openInstMenu(more, more.dataset.instMenu);
    return true;
  }
  if (!t.closest('#instMenu')) closeInstMenu();
  const eb = t.closest('[data-ie]');
  if (eb) { if (eb.dataset.ie === 'cancel') closeInstEdit(); else await ieSave(); return true; }
  const rb = t.closest('[data-ie-ram]');
  if (rb) { ieSync(); const v = Number(rb.dataset.ieRam); INST().edit.ramGb = v || null; paintInstEdit(); return true; }
  const n = NI();
  const tab = t.closest('[data-ni-tab]');
  if (tab) { niSync(); if (tab.dataset.niTab === 'pack') { go('packs'); return true; } n.tab = 'own'; renderNewInstall(); return true; }
  const ld = t.closest('[data-ni-loader]');
  if (ld) { niSync(); n.loader = ld.dataset.niLoader; renderNewInstall(); return true; }
  const fd = t.closest('[data-ni-folder]');
  if (fd) { niSync(); n.folder = fd.dataset.niFolder; renderNewInstall(); return true; }
  if (t.closest('[data-ni-snap]')) { niSync(); n.snap = !n.snap; renderNewInstall(); return true; }
  if (t.closest('[data-ni-create]')) { await niCreate(); return true; }
  return false;
}
