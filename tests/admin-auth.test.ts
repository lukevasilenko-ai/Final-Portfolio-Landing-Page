import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminAuthorizationTransition, getSupabaseAuthOptions, withTimeout } from '../src/lib/authLifecycle';

test('same-user auth refresh keeps the already-authorized admin shell mounted', () => {
  assert.equal(getAdminAuthorizationTransition('staging-admin', 'staging-admin'), 'background-check');
});

test('website-builder preview cannot refresh or persist the admin session', () => {
  assert.deepEqual(getSupabaseAuthOptions(true), {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  });
});

test('the admin client keeps normal session persistence enabled', () => {
  assert.deepEqual(getSupabaseAuthOptions(false), {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  });
});

test('a different user must pass a blocking administrator check', () => {
  assert.equal(getAdminAuthorizationTransition('another-user', 'staging-admin'), 'blocking-check');
});

test('a missing session immediately signs the admin out', () => {
  assert.equal(getAdminAuthorizationTransition(null, 'staging-admin'), 'signed-out');
});

test('a stuck administrator query fails closed with a bounded timeout', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => undefined), 5),
    { message: 'authorization_timeout' },
  );
});
