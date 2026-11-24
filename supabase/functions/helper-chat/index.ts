// Помогатор лаунчера: принимает сообщение игрока, списывает запрос и отвечает через OpenAI (gpt-6-luna).
// Ключ OpenAI — секрет OPENAI_API_KEY в Supabase, в лаунчер он не попадает.
// Тело запроса: { key: string, message: string }. Ответ: { ok, reply?, state?, error? }.
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
// Адрес и модель берутся из секретов, чтобы можно было подключить OpenAI или совместимый сервис (например unorouter).
const BASE_URL = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-6-luna';
const MAX_IN = 1000;
const HISTORY = 12;

const SYSTEM = `Ты — Помогатор, встроенный ИИ-помощник лаунчера Beluvu для Minecraft. Отвечай по-русски, по делу и дружелюбно.
Помогаешь с Minecraft: версии, загрузчики (Fabric, Forge, NeoForge, Quilt), моды, шейдеры, производительность, ошибки запуска.
Когда игрок просит собрать сборку (модпак), в конце ответа добавь ровно один блок:
\`\`\`pack
{"name": "Название", "mc": "1.21.11", "loader": "fabric", "mods": ["slug-1", "slug-2"]}
\`\`\`
В mods — только slug'и проектов Modrinth (как в адресе modrinth.com/mod/<slug>), не больше 30. Если не уверен в slug, лучше не добавляй мод.
Не обещай кристаллики, предметы, NFT или доступ к аккаунту. Не проси пароли и ключи.`;

const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const txt = await r.text();
  if (!r.ok) {
    let msg = txt;
    try { msg = JSON.parse(txt).message || txt; } catch (_) { /* оставляем как есть */ }
    throw new Error(msg);
  }
  return txt ? JSON.parse(txt) : null;
}

async function ask(messages: { role: string; content: string }[]): Promise<string> {
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, max_completion_tokens: 4000 }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content || '').trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Метод не поддерживается' }, 405);
  let body: { key?: string; message?: string };
  try { body = await req.json(); } catch (_) { return json({ ok: false, error: 'Неверный запрос' }, 400); }

  const key = String(body.key || '');
  const text = String(body.message || '').trim();
  if (!/^[0-9a-f]{32,64}$/.test(key)) return json({ ok: false, error: 'Нет ключа аккаунта' }, 400);
  if (!text) return json({ ok: false, error: 'Пустое сообщение' }, 400);
  if (text.length > MAX_IN) return json({ ok: false, error: `Не больше ${MAX_IN} символов` }, 400);
  if (!OPENAI_KEY) return json({ ok: false, error: 'Помогатор ещё не подключён к нейросети' }, 503);

  let state: unknown;
  try {
    state = await rpc('helper_consume', { p_key: key });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 429);
  }

  try {
    await rpc('helper_store', { p_key: key, p_role: 'user', p_body: text });
    const recent: { role: string; body: string }[] = await rpc('helper_recent', { p_key: key, p_n: HISTORY });
    const messages = [
      { role: 'system', content: SYSTEM },
      ...recent.map((m) => ({ role: m.role, content: m.body })),
    ];
    const reply = (await ask(messages)) || 'Не получилось придумать ответ, попробуй переформулировать.';
    await rpc('helper_store', { p_key: key, p_role: 'assistant', p_body: reply });
    return json({ ok: true, reply, state });
  } catch (e) {
    const detail = (e as Error).message;
    console.error('helper-chat failed', detail);
    return json({ ok: false, error: 'Помогатор не ответил. ' + detail.slice(0, 300) }, 502);
  }
});
