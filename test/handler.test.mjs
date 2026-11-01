import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handler } from '../lambda/index.js';

const context = { awsRequestId: 'local-test-request' };

async function capture(event) {
  const records = [];
  const originals = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, console[level]]));
  for (const level of Object.keys(originals)) console[level] = record => records.push({ level, record });
  try {
    const result = await handler(event, context);
    return { result, records };
  } catch (error) {
    return { error, records };
  } finally {
    Object.assign(console, originals);
  }
}

test('success emits correlated structured logs without recording arbitrary event data', async () => {
  const { result, records } = await capture({ scenario: 'success', password: 'never-log-this', email: 'private@example.invalid' });
  assert.equal(result.statusCode, 200);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(item => item.record.event), ['order_started', 'order_completed']);
  for (const { record } of records) {
    assert.equal(record.requestId, 'local-test-request');
    assert.equal(record.service, 'omni-handson-orders');
  }
  assert.ok(!JSON.stringify(records).includes('never-log-this'));
  assert.ok(!JSON.stringify(records).includes('private@example.invalid'));
});

test('warning produces a WARN record while the invocation succeeds', async () => {
  const { result, records } = await capture({ scenario: 'warning' });
  assert.equal(result.statusCode, 200);
  assert.equal(records.find(item => item.level === 'warn').record.event, 'inventory_low');
});

test('error produces a bounded diagnostic record and fails the invocation', async () => {
  const { error, records } = await capture({ scenario: 'error' });
  assert.equal(error.message, 'Simulated payment failure');
  assert.equal(records.at(-1).record.errorCode, 'PAYMENT_SIMULATED_FAILURE');
  assert.equal(records.at(-1).record.event, 'order_failed');
  assert.equal(records.at(-1).level, 'error');
});

test('unknown or malformed inputs do not get copied into diagnostics', async () => {
  for (const event of [null, 'secret-input', { scenario: 'secret-scenario' }, { scenario: { token: 'secret-token' } }]) {
    const { result, records } = await capture(event);
    assert.equal(result.statusCode, 200);
    assert.ok(records.every(item => item.record.scenario === 'success'));
    assert.ok(!JSON.stringify(records).includes('secret-'));
  }
});
