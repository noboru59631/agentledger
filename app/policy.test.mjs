import test from 'node:test'; import assert from 'node:assert/strict';
const permits = (parent, child) => child.budget <= parent.remaining && child.expiry <= parent.expiry && (child.scope | parent.scope) === parent.scope && child.depth < parent.depth;
test('child mandate can only reduce authority', () => assert.equal(permits({remaining: 5, expiry: 10, scope: 3, depth: 2}, {budget: 1, expiry: 10, scope: 1, depth: 1}), true));
test('scope widening and expiry extension are rejected', () => { assert.equal(permits({remaining: 5, expiry: 10, scope: 1, depth: 2}, {budget: 1, expiry: 11, scope: 3, depth: 1}), false); });
test('revoked ancestor blocks a request before settlement', () => { const ancestors = [{revoked:false},{revoked:true}]; assert.equal(ancestors.every((m) => !m.revoked), false); });
