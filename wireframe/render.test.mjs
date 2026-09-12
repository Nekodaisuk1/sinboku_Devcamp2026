import test from 'node:test';
import assert from 'node:assert/strict';

import {layout, listGroups, convergences} from './field.mjs';
import {renderField, renderFieldList} from './field-ui.mjs';
import {renderRoutes, renderUniversityCandidates} from './routes-ui.mjs';
import {domains} from './verbs.mjs';

const put = (id, ref, x, lane = 'now', kind = 'topic') => ({id, lane, x, label: id, kind, ref, verb: null, note: ''});

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
    kindName: `Route ${index + 1}`,
    steps: [{stage: 'university', title: `University ${index + 1}`, link: {url: `https://example.edu/${index + 1}`}}]
  }));
  const html = renderUniversityCandidates(routes);
  assert.equal((html.match(/class="candidate-primary"/g) ?? []).length, 4);
  assert.equal((html.match(/class="candidate-more"/g) ?? []).length, 2);
  assert.match(html, /<details><summary>ほか2件を広げる<\/summary>/);
});
