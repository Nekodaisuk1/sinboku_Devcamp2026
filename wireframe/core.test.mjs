import {encodeMapShare, decodeMapShare} from './map-share.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {routeDomains, routesForDomain, decisionPoints, mathLevels, mathSpread, ROUTES_CHECKED_ON} from './routes.mjs';
import {buildTimeline, nextDecision, stageWhen, schoolYearStart, STAGES, GRADES, validateStances, validateGrade} from './timeline.mjs';
import {validateLog, addEntry, removeEntry, byMonth, recentCount, sortLog, LOG_LIMIT} from './log.mjs';
import {encodeState, decodeState, emptyState, STATE_BYTES} from './store.mjs';
import {verbs, activitiesForVerb, activitiesByTopic, domainsForVerb, resourcesForVerb, allActivities, verbCoverage, domains, topics, resources} from './verbs.mjs';
import {
  searchCatalog, catalogIds, normalizeQuery,
  CATEGORIES, STALE_DAYS, freshnessOf, filterResources, coverage, coverageSentence
} from './catalog.mjs';
import {validateKnowledge} from './scripts/knowledge.mjs';
import {PREFECTURES} from './regions.mjs';
import {encodeRecommendation, decodeRecommendation, receiveRecommendation, validateRecommendations,
        RECOMMENDATION_LIMIT} from './recommendations.mjs';
import * as fieldModule from './field.mjs';
import {universityCandidates, universityCandidatesForDomain, EDUCATION_CHECKED_ON} from './education.mjs';
import {schoolId, dismissSchool, recordSchoolView, toggleSchoolMark, formatSchoolViewTime, SCHOOL_RECORD_LIMIT} from './school-records.mjs';

const routeRecords = routeDomains().flatMap(domainId => routesForDomain(domainId, {name: domainId}).map(route => ({domainId, route})));
const catalog = {
  ...catalogIds(),
  routes: new Set(routeRecords.map(({route}) => route.id)),
  schools: new Set(routeRecords.flatMap(({route}) => route.steps
    .filter(step => ['university', 'highschool'].includes(step.stage) && step.link)
    .map(step => schoolId(step.link.url, step.title))))
};

test('a shared map round-trips graph nodes without private records or photo data', () => {
  const placements = [
    {id: 'topic-1', lane: 'now', x: 0.2, label: topics.games.label, kind: 'topic', ref: 'games', verb: null, note: '', topic: null, url: null, title: null, photo: null, domains: null, source: 'catalog'},
    {id: 'outside-1', lane: 'faculty', x: 0.7, label: 'ゲーム制作イベント', kind: 'link', ref: null, verb: null, note: 'private memo', topic: null, url: 'https://example.org/event', title: 'ゲーム制作イベント', photo: null, domains: ['media', 'information'], source: 'self'},
    {id: 'photo-1', lane: 'now', x: 0.5, label: '作った模型', kind: 'photo', ref: null, verb: null, note: '', topic: null, url: null, title: '作った模型', photo: 'data:image/jpeg;base64,YQ==', domains: ['design'], source: 'self'}
  ];
  const encoded = encodeMapShare(placements, catalog);
  assert.ok(encoded.length <= 6000);
  assert.ok(!encoded.includes('private memo'));
  const decoded = decodeMapShare(encoded, catalog);
  assert.deepEqual(decoded.map(item => [item.id, item.kind, item.label, item.lane, item.domains]), [
    ['topic-1', 'topic', topics.games.label, 'now', null],
    ['outside-1', 'link', 'ゲーム制作イベント', 'faculty', ['media', 'information']],
    ['photo-1', 'custom', '作った模型', 'now', ['design']]
  ]);
  assert.ok(decoded.every(item => item.note === '' && item.photo === null));
});

test('a shared map rejects malformed and oversized payloads instead of partially loading them', () => {
  assert.throws(() => decodeMapShare('not-a-map', catalog), /共有リンク/);
  assert.throws(() => decodeMapShare('a'.repeat(6001), catalog), /長すぎ/);
});

test('an interest plan contains only the interests the user explicitly chose', () => {
  assert.equal(typeof fieldModule.buildInterestPlan, 'function');
  const plan = fieldModule.buildInterestPlan({
    topicIds: ['games', 'music', 'games'],
    customLabel: '天体観測',
    verbId: 'observe'
  });
  assert.deepEqual(plan.map(item => [item.kind, item.ref, item.label, item.verb]), [
    ['topic', 'games', topics.games.label, null],
    ['topic', 'music', topics.music.label, null],
    ['custom', null, '天体観測', 'observe']
  ]);
  assert.throws(() => fieldModule.buildInterestPlan({topicIds: ['unknown']}), /Unknown topic/);
  assert.throws(() => fieldModule.buildInterestPlan({customLabel: '天体観測'}), /ジャンル/);
});

test('a custom interest stores its explicitly selected science genres separately', () => {
  const plan = fieldModule.buildInterestPlan({
    customLabel: '天体観測',
    domainIds: ['physics', 'earth-science', 'physics']
  });
  assert.deepEqual(plan, [{
    kind: 'custom', ref: null, label: '天体観測', verb: null,
    topic: null, domains: ['physics', 'earth-science'], source: 'self'
  }]);
  assert.throws(
    () => fieldModule.buildInterestPlan({customLabel: '天体観測'}),
    /ジャンル/
  );
  assert.throws(
    () => fieldModule.buildInterestPlan({customLabel: '天体観測', domainIds: ['unknown']}),
    /Unknown domain/
  );
});

test('external information keeps the genres chosen by the student', () => {
  const draft = fieldModule.buildExternalInformationDraft({
    url: 'https://example.org/game-design',
    title: 'ゲームデザインの記事',
    domainIds: ['media', 'information', 'media'],
    lane: 'now'
  });
  assert.equal(draft.kind, 'link');
  assert.deepEqual(draft.domains, ['media', 'information']);
  assert.deepEqual(fieldModule.reachOf({...draft, id: 'outside', x: 0.5, label: draft.title}), ['media', 'information']);
  assert.throws(() => fieldModule.buildExternalInformationDraft({url: 'javascript:alert(1)'}), /http/);
  assert.throws(() => fieldModule.buildExternalInformationDraft({url: 'https://example.org', domainIds: ['not-a-domain']}), /Unknown domain/);
});

test('school search results land on the matching education stage', () => {
  assert.equal(typeof fieldModule.laneForResource, 'function');
  assert.equal(fieldModule.laneForResource({category: 'school'}), 'highschool');
  assert.equal(fieldModule.laneForResource({category: 'university'}), 'faculty');
  assert.equal(fieldModule.laneForResource({category: 'event'}), 'now');
  assert.equal(typeof fieldModule.placementForResource, 'function');
  assert.deepEqual(
    fieldModule.placementForResource('kaiyo-life', {name: '東京海洋大学 海洋生命科学部', category: 'university'}),
    {kind: 'resource', ref: 'kaiyo-life', label: '東京海洋大学 海洋生命科学部', lane: 'faculty'}
  );
});

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

test('school decisions and browsing history have separate durable records', () => {
  const state = emptyState();
  assert.deepEqual(state.schoolMarks, []);
  assert.deepEqual(state.schoolDismissals, []);
  assert.deepEqual(state.schoolViews, []);
});

test('school decisions and history survive saving, while older state gets empty records', () => {
  const id = [...catalog.schools][0];
  const school = {schoolId: id, label: 'Example School', stage: id.endsWith('-university') ? 'university' : 'highschool', domain: 'media', url: 'https://example.edu/'};
  const state = {
    ...emptyState(),
    schoolMarks: [id],
    schoolDismissals: [{...school, reason: '希望と違った', date: '2026-09-12'}],
    schoolViews: [{...school, viewedAt: '2026-09-12T03:00:00.000Z'}]
  };
  assert.deepEqual(decodeState(encodeState(state), catalog), state);
  const old = JSON.parse(encodeState(emptyState()));
  delete old.schoolMarks;
  delete old.schoolDismissals;
  delete old.schoolViews;
  const restored = decodeState(JSON.stringify(old), catalog);
  assert.deepEqual([restored.schoolMarks, restored.schoolDismissals, restored.schoolViews], [[], [], []]);
});

test('school marks toggle, while dismissing a school requires a reason', () => {
  assert.deepEqual(toggleSchoolMark([], 'route-media-general-university'), ['route-media-general-university']);
  assert.deepEqual(toggleSchoolMark(['route-media-general-university'], 'route-media-general-university'), []);
  const school = {schoolId: 'route-media-general-university', label: 'Example University', stage: 'university', domain: 'media', url: 'https://example.edu/'};
  assert.throws(() => dismissSchool([], school, {reason: '  ', date: '2026-09-12'}), /理由/);
  assert.equal(dismissSchool([], school, {reason: '実習内容が希望と違った', date: '2026-09-12'})[0].reason, '実習内容が希望と違った');
});

test('opening the same school again moves it to the top instead of flooding history', () => {
  const first = {schoolId: 'route-media-general-university', label: 'Example University', stage: 'university', domain: 'media', url: 'https://example.edu/'};
  const second = {...first, schoolId: 'route-media-specialized-university', label: 'Second University', url: 'https://second.example.edu/'};
  let history = recordSchoolView([], first, '2026-09-12T01:00:00.000Z');
  history = recordSchoolView(history, second, '2026-09-12T02:00:00.000Z');
  history = recordSchoolView(history, first, '2026-09-12T03:00:00.000Z');
  assert.deepEqual(history.map(item => item.schoolId), [first.schoolId, second.schoolId]);
  assert.equal(history[0].viewedAt, '2026-09-12T03:00:00.000Z');
  assert.ok(history.length <= SCHOOL_RECORD_LIMIT);
  assert.match(formatSchoolViewTime('2026-09-12T06:36:00.000Z'), /15:36/);
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
  for (const id of ['mathematics', 'physics', 'chemistry', 'biology', 'earth-science']) {
    assert.ok(domains[id], `${id} is missing from the general science fields`);
  }
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

/* --- Build 20: 時間の野原 --- */

import {
  LANES, LANE_IDS, layout, laneAt, revealWorld, convergences, reachOf, routePath, validatePlacements, packLane, freeX, PLACEMENT_LIMIT,
  MAX_ROWS, RECENT_COUNT, FIELD_VIEWS, LIST_SORTS, linkedSet, visibleFor, listGroups, previewBox, convergenceSentence, CONVERGENCE_NAMES,
  PLACEMENT_KINDS, SELF_KINDS, URL_LIMIT, TITLE_LIMIT, PHOTO_LIMIT, PHOTO_BYTES, sourceOf, contentOf, describeSource
} from './field.mjs';

// topic / url / title / photo は既定で null、source は kind から導いた既定値。
// Build 23 で増えたフィールドを、呼び出し側ごとに書かずに済ませるための既定値。
const put = (id, ref, x, lane = 'now', kind = 'topic', extra = {}) => ({
  id, lane, x, label: id, kind, ref, verb: null, note: '',
  topic: null, url: null, title: null, photo: null,
  domains: null,
  source: SELF_KINDS.includes(kind) ? 'self' : 'catalog',
  ...extra
});

test('manual connections replace suggested connections and survive saving', () => {
  assert.equal(typeof fieldModule.setDomainConnection, 'function');
  assert.equal(typeof fieldModule.resetDomainConnections, 'function');
  const suggested = put('editable', 'games', 0.5);
  assert.deepEqual(reachOf(suggested), ['information', 'media', 'design']);

  const removed = fieldModule.setDomainConnection(suggested, 'media', false);
  assert.deepEqual(reachOf(removed), ['information', 'design']);
  const added = fieldModule.setDomainConnection(removed, 'ecology', true);
  assert.deepEqual(reachOf(added), ['information', 'design', 'ecology']);

  const restored = decodeState(encodeState({...emptyState(), placements: [added]}), catalog).placements[0];
  assert.deepEqual(restored.domains, ['information', 'design', 'ecology']);
  assert.deepEqual(reachOf(restored), ['information', 'design', 'ecology']);
  assert.equal(fieldModule.resetDomainConnections(restored).domains, null);
  assert.deepEqual(reachOf(fieldModule.resetDomainConnections(restored)), ['information', 'media', 'design']);
  assert.throws(() => fieldModule.setDomainConnection(suggested, 'unknown', true), /Unknown domain/);
  assert.throws(() => validatePlacements([{...suggested, domains: ['unknown']}], catalog), /Unknown domain/);
});

test('the field places time on the vertical axis only, from the future down to today', () => {
  const view = layout({placements: [put('a', 'games', 0.3)], width: 360});
  assert.deepEqual(view.lanes.map(lane => lane.id), LANE_IDS);
  assert.deepEqual(LANE_IDS.at(-1), 'now', 'today is the bottom of the field');
  // 段は上から下へ積まれ、重ならない。
  for (let index = 1; index < view.lanes.length; index += 1) {
    assert.equal(view.lanes[index].top, view.lanes[index - 1].top + view.lanes[index - 1].height);
  }
  assert.equal(view.height, view.lanes.at(-1).top + view.lanes.at(-1).height);
});

test('the horizontal position is the user\'s own and is never rewritten by layout', () => {
  const placements = [put('a', 'games', 0.1), put('b', 'sea', 0.9)];
  const view = layout({placements, width: 400});
  const a = view.byId.get('a');
  const b = view.byId.get('b');
  assert.ok(a.left < b.left, 'the order the user chose is kept');
  assert.equal(a.row, 0);
  assert.equal(b.row, 0, 'two nodes far apart share one row');
  // 位置は保存された x のまま。並べ直しはしない。
  assert.deepEqual(placements.map(placement => placement.x), [0.1, 0.9]);
});

test('overlapping nodes fall to a new row up to the row limit, and the rest are sent away without ever moving sideways', () => {
  const nodes = Array.from({length: 4}, (_, index) => ({id: `n${index}`, label: 'おなじくらいの長さのラベル', x: 0.5}));
  const packed = packLane(nodes, 360);
  assert.equal(packed.rows, MAX_ROWS, 'stacking stops at the row limit, not at the number of nodes');
  assert.equal(packed.overflow.length, nodes.length - MAX_ROWS, 'anything past the limit is sent to overflow instead of being placed');
  assert.deepEqual([...new Set(packed.nodes.map(node => node.left))].length, 1, 'their horizontal position is unchanged');
  assert.ok(packed.overflow.every(node => node.x === 0.5), 'the sent-away nodes still carry their own untouched x');
});

test('an empty field reveals nothing; the world appears only from what the user places', () => {
  const empty = revealWorld([]);
  assert.deepEqual(empty.domains, []);
  assert.deepEqual(empty.links, []);
  const one = revealWorld([put('a', 'games', 0.5)]);
  assert.ok(one.domains.length >= 2, 'placing one interest reveals the fields it reaches');
  assert.ok(one.domains.every(domain => !domain.converged), 'one interest alone is never a convergence');
  assert.equal(one.links.length, one.domains.length);
});

test('two different interests reaching one field is a convergence, and it sits between them', () => {
  const placements = [put('a', 'sea', 0.2), put('b', 'cooking', 0.8)];
  const found = convergences(placements);
  assert.ok(found.length >= 1, 'the sea and cooking share at least one field');
  const shared = revealWorld(placements).domains.find(domain => domain.converged);
  assert.equal(shared.x, 0.5, 'the shared field is drawn halfway between the two');
  assert.deepEqual(found[0].labels.length, 2);
});

test('placing the same interest twice is not a convergence', () => {
  const twice = revealWorld([put('a', 'games', 0.2), put('b', 'games', 0.8)]);
  assert.ok(twice.domains.length >= 2);
  assert.ok(twice.domains.every(domain => !domain.converged), 'one interest placed twice must not look like agreement');
});

test('a written entry connects only once the user says how they are involved', () => {
  const written = {...put('a', null, 0.5, 'now', 'custom'), ref: null};
  assert.deepEqual(reachOf(written), [], 'nothing is inferred from free text');
  assert.ok(reachOf({...written, verb: verbs[0].id}).length >= 2, 'choosing a verb is what draws the line');
});

test('an activity reaches only the fields supported by its activity group', () => {
  const musicPractice = put('a', 'music-grow-0', 0.5, 'now', 'activity');
  assert.deepEqual(reachOf(musicPractice), ['sound']);
  assert.ok(!reachOf(musicPractice).includes('ecology'), 'the verb alone must not create an unrelated field');
});

test('a route is drawn one at a time, through the middle lanes, down from its field', () => {
  const path = routePath('media', 'kosen', 0.4);
  assert.deepEqual(path.nodes.map(node => node.lane), ['faculty', 'course', 'highschool']);
  assert.ok(path.nodes.every(node => node.x === 0.4), 'the drawn route hangs below its field');
  assert.equal(path.links[0].to, 'domain-media', 'the route starts at the field it leads to');
  assert.deepEqual(routePath('media', 'nosuchkind', 0.5).nodes, []);
  assert.deepEqual(routePath('nosuchdomain', 'kosen', 0.5).nodes, []);
});

test('all routes can be compared on the field before one is chosen', () => {
  const routes = routesForDomain('media', domains.media);
  const comparison = routePath('media', null, 0.5);
  assert.equal(comparison.routes.length, routes.length);
  assert.equal(comparison.nodes.length, routes.length * 3, 'each route crosses the university, course and high-school lanes');
  assert.equal(new Set(comparison.nodes.map(node => node.route)).size, routes.length);
  assert.ok(new Set(comparison.nodes.map(node => node.x)).size > 1, 'the routes spread sideways so their features stay readable');
  for (const route of routes) {
    const university = comparison.nodes.find(node => node.route === route.kind && node.lane === 'faculty');
    assert.ok(university?.link?.url, `${route.id} keeps its official university page on the field`);
  }
});

test('clicking a university or high-school step fans out similar schools around it', () => {
  for (const stage of ['university', 'highschool']) {
    const base = routePath('media', 'general', 0.5);
    const selected = base.nodes.find(node => node.stage === stage);
    assert.ok(selected, `${stage} route node is missing`);

    const expanded = routePath('media', 'general', 0.5, {expandedSchoolId: selected.id});
    const alternatives = expanded.nodes.filter(node => node.kind === 'school-option');
    assert.ok(alternatives.length >= 2, `${stage} should offer multiple alternatives`);
    assert.ok(alternatives.every(node => node.lane === selected.lane));
    assert.ok(alternatives.every(node => node.activity && node.link?.url));
    assert.equal(new Set(alternatives.map(node => node.link.url)).size, alternatives.length);
    assert.ok(expanded.links.every(link => link.kind !== 'school-option' || link.to === selected.id));
  }
});

test('an ordinary click on a university or high-school node toggles its surrounding schools', () => {
  assert.equal(typeof fieldModule.schoolExpansionAfterClick, 'function');
  const university = routePath('media', 'general', 0.5).nodes.find(node => node.stage === 'university');
  assert.equal(fieldModule.schoolExpansionAfterClick(university, null), university.id);
  assert.equal(fieldModule.schoolExpansionAfterClick(university, university.id), null);
  assert.equal(fieldModule.schoolExpansionAfterClick({...university, stage: 'course'}, null), null);
});

test('every field offers four or five checked university alternatives', () => {
  for (const domainId of Object.keys(domains)) {
    const candidates = universityCandidatesForDomain(domainId);
    assert.ok(candidates.length >= 4 && candidates.length <= 5, `${domainId} has ${candidates.length} universities`);
    assert.ok(candidates.every(item => item.checkedOn === EDUCATION_CHECKED_ON));
    assert.ok(candidates.every(item => /^https:\/\//.test(item.url) && item.activity.length > 12));
  }
  assert.equal(new Set(universityCandidates.map(item => item.id)).size, universityCandidates.length);
});

test('a general science field without detailed routes still exposes clickable university and high-school steps', () => {
  const path = routePath('physics', null, 0.5);
  assert.ok(path.nodes.some(node => node.stage === 'university' && node.link?.url));
  assert.ok(path.nodes.some(node => node.stage === 'highschool' && node.link?.url));
});

test('selecting an intermediate route node keeps its route visible', () => {
  assert.equal(typeof fieldModule.selectFieldNode, 'function');
  const clickedId = 'route-media-general-course';
  const next = fieldModule.selectFieldNode({
    currentSelected: 'domain-media',
    clickedId,
    routeDomain: 'media'
  });
  assert.deepEqual(next, {selected: clickedId, routeDomain: 'media'});
  assert.ok(routePath(next.routeDomain, null, 0.5).nodes.some(node => node.id === clickedId));
  assert.deepEqual(
    fieldModule.selectFieldNode({...next, currentSelected: clickedId, clickedId}),
    next,
    'clicking the route node again must not collapse the route'
  );
});

test('selecting a route node from another field switches the route focus', () => {
  assert.deepEqual(
    fieldModule.selectFieldNode({
      currentSelected: 'route-media-general-course',
      clickedId: 'route-biology-general-course',
      clickedDomain: 'biology',
      routeDomain: 'media'
    }),
    {selected: 'route-biology-general-course', routeDomain: 'biology'}
  );
});

test('dismissing a school removes its node and reconnects the remaining route', () => {
  assert.equal(typeof fieldModule.withoutDismissedRouteSchools, 'function');
  const path = {
    nodes: [{id: 'domain-media'}, {id: 'route-media-general-university', schoolId: 'school-example'}, {id: 'route-media-general-course'}],
    links: [
      {from: 'route-media-general-university', to: 'domain-media', kind: 'route'},
      {from: 'route-media-general-course', to: 'route-media-general-university', kind: 'route'}
    ]
  };
  const result = fieldModule.withoutDismissedRouteSchools(path, new Set(['school-example']));
  assert.deepEqual(result.nodes.map(node => node.id), ['domain-media', 'route-media-general-course']);
  assert.deepEqual(result.links, [{from: 'route-media-general-course', to: 'domain-media', kind: 'route'}]);
});

test('selecting a node for editing does not collapse an open route graph', () => {
  assert.deepEqual(
    fieldModule.selectFieldNode({
      currentSelected: 'route-media-general-course',
      clickedId: 'placement-1',
      routeDomain: 'media'
    }),
    {selected: 'placement-1', routeDomain: 'media'}
  );
  assert.deepEqual(
    fieldModule.selectFieldNode({
      currentSelected: 'domain-media',
      clickedId: 'domain-media',
      routeDomain: 'media'
    }),
    {selected: null, routeDomain: 'media'},
    'closing domain details must leave the graph visible'
  );
  assert.deepEqual(
    fieldModule.selectFieldNode({
      currentSelected: 'placement-1',
      clickedId: 'domain-information',
      routeDomain: 'media'
    }),
    {selected: 'domain-information', routeDomain: 'information'},
    'choosing another domain must switch the open graph'
  );
});

test('clicking another node moves the highlight to that node', () => {
  assert.equal(typeof fieldModule.highlightAfterClick, 'function');
  assert.equal(fieldModule.highlightAfterClick(null, 'topic-1'), 'topic-1');
  assert.equal(
    fieldModule.highlightAfterClick('topic-1', 'route-media-general-course'),
    'route-media-general-course',
  );
  assert.equal(fieldModule.highlightAfterClick('topic-1', 'topic-2'), 'topic-2');
});

test('dropping a node reads its lane from the vertical position, and never leaves the field', () => {
  const view = layout({placements: [put('a', 'games', 0.5)], width: 360});
  assert.equal(laneAt(view.lanes[0].top + 1, view.lanes), 'lab');
  assert.equal(laneAt(view.lanes.at(-1).top + 1, view.lanes), 'now');
  assert.equal(laneAt(-500, view.lanes), 'lab', 'above the field is the furthest future');
  assert.equal(laneAt(99999, view.lanes), 'now', 'below the field is today');
});

test('placements survive saving and reject unknown lanes, references and positions', () => {
  const activity = allActivities()[0];
  const resource = [...catalog.resources][0];
  const placements = [
    put('a', 'games', 0.25),
    {
      id: 'b', lane: 'highschool', x: 1, label: activity.title, kind: 'activity', ref: activity.id, verb: null, note: '',
      topic: null, url: null, title: null, photo: null, domains: null, source: 'catalog'
    },
    {
      id: 'c', lane: 'lab', x: 0, label: resources[resource].name, kind: 'resource', ref: resource, verb: verbs[0].id, note: 'メモ',
      topic: null, url: null, title: null, photo: null, domains: null, source: 'catalog'
    }
  ];
  const state = {...emptyState(), placements};
  assert.deepEqual(decodeState(encodeState(state), catalog).placements, placements);
  const broken = change => () => validatePlacements([{...placements[0], ...change}], catalog);
  assert.throws(broken({lane: 'someday'}), /Unknown lane/);
  assert.throws(broken({x: 1.5}), /position/);
  assert.throws(broken({ref: 'nosuchtopic'}), /Unknown interest/);
  assert.throws(broken({kind: 'custom'}), /no catalog reference/);
  assert.throws(broken({label: ''}), /label/);
  assert.throws(() => validatePlacements([placements[0], placements[0]], catalog), /placement id/);
  assert.throws(() => validatePlacements(new Array(PLACEMENT_LIMIT + 1).fill(placements[0]), catalog), /Invalid placements/);
});

test('a record keeps pointing at its placement, and survives the placement being removed', () => {
  const placements = [put('a', 'games', 0.5)];
  const log = addEntry([], {text: '30分さわった', placement: 'a', id: 'r1'});
  const restored = decodeState(encodeState({...emptyState(), placements, log}), catalog);
  assert.equal(restored.log[0].placement, 'a');
  // 置きものを外したら紐づけだけ切れる。記録そのものは消えない。
  const orphan = restored.log.map(entry => ({...entry, placement: null}));
  const after = decodeState(encodeState({...emptyState(), placements: [], log: orphan}), catalog);
  assert.equal(after.log.length, 1);
  assert.equal(after.log[0].placement, null);
  assert.throws(() => decodeState(encodeState({...emptyState(), placements: [], log}), catalog), /Unknown placement/);
});

test('a new placement lands where the lane is least crowded', () => {
  assert.equal(freeX([], 'now'), 0.5, 'the first one goes to the middle');
  const busy = [put('a', 'games', 0.5)];
  assert.notEqual(freeX(busy, 'now'), 0.5);
  assert.equal(freeX(busy, 'lab'), 0.5, 'another lane is still empty');
});

/* --- Build 22: 20件でも読める野原 --- */

test('placing twenty items in one lane still fits in the row limit plus one summary row, all drawn inside the field width', () => {
  const placements = Array.from({length: 20}, (_, index) => put(`p${index}`, null, 0.5, 'now', 'custom'));
  const width = 360;
  const view = layout({placements, width});
  const nowLane = view.lanes.find(lane => lane.id === 'now');
  assert.equal(nowLane.count, 20, 'the lane remembers how many were actually placed here');
  assert.equal(nowLane.overflow, 20 - MAX_ROWS, 'everything past the row limit is sent to the cluster');
  assert.equal(nowLane.rows, MAX_ROWS + 1, 'the row cap plus one row for the "ほか◯件" chip');
  const drawn = view.nodes.filter(node => node.lane === 'now');
  assert.equal(drawn.length, MAX_ROWS + 1, 'only the row cap worth of placements plus the cluster chip are drawn');
  for (const node of drawn) assert.ok(node.left >= 0 && node.left + node.w <= width, `${node.id} is drawn outside the field`);
});

test('clustering never rewrites the x a placement was saved with', () => {
  const placements = Array.from({length: 20}, (_, index) => put(`p${index}`, null, index / 19, 'now', 'custom'));
  const before = placements.map(placement => placement.x);
  layout({placements, width: 360});
  assert.deepEqual(placements.map(placement => placement.x), before, 'layout must never mutate the saved positions');
});

test('links into a clustered node are rerouted to the cluster instead of disappearing', () => {
  const placements = Array.from({length: 6}, (_, index) => put(`p${index}`, 'games', 0.5, 'now', 'topic'));
  const view = layout({placements, width: 360});
  assert.ok(view.links.length > 0, 'links survive the clustering');
  assert.ok(view.aliases.size > 0, 'the overflowed placements are recorded as aliases to their cluster');
  const aliasTargets = new Set(view.aliases.values());
  const rerouted = view.links.some(link => aliasTargets.has(link.from) || aliasTargets.has(link.to));
  assert.ok(rerouted, 'at least one line now ends at the cluster chip that replaced its endpoint');
});

test('expanding a lane lays out one node per row so no two labels can overlap', () => {
  const placements = Array.from({length: 6}, (_, index) => put(`p${index}`, null, 0.5, 'now', 'custom'));
  const width = 360;
  const view = layout({placements, width, expandedLanes: ['now']});
  const nowLane = view.lanes.find(lane => lane.id === 'now');
  assert.equal(nowLane.expanded, true);
  assert.equal(nowLane.overflow, 0, 'expanding never sends anything to a cluster');
  const drawn = view.nodes.filter(node => node.lane === 'now');
  assert.equal(drawn.length, placements.length, 'every placement gets its own row when expanded');
  assert.equal(new Set(drawn.map(node => node.row)).size, drawn.length, 'one node, one row: none share a row');
  for (const node of drawn) assert.ok(node.left >= 0 && node.left + node.w <= width);
});

test('previewBox agrees with the row-0 box that layout draws for the same x and lane', () => {
  const placements = [put('a', 'games', 0.42, 'now')];
  const view = layout({placements, width: 360});
  const node = view.byId.get('a');
  assert.deepEqual(previewBox({label: node.label, x: node.x, lane: node.lane}, view), {left: node.left, w: node.w, y: node.y, h: node.h});
  assert.equal(previewBox({label: 'x', x: 0.5, lane: 'nosuch'}, view), null, 'an unknown lane has nowhere to preview');
});

test('a selection reaches exactly one link: a placement reaches its fields, a field reaches what arrives at it', () => {
  const placements = [put('a', 'sea', 0.2), put('b', 'cooking', 0.8)];
  const shared = revealWorld(placements).domains.find(domain => domain.converged);
  const linked = linkedSet(placements, 'a');
  assert.ok(linked.has('a'));
  assert.ok(linked.has(`domain-${shared.id}`), 'the field the placement reaches is included');
  // 合流相手は含めない。含めると「選んだものだけ」が絞り込みにならず、
  // まとめから外す対象に使ったときは選んだ瞬間に段が伸びる。合流は学問を選べば見える。
  assert.ok(!linked.has('b'), 'the other placement converging on the same field is one link too far');
  assert.deepEqual(linkedSet(placements, `domain-${shared.id}`), new Set([`domain-${shared.id}`, 'a', 'b']),
    'selecting the field is the second step, and that is where the convergence shows');
  assert.deepEqual(linkedSet(placements, null), new Set(), 'nothing is selected, so nothing is in reach');
  assert.deepEqual(linkedSet(placements, 'nosuch'), new Set(), 'an id that matches nothing reaches nothing');
});

test('visibleFor hides nothing before a selection is made, and the recent view keeps the last RECENT_COUNT in order', () => {
  const placements = Array.from({length: 8}, (_, index) => put(`p${index}`, null, 0.1 + index * 0.05, 'now', 'custom'));
  const untouched = visibleFor(placements, {view: 'selected', selected: null});
  assert.equal(untouched.hidden, 0, 'nothing is hidden before anything is selected');
  assert.deepEqual(untouched.placements, placements);

  const recent = visibleFor(placements, {view: 'recent'});
  assert.deepEqual(recent.placements.map(placement => placement.id), placements.slice(-RECENT_COUNT).map(placement => placement.id));
  assert.equal(recent.hidden, placements.length - RECENT_COUNT);
});

test('the selected view really narrows: one placement stays, and the field it reaches is the way back to the rest', () => {
  const placements = [put('a', 'sea', 0.2), put('b', 'cooking', 0.8), put('c', null, 0.5, 'now', 'custom')];
  const picked = visibleFor(placements, {view: 'selected', selected: 'a'});
  assert.deepEqual(picked.placements.map(placement => placement.id), ['a'], 'selecting one thing shows that one thing');
  assert.equal(picked.hidden, 2);
  assert.ok(picked.note.includes('学問'), 'the screen says where the rest went');
  // 合流相手は、学問のほうを選べば出る。ここが2ホップ目にあたる。
  const shared = revealWorld(placements).domains.find(domain => domain.converged);
  const viaDomain = visibleFor(placements, {view: 'selected', selected: `domain-${shared.id}`});
  assert.deepEqual(viaDomain.placements.map(placement => placement.id).sort(), ['a', 'b']);
  assert.ok(!viaDomain.placements.some(placement => placement.id === 'c'), 'nothing unrelated is swept in');
});

test('listGroups never drops a placement across the three sorts, and domain sort files the unconnected ones under "loose"', () => {
  assert.deepEqual(listGroups([], 'lane'), [], 'nothing placed means nothing to list');
  const placements = [
    put('a', 'sea', 0.2, 'now'),
    put('b', 'cooking', 0.8, 'lab'),
    put('c', null, 0.5, 'faculty', 'custom')
  ];
  const allIds = placements.map(placement => placement.id).sort();
  for (const {id: sort} of LIST_SORTS) {
    const groups = listGroups(placements, sort);
    const seen = new Set(groups.flatMap(group => group.items.filter(item => item.kind === 'placement').map(item => item.id)));
    assert.deepEqual([...seen].sort(), allIds, `sort=${sort} must not drop any placement`);
  }
  const domainGroups = listGroups(placements, 'domain');
  const loose = domainGroups.find(group => group.id === 'loose');
  assert.ok(loose, 'the unconnected written entry needs somewhere to appear');
  assert.deepEqual(loose.items.map(item => item.id), ['c']);
  assert.ok(domainGroups.some(group => group.note === '複数の項目に共通'), 'a converged field says so in plain language');
});

test('selecting a placement keeps its fields out of the cluster, so the line can be followed to the end', () => {
  // 同じ場所に積んで、まとめが必ず出る状態をつくる。
  const placements = [
    ...Array.from({length: 12}, (_, index) => put(`n${index}`, index % 2 ? 'games' : 'cooking', 0.5)),
    put('sea', 'sea', 0.5)
  ];
  const plain = layout({placements, width: 360});
  assert.ok(plain.aliases.size > 0, 'without a selection the crowded lane is summarised');
  const keep = linkedSet(placements, 'sea');
  const focused = layout({placements, width: 360, keep});
  for (const id of keep) {
    assert.ok(!focused.aliases.has(id), `${id} is on the path from the selection and must stay visible`);
    assert.ok(focused.byId.has(id), `${id} is drawn in its own right`);
  }
  // 残りはまとめられたままで、段がすべて開くわけではない。
  assert.ok(focused.aliases.size > 0, 'only what the selection reaches is spared, not the whole lane');
  // まとめから学問へ伸びる線は残るので、合流は隠れない。
  const toDomains = focused.links.filter(link => link.from.startsWith('cluster-') && link.to.startsWith('domain-'));
  assert.ok(toDomains.length > 0, 'what stayed in the cluster still shows that it reaches a field');
  // 合流相手まで広げないので、選んだ瞬間に段が一気に伸びることはない。
  assert.ok(focused.height - plain.height < 200, 'selecting opens the path, not the whole neighbourhood');
  // 横位置は動いていない。
  assert.deepEqual(placements.map(placement => placement.x), new Array(13).fill(0.5));
});

test('a convergence sentence names a few and counts the rest, and only says "どちらも" when there are two', () => {
  const two = convergenceSentence({domain: 'd', name: 'デザイン', labels: ['ゲーム', '料理']});
  assert.equal(two.all, 'どちらも');
  assert.equal(two.rest, 0);
  const many = convergenceSentence({domain: 'd', name: 'デザイン', labels: Array.from({length: 8}, (_, i) => `label${i}`)});
  assert.equal(many.all, 'どれも', 'eight things are not "both"');
  assert.equal(many.shown.length, CONVERGENCE_NAMES);
  assert.equal(many.rest, 8 - CONVERGENCE_NAMES, 'the ones left out are counted, never dropped in silence');
});

/* --- Build 23: 統一したデータの形と検証 --- */

test('PLACEMENT_KINDS lists every kind the field can hold, and SELF_KINDS names exactly the ones the user added themselves', () => {
  assert.deepEqual(PLACEMENT_KINDS, ['topic', 'activity', 'resource', 'custom', 'link', 'photo']);
  assert.deepEqual(SELF_KINDS, ['custom', 'link', 'photo']);
  for (const kind of SELF_KINDS) assert.ok(PLACEMENT_KINDS.includes(kind), `${kind} must also be a placement kind`);
});

test('a url only accepts http and https, and rejects javascript:, data: and file: as an entry, not a silent drop', () => {
  const link = put('u1', null, 0.5, 'now', 'link', {url: 'https://example.com/path'});
  assert.equal(validatePlacements([link], catalog)[0].url, 'https://example.com/path');
  assert.equal(validatePlacements([{...link, url: 'http://example.com'}], catalog)[0].url, 'http://example.com');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'not a url']) {
    assert.throws(() => validatePlacements([{...link, url: bad}], catalog), /url/, `${bad} must be rejected`);
  }
  assert.throws(() => validatePlacements([{...link, url: `https://${'a'.repeat(URL_LIMIT)}`}], catalog), /url/, 'a url past URL_LIMIT is rejected');
});

test('a link placement must carry a url, and can never carry a catalog reference', () => {
  assert.throws(() => validatePlacements([put('u2', null, 0.5, 'now', 'link')], catalog), /needs a url/);
  assert.throws(() => validatePlacements([put('u3', 'games', 0.5, 'now', 'link', {url: 'https://example.com'})], catalog), /no catalog reference/);
  const ok = validatePlacements([put('u4', null, 0.5, 'now', 'link', {url: 'https://example.com'})], catalog);
  assert.equal(ok[0].url, 'https://example.com');
  assert.equal(ok[0].ref, null);
});

test('a photo placement only accepts a jpeg or png data url, and rejects one that is too big or the wrong shape', () => {
  const small = `data:image/png;base64,${'a'.repeat(10)}`;
  assert.equal(validatePlacements([put('ph1', null, 0.5, 'now', 'photo', {photo: small})], catalog)[0].photo, small);
  assert.throws(() => validatePlacements([put('ph2', null, 0.5, 'now', 'photo')], catalog), /needs a photo/);
  assert.throws(() => validatePlacements([put('ph3', null, 0.5, 'now', 'photo', {photo: 'data:text/plain;base64,aGk='})], catalog), /photo/, 'not an image, no matter how it is spelled');
  const tooBig = `data:image/jpeg;base64,${'a'.repeat(PHOTO_BYTES)}`;
  assert.throws(() => validatePlacements([put('ph4', null, 0.5, 'now', 'photo', {photo: tooBig})], catalog), /photo/, 'one photo past PHOTO_BYTES is rejected');
});

test('placing more photos than the per-device limit is rejected as a whole, not trimmed silently', () => {
  const photo = `data:image/png;base64,${'a'.repeat(20)}`;
  const many = Array.from({length: PHOTO_LIMIT + 1}, (_, index) => put(`ph${index}`, null, index / (PHOTO_LIMIT + 2), 'now', 'photo', {photo}));
  assert.throws(() => validatePlacements(many, catalog), /Too many photos/);
  assert.equal(validatePlacements(many.slice(0, PHOTO_LIMIT), catalog).length, PHOTO_LIMIT, 'exactly at the limit is still fine');
});

test('a catalog entry (topic, activity or resource) cannot carry a topic tag, a url, a title or a photo of its own', () => {
  const topicPlacement = put('t1', 'games', 0.5, 'now', 'topic');
  assert.throws(() => validatePlacements([{...topicPlacement, topic: 'sea'}], catalog), /topic tag/);
  assert.throws(() => validatePlacements([{...topicPlacement, url: 'https://example.com'}], catalog), /url/);
  assert.throws(() => validatePlacements([{...topicPlacement, title: 'メモ'}], catalog), /title/);
  assert.throws(() => validatePlacements([{...topicPlacement, photo: 'data:image/png;base64,aa'}], catalog), /photo/);
});

test('sourceOf and contentOf read a placement\'s origin and shape straight from its fields', () => {
  assert.equal(sourceOf(put('a', 'games', 0.5, 'now', 'topic')), 'catalog');
  assert.equal(sourceOf(put('a', null, 0.5, 'now', 'custom')), 'self');
  assert.equal(sourceOf(put('a', null, 0.5, 'now', 'link', {url: 'https://example.com'})), 'self');
  assert.equal(sourceOf(put('a', null, 0.5, 'now', 'photo', {photo: 'data:image/png;base64,aa'})), 'self');
  assert.equal(contentOf(put('a', null, 0.5, 'now', 'custom')), 'text', 'a written entry is called text, not custom');
  assert.equal(contentOf(put('a', null, 0.5, 'now', 'link')), 'link');
  assert.equal(contentOf(put('a', null, 0.5, 'now', 'photo')), 'photo');
  for (const kind of ['topic', 'activity', 'resource']) assert.equal(contentOf(put('a', null, 0.5, 'now', kind)), kind);
});

test('a self-added entry reaches nowhere until a tag is chosen, whether it is written, a link or a photo', () => {
  for (const kind of SELF_KINDS) {
    const extra = kind === 'link' ? {url: 'https://example.com'} : kind === 'photo' ? {photo: 'data:image/png;base64,aa'} : {};
    const bare = put('s1', null, 0.5, 'now', kind, extra);
    assert.deepEqual(reachOf(bare), [], `${kind} with no tag chosen must not connect anywhere`);
  }
});

test('choosing what it is about and how one is involved intersects the two fields, and falls back to "what it is about" when they share nothing', () => {
  // 実在のデータで積を検証する。games の領域と dig の領域は information で重なる。
  const both = reachOf(put('w1', null, 0.5, 'now', 'custom', {topic: 'games', verb: 'dig'}));
  const gamesDomains = topics.games.ids;
  const digDomains = domainsForVerb('dig').map(domain => domain.id);
  assert.deepEqual(both.sort(), gamesDomains.filter(id => digDomains.includes(id)).sort());
  assert.ok(both.length > 0 && both.length < gamesDomains.length, 'a real intersection, not the whole topic');

  // 重ならない動詞（カタログに無い＝どこも扱わない動詞）を選んだときは、何についてが扱う領域に落ちる。
  const empty = reachOf(put('w2', null, 0.5, 'now', 'custom', {topic: 'sea', verb: 'nosuchverb'}));
  assert.deepEqual(empty.sort(), topics.sea.ids.slice().sort(), 'an empty intersection falls back to the topic side');

  // 片方だけならその領域がそのまま使われる。
  assert.deepEqual(reachOf(put('w3', null, 0.5, 'now', 'custom', {topic: 'sea'})).sort(), topics.sea.ids.slice().sort());
  assert.deepEqual(reachOf(put('w4', null, 0.5, 'now', 'custom', {verb: 'dig'})).sort(), digDomains.sort());
});

test('placements with the new fields survive a save and reload without changing shape', () => {
  const placements = [
    put('link1', null, 0.2, 'now', 'link', {url: 'https://example.com/page', title: 'メモ', topic: 'sea'}),
    put('photo1', null, 0.6, 'now', 'photo', {photo: `data:image/jpeg;base64,${'a'.repeat(30)}`, title: '写真'})
  ];
  const state = {...emptyState(), placements};
  const restored = decodeState(encodeState(state), catalog);
  assert.deepEqual(restored.placements, placements, 'link and photo placements round-trip byte for byte');
});

test('an old record saved without a source field still loads, and source is derived from kind', () => {
  const legacyPlacements = [
    {id: 'a', lane: 'now', x: 0.4, label: 'ゲーム', kind: 'topic', ref: 'games', verb: null, note: ''},
    {id: 'b', lane: 'now', x: 0.6, label: 'じぶんで書いた', kind: 'custom', ref: null, verb: null, note: ''}
  ];
  const raw = JSON.stringify({
    version: 2, grade: null, stances: {}, log: [], placements: legacyPlacements,
    marks: [], heldRoutes: [], verb: null, expanded: false
  });
  const restored = decodeState(raw, catalog);
  assert.equal(sourceOf(restored.placements[0]), 'catalog', 'a Build 22 topic placement is still a catalog placement');
  assert.equal(sourceOf(restored.placements[1]), 'self', 'a Build 22 written entry is still self-added');
});

test('encodeState refuses to save silently once the state grows past the device limit', () => {
  assert.ok(encodeState(emptyState()).length < STATE_BYTES, 'an empty state is nowhere near the limit');
  const huge = {...emptyState(), placements: [{id: 'huge', note: 'x'.repeat(STATE_BYTES)}]};
  assert.throws(() => encodeState(huge), /超えて/, 'a save past STATE_BYTES throws instead of failing silently later');
});

test('describeSource marks the self-added and the family-sent as unconfirmed, and never marks a catalog listing that way', () => {
  const resourceId = [...catalog.resources][0];
  const listed = put('r1', resourceId, 0.5, 'now', 'resource');
  assert.equal(describeSource(listed).caution, null, 'a catalog listing already carries its own source and check date');
  assert.equal(describeSource(listed).label, '掲載情報');

  const topicPlacement = put('t2', 'games', 0.5, 'now', 'topic');
  assert.equal(describeSource(topicPlacement).caution, null);
  assert.equal(describeSource(topicPlacement).label, 'このアプリの項目');

  const own = put('m1', null, 0.5, 'now', 'custom');
  assert.equal(describeSource(own).caution, '内容は確認していません');
  assert.equal(describeSource(own).label, '自分で追加');

  const family = {...own, source: 'family'};
  assert.equal(describeSource(family).caution, '内容は確認していません');
  assert.equal(describeSource(family).label, '家族から');
});

/* --- Build 24: 絞り込み・鮮度・掲載範囲。合成データで検査する --- */
/* filterResources / coverage / coverageSentence は [{id, ...resource}] という配列で受け取る。 */

const sample = [
  {
    id: 'tokyoEvent', category: 'event', prefecture: '東京都', grades: ['j1', 'j2'],
    cost: 'free', domain: 'ecology', date: '2026-10-01', deadline: '2026-09-20',
    online: false, checkedOn: '2026-09-01'
  },
  {
    id: 'chibaMaterial', category: 'material', prefecture: null, grades: [],
    cost: 'unknown', domain: 'ecology', date: null, deadline: null,
    online: true, checkedOn: '2026-08-01'
  },
  {
    id: 'osakaClub', category: 'club', prefecture: '大阪府', grades: ['h1'],
    cost: 'paid', domain: 'engineering', date: null, deadline: null,
    online: false, checkedOn: '2026-09-05'
  }
];

test('CATEGORIES lists exactly the seven kinds the Build 24 contract defines, and STALE_DAYS is 180', () => {
  assert.deepEqual(CATEGORIES.map(c => c.id), ['material', 'place', 'event', 'continuing', 'club', 'school', 'university']);
  assert.equal(STALE_DAYS, 180);
});

test('filterResources keeps every resource when no filters are given', () => {
  const result = filterResources(sample, {}, '2026-09-12');
  assert.equal(result.length, sample.length);
});

test('filtering by prefecture keeps that prefecture and place-agnostic resources, and drops other prefectures', () => {
  const result = filterResources(sample, {prefecture: '東京都'}, '2026-09-12');
  assert.deepEqual(result.map(r => r.id).sort(), ['chibaMaterial', 'tokyoEvent']);
});

test('filtering by free cost drops resources whose cost is unknown or paid', () => {
  const result = filterResources(sample, {cost: 'free'}, '2026-09-12');
  assert.deepEqual(result.map(r => r.id), ['tokyoEvent']);
});

test('filtering by grade keeps that grade and resources whose target grade is unspecified', () => {
  const result = filterResources(sample, {grade: 'j1'}, '2026-09-12');
  assert.deepEqual(result.map(r => r.id).sort(), ['chibaMaterial', 'tokyoEvent']);
});

test('freshnessOf calls a past event date closed, even when its deadline and check date also look bad', () => {
  const resource = {date: '2026-09-01', deadline: '2026-08-01', checkedOn: '2025-01-01'};
  assert.equal(freshnessOf(resource, '2026-09-12').state, 'closed');
});

test('freshnessOf calls a passed deadline over while the event itself is still upcoming', () => {
  const resource = {date: '2026-12-01', deadline: '2026-09-01', checkedOn: '2026-09-01'};
  assert.equal(freshnessOf(resource, '2026-09-12').state, 'over');
});

test('freshnessOf calls a passed reviewAfter date over', () => {
  const resource = {date: null, deadline: null, reviewAfter: '2026-09-01', checkedOn: '2026-09-01'};
  assert.equal(freshnessOf(resource, '2026-09-12').state, 'over');
});

test('freshnessOf calls an old checkedOn stale once nothing else applies', () => {
  const resource = {date: null, deadline: null, checkedOn: '2026-01-01'};
  assert.equal(freshnessOf(resource, '2026-09-12').state, 'stale');
});

test('freshnessOf reports ok with a null note when nothing is wrong', () => {
  const resource = {date: '2026-12-01', deadline: '2026-11-01', checkedOn: '2026-09-01'};
  const result = freshnessOf(resource, '2026-09-12');
  assert.equal(result.state, 'ok');
  assert.equal(result.note, null);
});

test('coverage counts every resource exactly once across prefectures, with the place-agnostic ones last', () => {
  const result = coverage(sample);
  assert.equal(result.total, sample.length);
  assert.equal(result.byPrefecture.reduce((sum, entry) => sum + entry.count, 0), result.total);
  assert.equal(result.byPrefecture.at(-1).prefecture, null);
});

test('coverage lists every known field of study in byDomain, marking one with no resources as zero and thin', () => {
  // sample only uses 'ecology' and 'engineering'; every other domain must still appear at 0.
  const result = coverage(sample);
  assert.deepEqual(result.byDomain.map(entry => entry.domain).sort(), Object.keys(domains).sort());
  const empty = result.byDomain.find(entry => entry.domain === 'environment');
  assert.deepEqual(empty, {domain: 'environment', name: domains.environment.name, count: 0, thin: true});
});

test('coverage lists all seven categories in byCategory, even ones with no resources', () => {
  // sample only uses event/material/club; the other four categories must still appear at 0.
  const result = coverage(sample);
  assert.deepEqual(result.byCategory.map(entry => entry.category).sort(), CATEGORIES.map(c => c.id).sort());
  const empty = result.byCategory.find(entry => entry.category === 'university');
  assert.deepEqual(empty, {category: 'university', label: '大学', count: 0});
});

test('coverageSentence never claims nationwide coverage', () => {
  const sentence = coverageSentence(sample);
  assert.ok(!/全国(対応|どこでも)/.test(sentence), sentence);
});

/* --- Build 24: 実データ42件に対する検査。担当Aのフィールド追加が終わるまで落ちる可能性がある --- */

const realResources = Object.entries(resources).map(([id, resource]) => ({id, ...resource}));

test('coverage counts every real resource exactly once across prefectures', () => {
  const result = coverage(realResources);
  assert.equal(result.total, realResources.length);
  assert.equal(result.byPrefecture.reduce((sum, entry) => sum + entry.count, 0), result.total);
});

test('coverage never drops a known field of study from byDomain for the real catalog', () => {
  const result = coverage(realResources);
  assert.deepEqual(result.byDomain.map(entry => entry.domain).sort(), Object.keys(domains).sort());
});

test('coverageSentence never claims nationwide coverage for the real catalog', () => {
  const sentence = coverageSentence(realResources);
  assert.ok(!/全国(対応|どこでも)/.test(sentence), sentence);
});

/* --- Build 25: 家族のおすすめは、本人の受信箱を経てから野原へ入る --- */

test('a family recommendation link round-trips Japanese text without carrying private state', () => {
  const source = {
    title: '海の研究を体験できるイベント', url: 'https://example.com/events?kind=海',
    note: '前に話していたことと近そう', topic: 'sea', verb: 'observe'
  };
  const encoded = encodeRecommendation(source, catalog);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeRecommendation(encoded, catalog), {...source, status: 'new', id: null, receivedOn: null});
  assert.equal(encoded.includes('grade'), false, 'the link has no student profile field');
});

test('recommendation links reject unsafe URLs, unknown tags and malformed payloads', () => {
  assert.throws(() => encodeRecommendation({title: 'bad', url: 'javascript:alert(1)'}, catalog), /http/);
  assert.throws(() => encodeRecommendation({title: 'bad', url: 'https://example.com', topic: 'unknown'}, catalog), /何について/);
  assert.throws(() => decodeRecommendation('%%%not-valid%%%', catalog), /読み取れません/);
});

test('receiving a recommendation deduplicates it and keeps a bounded inbox', () => {
  const payload = {title: '海の研究', url: 'https://example.com/sea', note: '', topic: 'sea', verb: null};
  const first = receiveRecommendation(payload, [], catalog, {id: 'rfirst', receivedOn: '2026-09-12'});
  assert.equal(first.added, true);
  assert.equal(first.items[0].status, 'new');
  const duplicate = receiveRecommendation(payload, first.items, catalog, {id: 'rsecond', receivedOn: '2026-09-12'});
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.items.length, 1);

  const full = Array.from({length: RECOMMENDATION_LIMIT}, (_, index) => ({
    id: `r${index}`, title: `おすすめ${index}`, url: `https://example.com/${index}`,
    note: '', topic: null, verb: null, status: 'later', receivedOn: '2026-09-01'
  }));
  const bounded = receiveRecommendation({...payload, url: 'https://example.com/new'}, full, catalog, {id: 'rnew', receivedOn: '2026-09-12'});
  assert.equal(bounded.items.length, RECOMMENDATION_LIMIT);
  assert.equal(bounded.items[0].id, 'rnew');
});

test('recommendations survive storage, while older Build 24 state gets an empty inbox', () => {
  const recommendation = {
    id: 'rfamily', title: '家族から届いたページ', url: 'https://example.com/family', note: '見てみて',
    topic: 'sea', verb: 'observe', status: 'new', receivedOn: '2026-09-12'
  };
  const state = {...emptyState(), recommendations: [recommendation]};
  assert.deepEqual(decodeState(encodeState(state), catalog).recommendations, [recommendation]);
  assert.throws(() => validateRecommendations([{...recommendation, receivedOn: '2026-99-99'}], catalog), /受取日/);

  const old = JSON.parse(encodeState(emptyState()));
  delete old.recommendations;
  assert.deepEqual(decodeState(JSON.stringify(old), catalog).recommendations, []);
});

test('every real resource belongs to one of the seven known categories', () => {
  for (const resource of realResources) {
    assert.ok(CATEGORIES.some(c => c.id === resource.category), `${resource.id} has category ${resource.category}`);
  }
});

/* --- Build 24: イベントの必須項目と、掲載範囲の正直さ --- */

test('an event says when it is and by when to apply, or says to check the official page - never a blank', () => {
  const events = Object.entries(resources).filter(([, item]) => item.category === 'event');
  assert.ok(events.length > 0, 'the data must carry events for this rule to mean anything');
  for (const [id, item] of events) {
    assert.ok(['single', 'listing'].includes(item.occurrence), `${id} must say whether it is one session or a listing`);
    // キーごと無いと、画面が黙って空欄を出してしまう。null は「公式案内で確認」と言うための値。
    for (const field of ['date', 'deadline', 'grades']) {
      assert.ok(Object.hasOwn(item, field), `${id} is missing ${field}`);
    }
    if (item.occurrence === 'single') {
      assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/, `${id} is one session, so it must carry its date`);
    } else {
      assert.equal(item.date, null, `${id} lists many sessions, so it must not claim one date as the whole`);
    }
  }
});

test('a resource never states a cost two ways that disagree, and never claims a grade twice', () => {
  for (const [id, item] of Object.entries(resources)) {
    assert.equal(item.free, item.cost === 'free', `${id} says one thing in free and another in cost`);
    assert.equal(new Set(item.grades).size, item.grades.length, `${id} repeats a grade`);
    // 学年の絞り込みで選べるのは中1〜高3だけ。データが持てない学年を選択肢に出さないため。
    for (const grade of item.grades) assert.match(grade, /^[jh][1-3]$/, `${id} carries a grade the filter cannot offer`);
  }
});

test('every listed place names a real prefecture, and what is not tied to a place says so with null', () => {
  for (const [id, item] of Object.entries(resources)) {
    assert.ok(item.prefecture === null || PREFECTURES.includes(item.prefecture), `${id} names a place that is not a prefecture`);
  }
  const placed = Object.values(resources).filter(item => item.prefecture !== null);
  assert.ok(placed.length > 0 && placed.length < Object.keys(resources).length,
    'some listings are tied to a place and some are not; if all or none were, the filter would be pointless');
});
