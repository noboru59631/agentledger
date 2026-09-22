import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiEndpoint, geminiSchema, handleOrchestration } from './orchestrate.mjs';

const request = (body, headers = {}) => new Request('http://localhost/api/orchestrate', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const providerProposal = { taskSummary: 'Research Arc', rootAgent: { role: 'Coordinator', budget: 5 }, needsSubAgents: true, subAgents: [{ role: 'Researcher', budget: 2, scope: ['research'], relativeExpiryHours: 24, delegationDepth: 1 }], services: [{ category: 'research', description: 'Search', estimatedCost: 0.2 }], finalOutputType: 'report' };

test('deployed app/api route uses the canonical Gemini request and normalizes provider output', async () => {
  let calledUrl;
  let calledOptions;
  const response = await handleOrchestration(request({ goal: 'Research Arc', budget: 5 }, { 'x-forwarded-for': 'deployed-route-test' }), {
    env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-custom' },
    now: () => 1_000,
    fetchImpl: async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(providerProposal) }] } }] }), { status: 200 });
    },
  });
  const body = await response.json();
  assert.equal(calledUrl, geminiEndpoint('gemini-custom'));
  assert.equal(calledOptions.headers['x-goog-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(calledOptions.body).generationConfig.responseSchema, geminiSchema);
  assert.equal(body.source, 'gemini');
  assert.equal(body.proposal.expiry, new Date(86_401_000).toISOString());
  assert.equal(body.proposal.subAgents[0].expiry, new Date(86_401_000).toISOString());
});

test('deployed app/api route rejects child scope wider than returned services', async () => {
  const proposal = { ...providerProposal, subAgents: [{ ...providerProposal.subAgents[0], scope: ['research', 'api'] }] };
  const response = await handleOrchestration(request({ goal: 'Research Arc', budget: 5 }, { 'x-forwarded-for': 'deployed-scope-test' }), {
    env: { GEMINI_API_KEY: 'test-key' },
    now: () => 2_000,
    fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(proposal) }] } }] }), { status: 200 }),
  });
  const body = await response.json();
  assert.equal(body.source, 'fallback');
  assert.match(body.reason, /rejected by deterministic policy/);
});
