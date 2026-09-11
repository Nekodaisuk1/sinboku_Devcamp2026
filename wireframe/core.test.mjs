import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {routeDomains, routesForDomain, decisionPoints, mathLevels, mathSpread, ROUTES_CHECKED_ON} from './routes.mjs';
import {buildTimeline, nextDecision, stageWhen, schoolYearStart, STAGES, GRADES, validateStances, validateGrade} from './timeline.mjs';
import {validateLog, addEntry, removeEntry, byMonth, recentCount, sortLog, LOG_LIMIT} from './log.mjs';
import {encodeState, decodeState, emptyState} from './store.mjs';
import {verbs, activitiesForVerb, activitiesByTopic, domainsForVerb, resourcesForVerb, allActivities, verbCoverage, domains, topics, resources} from './verbs.mjs';
import {searchCatalog, catalogIds, normalizeQuery} from './catalog.mjs';
import {validateKnowledge} from './scripts/knowledge.mjs';

const catalog = {...catalogIds(), routes: new Set(routeDomains().flatMap(id => routesForDomain(id, {name: id}).map(route => route.id)))};

/* --- Build 14 から引き継いだ経路の要件。再構成で壊れていないことを確かめる --- */

test('every published field offers at least three routes of different kinds', () => {
  for (const domainId of routeDomains()) {
    const routes = routesForDomain(domainId, {name: domainId});
    assert.ok(routes.length >= 3, `${domainId} has ${routes.length} routes`);
    assert.equal(new Set(routes.map(route => route.kind)).size, routes.length, `${domainId} repeats a route kind`);
    assert.deepEqual(routes.map(route => route.order), [...routes.map(route => route.order)].sort((a, b) => a - b));
  }
});

test('each route ends at the present and states a deferral deadline for every earlier decision', () => {
  for (const domainId of routeDomains()) {
    for (const route of routesForDomain(domainId, {name: domainId})) {
      const last = route.steps.at(-1);
      assert.equal(last.stage, 'now');
      assert.equal(last.decision, null, 'the final step is what cannot be deferred');
      for (const step of route.steps.slice(0, -1)) {
        const point = decisionPoints[step.decision];
        assert.ok(point, `${route.id}/${step.stage} has no decision point`);
        assert.match(point.defer, /まで/);
        assert.ok(point.detail.length > 20);
      }
      assert.deepEqual(route.steps.map(step => step.decision), ['lab', 'faculty', 'course', 'highschool', null]);
    }
  }
});

test('routes carry a math level, and the requirement differs between routes to the same field', () => {
  let varied = 0;
  for (const domainId of routeDomains()) {
    const routes = routesForDomain(domainId, {name: domainId});
    for (const route of routes) {
      assert.ok(mathLevels[route.math.level], `${route.id} has no math level`);
      assert.equal(route.math.label, mathLevels[route.math.level].label);
      assert.ok(route.math.detail.length > 20);
    }
    if (mathSpread(routes).varies) varied += 1;
  }
  assert.equal(varied, routeDomains().length, 'every field should show that the maths ceiling depends on the route');
});

test('route sources are official https pages with an attribution and a check date', () => {
  for (const domainId of routeDomains()) {
    for (const route of routesForDomain(domainId, {name: domainId})) {
      assert.equal(route.checkedOn, ROUTES_CHECKED_ON);
      for (const step of route.steps) {
        if (!step.link) continue;
        assert.match(step.link.url, /^https:\/\//, `${route.id} links to ${step.link.url}`);
        assert.ok(step.link.source.trim(), `${route.id} has an unattributed link`);
      }
      assert.ok(route.steps.find(step => step.stage === 'university').link, `${route.id} must cite the university`);
    }
  }
});

test('every field reachable from a verb has routes, so the verb entry never dead-ends', () => {
  for (const verb of verbs) {
    for (const field of domainsForVerb(verb.id)) {
      assert.ok(routesForDomain(field.id, field).length >= 3, `${verb.id} → ${field.id} has no routes`);
    }
  }
});

/* --- Build 19: 7年の地図 --- */

test('the timeline orders decisions from far future to now and marks exactly one as next', () => {
  const timeline = buildTimeline({gradeId: 'j3', today: new Date('2026-09-12T00:00:00+09:00')});
  assert.deepEqual(timeline.map(rung => rung.decision), ['lab', 'faculty', 'course', 'highschool']);
  assert.equal(timeline.filter(rung => rung.status === 'next').length, 1);
  assert.equal(nextDecision(timeline).decision, 'highschool', 'a third-year student decides the high school next');
  assert.ok(timeline.every(rung => rung.defer && rung.detail), 'every rung keeps its deferral wording');
});

test('the school year, not the calendar year, decides when a stage falls', () => {
  assert.equal(schoolYearStart(new Date('2026-09-12T00:00:00+09:00')), 2026);
  assert.equal(schoolYearStart(new Date('2027-02-01T00:00:00+09:00')), 2026, 'February still belongs to the previous school year');
  const highschool = STAGES.find(stage => stage.decision === 'highschool');
  assert.deepEqual(stageWhen(highschool, 'j3', new Date('2026-09-12T00:00:00+09:00')), {year: 2026, month: 12, months: 3});
  // 高1の11月は、中3の9月から見て1年と2か月先。
  const course = STAGES.find(stage => stage.decision === 'course');
  assert.equal(stageWhen(course, 'j3', new Date('2026-09-12T00:00:00+09:00')).months, 14);
});

test('without a grade the map still renders, and no countdown is invented', () => {
  const timeline = buildTimeline({today: new Date('2026-09-12T00:00:00+09:00')});
  assert.equal(timeline.length, STAGES.length);
  assert.ok(timeline.every(rung => rung.when === null && rung.status === 'unknown'));
  assert.equal(nextDecision(timeline).decision, 'highschool', 'the nearest rung is still reachable');
});

test('passed decisions are marked past rather than hidden or re-asked', () => {
  const timeline = buildTimeline({gradeId: 'h2', today: new Date('2026-09-12T00:00:00+09:00')});
  const byId = Object.fromEntries(timeline.map(rung => [rung.decision, rung]));
  assert.equal(byId.highschool.status, 'past');
  assert.equal(byId.course.status, 'past');
  assert.equal(byId.faculty.status, 'next');
});

test('a stance is optional, length-bounded, and blank stances are not stored', () => {
  assert.deepEqual(validateStances({highschool: '  '}), {}, 'a blank stance is the same as none');
  assert.deepEqual(validateStances({highschool: '高専も見てる'}), {highschool: '高専も見てる'});
  assert.deepEqual(validateStances(undefined), {});
  assert.throws(() => validateStances({nosuch: 'x'}), /Unknown decision/);
  assert.throws(() => validateStances({highschool: 'あ'.repeat(61)}), /Invalid stance/);
  assert.equal(validateGrade(null), null);
  assert.throws(() => validateGrade('k9'), /Unknown grade/);
  assert.ok(GRADES.every(grade => validateGrade(grade.id) === grade.id));
});

/* --- Build 19: やったことの記録 --- */

const logContext = {verbIds: catalog.verbs, activityIds: catalog.activities};

test('records keep newest first, carry provenance, and survive a save/restore round trip', () => {
  const activity = allActivities()[0];
  let entries = addEntry([], {text: '海の写真を3枚見た', date: '2026-09-10', id: 'r1'});
  entries = addEntry(entries, {text: activity.title, verb: activity.verb, activity: activity.id, date: '2026-09-12', id: 'r2'});
  assert.deepEqual(entries.map(entry => entry.id), ['r2', 'r1']);
  const restored = decodeState(encodeState({...emptyState(), log: entries}), catalog);
  assert.deepEqual(restored.log, entries);
  assert.equal(restored.log[0].activity, activity.id, 'the originating activity is kept');
});

test('records reject unknown verbs, unknown activities, bad dates and oversize text', () => {
  const base = {id: 'r1', date: '2026-09-12', text: 'ok', verb: null, activity: null};
  assert.doesNotThrow(() => validateLog([base], logContext));
  assert.throws(() => validateLog([{...base, verb: 'nosuchverb'}], logContext), /Unknown verb/);
  assert.throws(() => validateLog([{...base, activity: 'nosuchactivity'}], logContext), /Unknown activity/);
  assert.throws(() => validateLog([{...base, date: '2026-02-30'}], logContext), /record date/);
  assert.throws(() => validateLog([{...base, text: 'あ'.repeat(141)}], logContext), /record text/);
  assert.throws(() => validateLog([base, base], logContext), /Duplicate/);
});

test('records can be removed, grouped by month, and counted over a recent window', () => {
  const entries = [
    {id: 'a', date: '2026-09-12', text: '1', verb: null, activity: null},
    {id: 'b', date: '2026-09-01', text: '2', verb: null, activity: null},
    {id: 'c', date: '2026-08-20', text: '3', verb: null, activity: null}
  ];
  assert.deepEqual(byMonth(entries).map(group => [group.month, group.items.length]), [['2026-09', 2], ['2026-08', 1]]);
  assert.equal(recentCount(entries, 7, new Date('2026-09-12T12:00:00+09:00')), 1);
  assert.deepEqual(removeEntry(entries, 'b').map(entry => entry.id), ['a', 'c']);
  assert.deepEqual(sortLog(entries).map(entry => entry.id), ['a', 'b', 'c']);
});

test('the record list is capped so a long-running map cannot grow without limit', () => {
  const full = Array.from({length: LOG_LIMIT}, (_, index) => ({id: `r${index}`, date: '2026-09-12', text: 'x', verb: null, activity: null}));
  assert.throws(() => addEntry(full, {text: 'one more'}), /500件まで/);
  assert.throws(() => validateLog([...full, {id: 'extra', date: '2026-09-12', text: 'x'}], logContext), /Invalid record list/);
});

/* --- Build 19: 動詞を入口にする層 --- */

test('every verb crosses at least two interests, so it is not a sub-category of one topic', () => {
  for (const verb of verbs) {
    const grouped = activitiesByTopic(verb.id);
    assert.ok(grouped.length >= 2, `${verb.id} only appears under ${grouped.length} interest(s)`);
    assert.ok(activitiesForVerb(verb.id).length >= 3, `${verb.id} has too few activities to be an entry point`);
    assert.ok(domainsForVerb(verb.id).length >= 2, `${verb.id} lands in too few fields`);
  }
});

test('every activity is reachable from exactly one verb and declares time and place', () => {
  const seen = new Set();
  for (const activity of allActivities()) {
    assert.ok(catalog.verbs.has(activity.verb), `${activity.id} has no verb`);
    assert.ok(Number.isInteger(activity.minutes) && activity.minutes >= 5, `${activity.id} has no time estimate`);
    assert.equal(typeof activity.athome, 'boolean');
    assert.ok(catalog.activities.has(activity.id));
    assert.equal(seen.has(activity.id), false, `${activity.id} is listed twice`);
    seen.add(activity.id);
  }
  assert.equal(seen.size, verbs.reduce((total, verb) => total + activitiesForVerb(verb.id).length, 0));
});

test('a home-only filter narrows without emptying any verb, and never invents entries', () => {
  for (const verb of verbs) {
    const all = activitiesForVerb(verb.id);
    const home = activitiesForVerb(verb.id, {athome: true});
    assert.ok(home.length >= 1, `${verb.id} has nothing that can be done at home`);
    assert.ok(home.length <= all.length);
    assert.ok(home.every(activity => activity.athome && all.includes(activity)));
  }
});

test('listed resources reached through a verb keep their source, check date and conditions', () => {
  for (const verb of verbs) {
    for (const item of resourcesForVerb(verb.id)) {
      assert.match(item.url, /^https?:\/\//);
      assert.ok(item.source.trim() && /^\d{4}-\d{2}-\d{2}$/.test(item.checkedOn), `${item.id} lacks attribution`);
      assert.ok(item.conditions.length >= 1, `${item.id} lists no conditions`);
    }
  }
  const coverage = verbCoverage(verbs[0].id);
  assert.ok(coverage.activities > 0 && coverage.domains > 0, 'coverage counts are shown rather than hidden');
});

/* --- 検索と保存 --- */

test('search normalizes kana, case and width without inventing unknown matches', () => {
  assert.equal(normalizeQuery('ゲーム'), normalizeQuery('げーむ'));
  // 表記ゆれは、その語が掲載データのどこかに書かれている場合にだけ効く。
  const katakana = searchCatalog('スクラッチ');
  assert.ok(katakana.some(entry => entry.id === 'scratch-create'), 'a registered keyword is searchable');
  assert.deepEqual(searchCatalog('すくらっち').map(entry => entry.id), katakana.map(entry => entry.id));
  assert.deepEqual(searchCatalog('ｽｸﾗｯﾁ').map(entry => entry.id), katakana.map(entry => entry.id));
  assert.ok(searchCatalog('発酵').some(entry => entry.type === 'resource'));
  assert.equal(searchCatalog('存在しない架空の学校名').length, 0, 'nothing is fabricated for an unmatched query');
  assert.ok(searchCatalog('つくる').some(entry => entry.type === 'verb'));
});

test('the home filter only keeps entries that state they are free and online, or doable at home', () => {
  for (const entry of searchCatalog('', 'home')) {
    if (entry.activity) assert.equal(entry.activity.athome, true);
    else if (entry.resource) assert.ok(entry.resource.online && entry.resource.free);
  }
  assert.ok(searchCatalog('', 'study').every(entry => entry.resource?.group === 'study'));
});

test('stored state round-trips, and unknown ids fail loudly instead of being dropped', () => {
  const route = [...catalog.routes][0];
  const resource = [...catalog.resources][0];
  const state = {...emptyState(), grade: 'j3', stances: {highschool: 'まだ決めてない'}, marks: [resource], heldRoutes: [route], verb: verbs[0].id, expanded: true};
  assert.deepEqual(decodeState(encodeState(state), catalog), state);
  assert.throws(() => decodeState(encodeState({...state, marks: ['nosuch-resource']}), catalog), /Unknown marked resource/);
  assert.throws(() => decodeState(encodeState({...state, heldRoutes: ['ecology-nosuchkind']}), catalog), /Unknown route/);
  assert.throws(() => decodeState(encodeState({...state, verb: 'nosuchverb'}), catalog), /Unknown verb/);
  assert.throws(() => decodeState(JSON.stringify({version: 1, saved: []}), catalog), /別の形式/);
});

test('an empty state is valid, so a first visit never has to record anything', () => {
  const restored = decodeState(encodeState(emptyState()), catalog);
  assert.deepEqual(restored, emptyState());
  assert.equal(restored.grade, null);
  assert.deepEqual(restored.stances, {});
  assert.deepEqual(restored.log, []);
});

/* --- データの検査 --- */

test('knowledge data rejects broken links, cycles, duplicates and invalid publication dates', async () => {
  const data = JSON.parse(await readFile(new URL('./data/knowledge.json', import.meta.url), 'utf8'));
  assert.equal(validateKnowledge(data), data);
  const missing = structuredClone(data); missing.resources[0].conceptIds = ['missing'];
  assert.throws(() => validateKnowledge(missing));
  const cycle = structuredClone(data); cycle.concepts[0].broader = ['marine-life'];
  assert.throws(() => validateKnowledge(cycle));
  const duplicate = structuredClone(data); duplicate.resources.push(duplicate.resources[0]);
  assert.throws(() => validateKnowledge(duplicate));
});

test('knowledge data rejects a verb that is too thin to be an entry point', async () => {
  const data = JSON.parse(await readFile(new URL('./data/knowledge.json', import.meta.url), 'utf8'));
  const thin = structuredClone(data);
  thin.verbs.push({id: 'zzz', label: '足す', icon: '+', summary: 'まだ活動がない動詞。', detail: '入口にできるだけの活動がない。', domains: ['design']});
  assert.throws(() => validateKnowledge(thin), /at least 3/);
  const unlabelled = structuredClone(data);
  unlabelled.directions.games[0].activities[0].verb = 'nosuchverb';
  assert.throws(() => validateKnowledge(unlabelled), /no known verb/);
  const untagged = structuredClone(data);
  untagged.resources.find(resource => resource.group !== 'study').verbs = [];
  assert.throws(() => validateKnowledge(untagged), /needs at least one verb/);
});

test('fields, interests and resources are defined in data rather than in the screen code', () => {
  assert.equal(Object.keys(domains).length, 8);
  assert.ok(Object.keys(topics).length >= 4);
  assert.ok(Object.keys(resources).length >= 40, `only ${Object.keys(resources).length} resources are published`);
  for (const [id, topic] of Object.entries(topics)) {
    assert.ok(topic.ids.every(field => domains[field]), `${id} points at an unknown field`);
  }
});

test('a collapsed ladder still shows the next decision, whatever the grade', () => {
  // 画面が畳んだときに出す範囲の決め方（app.js の nowPage と同じ規則）。
  const collapsed = timeline => {
    const nextIndex = timeline.findIndex(rung => rung.status === 'next');
    const start = Math.min(nextIndex === -1 ? timeline.length - 2 : nextIndex, timeline.length - 2);
    return timeline.slice(start);
  };
  for (const grade of [...GRADES.map(item => item.id), null]) {
    const timeline = buildTimeline({gradeId: grade, today: new Date('2026-09-12T00:00:00+09:00')});
    const visible = collapsed(timeline);
    assert.ok(visible.length >= 2, `${grade} collapses to ${visible.length} rung(s)`);
    const next = timeline.find(rung => rung.status === 'next');
    if (next) assert.ok(visible.includes(next), `${grade} hides its next decision when collapsed`);
    assert.ok(visible.includes(nextDecision(timeline)), `${grade} hides the nearest rung`);
  }
});
