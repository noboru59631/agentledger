import test from 'node:test';
import assert from 'node:assert/strict';
import { ARC_CHAIN_ID, CONTRACT_ADDRESS, DEMO_PAYMENT_CAP, assertArcChain, assertDistinctRecipient, assertDemoPaymentAmount, buildConfirmationPayload, validateTaskPermissions } from './live-policy.mjs';

test('chain guard accepts Arc Mainnet and rejects other chains', () => { assert.equal(assertArcChain(5042), true); assert.throws(() => assertArcChain(1), /Arc Mainnet/); });
test('recipient must be distinct from sender', () => { assert.equal(assertDistinctRecipient('0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002'), true); assert.throws(() => assertDistinctRecipient('0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000001'), /separate/); });
test('demo payment is capped at 0.01 USDC', () => { assert.equal(assertDemoPaymentAmount(10_000), DEMO_PAYMENT_CAP); assert.throws(() => assertDemoPaymentAmount(10_001), /0.01/); });
test('confirmation payload is explicit and bound to deployed contract', () => { const payload = buildConfirmationPayload('Approve USDC', { amount: '10000' }); assert.deepEqual(payload, { action: 'Approve USDC', chainId: '5042', contract: CONTRACT_ADDRESS, args: { amount: '10000' } }); });
test('task permissions require plain-language boundaries', () => { assert.equal(validateTaskPermissions({ budget: '1', deadline: Math.floor(Date.now() / 1000) + 3600, serviceScope: 'research', recipient: '0x2', delegationDepth: '2' }), true); assert.throws(() => validateTaskPermissions({ budget: '1', deadline: 1, serviceScope: 'research', recipient: '0x2', delegationDepth: '2' }), /deadline/); });
