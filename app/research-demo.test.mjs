import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchExample, researchExampleAction } from './research-demo.mjs';
import { taskBudgetBreakdown } from './live-policy.mjs';

test('helper payment converts reserved funds to spent without consuming parent availability', () => {
  const initial = createResearchExample();
  const paid = researchExampleAction(initial, 'pay');
  const totals = taskBudgetBreakdown(paid);
  assert.equal(totals.available, 4_000_000n);
  assert.equal(totals.reserved, 800_000n);
  assert.equal(totals.spent, 200_000n);
  assert.equal(totals.available + totals.reserved + totals.spent, initial.budget);
  assert.equal(researchExampleAction(paid, 'pay'), paid);
});

test('over-budget request pauses without spending the helper reservation or enabling retries', () => {
  const paid = researchExampleAction(createResearchExample(), 'pay');
  const paused = researchExampleAction(paid, 'over-budget');
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.spent, paid.spent);
  assert.equal(paused.reserved, paid.reserved);
  assert.equal(researchExampleAction(paused, 'pay'), paused);
  assert.equal(researchExampleAction(paused, 'over-budget'), paused);
});

test('STOP blocks every later request and preserves accounting before and after payment', () => {
  for (const state of [createResearchExample(), researchExampleAction(createResearchExample(), 'pay')]) {
    const stopped = researchExampleAction(state, 'stop');
    assert.equal(stopped.phase, 'stopped');
    assert.deepEqual(taskBudgetBreakdown(stopped), taskBudgetBreakdown(state));
    assert.equal(researchExampleAction(stopped, 'pay'), stopped);
    assert.equal(researchExampleAction(stopped, 'over-budget'), stopped);
  }
});
