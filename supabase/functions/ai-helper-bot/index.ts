// Ai_Helper_Bot: отвечает на личные сообщения игроков через Groq (OpenAI-совместимый API).
// Вызывается раз в минуту из pg_cron (см. миграцию 0013). Ключ хранится в секрете GROQ_API_KEY.
// Идемпотентно: курсор в bot_state не даёт ответить дважды на одно сообщение.
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') || '';
const MODEL = 'llama-3.3-70b-versatile';
const BOT_NICK = 'Ai_Helper_Bot';
const SYSTEM = 'Ты — Ai_Helper_Bot, нейро-помощник игры Beluvu. Отвечай по-русски, дружелюбно и коротко (до 3 предложений). Не обещай выдать кристаллы, предметы или NFT, и не проси пароли.';
const MAX_BODY = 300;

const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function botKey(): Promise<string> {
  const rows = await sb(`players?nick=eq.${BOT_NICK}&select=key_hash`);
  if (!rows || !rows[0]) throw new Error('bot account not found');
  return rows[0].key_hash;
}

async function ask(history: { role: string; text: string }[]): Promise<string> {
  if (!GROQ_KEY) return 'Я пока не подключён к нейросети. Попробуй позже.';
  // роли Groq: user / assistant (у Gemini была model)
  const messages = [
    { role: 'system', content: SYSTEM },
    ...history.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
  ];
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 300, temperature: 0.7 }),
  });
  if (!r.ok) throw new Error(`groq ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || '').trim();
}

Deno.serve(async () => {
  const bot = await botKey();
  // блокировка от параллельных запусков: берём, только если никто не держит
  const now = new Date().toISOString();
  const claimed = await sb(`bot_state?id=eq.1&busy_until=lt.${encodeURIComponent(now)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ busy_until: new Date(Date.now() + 60_000).toISOString() }),
  });
  if (!claimed || !claimed.length) return new Response(JSON.stringify({ ok: true, busy: true }));

  let handled = 0;
  try {
    const [state] = await sb('bot_state?id=eq.1&select=last_id');
    const incoming = await sb(`direct_messages?recipient=eq.${bot}&id=gt.${state.last_id}&order=id.asc&limit=10&select=id,sender,body`);
    for (const msg of incoming) {
      let reply = '';
      try {
        const ctx = await sb(`direct_messages?or=(and(sender.eq.${msg.sender},recipient.eq.${bot}),and(sender.eq.${bot},recipient.eq.${msg.sender}))&id=lte.${msg.id}&order=id.desc&limit=12&select=sender,body`);
        const history = ctx.reverse().map((m: { sender: string; body: string }) => ({
          role: m.sender === bot ? 'model' : 'user', text: m.body }));
        reply = await ask(history);
      } catch (e) {
        console.error('ask failed', e);
        // лимит или сбой провайдера: отвечаем один раз и двигаем курсор, чтобы очередь не вставала
        reply = /groq 429/.test(String(e))
          ? 'Я сейчас перегружен, напиши чуть позже.'
          : 'Сейчас не получилось ответить, попробуй чуть позже.';
      }
      reply = (reply || 'Не понял вопрос, переформулируй.').slice(0, MAX_BODY);
      await sb('direct_messages', { method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ sender: bot, recipient: msg.sender, body: reply }) });
      await sb(`bot_state?id=eq.1`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ last_id: msg.id }) });
      handled++;
    }
  } finally {
    await sb('bot_state?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ busy_until: new Date(0).toISOString() }) });
  }
  return new Response(JSON.stringify({ ok: true, handled }), { headers: { 'Content-Type': 'application/json' } });
});
