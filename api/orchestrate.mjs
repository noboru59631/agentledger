import { fallbackPlan, validateProposal } from '../app/ai-policy.mjs';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const COMPATIBILITY_MODEL = 'gemini-2.5-flash';
const requestLog = new Map();
const schema = { type: 'OBJECT', properties: { taskSummary: { type: 'STRING' }, rootAgent: { type: 'OBJECT', properties: { role: { type: 'STRING' }, budget: { type: 'NUMBER' } }, required: ['role', 'budget'] }, needsSubAgents: { type: 'BOOLEAN' }, subAgents: { type: 'ARRAY', items: { type: 'OBJECT', properties: { role: { type: 'STRING' }, budget: { type: 'NUMBER' }, scope: { type: 'ARRAY', items: { type: 'STRING' } }, expiry: { type: 'STRING' }, delegationDepth: { type: 'INTEGER' } }, required: ['role', 'budget', 'scope', 'expiry', 'delegationDepth'] } }, services: { type: 'ARRAY', items: { type: 'OBJECT', properties: { category: { type: 'STRING' }, description: { type: 'STRING' }, estimatedCost: { type: 'NUMBER' } }, required: ['category', 'description', 'estimatedCost'] } }, finalOutputType: { type: 'STRING' }, expiry: { type: 'STRING' } }, required: ['taskSummary', 'rootAgent', 'needsSubAgents', 'subAgents', 'services', 'finalOutputType', 'expiry'] };

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
function withinLimit(ip, now) { const entries = (requestLog.get(ip) || []).filter((item) => now - item < 60_000); if (entries.length >= 8) return false; entries.push(now); requestLog.set(ip, entries); return true; }

export async function handleOrchestration(request, { fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  if (request.method !== 'POST') return response({ error: 'POST required' }, 405);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
  if (!withinLimit(ip, now())) return response({ error: 'Demo rate limit reached. Please try again shortly.' }, 429);
  let input; try { input = await request.json(); } catch { return response({ error: 'Request body must be JSON.' }, 400); }
  const goal = typeof input.goal === 'string' ? input.goal.trim().slice(0, 500) : '';
  const budget = Number(input.budget);
  if (!goal || !Number.isFinite(budget) || budget <= 0 || budget > 100) return response({ error: 'Provide a goal and a budget between 0 and 100 USDC.' }, 400);
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = (reason) => response({ source: 'fallback', model, reason, proposal: fallbackPlan(goal, budget), policy: 'deterministic' });
  if (!env.GEMINI_API_KEY) return fallback('GEMINI_API_KEY is not configured; showing the deterministic demo plan.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const requestModel = async (candidateModel) => fetchImpl(`https://generativelanguage.googleapis.com/v1/models/${candidateModel}:generateContent`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ systemInstruction: { parts: [{ text: 'You propose plans only. Never authorize spending. Return JSON matching the schema. Use only service categories: research, translation, data, api. Keep all allocations and costs within the user budget.' }] }, contents: [{ role: 'user', parts: [{ text: `Goal: ${goal}\nTask budget: ${budget} USDC` }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 1200 } }) });
    let result = await requestModel(model);
    let responseModel = model;
    if (result.status === 404 && model === DEFAULT_MODEL) {
      result = await requestModel(COMPATIBILITY_MODEL);
      responseModel = COMPATIBILITY_MODEL;
    }
    if (!result.ok) return fallback(result.status === 429 ? 'Gemini free-tier quota is temporarily exhausted.' : `Gemini returned HTTP ${result.status}.`);
    const payload = await result.json(); const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join(''); const proposal = JSON.parse(text);
    const validation = validateProposal(proposal, budget); if (!validation.valid) return fallback(`The model returned a proposal rejected by deterministic policy: ${validation.errors.join(' ')}`);
    return response({ source: 'gemini', model: responseModel, proposal, policy: 'deterministic' });
  } catch (error) { return fallback(error.name === 'AbortError' ? 'Gemini timed out; showing the deterministic demo plan.' : 'Gemini was unavailable or returned malformed JSON; showing the deterministic demo plan.'); }
  finally { clearTimeout(timer); }
}

export default async function handler(request) { return handleOrchestration(request); }
