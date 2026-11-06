(function (root, factory) {
  const demo = factory(typeof module === 'object' && module.exports ? require('./coach.js') : root.RMCoach);
  if (typeof module === 'object' && module.exports) module.exports = demo;
  else root.RMCoachDemo = demo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  // Scene order and wording match Android CoachScenes.java. All places and signals are simulated.
  const QUESTION_SECONDS = 3.2, RESULT_SECONDS = 1, REROUTE_SECONDS = 1.2, PASSENGER_LEAVES_SECONDS = 1.6, SPEAK_SECONDS = 4.4;
  const scenes = Object.freeze([
    { id: 'intro', card: true, title: '길기억', lead: '놓친 길을 기억해, 필요할 때만 말합니다', seconds: 13,
      narration: '길기억은 운전자가 놓친 곳과 약한 회전 유형을 기억해, 필요할 때만 말하는 차량용 앱입니다. 이 영상은 가상 신호로 동작하는 시연입니다.' },
    { id: 'miss-1', tag: '일반 · 평소 주행', driver: 'general', turn: { id: 'exit-a', type: 'exit-left' }, from: 900, driveSeconds: 5,
      outcome: 'miss', question: '아까 그 출구, 놓치셨나요?', seconds: 20,
      narration: '왼쪽 출구를 놓치면 내비게이션이 재탐색합니다. 길기억은 주행 중에 끼어들지 않고, 정차한 뒤 운전자에게 확인합니다.' },
    { id: 'miss-2', tag: '일반 · 다른 길', driver: 'general', turn: { id: 'exit-b', type: 'exit-left' }, from: 900, driveSeconds: 4,
      outcome: 'miss', question: '아까 그 출구, 놓치셨나요?', seconds: 17,
      narration: '다른 길에서도 왼쪽 출구를 놓쳤다고 확인하면, 왼쪽 출구가 이 운전자의 약한 유형이 됩니다.' },
    { id: 'speak', tag: '일반 · 첫 출장길', driver: 'general', turn: { id: 'exit-c', type: 'exit-left' }, from: 1000, driveSeconds: 6,
      outcome: 'pass', seconds: 15,
      narration: '처음 가는 길이어도 약한 유형이 다가오는데 방향지시등이 꺼져 있으면, 한 문장으로 알립니다.' },
    { id: 'silent', tag: '일반 · 첫 출장길', driver: 'general', turn: { id: 'exit-d', type: 'exit-left' }, from: 1000, driveSeconds: 6,
      signalAt: 800, signalSide: 'left', outcome: 'pass', seconds: 15,
      narration: '운전자가 먼저 방향지시등을 켜면 준비한 것으로 보고, 아무 말도 하지 않습니다.' },
    { id: 'taxi', tag: '택시 · 승객 탑승', driver: 'taxi', turn: { id: 'exit-t', type: 'exit-left' }, from: 700, driveSeconds: 5, passenger: true,
      outcome: 'miss', question: '아까 그 출구, 놓치셨나요?', seconds: 20,
      narration: '택시 유형은 승객이 타면 지난 실수를 말하지 않습니다. 확인 질문도 승객이 내린 뒤로 미룹니다.' },
    { id: 'truck', tag: '화물 · 처음 가는 물류센터', driver: 'truck', turn: { id: 'exit-r', type: 'exit-right' }, from: 1000, driveSeconds: 6,
      outcome: 'pass', seconds: 16,
      narration: '화물 유형은 큰 차체를 고려해 더 일찍 판단합니다. 기본 판단 거리가 일반의 두 배인 600미터입니다.' },
    { id: 'narrow', tag: '화물 · 주의 구간', driver: 'truck', turn: { id: 'narrow-1', type: 'narrow-road' }, from: 900, driveSeconds: 5,
      outcome: 'pass', seconds: 13,
      narration: '내비게이션의 주의 지점 정보와 결합해, 좁은 길도 미리 알립니다.' },
    { id: 'bus-memo', tag: '버스 · 새 노선', driver: 'bus', memo: 'bus-point', memoText: '여기 헷갈려', noRoute: true, passenger: true, seconds: 9,
      narration: '새 노선에 배치된 기사가 헷갈린 곳에서 음성으로 메모를 남깁니다.' },
    { id: 'bus-remind', tag: '버스 · 다음 운행', driver: 'bus', point: 'bus-point', from: 400, driveSeconds: 5, pointMeters: 300, noRoute: true, passenger: true, seconds: 14,
      narration: '내비게이션 경로가 없어도, 다음 운행 때 그 지점에 다가가면 위치를 기준으로 알립니다.' },
    { id: 'outro', card: true, title: '사람, 차량, 업무에 맞춰 말합니다', lead: '현재는 가상 시연이며, Pleos Connect SDK 연동은 2차 심사 전까지 진행합니다', seconds: 14,
      narration: '길기억은 사람과 차량, 업무에 맞춰 말합니다. 현재는 가상 시연 단계이며, Pleos Connect SDK 연동은 2차 심사 전까지 진행합니다.' }
  ].map(Object.freeze));

  function seedProfiles() {
    const profiles = {};
    for (const type of Object.keys(C.driverTypes)) profiles[type] = C.createProfile(type, C.driverTypes[type].label, type);
    C.chooseWeak(profiles.taxi, 'exit-left');
    C.addMemo(profiles.taxi, 'exit-t');
    C.chooseWeak(profiles.truck, 'exit-right');
    C.chooseWeak(profiles.truck, 'narrow-road');
    return profiles;
  }
  function metersAt(scene, seconds) {
    return Math.round(scene.from * Math.max(0, 1 - seconds / scene.driveSeconds));
  }
  function signalAt(scene, meters) { return scene.signalAt && meters <= scene.signalAt ? scene.signalSide : 'off'; }
  function drivingDecision(scene, profile, meters) {
    if (scene.point) return meters <= scene.pointMeters ? C.decidePoint(profile, scene.point) : { action: 'wait', reason: 'too-far', speech: '' };
    return C.decide(profile, scene.turn, { meters, signal: signalAt(scene, meters), passenger: Boolean(scene.passenger) });
  }
  // First moment in a scene when the app speaks, found by stepping the same rule the driver would hit.
  function alertSeconds(scene, profile) {
    if (!scene.from) return null;
    for (let u = 0; u <= scene.driveSeconds; u += 0.05)
      if (drivingDecision(scene, profile, metersAt(scene, u)).action === 'speak') return Math.round(u * 100) / 100;
    return null;
  }
  function askSeconds(scene) { return scene.driveSeconds + REROUTE_SECONDS + (scene.passenger ? PASSENGER_LEAVES_SECONDS : 0); }
  function narrationSeconds(scene) {
    if (scene.card) return 0.6;
    if (scene.memo) return 2.4;
    return scene.question ? askSeconds(scene) + QUESTION_SECONDS : scene.driveSeconds + RESULT_SECONDS;
  }
  function finishScene(scene, profile) {
    if (scene.memo) C.addMemo(profile, scene.memo);
    if (scene.outcome === 'pass') C.notePass(profile, scene.turn, scene.signalAt);
    if (scene.outcome === 'miss') { C.noteMiss(profile, scene.turn); C.review(profile, true); }
  }
  function timeline(durations = {}) {
    let start = 0;
    const items = scenes.map(scene => {
      const seconds = durations[scene.id] || scene.seconds;
      const item = { scene, start, end: start + seconds };
      start += seconds;
      return item;
    });
    return { items, total: start };
  }
  function learned(profile) {
    const weak = Object.keys(C.turnTypes).filter(type => C.isWeak(profile, type)).map(type => C.turnTypes[type].label);
    return { driver: C.driverTypes[profile.driverType].label, weak, places: profile.places.length };
  }
  function stateAt(seconds, line = timeline()) {
    const profiles = seedProfiles();
    const time = Math.min(Math.max(seconds, 0), line.total - 0.001);
    for (const item of line.items) {
      const { scene } = item;
      const profile = scene.driver ? profiles[scene.driver] : null;
      if (time >= item.end) { if (profile) finishScene(scene, profile); continue; }
      const u = time - item.start;
      const base = { scene, index: line.items.indexOf(item), seconds: u, total: line.total, time };
      if (scene.card) return { ...base, phase: 'card' };
      const state = { ...base, driver: C.driverTypes[scene.driver], passenger: Boolean(scene.passenger), signal: 'off', meters: null, phase: 'driving' };
      if (scene.memo) {
        const saved = u >= 1.6;
        if (saved) C.addMemo(profile, scene.memo);
        return { ...state, phase: saved ? 'memo-saved' : 'memo', learned: learned(profile), limit: null, decision: { action: 'none', reason: 'memo', speech: '' } };
      }
      const alertAt = alertSeconds(scene, profile);
      const meters = metersAt(scene, Math.min(u, scene.driveSeconds));
      state.meters = meters;
      state.signal = signalAt(scene, meters);
      state.limit = scene.turn ? C.decisionMeters(profile, scene.turn) : scene.pointMeters;
      state.decision = drivingDecision(scene, profile, meters);
      state.spoken = alertAt === null ? '' : drivingDecision(scene, profile, metersAt(scene, alertAt)).speech;
      state.speaking = alertAt !== null && u >= alertAt && u < alertAt + SPEAK_SECONDS;
      state.learned = learned(profile);
      if (u >= scene.driveSeconds) {
        if (!scene.question) return { ...state, phase: 'passed' };
        const ask = askSeconds(scene);
        state.passenger = Boolean(scene.passenger) && u < scene.driveSeconds + REROUTE_SECONDS + PASSENGER_LEAVES_SECONDS * 0.6;
        if (u < scene.driveSeconds + REROUTE_SECONDS) return { ...state, phase: 'rerouting' };
        if (u < ask) return { ...state, phase: 'question-waiting' };
        if (u < ask + QUESTION_SECONDS) return { ...state, phase: 'question' };
        finishScene(scene, profile);
        return { ...state, phase: 'learned', learned: learned(profile), limit: C.decisionMeters(profile, scene.turn) };
      }
      return state;
    }
    return null;
  }
  // Timed speech for playback and for the recorded video, in time order.
  function events(line = timeline()) {
    const profiles = seedProfiles();
    const list = [];
    for (const item of line.items) {
      const { scene } = item;
      const profile = scene.driver ? profiles[scene.driver] : null;
      if (profile && !scene.memo) {
        const alertAt = alertSeconds(scene, profile);
        if (alertAt !== null) list.push({ at: item.start + alertAt, kind: 'alert', text: drivingDecision(scene, profile, metersAt(scene, alertAt)).speech });
      }
      if (scene.question) list.push({ at: item.start + askSeconds(scene), kind: 'alert', text: scene.question });
      list.push({ at: item.start + narrationSeconds(scene), kind: 'narration', text: scene.narration });
      if (profile) finishScene(scene, profile);
    }
    return list.sort((a, b) => a.at - b.at);
  }
  return Object.freeze({ scenes, timeline, stateAt, events, narrationSeconds });
});
