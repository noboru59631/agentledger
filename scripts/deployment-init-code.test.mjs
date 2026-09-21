import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';

test('deployment init code normalizes prefixed bytecode and appends ABI constructor args', () => {
  const bytecode = '0x60006000';
  const constructorArgs = `0x${'1'.repeat(24)}${'2'.repeat(40)}`;

  const initCode = buildDeploymentInitCode(bytecode, constructorArgs);

  assert.equal(initCode, `0x60006000${'1'.repeat(24)}${'2'.repeat(40)}`);
  assert.equal((initCode.match(/0x/g) ?? []).length, 1);
});

test('deployment init code also accepts unprefixed bytecode and constructor args', () => {
  assert.equal(buildDeploymentInitCode('6000', '1234'), '0x60001234');
});

test('deployment init code rejects malformed bytecode or constructor args', () => {
  assert.throws(() => buildDeploymentInitCode('0x0x6000'), /complete hex bytes/);
  assert.throws(() => buildDeploymentInitCode('600'), /complete hex bytes/);
  assert.throws(() => buildDeploymentInitCode('6000', '0x123'), /complete hex bytes/);
});
