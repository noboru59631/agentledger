import { handleOrchestration } from '../orchestrate-core.mjs';

export { GEMINI_API_VERSION, geminiEndpoint, geminiSchema, handleOrchestration } from '../orchestrate-core.mjs';

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
