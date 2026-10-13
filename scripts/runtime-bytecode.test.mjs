import assert from 'node:assert/strict';
import test from 'node:test';
import { byteLength, normalizeImmutableReferences } from './runtime-bytecode.mjs';

test('normalizes immutable slots without changing surrounding runtime code', () => {
  const bytecode = '0x112233445566';
  const references = { '1': [{ start: 2, length: 2 }] };
  assert.equal(normalizeImmutableReferences(bytecode, references), '0x112200005566');
  assert.equal(byteLength(bytecode), 6);
});

test('rejects malformed bytecode and out-of-range immutable references', () => {
  assert.throws(() => normalizeImmutableReferences('0x123'), /complete hex bytes/);
  assert.throws(
    () => normalizeImmutableReferences('0x1234', { '1': [{ start: 1, length: 2 }] }),
    /outside runtime bytecode/,
  );
});
