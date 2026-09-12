import test from 'node:test';
import assert from 'node:assert/strict';
import {bearerToken, error, json} from '../src/http';

test('reads a valid bearer token and rejects malformed values', () => {
  assert.equal(bearerToken(new Request('https://example.test', {headers: {Authorization: 'Bearer abc.def_123'}})), 'abc.def_123');
  assert.equal(bearerToken(new Request('https://example.test', {headers: {Authorization: 'Basic abc'}})), null);
  assert.equal(bearerToken(new Request('https://example.test')), null);
});

test('API responses have JSON and no-store headers', async () => {
  const response = json({data: {ok: true}});
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {data: {ok: true}});
});

test('errors keep a stable client code', async () => {
  const response = error('AUTH_REQUIRED', 'サインインが必要です。', 'r1', 401);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {error: {code: 'AUTH_REQUIRED', message: 'サインインが必要です。'}, requestId: 'r1'});
});
