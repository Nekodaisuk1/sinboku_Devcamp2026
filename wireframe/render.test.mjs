import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {layout, listGroups, convergences} from './field.mjs';
import {renderField, renderFieldList} from './field-ui.mjs';
import * as fieldUiModule from './field-ui.mjs';
import {renderRoutes, renderUniversityCandidates} from './routes-ui.mjs';
import {domains} from './verbs.mjs';
import {schoolId} from './school-records.mjs';

const put = (id, ref, x, lane = 'now', kind = 'topic') => ({id, lane, x, label: id, kind, ref, verb: null, note: ''});

test('the map offers an explicit multi-interest creation form', () => {
  assert.equal(typeof fieldUiModule.renderInterestBuilder, 'function');
  const html = fieldUiModule.renderInterestBuilder({
    topics: {games: {label: 'ゲーム'}, music: {label: 'ギター・音楽'}},
    verbs: [{id: 'make', label: 'つくる'}],
    domains: {
      mathematics: {name: '数学'}, physics: {name: '物理学'}, chemistry: {name: '化学'},
      biology: {name: '生物学'}, 'earth-science': {name: '地球科学'}
    },
    placedRefs: new Set(['games']),
    open: true
  });
  assert.match(html, /自分の興味からマップを作る/);
  assert.match(html, /type="checkbox"[^>]+name="topics"/);
  assert.match(html, /name="customLabel"/);
  assert.match(html, /興味があること/);
  assert.match(html, /関係があるジャンル/);
  assert.match(html, /name="domainIds"/);
  assert.match(html, /数学/);
  assert.match(html, /物理学/);
  assert.match(html, /化学/);
  assert.match(html, /生物学/);
  assert.match(html, /地球科学/);
  assert.match(html, /この内容でマップを作る/);
  assert.match(html, /value="games"[^>]+disabled/);
});

test('the connection editor exposes every field and can restore suggestions', () => {
  assert.equal(typeof fieldUiModule.renderConnectionEditor, 'function');
  const html = fieldUiModule.renderConnectionEditor({
    domains: {
      information: {name: '情報科学'},
      media: {name: '映像・ゲーム表現'}
    },
    connected: new Set(['information']),
    customized: true,
    open: true
  });
  assert.match(html, /class="connection-editor" open/);
  assert.match(html, /接続を編集/);
  assert.match(html, /data-domain-connection="information"[^>]+checked/);
  assert.match(html, /data-domain-connection="media"/);
  assert.match(html, /提示された接続に戻す/);
});

test('app chrome matches the Shimboku visual identity', async () => {
  const [html, css, build, server] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./scripts/build.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./server.mjs', import.meta.url), 'utf8')
  ]);

  assert.match(html, /<img[^>]+src="assets\/shinboku-logo\.png"[^>]+alt=""/);
  assert.match(html, /class="brand-copy"/);
  assert.match(html, /class="tab-icon"/);
  assert.match(css, /--forest:\s*#203026/i);
  assert.match(css, /--cream:\s*#f8f4e8/i);
  assert.match(css, /--mint:\s*#85d5a7/i);
  assert.match(css, /--sun:\s*#ffcf74/i);
  assert.match(build, /png/, 'the public build must include the logo image referenced by index.html');
  assert.match(server, /assets\/shinboku-logo\.png/, 'the local preview server must serve the logo');
});

/* --- Build 22: axe が動かない環境の代わりに、描画結果の文字列で退行を止める ---
 * この環境は Node.js と ChromeDriver のバージョンが合わず axe 監査が動かない。
 * axe の代わりにはならないが、「操作できるのに名前がない」「意味が色だけに載っている」
 * といった、この画面が特に壊れやすい退行だけは、文字列検査でも確実に止められる。
 * 実装の細部（座標値やclass名の並び順）ではなく、守るべき約束だけを検査する。
 */


// SVG文字列から <g ...> タグを取り出し、role="button" を持つものだけに絞る。
// フルのXMLパーサーは使わず、属性の並び順に依存しない緩い正規表現にとどめる。
function buttonTags(svg) {
  const tags = svg.match(/<g\b[^>]*>/g) ?? [];
  return tags.filter(tag => /\brole="button"/.test(tag));
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

test('every operable element in the field carries a name and is keyboard-reachable', () => {
  // 段の地・広げる/まとめるピル・置きもの・学問・まとめノードが全部そろう配置を作る。
  // 「たまたま今そうなっている」ではなく「操作できる要素には必ず名前がある」という約束を検査したいので、
  // 個別の要素を1つずつ拾うのではなく、role="button" を持つもの全部を対象にする。
  const placements = Array.from({length: 6}, (_, index) => put(`p${index}`, 'games', 0.5, 'now', 'topic'));
  const view = layout({placements, width: 360});
  const html = renderField(view);
  const buttons = buttonTags(html);
  const kinds = {
    lane: buttons.some(tag => /class="lane /.test(tag)),
    toggle: buttons.some(tag => tag.includes('lane-toggle')),
    placement: buttons.some(tag => tag.includes('node-placement')),
    domain: buttons.some(tag => tag.includes('node-domain')),
    cluster: buttons.some(tag => tag.includes('node-cluster'))
  };
  for (const [kind, present] of Object.entries(kinds)) {
    assert.ok(present, `this arrangement was expected to draw an operable "${kind}" element, so the test itself is broken`);
  }
  for (const tag of buttons) {
    const label = attr(tag, 'aria-label');
    assert.ok(label && label.trim().length > 0, `an operable element has no name: ${tag}`);
    assert.match(tag, /\btabindex="0"/, `an operable element is not keyboard-reachable: ${tag}`);
  }
});

test('starting a node drag captures its pointer until the gesture ends', () => {
  assert.equal(typeof fieldUiModule.captureNodePointer, 'function');
  let captured = null;
  const node = {setPointerCapture(pointerId) {captured = pointerId;}};

  fieldUiModule.captureNodePointer(node, 17);

  assert.equal(captured, 17);
  assert.equal(fieldUiModule.captureNodePointer({}, 18), false);
});

test('a cluster names the count it hides in words, not only through its shape', () => {
  const placements = Array.from({length: 6}, (_, index) => put(`p${index}`, 'games', 0.5, 'now', 'topic'));
  const view = layout({placements, width: 360});
  const cluster = view.nodes.find(node => node.node === 'cluster');
  assert.ok(cluster, 'this arrangement must overflow into a cluster for the test to mean anything');
  const html = renderField(view);
  assert.ok(html.includes(cluster.label), 'the "ほか◯件" label must appear as text, not only as a shape');
  const tag = buttonTags(html).find(item => item.includes(`data-node="${cluster.id}"`));
  assert.ok(tag, 'the cluster must itself be one of the operable elements');
  assert.match(attr(tag, 'aria-label'), /\d+/, 'the aria-label must state the hidden count as a digit');
});

test('a converged field is marked by class, spark and plain language, never by color alone', () => {
  // 既存の約束（README/実装コメント）は「色・枠線・印の3つで示す」なので、
  // クラスだけでなく node-spark の印と、一覧側の「合流」という言葉の両方があるかを確かめる。
  const placements = [put('a', 'sea', 0.2), put('b', 'cooking', 0.8)];
  const view = layout({placements, width: 360});
  const html = renderField(view);
  const convergedTag = (html.match(/<g\b[^>]*class="[^"]*node-converged[^"]*"[^>]*>/) ?? [])[0];
  assert.ok(convergedTag, 'no converged node was drawn for a placement pair that should converge');
  const nodeBlock = html.slice(html.indexOf(convergedTag), html.indexOf(convergedTag) + 800);
  assert.match(nodeBlock, /node-spark/, 'a converged node must also carry the spark mark, not only the class');
  const groups = listGroups(placements, 'domain');
  const listHtml = renderFieldList(groups, convergences(placements));
  assert.match(listHtml, /複数の項目に共通/, 'renderFieldList must explain the shared field without relying on color or a class alone');
});

test('user-supplied text is escaped before it reaches the SVG or the list', () => {
  // 置きもののラベルは本人が自由に打てる文字列なので、<script> や & や " が
  // そのままSVG/HTML属性値に混ざると壊れる。エスケープが外れていないかを直接見る。
  const malicious = {...put('x', null, 0.5, 'now', 'custom'), label: '<script>alert(1)</script>&"quote"'};
  const view = layout({placements: [malicious], width: 360});
  const fieldHtml = renderField(view);
  assert.ok(!fieldHtml.includes('<script'), 'a raw <script> tag must never appear in the rendered SVG');
  const listHtml = renderFieldList(listGroups([malicious], 'lane'), []);
  assert.ok(!listHtml.includes('<script'), 'a raw <script> tag must never appear in the rendered list either');
});

test('every name drawn in the field also reads in the list, including names a cluster hid from the picture', () => {
  // 「図が読めなくても同じことが分かる」の中心的な約束。まとめに入って絵から消えた名前こそ、
  // 一覧に出ていなければ「一覧を常設している理由」が成り立たない。
  const placements = Array.from({length: 6}, (_, index) => ({...put(`p${index}`, null, 0.5, 'now', 'custom'), label: `置きもの${index}`}));
  const view = layout({placements, width: 360});
  assert.ok(view.aliases.size > 0, 'this arrangement must fold some placements into a cluster for the test to mean anything');
  const fieldHtml = renderField(view);
  const listHtml = renderFieldList(listGroups(placements, 'lane'), []);
  for (const placement of placements) {
    assert.ok(listHtml.includes(placement.label), `${placement.id}'s name is missing from the list`);
  }
  const hiddenFromPicture = placements.filter(placement => view.aliases.has(placement.id));
  assert.ok(hiddenFromPicture.length > 0);
  for (const placement of hiddenFromPicture) {
    assert.ok(!fieldHtml.includes(placement.label), `${placement.id} was expected to be folded away from the picture by this arrangement`);
    assert.ok(listHtml.includes(placement.label), `${placement.id} disappeared from the field but must still be readable in the list`);
  }
});

test('the field exposes its complete vertical timeline to the page', () => {
  const html = renderField(layout({placements: [put('a', 'games', 0.5)], width: 360}));
  assert.match(html, /preserveAspectRatio="xMidYMin meet"/);
  assert.doesNotMatch(html, /<svg[^>]+\sheight="\d+"/, 'a fixed SVG height would restore the nested vertical viewport');
});

test('route comparison shows each route feature and a direct official detail link', () => {
  const html = renderRoutes({domainId: 'media', domain: domains.media, saved: new Set(), checkedOn: '2026-09-12'});
  assert.equal((html.match(/class="route-card"/g) ?? []).length, 4);
  assert.equal((html.match(/class="route-detail"/g) ?? []).length, 4);
  assert.match(html, /このルートの大学・学部を公式ページで見る/);
});

test('university candidates show four together and put later candidates behind an expandable control', () => {
  const routes = Array.from({length: 6}, (_, index) => ({
    id: `media-route-${index + 1}`,
    kindName: `Route ${index + 1}`,
    steps: [{stage: 'university', title: `University ${index + 1}`, link: {url: `https://example.edu/${index + 1}`}}]
  }));
  const html = renderUniversityCandidates(routes);
  assert.equal((html.match(/class="candidate-primary"/g) ?? []).length, 4);
  assert.equal((html.match(/class="candidate-more"/g) ?? []).length, 2);
  assert.match(html, /<details><summary>ほか2件を広げる<\/summary>/);
});

test('school candidates expose visible review actions', () => {
  const routes = [{
    id: 'media-general',
    kindName: 'General route',
    steps: [
      {stage: 'university', title: 'Example University', link: {url: 'https://example.edu/university'}},
      {stage: 'highschool', title: 'Example High School', link: {url: 'https://example.edu/highschool'}}
    ]
  }];
  const html = renderUniversityCandidates(routes, 4, {domainId: 'media'});
  const id = schoolId('https://example.edu/university', 'Example University');
  assert.ok(html.includes(`data-school-mark="${id}"`));
  assert.ok(html.includes(`data-school-dismiss="${id}"`));
  assert.ok(html.includes(`data-school-open="${id}"`));
});

test('high-school route steps expose the same review actions as universities', () => {
  const html = renderRoutes({
    domainId: 'media',
    domain: domains.media,
    saved: new Set(),
    schoolMarks: new Set(),
    dismissedSchools: new Set(),
    checkedOn: '2026-09-12'
  });
  const id = schoolId('https://www.kyoiku.metro.tokyo.lg.jp/admission/high_school/', '普通科（理科と数学を続けられる学校）');
  assert.ok(html.includes(`data-school-mark="${id}"`));
  assert.ok(html.includes(`data-school-dismiss="${id}"`));
  assert.ok(html.includes(`data-school-open="${id}"`));
});

test('a marked school is visibly identified on the map without relying on color', () => {
  const view = layout({
    placements: [put('a', 'games', 0.5)],
    extraNodes: [{id: 'route-media-general-university', lane: 'faculty', label: 'Example University', x: 0.5, marked: true}],
    width: 360
  });
  const html = renderField(view);
  assert.match(html, /node-school-marked/);
  assert.match(html, /★ Example University/);
  assert.match(html, /よかった印/);
});

test('the inbox and school records are independent main tabs', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./app.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /href="#records"[^>]+data-tab="records"/);
  assert.match(html, /href="#inbox"[^>]+data-tab="inbox"/);
  assert.match(app, /page === 'inbox'/);
  assert.match(app, /page === 'records'/);
});
