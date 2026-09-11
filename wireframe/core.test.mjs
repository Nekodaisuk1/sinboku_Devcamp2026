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

/* --- Build 20: 時間の野原 --- */

import {
  LANES, LANE_IDS, layout, laneAt, revealWorld, convergences, reachOf, routePath, validatePlacements, packLane, freeX, PLACEMENT_LIMIT,
  MAX_ROWS, RECENT_COUNT, FIELD_VIEWS, LIST_SORTS, linkedSet, visibleFor, listGroups, previewBox, convergenceSentence, CONVERGENCE_NAMES
} from './field.mjs';

const put = (id, ref, x, lane = 'now', kind = 'topic') => ({id, lane, x, label: id, kind, ref, verb: null, note: ''});

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
    {id: 'b', lane: 'highschool', x: 1, label: activity.title, kind: 'activity', ref: activity.id, verb: null, note: ''},
    {id: 'c', lane: 'lab', x: 0, label: resources[resource].name, kind: 'resource', ref: resource, verb: verbs[0].id, note: 'メモ'}
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
  assert.ok(domainGroups.some(group => group.note === '合流'), 'a converged field says so in its note');
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
