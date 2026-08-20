import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  transition,
  nextStateAfterBuilderStatus,
  nextStateAfterReviewVerdict,
  checkIterationGuards,
  getAllowedTransitions,
  STATES,
} from '../src/state-machine.mjs';

test('all expected states are defined', () => {
  for (const s of [
    'IDLE',
    'TASK_SELECTED',
    'BUILDING',
    'BUILDER_RESULT',
    'REVIEWING',
    'TASK_COMPLETE',
    'NEEDS_JACOB_APPROVAL',
    'BLOCKED',
    'BLOCKED_MAX_ITERATIONS',
    'READY_FOR_JACOB_REVIEW',
  ]) {
    assert.ok(STATES.includes(s), s);
  }
});

test('valid transitions accepted', () => {
  assert.equal(transition('IDLE', 'TASK_SELECTED'), 'TASK_SELECTED');
  assert.equal(transition('TASK_SELECTED', 'BUILDING'), 'BUILDING');
  assert.equal(transition('BUILDING', 'BUILDER_RESULT'), 'BUILDER_RESULT');
  assert.equal(transition('BUILDER_RESULT', 'REVIEWING'), 'REVIEWING');
  assert.equal(transition('REVIEWING', 'TASK_COMPLETE'), 'TASK_COMPLETE');
  assert.equal(transition('TASK_COMPLETE', 'READY_FOR_JACOB_REVIEW'), 'READY_FOR_JACOB_REVIEW');
  assert.equal(transition('BUILDER_RESULT', 'NEEDS_JACOB_APPROVAL'), 'NEEDS_JACOB_APPROVAL');
  assert.equal(transition('BUILDER_RESULT', 'BLOCKED'), 'BLOCKED');
  assert.equal(transition('REVIEWING', 'BUILDING'), 'BUILDING');
});

test('invalid transitions rejected', () => {
  assert.equal(canTransition('IDLE', 'BUILDING'), false);
  assert.throws(() => transition('IDLE', 'BUILDING'));
  assert.throws(() => transition('READY_FOR_JACOB_REVIEW', 'IDLE'));
  assert.throws(() => transition('BLOCKED', 'BUILDING'));
  assert.throws(() => transition('NEEDS_JACOB_APPROVAL', 'TASK_COMPLETE'));
});

test('owner approval gate via builder NEEDS_APPROVAL', () => {
  assert.equal(nextStateAfterBuilderStatus('NEEDS_APPROVAL'), 'NEEDS_JACOB_APPROVAL');
});

test('builder IMPLEMENTED/PARTIALLY_IMPLEMENTED go to REVIEWING', () => {
  assert.equal(nextStateAfterBuilderStatus('IMPLEMENTED'), 'REVIEWING');
  assert.equal(nextStateAfterBuilderStatus('PARTIALLY_IMPLEMENTED'), 'REVIEWING');
  assert.equal(nextStateAfterBuilderStatus('BLOCKED'), 'BLOCKED');
});

test('reviewer verdict mapping', () => {
  assert.equal(
    nextStateAfterReviewVerdict('APPROVED', { taskIteration: 0, maxTaskIterations: 10 }),
    'TASK_COMPLETE',
  );
  assert.equal(
    nextStateAfterReviewVerdict('CHANGES_REQUIRED', { taskIteration: 1, maxTaskIterations: 10 }),
    'BUILDING',
  );
  assert.equal(
    nextStateAfterReviewVerdict('BLOCKED', { taskIteration: 0, maxTaskIterations: 10 }),
    'BLOCKED',
  );
});

test('max task iteration guard', () => {
  const g = checkIterationGuards({
    taskIteration: 10,
    maxTaskIterations: 10,
    projectIteration: 0,
    maxProjectIterations: 100,
  });
  assert.equal(g.blocked, true);
  assert.equal(g.state, 'BLOCKED_MAX_ITERATIONS');
  assert.equal(
    nextStateAfterReviewVerdict('CHANGES_REQUIRED', { taskIteration: 10, maxTaskIterations: 10 }),
    'BLOCKED_MAX_ITERATIONS',
  );
});

test('max project iteration guard', () => {
  const g = checkIterationGuards({
    taskIteration: 0,
    maxTaskIterations: 10,
    projectIteration: 100,
    maxProjectIterations: 100,
  });
  assert.equal(g.blocked, true);
  assert.equal(g.state, 'BLOCKED_MAX_ITERATIONS');
});

test('stop states have no outbound transitions', () => {
  for (const s of ['NEEDS_JACOB_APPROVAL', 'BLOCKED', 'BLOCKED_MAX_ITERATIONS', 'READY_FOR_JACOB_REVIEW']) {
    assert.deepEqual(getAllowedTransitions(s), []);
  }
});
