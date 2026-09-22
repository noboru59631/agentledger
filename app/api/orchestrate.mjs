import { fallbackPlan, validateProposal } from '../ai-policy.mjs';

const MODEL = 'gemini-2.5-flash-lite';
const API_VERSION = 'v1beta';
const requestLog = new Map();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const schema = { type: 'OBJECT', properties: { taskSummary: { type: 'STRING' }, rootAgent: { type: 'OBJECT', properties: { role: { type: 'STRING' }, budget: { type: 'NUMBER' } }, required: ['role', 'budget'] }, needsSubAgents: { type: 'BOOLEAN' }, subAgents: { type: 'ARRAY', items: { type: 'OBJECT', properties: { role: { type: 'STRING' }, budget: { type: 'NUMBER' }, scope: { type: 'ARRAY', items: { type: 'STRING' } }, expiry: { type: 'STRING' }, delegationDepth: { type: 'INTEGER' } }, required: ['role', 'budget', 'scope', 'expiry', 'delegationDepth'] } }, services: { type: 'ARRAY', items: { type: 'OBJECT', properties: { category: { type: 'STRING' }, description: { type: 'STRING' }, estimatedCost: { type: 'NUMBER' } }, required: ['category', 'description', 'estimatedCost'] } }, finalOutputType: { type: 'STRING' }, expiry: { type: 'STRING' } }, required: ['taskSummary', 'rootAgent', 'needsSubAgents', 'subAgents', 'services', 'finalOutputType', 'expiry'] };
const limited = (ip, now) => { const recent = (requestLog.get(ip) || []).filter((time) => now - time < 60_000); if (recent.length >= 8) return false; recent.push(now); requestLog.set(ip, recent); return true; };

export async function handleOrchestration(request, { fetchImpl = fetch, env = globalThis.process?.env || {}, now = Date.now } = {}) {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'; if (!limited(ip, now())) return json({ error: 'Demo rate limit reached. Please try again shortly.' }, 429);
  let input; try { input = await request.json(); } catch { return json({ error: 'Request body must be JSON.' }, 400); }
  const goal = typeof input.goal === 'string' ? input.goal.trim().slice(0, 500) : ''; const budget = Number(input.budget);
  if (!goal || !Number.isFinite(budget) || budget <= 0 || budget > 100) return json({ error: 'Provide a goal and a budget between 0 and 100 USDC.' }, 400);
  const model = env.GEMINI_MODEL || MODEL; const fallback = (reason, diagnostic) => json({ source: 'fallback', model, reason, ...(diagnostic ? { diagnostic } : {}), proposal: fallbackPlan(goal, budget), policy: 'deterministic' });
  if (!env.GEMINI_API_KEY) return fallback('GEMINI_API_KEY is not configured; showing the deterministic demo plan.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const result = await fetchImpl(`https://generativelanguage.googleapis.com/${API_VERSION}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ systemInstruction: { parts: [{ text: 'You propose plans only. Never authorize spending. Return JSON matching the schema. Use only service categories: research, translation, data, api. Keep all allocations and costs within the user budget.' }] }, contents: [{ role: 'user', parts: [{ text: `Goal: ${goal}\nTask budget: ${budget} USDC` }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 1200 } }) });
    if (!result.ok) { let details = {}; try { details = await result.json(); } catch {} const message = typeof details.error?.message === 'string' ? details.error.message.slice(0, 240) : 'No provider message.'; console.error('[gemini] request failed', { code: result.status, message, model, version: API_VERSION }); const diagnostic = { code: result.status, message, model, version: API_VERSION }; return fallback(result.status === 429 ? 'Gemini free-tier quota is temporarily exhausted.' : result.status === 404 ? `Gemini model or API version was not found (${model}/${API_VERSION}).` : `Gemini returned HTTP ${result.status}.`, diagnostic); }
    const payload = await result.json(); const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join(''); const proposal = JSON.parse(text); const validation = validateProposal(proposal, budget);
    if (!validation.valid) return fallback(`The model returned a proposal rejected by deterministic policy: ${validation.errors.join(' ')}`); return json({ source: 'gemini', model, proposal, policy: 'deterministic' });
  } catch (error) { return fallback(error.name === 'AbortError' ? 'Gemini timed out; showing the deterministic demo plan.' : 'Gemini was unavailable or returned malformed JSON; showing the deterministic demo plan.'); } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  let body = req.body;
  if (body === undefined && req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks).toString('utf8');
  }
  const request = new Request(`https://${req.headers.host || 'agentledger.local'}${req.url || '/api/orchestrate'}`, { method: req.method, headers: req.headers, body: body === undefined || req.method === 'GET' || req.method === 'HEAD' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const result = await handleOrchestration(request);
  res.statusCode = result.status;
  result.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await result.text());
}
