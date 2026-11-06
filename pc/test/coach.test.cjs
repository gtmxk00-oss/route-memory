'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/coach.js');
const turn = (id = 'exit-1', type = 'exit-left') => ({ id, type });
function confirmMiss(profile, item) {
  C.noteMiss(profile, item);
  return C.review(profile, true);
}

test('one confirmed miss remembers the place but does not make a weak type', () => {
  const p = C.createProfile('a', 'A');
  const result = confirmMiss(p, turn());
  assert.equal(result.becameWeak, false);
  assert.equal(C.isWeak(p, 'exit-left'), false);
  assert.equal(C.remembers(p, 'exit-1'), true);
});

test('two confirmed misses of a type apply to a road the driver has never seen', () => {
  const p = C.createProfile('a', 'A');
  confirmMiss(p, turn('exit-1'));
  assert.equal(confirmMiss(p, turn('exit-2')).becameWeak, true);
  const decision = C.decide(p, turn('never-seen'), { meters: 500, signal: 'off', passenger: false });
  assert.equal(decision.action, 'speak');
  assert.equal(decision.speech, '왼쪽 출구가 곧 나옵니다. 미리 준비하세요.');
});

test('a driver with no history for a turn hears nothing extra', () => {
  const p = C.createProfile('a', 'A');
  assert.equal(C.decide(p, turn(), { meters: 100, signal: 'off' }).action, 'none');
});

test('an unconfirmed miss teaches nothing', () => {
  const p = C.createProfile('a', 'A');
  C.noteMiss(p, turn());
  assert.equal(C.review(p, false).confirmed, false);
  assert.equal(C.misses(p, 'exit-left'), 0);
  assert.equal(C.remembers(p, 'exit-1'), false);
});

test('the matching turn signal keeps the app silent, the wrong one does not', () => {
  const p = C.createProfile('a', 'A');
  C.chooseWeak(p, 'exit-left');
  const near = signal => C.decide(p, turn(), { meters: 200, signal });
  assert.equal(near('left').action, 'silent');
  assert.equal(near('off').action, 'speak');
  assert.equal(near('right').action, 'speak');
  assert.equal(near('right').reason, 'needs-attention');
});

test('nothing is said before the personal decision distance', () => {
  const p = C.createProfile('a', 'A');
  C.chooseWeak(p, 'exit-left');
  assert.equal(C.decide(p, turn(), { meters: 301, signal: 'off' }).action, 'wait');
  assert.equal(C.decide(p, turn(), { meters: 300, signal: 'off' }).action, 'speak');
});

test('turns without a side cannot be silenced by a signal', () => {
  const p = C.createProfile('a', 'A', 'truck');
  C.chooseWeak(p, 'narrow-road');
  const decision = C.decide(p, turn('n1', 'narrow-road'), { meters: 300, signal: 'left' });
  assert.equal(decision.action, 'speak');
  assert.equal(decision.speech, '좁은 길이 곧 나옵니다. 미리 준비하세요.');
});

test('driver types change the decision distance', () => {
  const distance = type => C.decisionMeters(C.createProfile('a', 'A', type), turn());
  assert.deepEqual(['general', 'taxi', 'truck', 'bus'].map(distance), [300, 300, 600, 450]);
});

test('each confirmed miss moves the decision earlier up to the type limit', () => {
  const general = C.createProfile('g', 'G');
  const truck = C.createProfile('t', 'T', 'truck');
  for (let i = 0; i < 6; i++) { confirmMiss(general, turn('g' + i)); confirmMiss(truck, turn('t' + i)); }
  assert.equal(C.decisionMeters(general, turn()), 900);
  assert.equal(C.decisionMeters(truck, turn()), 1200);
});

test('a late-signalling driver keeps the safety minimum, an early one is judged at the habit', () => {
  const late = C.createProfile('l', 'L');
  C.notePass(late, turn(), 100);
  assert.equal(C.decisionMeters(late, turn()), 300);
  const early = C.createProfile('e', 'E');
  C.notePass(early, turn(), 500);
  C.notePass(early, turn(), 700);
  assert.equal(early.habitMeters, 600);
  assert.equal(C.decisionMeters(early, turn()), 600);
});

test('a passenger hides the personal history in the sentence', () => {
  const p = C.createProfile('a', 'A', 'taxi');
  confirmMiss(p, turn());
  const state = passenger => ({ meters: 200, signal: 'off', passenger });
  assert.equal(C.decide(p, turn(), state(false)).speech, '지난번 놓친 왼쪽 출구예요. 미리 준비하세요.');
  assert.equal(C.decide(p, turn(), state(true)).speech, '왼쪽 출구 준비하세요.');
});

test('a bus never speaks personal history even with no passenger flag', () => {
  const p = C.createProfile('a', 'A', 'bus');
  confirmMiss(p, turn());
  assert.equal(C.decide(p, turn(), { meters: 200, signal: 'off', passenger: false }).speech, '왼쪽 출구 준비하세요.');
});

test('the review question waits until the car is parked and the passenger has left', () => {
  const p = C.createProfile('a', 'A', 'taxi');
  C.noteMiss(p, turn());
  assert.equal(C.canReview(p, { parked: false, passenger: false }), false);
  assert.equal(C.canReview(p, { parked: true, passenger: true }), false);
  assert.equal(C.canReview(p, { parked: true, passenger: false }), true);
});

test('a memo reminds the driver without any active route', () => {
  const p = C.createProfile('a', 'A', 'bus');
  assert.equal(C.decidePoint(p, 'stop-7').action, 'none');
  C.addMemo(p, 'stop-7');
  assert.equal(C.decidePoint(p, 'stop-7').speech, '헷갈렸던 지점입니다. 미리 확인하세요.');
});

test('three passes in a row offer to lower a weak type, and only approval lowers it', () => {
  const p = C.createProfile('a', 'A');
  C.chooseWeak(p, 'exit-left');
  assert.equal(C.notePass(p, turn()).offerLower, false);
  assert.equal(C.notePass(p, turn()).offerLower, false);
  assert.equal(C.notePass(p, turn()).offerLower, true);
  assert.equal(C.isWeak(p, 'exit-left'), true);
  C.lowerType(p, 'exit-left');
  assert.equal(C.isWeak(p, 'exit-left'), false);
});

test('a confirmed miss resets the pass streak', () => {
  const p = C.createProfile('a', 'A');
  C.chooseWeak(p, 'exit-left');
  C.notePass(p, turn());
  C.notePass(p, turn());
  confirmMiss(p, turn('other'));
  assert.equal(C.notePass(p, turn()).offerLower, false);
});

test('profiles do not share what they learned', () => {
  const parent = C.createProfile('p', 'P');
  const child = C.createProfile('c', 'C');
  confirmMiss(parent, turn('e1'));
  confirmMiss(parent, turn('e2'));
  assert.equal(C.decide(parent, turn('e3'), { meters: 100, signal: 'off' }).action, 'speak');
  assert.equal(C.decide(child, turn('e3'), { meters: 100, signal: 'off' }).action, 'none');
});

test('duplicate misses of one place create one question', () => {
  const p = C.createProfile('a', 'A');
  C.noteMiss(p, turn());
  C.noteMiss(p, turn());
  assert.equal(p.pending.length, 1);
});

test('unknown values fail loudly', () => {
  assert.throws(() => C.createProfile('a', 'A', 'tractor'), TypeError);
  assert.throws(() => C.chooseWeak(C.createProfile('a', 'A'), 'jump'), TypeError);
});

const D = require('../src/coach-demo.js');
const sceneState = (id, offset) => {
  const line = D.timeline();
  const item = line.items.find(i => i.scene.id === id);
  return D.stateAt(item.start + offset, line);
};

test('the demo tells only what the rules decide', () => {
  const events = D.events().filter(e => e.kind === 'alert').map(e => e.text);
  assert.deepEqual(events, [
    '아까 그 출구, 놓치셨나요?', '아까 그 출구, 놓치셨나요?',
    '왼쪽 출구가 곧 나옵니다. 미리 준비하세요.',
    '왼쪽 출구 준비하세요.', '아까 그 출구, 놓치셨나요?',
    '오른쪽 출구가 곧 나옵니다. 미리 준비하세요.',
    '좁은 길이 곧 나옵니다. 미리 준비하세요.',
    '헷갈렸던 지점입니다. 미리 확인하세요.'
  ]);
});

test('the signal scene stays silent all the way to the exit', () => {
  const line = D.timeline();
  const item = line.items.find(i => i.scene.id === 'silent');
  assert.equal(D.events(line).some(e => e.kind === 'alert' && e.at >= item.start && e.at < item.end), false);
  assert.equal(sceneState('silent', 4).decision.action, 'silent');
});

test('the second confirmed miss makes the weak type visible in the demo', () => {
  assert.deepEqual(sceneState('miss-1', 14).learned.weak, []);
  assert.deepEqual(sceneState('miss-2', 11.5).learned.weak, ['왼쪽 출구']);
});

test('the taxi question appears only after the passenger has left', () => {
  assert.equal(sceneState('taxi', 6.5).phase, 'question-waiting');
  const asked = sceneState('taxi', 8.2);
  assert.equal(asked.phase, 'question');
  assert.equal(asked.passenger, false);
});

test('truck judges earlier than the general base distance', () => {
  assert.equal(sceneState('truck', 1).limit, 600);
});

test('state is a pure function of time', () => {
  assert.deepEqual(D.stateAt(40).decision, D.stateAt(40).decision);
  assert.equal(D.stateAt(1e9).scene.id, 'outro');
});

test('narration never starts before its scene and fits custom durations', () => {
  const line = D.timeline({ intro: 20 });
  assert.equal(line.items[1].start, 20);
  for (const item of line.items) assert.ok(D.narrationSeconds(item.scene) < item.end - item.start);
});
