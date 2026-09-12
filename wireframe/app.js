import {encodeMapShare, decodeMapShare} from './map-share.mjs';
import {buildTimeline, nextDecision, GRADES, STANCE_LIMIT, gradeById} from './timeline.mjs';
import {LOG_TEXT_LIMIT, addEntry, removeEntry, recentCount, today} from './log.mjs';
import {verbs, verbById, domains, topics, activitiesByTopic, activityById, domainsForVerb, resourcesForVerb, verbCoverage, resources, allActivities} from './verbs.mjs';
import {searchCatalog, catalogIds, CATEGORIES, filterResources, freshnessOf, coverage, coverageSentence} from './catalog.mjs';
import {PREFECTURES} from './regions.mjs';
import {routesForDomain, hasRoutes, routeDomains, ROUTES_CHECKED_ON} from './routes.mjs';
import {renderRoutes, renderUniversityCandidates} from './routes-ui.mjs';
import {STORAGE_KEY, emptyState, encodeState, decodeState, hasLegacyRecord} from './store.mjs';
import {LANES, LANE_IDS, laneById, layout, laneAt, revealWorld, convergences, reachOf, routePath, newPlacementId, freeX, previewBox, visibleFor, linkedSet, listGroups, convergenceSentence, FIELD_VIEWS, LIST_SORTS,
        sourceOf, contentOf, describeSource, URL_LIMIT, PHOTO_LIMIT, PHOTO_BYTES,
        PLACEMENT_LIMIT, LABEL_LIMIT, buildInterestPlan, buildExternalInformationDraft, placementForResource, setDomainConnection, resetDomainConnections} from './field.mjs';
import {renderField, renderFieldList, renderInterestBuilder, renderConnectionEditor, curve} from './field-ui.mjs';
import {encodeRecommendation, decodeRecommendation, receiveRecommendation, newRecommendationId,
        RECOMMENDATION_TITLE_LIMIT, RECOMMENDATION_NOTE_LIMIT, RECOMMENDATION_URL_LIMIT} from './recommendations.mjs';
import {selectFieldNode, highlightAfterClick, schoolExpansionAfterClick} from './field.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const $ = id => document.getElementById(id);

const catalog = {...catalogIds(), routes: new Set(routeDomains().flatMap(id => routesForDomain(id, domains[id]).map(route => route.id)))};

let state = emptyState();
// 画面の一時的な状態。保存の対象にしない。
const ui = {query: '', filter: 'all', athome: false, editing: null, gradePicker: false, legacy: false,
            selected: null, highlighted: null, routeDomain: null, routeKind: null, expandedSchoolId: null, listView: false, about: false, picker: null,
            verbSection: 'activities', fieldWidth: 360, fieldScroll: null,
            // 表示の絞り込みと段の展開は、見え方だけの状態。保存しない。
            fieldView: 'all', listSort: 'lane', expandedLanes: [], moving: null,
            connectionEditorOpenFor: null,
            // 取り込む前の下書き。確認画面を通るまで state には入れない。
            draft: null,
            // 掲載情報の絞り込み。既定はどれも「絞らない」。本人が絞ったときだけ絞る。
            picks: {category: null, online: false, cost: null, grade: null, when: null},
            picksOpen: false, coverageOpen: false, shareLink: '', mapShareLink: '', sharedMap: false};
let persist = false;
let storageNote = '';
let toastTimer;
let lastView = null;
let settingScroll = false;

/* ---------- 保存：本人が選んだときだけ、この端末に残す ---------- */

function save() {
  if (!persist) return;
  try {
    localStorage.setItem(STORAGE_KEY, encodeState(state));
    storageNote = '';
  } catch (error) {
    // 保存できなかったことを黙って飲み込まない。本人が気づけるようにする。
    // 写真を足して入りきらなくなった場合と、ブラウザが保存を止めている場合では、次にやることが違う。
    persist = false;
    storageNote = error.name === 'QuotaExceededError' || /大きすぎ/.test(error.message)
      ? `記録を保存できませんでした。${error.message} 写真を含む項目を削除すると、また保存できるようになります。画面を閉じるまでは、いまの内容は残っています。`
      : `記録を保存できませんでした（${error.name}）。このブラウザの設定で保存が止められている可能性があります。`;
    render();
  }
}

function restore() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    ui.legacy = hasLegacyRecord(localStorage);
  } catch {
    storageNote = 'このブラウザでは記録を読み書きできません。';
    return;
  }
  if (raw === null) return;
  try {
    state = decodeState(raw, catalog);
    persist = true;
  } catch (error) {
    storageNote = `保存されていた記録を読み込めませんでした：${error.message} 記録は消していません。`;
  }
}

function setPersist(on) {
  persist = on;
  if (on) return save();
  try {
    localStorage.removeItem(STORAGE_KEY);
    storageNote = 'この端末の記録を消しました。画面を閉じるまでは、いまの内容が残ります。';
  } catch {
    storageNote = 'この端末の記録を消せませんでした。';
  }
}

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {toast.hidden = true;}, 4500);
}

function route() {
  const [name, argument] = location.hash.replace(/^#/, '').split('/');
  if (name === 'find') return {page: 'find', verb: verbById(argument) ? argument : null};
  if (name === 'routes' && hasRoutes(argument)) return {page: 'routes', domain: argument};
  if (name === 'recommend') return {page: 'recommend'};
  return {page: 'now'};
}

/* ---------- 外から届いたページを、置く前に確認する ---------- */

/**
 * ブックマークレットから `#add?u=...&t=...` で届いたページを下書きにする。
 * 届いた文字列は、このアプリの外で作られたものとして扱う。中身を取りに行かない（通信しない）し、
 * 何についての話かも推測しない。開くかどうかも、タグを付けるかも、本人が決める。
 */
function startLinkDraft(url, title = '') {
  ui.draft = buildExternalInformationDraft({url, title, lane: ui.picker?.lane ?? 'now'});
  ui.picker = null;
}

/** ハッシュに届いた取り込み要求を1回だけ消費する。再読み込みで二重に出さない。 */
function consumeAddHash() {
  const raw = location.hash.replace(/^#/, '');
  if (raw !== 'add' && !raw.startsWith('add?')) return false;
  const query = new URLSearchParams(raw.slice(3).replace(/^\?/, ''));
  const url = (query.get('u') ?? '').trim();
  const title = (query.get('t') ?? '').trim();
  history.replaceState(null, '', '#now');
  if (!url) {
    notify('送られてきたページのアドレスが読み取れませんでした。');
    return true;
  }
  try {
    startLinkDraft(url, title);
  } catch (error) {
    notify(error.message);
  }
  return true;
}

/** 家族から届いた共有リンクを受信箱へ入れる。野原へは本人が選ぶまで置かない。 */
function consumeRecommendationHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw.startsWith('inbox?')) return false;
  const encoded = new URLSearchParams(raw.slice(6)).get('d') ?? '';
  history.replaceState(null, '', '#now');
  try {
    const payload = decodeRecommendation(encoded, catalog);
    const result = receiveRecommendation(payload, state.recommendations, catalog, {
      id: newRecommendationId(), receivedOn: today()
    });
    state.recommendations = result.items;
    save();
    notify(result.added ? '家族からのおすすめが届きました。進路マップに追加するか、あとで見るかを選べます。' : 'このおすすめは、すでに届いています。');
  } catch (error) {
    notify(error.message);
  }
  return true;
}

/** 共有URLのグラフは一時表示だけにし、この端末に保存済みのマップは上書きしない。 */
function consumeSharedMapHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw.startsWith('shared?')) return false;
  const encoded = new URLSearchParams(raw.slice(7)).get('d') ?? '';
  history.replaceState(null, '', '#now');
  try {
    const placements = decodeMapShare(encoded, catalog);
    state = {...emptyState(), placements};
    persist = false;
    ui.sharedMap = true;
    notify('共有された進路マップを表示しています。この端末の保存内容は変更していません。');
  } catch (error) {
    notify(error.message);
  }
  return true;
}

/* ---------- 野原 ---------- */

function fieldView() {
  // 絞り込みは「描くものを減らす」だけ。保存された置きものには手を触れない。
  const focus = ui.highlighted ?? ui.selected;
  const scope = visibleFor(state.placements, {view: ui.fieldView, selected: focus});
  const routeDomain = ui.routeDomain;
  const anchor = routeDomain
    ? revealWorld(scope.placements).domains.find(domain => domain.id === routeDomain)?.x ?? 0.5
    : 0.5;
  const extra = routeDomain
    ? routePath(routeDomain, ui.routeKind, anchor, {expandedSchoolId: ui.expandedSchoolId})
    : {nodes: [], links: []};
  const extraNodes = extra.nodes.map(node => ({...node, links: extra.links.filter(link => link.from === node.id)}));
  // 選んだものと、その線の行き先は「ほか◯件」に隠さない。隠れると線を最後まで追えない。
  // いま動かしているものも同じ。動かした先で消えてしまっては、動かした意味がない。
  const openSchools = extraNodes.filter(node => node.kind === 'school-option').map(node => node.id);
  const keep = new Set([...linkedSet(scope.placements, focus), focus, ui.selected, ui.expandedSchoolId, ui.moving, ...openSchools].filter(Boolean));
  const view = layout({placements: scope.placements, extraNodes, width: ui.fieldWidth, expandedLanes: ui.expandedLanes, keep});
  return {...view, scope};
}

/** 絞り込んだときに、何件を隠しているかを必ず言う。黙って減らさない。 */
function scopeMarkup(scope) {
  const total = state.placements.length;
  if (!total || (!scope.hidden && !scope.note)) return '';
  const counted = scope.hidden ? `${total}件のうち${total - scope.hidden}件を表示しています。` : '';
  return `<p class="field-scope">${escape(counted)}${escape(scope.note ?? '')}</p>`;
}

/**
 * 広げている段を、野原の外にも出す。段の見出しにある「まとめる」は、
 * 広げて縦に長くなった段をスクロールすると画面の外へ消えてしまい、戻せなくなる。
 */
function expandedMarkup(view) {
  const open = view.lanes.filter(lane => lane.expanded);
  if (!open.length) return '';
  // 段の名前は「◯◯を選ぶ」なので、「を閉じる」を足すと「選ぶを閉じる」になる。
  // 見出しは名前だけにして、何をする釦かは aria-label で言う。
  return `<p class="field-expanded">広げている時期：${open.map(lane =>
    `<button class="lane-chip on" data-expand-lane="${escape(lane.id)}" data-expand-from="list" aria-label="${escape(lane.title)}の時期をまとめる">${escape(lane.title)}<span aria-hidden="true"> ✕</span></button>`).join('')}</p>`;
}

function fieldViewMarkup() {
  if (state.placements.length === 0) return '';
  return `<div class="field-views" role="group" aria-label="進路マップの表示">
    ${FIELD_VIEWS.map(item => `<button class="view-chip${ui.fieldView === item.id ? ' on' : ''}" data-field-view="${escape(item.id)}" aria-pressed="${ui.fieldView === item.id}" title="${escape(item.hint)}">${escape(item.label)}</button>`).join('')}
  </div>`;
}

/** 一覧にも出どころを出す。図が読めない人にも、掲載情報と自分で足したものの違いが分かるように。 */
function listWithSource(groups) {
  return groups.map(group => ({...group, items: group.items.map(item => {
    const placement = state.placements.find(entry => entry.id === item.id);
    if (!placement) return item;
    const origin = describeSource(placement);
    return {...item, sub: [item.sub, origin.label].filter(Boolean).join(' · '), caution: origin.caution};
  })}));
}

function listSortMarkup() {
  return `<div class="list-sorts" role="group" aria-label="一覧の並べ方">
    <span class="list-sorts-label">並べ方</span>
    ${LIST_SORTS.map(item => `<button class="lane-chip${ui.listSort === item.id ? ' on' : ''}" data-list-sort="${escape(item.id)}" aria-pressed="${ui.listSort === item.id}">${escape(item.label)}</button>`).join('')}
  </div>`;
}

/**
 * 選んだものに直接つながる線だけを明るくする。ほかは消さずに薄くする。
 * 経路だけは1本の道なので、最後までたどる。何もかも明るくすると、選んだ意味がなくなる。
 */
function highlightFor(view) {
  if (!ui.highlighted || !view.byId.has(ui.highlighted)) return new Set();
  const lit = new Set([ui.highlighted]);
  for (const link of view.links) {
    if (link.from === ui.highlighted) lit.add(link.to);
    if (link.to === ui.highlighted) lit.add(link.from);
  }
  let frontier = [...lit];
  while (frontier.length) {
    const next = [];
    for (const link of view.links.filter(item => item.kind === 'route')) {
      if (frontier.includes(link.to) && !lit.has(link.from)) {lit.add(link.from); next.push(link.from);}
    }
    frontier = next;
  }
  return lit;
}

function contextMarkup(next, grade, week) {
  const placement = state.placements.at(-1);
  const timing = next.when && next.when.months >= 0
    ? `あと${next.when.months}か月`
    : grade ? next.defer : '中3の12月ごろが目安';
  const decision = next.name || '次の選択時期';
  return `<section class="field-context" aria-label="いま確認できること">
    <button class="context-item context-decision" data-node-open="lane-${escape(next.decision)}">
      <span>次の選択時期</span>
      <b>${escape(decision)}</b>
      <small>${escape(timing)} · いま全部を決めなくて大丈夫</small>
    </button>
    ${state.placements.length === 1 ? `<button class="context-item context-resume" data-open-picker="topic">
      <span>つぎの一手</span>
      <b>もうひとつ追加して、共通点を見る</b>
      <small>別の好きなことや活動を選ぶ</small>
    </button>` : placement ? `<button class="context-item context-resume" data-node-open="${escape(placement.id)}">
      <span>進路マップのつづき</span>
      <b>「${escape(placement.label)}」を見る</b>
      <small>追加した項目${state.placements.length}件${week ? ` · 7日間の記録${week}件` : ''}</small>
    </button>` : `<a class="context-item context-explore" href="#find">
      <span>何を追加するか迷ったら</span>
      <b>やっていることから探す</b>
      <small>36の活動と42の掲載情報</small>
    </a>`}
  </section>`;
}

function convergenceMarkup() {
  const found = convergences(state.placements);
  if (!found.length) {
    // 合流しないことを失敗にしない。無理に線をつながず、次にできることだけを出す。
    if (state.placements.length < 2) return '';
    const loose = state.placements.filter(placement => !reachOf(placement).length).length;
    return `<section class="converge converge-none">
      <h2>共通する学問はまだありません</h2>
      <p>${loose ? `${loose}件は、まだ学問と関連づいていません。タップして関わり方を選ぶと、関連する学問が表示されます。` : '追加した項目は、それぞれ別の学問分野につながっています。それも一つの結果です。'}</p>
      <p class="converge-note">無理に共通点を作ることはしません。別の好きなことを追加するか、「探す」で関わり方から活動を追加してみてください。</p>
    </section>`;
  }
  return `<section class="converge">
    <h2>複数の項目に共通する学問</h2>
    <ul>${found.map(item => {
      // 名前を全部並べない。1つの学問に8件届くことがあり、並べると1行が画面を埋める。
      const {shown, rest, all, name} = convergenceSentence(item);
      return `<li>
      <p class="converge-from">${shown.map(label => `<span>${escape(label)}</span>`).join('<em>と</em>')}${rest ? `<em>ほか</em><span>${rest}件</span>` : ''}</p>
      <p class="converge-to">${escape(all)} <button class="link-button" data-node-open="domain-${escape(item.domain)}">${escape(name)}</button> につながっています</p>
    </li>`;
    }).join('')}</ul>
    <p class="converge-note">複数の項目が同じ学問分野につながっているという意味です。向き不向きの判定ではありません。</p>
  </section>`;
}

function placementPanel(placement) {
  const reach = reachOf(placement).map(id => domains[id]?.name).filter(Boolean);
  const lane = laneById(placement.lane);
  const records = state.log.filter(entry => entry.placement === placement.id);
  const origin = describeSource(placement);
  const own = sourceOf(placement) === 'self';
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">${escape(origin.label)} · ${escape(lane.title)}</p>
    <h2>${escape(placement.label)}</h2>
    <form class="placement-name-form" data-rename-placement="${escape(placement.id)}">
      <label for="placement-name">項目名</label>
      <div><input id="placement-name" name="label" type="text" maxlength="${LABEL_LIMIT}" value="${escape(placement.label)}" required><button class="secondary" type="submit">名前を変更</button></div>
    </form>
    ${origin.caution ? `<p class="placement-caution">${escape(origin.caution)}。${placement.url ? 'リンク先を開くかどうかは、自分で決めてください。' : ''}</p>` : ''}
    ${placement.photo ? `<img class="photo-preview" src="${escape(placement.photo)}" alt="「${escape(placement.label)}」として置いた写真">` : ''}
    ${placement.url ? `<a class="secondary" href="${escape(placement.url)}" target="_blank" rel="noopener noreferrer nofollow">このページを開く ↗<small class="confirm-url">${escape(placement.url)}</small></a>` : ''}
    ${reach.length
      ? `<p class="panel-reach">関連する学問：<b>${reach.map(escape).join('・')}</b></p>`
      : '<p class="panel-reach muted">関連する学問はまだありません。下でタグを選ぶと表示されます。</p>'}

    ${renderConnectionEditor({
      domains,
      connected: new Set(reachOf(placement)),
      customized: Array.isArray(placement.domains),
      open: ui.connectionEditorOpenFor === placement.id
    })}

    ${own ? `<div class="panel-block">
      <p class="panel-label">何について？</p>
      <div class="lane-row">${Object.entries(topics).map(([id, topic]) => `<button class="lane-chip${placement.topic === id ? ' on' : ''}" data-set-topic="${escape(id)}" aria-pressed="${placement.topic === id}">${escape(topic.label)}</button>`).join('')}</div>
    </div>` : ''}

    ${own || !reach.length ? `<div class="panel-block">
      <p class="panel-label">どんなふうに関わっている？</p>
      <div class="verb-row">${verbs.map(verb => `<button class="verb-chip small${placement.verb === verb.id ? ' on' : ''}" data-set-verb="${escape(verb.id)}" aria-pressed="${placement.verb === verb.id}">${escape(verb.icon)} ${escape(verb.label)}</button>`).join('')}</div>
    </div>` : ''}

    <div class="panel-block">
      <p class="panel-label">いつのこと？</p>
      <div class="lane-row">${LANES.map(item => `<button class="lane-chip${placement.lane === item.id ? ' on' : ''}" data-move-lane="${escape(item.id)}" aria-pressed="${placement.lane === item.id}">${escape(item.id === 'now' ? 'いま' : item.horizon)}</button>`).join('')}</div>
      <p class="panel-hint">未来の時期を選ぶと「その頃にやりたいこと」として残せます。指で動かしても変更できます。</p>
    </div>

    <form class="panel-log" data-log-form="${escape(placement.id)}">
      <label for="log-text">これでやったことを残す（任意）</label>
      <div class="panel-log-row">
        <input id="log-text" name="text" type="text" maxlength="${LOG_TEXT_LIMIT}" placeholder="録音を昨日のと聴き比べた" autocomplete="off">
        <button class="primary small" type="submit">残す</button>
      </div>
    </form>
    ${records.length ? `<ul class="panel-records">${records.slice(0, 6).map(entry => `<li><span>${escape(entry.date.slice(5).replace('-', '/'))}</span>${escape(entry.text)}<button class="text-button warn" data-log-remove="${escape(entry.id)}">消す</button></li>`).join('')}</ul>` : ''}

    <button class="text-button warn panel-remove" data-remove-placement="${escape(placement.id)}">この項目を削除する</button>
  </section>`;
}

function domainPanel(domainId) {
  const domain = domains[domainId];
  const world = revealWorld(state.placements).domains.find(item => item.id === domainId);
  const from = (world?.from ?? []).map(id => state.placements.find(placement => placement.id === id)?.label).filter(Boolean);
  const routes = hasRoutes(domainId) ? routesForDomain(domainId, domain) : [];
  const selectedRoute = routes.find(item => item.kind === ui.routeKind) ?? null;
  return `<section class="panel panel-domain">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">追加した項目に関連する学問</p>
    <h2>${escape(domain.name)}</h2>
    <p>${escape(domain.summary)}</p>
    <p class="panel-example">${escape(domain.example)}</p>
    ${from.length ? `<p class="panel-reach">${from.map(label => `「${escape(label)}」`).join('と')}に関連しています。</p>` : ''}

    ${routes.length ? `<div class="panel-block route-compare-panel">
      <p class="panel-label">進路ルートは${routes.length}通り。${selectedRoute ? '選んだルートを進路マップに表示しています。' : '選ぶ前に、すべてのルートを進路マップに表示しています。'}</p>
      ${selectedRoute ? '<button class="text-button route-show-all" data-route-all>すべてのルートをもう一度比べる</button>' : ''}
      ${renderUniversityCandidates(routes)}
      <div class="route-choice-grid">${routes.map(item => {
        return `<article class="route-choice${ui.routeKind === item.kind ? ' on' : ''}">
          <button data-route-kind="${escape(item.kind)}" aria-pressed="${ui.routeKind === item.kind}">
            <strong>${escape(item.kindName)}</strong>
            <span>${escape(item.kindSummary)}</span>
            <small>数学 ${escape(item.math.label)}</small>
          </button>
          <p>${escape(item.why)}</p>
        </article>`;
      }).join('')}</div>
      <a class="secondary route-entry" href="#routes/${escape(domainId)}">${routes.length}通りの特徴を表と個別ページで比べる →</a>
    </div>` : '<p class="empty-note">この学問の進路ルートは、まだ用意できていません。</p>'}
  </section>`;
}

function routeNodePanel(node) {
  const option = node.kind === 'school-option';
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">${option ? '似た学部・活動を持つ学校' : '進路ルートの途中'}</p>
    <h2>${escape(node.label)}</h2>
    <p>${escape(node.detail)}</p>
    ${node.link ? `<a class="secondary" href="${escape(node.link.url)}" target="_blank" rel="noopener noreferrer">${escape(node.link.name)} ↗<small>出典 ${escape(node.link.source)}・別のタブで開きます</small></a>` : ''}
  </section>`;
}

function lanePanel(laneId) {
  const lane = laneById(laneId);
  const timeline = buildTimeline({gradeId: state.grade, stances: state.stances});
  const rung = timeline.find(item => item.decision === lane.decision);
  if (!rung) {
    return `<section class="panel">
      <button class="panel-close" data-deselect>× 閉じる</button>
      <p class="panel-kind">現在の時期</p>
      <h2>いま</h2>
      <p>今日のことです。追加した項目から、関連する学問や進路が上の時期へ表示されます。ここで決めることはありません。</p>
    </section>`;
  }
  const editing = ui.editing === laneId;
  const away = rung.when === null ? ''
    : rung.when.months < 0 ? 'この選択時期は過ぎています。'
    : rung.when.months === 0 ? '今月ごろです。'
    : `あと${rung.when.months}か月（${rung.when.year}年${rung.when.month}月ごろ）。`;
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">選択時期${rung.status === 'next' ? '・次はここ' : ''}</p>
    <h2>${escape(rung.name)}</h2>
    <p class="panel-defer">今すぐ決める必要はありません。目安は${escape(rung.defer)}です。${escape(away)}</p>
    <p>${escape(rung.detail)}</p>
    ${editing
      ? `<form class="stance-form" data-stance-form="${escape(laneId)}">
          <label for="stance-input">いまの考え（空欄のままでもかまいません）</label>
          <input id="stance-input" name="stance" type="text" maxlength="${STANCE_LIMIT}" value="${escape(rung.stance)}" placeholder="まだ決めてない／高専も見てる">
          <div class="stance-actions"><button class="primary" type="submit">残す</button><button class="text-button" type="button" data-stance-cancel>やめる</button>
          ${rung.stance ? `<button class="text-button warn" type="button" data-stance-clear="${escape(laneId)}">消す</button>` : ''}</div>
        </form>`
      : rung.stance
        ? `<p class="stance"><span>いまの考え</span>${escape(rung.stance)} <button class="text-button" data-stance-edit="${escape(laneId)}">書き直す</button></p>`
        : `<p class="stance empty">まだ決める時期ではありません。<button class="text-button" data-stance-edit="${escape(laneId)}">いま思っていることを書く</button></p>`}
  </section>`;
}

function selectionPanel(view) {
  if (!ui.selected) return '';
  const placement = state.placements.find(item => item.id === ui.selected);
  if (placement) return placementPanel(placement);
  if (ui.selected.startsWith('domain-')) return domainPanel(ui.selected.slice(7));
  if (ui.selected.startsWith('lane-')) return lanePanel(ui.selected.slice(5));
  const node = view.byId.get(ui.selected);
  if (node?.node === 'world') return routeNodePanel(node);
  return '';
}

/* ---------- 写真：この端末の中だけに置く ---------- */

const PHOTO_STEPS = [[480, 0.7], [480, 0.55], [360, 0.55], [240, 0.5]];

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('この写真を読み込めませんでした。'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('この写真を画像として読めませんでした。'));
    image.src = dataUrl;
  });
}

/**
 * 端末保存に収まる大きさまで小さくする。入らなければ黙って諦めず、本人に言う。
 * 送信はしない。縮小もこの端末の中で終わる。
 */
async function shrinkPhoto(file) {
  const image = await loadImage(await readFile(file));
  for (const [side, quality] of PHOTO_STEPS) {
    const scale = Math.min(1, side / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL('image/jpeg', quality);
    if (encoded.length <= PHOTO_BYTES) return encoded;
  }
  throw new Error('この写真は、この端末に残すには大きすぎました。別の写真を選んでください。');
}

/* ---------- 置く前の確認 ---------- */

/** いまの選び方だと、どこへ線が伸びるのかを先に言う。置いてから驚かせない。 */
function draftReachNote(draft) {
  const reach = reachOf({kind: draft.kind, ref: null, topic: draft.topic, verb: draft.verb, domains: draft.domains})
    .map(id => domains[id]?.name).filter(Boolean);
  if (!reach.length) return 'いまのままだと、関連する学問はありません。タグはあとから選ぶこともできます。';
  return `関連する学問：${reach.join('・')}`;
}

function draftMarkup() {
  if (!ui.draft) return '';
  const draft = ui.draft;
  return `<dialog class="picker confirm-panel" id="draft" aria-label="進路マップに追加する前の確認">
    <div class="picker-head">
      <p class="picker-lane">追加する前に確認します</p>
      <button class="text-button" data-draft-cancel>やめる</button>
    </div>
    <p class="placement-caution">これは<b>自分で追加</b>するものです。このアプリは中身を見に行っていないので、内容は確認していません。${draft.kind === 'link' ? 'リンク先を開くかどうかは、自分で決めてください。' : ''}</p>
    <form data-draft-form>
      ${draft.kind === 'link' ? `<div class="confirm-row"><span>リンク先</span><p class="confirm-url">${escape(draft.url)}</p></div>` : ''}
      ${draft.kind === 'photo' ? `<div class="confirm-row"><span>写真</span><img class="photo-preview" src="${escape(draft.photo)}" alt="置こうとしている写真"></div>` : ''}

      <label for="draft-title">進路マップに表示する名前</label>
      <input id="draft-title" name="title" type="text" maxlength="${LABEL_LIMIT}" value="${escape(draft.title)}" placeholder="例：波の高さの調べ方" autocomplete="off" required>

      <p class="panel-label">何について？</p>
      <div class="lane-row">${Object.entries(topics).map(([id, topic]) => `<button type="button" class="lane-chip${draft.topic === id ? ' on' : ''}" data-draft-topic="${escape(id)}" aria-pressed="${draft.topic === id}">${escape(topic.label)}</button>`).join('')}</div>

      <p class="panel-label">どんなふうに関わる？</p>
      <div class="verb-row">${verbs.map(verb => `<button type="button" class="verb-chip small${draft.verb === verb.id ? ' on' : ''}" data-draft-verb="${escape(verb.id)}" aria-pressed="${draft.verb === verb.id}">${escape(verb.icon)} ${escape(verb.label)}</button>`).join('')}</div>

      ${draft.kind === 'link' ? `<fieldset class="external-genres">
        <legend>つなぐジャンル（1つ以上）</legend>
        <p class="panel-hint">この情報と関係があると思うジャンルを選んでください。複数選べます。</p>
        <div class="lane-row">${Object.entries(domains).map(([id, domain]) => `<button type="button" class="lane-chip${draft.domains.includes(id) ? ' on' : ''}" data-draft-domain="${escape(id)}" aria-pressed="${draft.domains.includes(id)}">${escape(domain.name)}</button>`).join('')}</div>
      </fieldset>` : ''}

      <p class="panel-label">いつやりたい？</p>
      <div class="lane-row">${LANES.map(item => `<button type="button" class="lane-chip${draft.lane === item.id ? ' on' : ''}" data-draft-lane="${escape(item.id)}" aria-pressed="${draft.lane === item.id}">${escape(item.id === 'now' ? 'いま' : item.horizon)}</button>`).join('')}</div>

      <p class="panel-hint">${escape(draftReachNote(draft))}</p>
      <button class="primary" type="submit">進路マップに追加</button>
    </form>
  </dialog>`;
}

/** 見ているページを野原へ送るブックマークレット。CSPで自分の画面では動かないので、登録用として出す。 */
function bookmarkletMarkup() {
  const target = `${location.origin}${location.pathname}`;
  const code = `javascript:(function(){window.open('${target}#add?u='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title||''),'_blank');})()`;
  return `<details class="bookmarklet">
    <summary>見ているページを、ここへ送れるようにする</summary>
    <p class="panel-hint">下のリンクをブラウザのお気に入りバーへドラッグして登録します。登録したあと、気になるページで押すと、この画面の確認に届きます。送られるのはアドレスとページの題名だけで、このアプリから外へは何も出しません。</p>
    <p><a class="bookmarklet-link" href="${escape(code)}" onclick="return false">進路マップへ送る</a></p>
    <p class="panel-hint">ドラッグできないときは、次の文字列をお気に入りのアドレス欄に貼り付けてください。</p>
    <textarea class="bookmarklet-code" rows="3" readonly>${escape(code)}</textarea>
  </details>`;
}

function pickerMarkup() {
  if (!ui.picker) return '';
  const {tab, lane: laneId} = ui.picker;
  const tabs = [['topic', '好きなこと'], ['activity', 'やってみる'], ['resource', '掲載情報'], ['custom', '自分で足す']];
  const body = tab === 'topic'
    ? `<ul class="pick-list">${Object.entries(topics).map(([id, topic]) => `<li><button data-pick="topic:${escape(id)}"><b>${escape(topic.label)}</b><span>${escape(topic.root)}</span></button></li>`).join('')}</ul>`
    : tab === 'activity'
      ? `<ul class="pick-list">${allActivities().map(activity => `<li><button data-pick="activity:${escape(activity.id)}"><b>${escape(activity.title)}</b><span>${escape(topics[activity.topic]?.label ?? '')} · ${escape(verbById(activity.verb)?.label ?? '')} · 目安${activity.minutes}分</span></button></li>`).join('')}</ul>`
      : tab === 'resource'
        ? `<ul class="pick-list">${Object.entries(resources).map(([id, item]) => `<li><button data-pick="resource:${escape(id)}"><b>${escape(item.name)}</b><span>${escape(item.kind)}</span></button></li>`).join('')}</ul>`
        : `<div class="pick-self">
            <form class="pick-write" data-pick-write>
              <label for="pick-label">思いついたことを書く</label>
              <input id="pick-label" name="label" type="text" maxlength="${LABEL_LIMIT}" placeholder="例：アンプを自作する" autocomplete="off" required>
              <p class="panel-label">どんなふうに関わる？（あとで選んでもかまいません）</p>
              <div class="verb-row">${verbs.map(verb => `<label class="verb-chip small"><input type="radio" name="verb" value="${escape(verb.id)}"> ${escape(verb.icon)} ${escape(verb.label)}</label>`).join('')}</div>
              <button class="primary" type="submit">追加する</button>
            </form>

            <form class="pick-link" data-pick-link>
              <label for="pick-url">外部情報をジャンルにつなぐ</label>
              <input id="pick-url" name="url" type="url" inputmode="url" maxlength="${URL_LIMIT}" placeholder="https://" autocomplete="off" required>
              <button class="secondary" type="submit">確認する</button>
              <p class="panel-hint">記事、イベント、学校などのURLを入れ、次の画面で関係するジャンルを選びます。リンク先の中身はこのアプリでは確認しません。</p>
            </form>

            <div class="pick-photo">
              <label for="pick-photo">写真を追加</label>
              <input id="pick-photo" type="file" accept="image/*" data-photo-input>
              <p class="panel-hint">写真はこの端末の中だけに残り、送信されません。保存できる大きさに縮小して追加します（${PHOTO_LIMIT}枚まで）。</p>
            </div>

            ${bookmarkletMarkup()}
          </div>`;
  return `<dialog class="picker" id="picker" aria-label="進路マップに追加するものを選ぶ">
    <div class="picker-head">
      <p class="picker-lane">${escape(laneById(laneId).id === 'now' ? '現在の時期に追加します' : `${laneById(laneId).horizon}の時期に追加します`)}</p>
      <button class="text-button" data-close-picker>閉じる</button>
    </div>
    <div class="lane-row">${LANES.map(item => `<button class="lane-chip${item.id === laneId ? ' on' : ''}" data-picker-lane="${escape(item.id)}">${escape(item.id === 'now' ? 'いま' : item.horizon)}</button>`).join('')}</div>
    <div class="picker-tabs">${tabs.map(([id, label]) => `<button class="picker-tab${tab === id ? ' on' : ''}" data-picker-tab="${id}">${label}</button>`).join('')}</div>
    <div class="picker-body">${body}</div>
  </dialog>`;
}

function nowPage() {
  const view = fieldView();
  lastView = view;
  const timeline = buildTimeline({gradeId: state.grade, stances: state.stances});
  const next = nextDecision(timeline);
  const grade = gradeById(state.grade);
  const week = recentCount(state.log, 7);
  return `
    <section class="field-head">
      <h1>7年進路マップ</h1>
      <p class="lead">下が今日、上が7年先です。横の位置は自由に変えられます。<button class="link-button" data-about>このマップについて</button></p>
      <div class="field-controls">
        <button class="grade-open" data-grade-open>${grade ? `いま ${escape(grade.label)}` : 'いま何年生？'}</button>
        <button class="primary" data-open-picker="topic">＋ 項目を追加</button>
        <button class="ghost" data-list-view aria-pressed="${ui.listView}">${ui.listView ? 'マップで見る' : '一覧で読む'}</button>
        ${ui.highlighted ? '<button class="ghost" data-clear-highlight>ハイライトを解除</button>' : ''}
        ${ui.routeDomain ? '<button class="ghost" data-close-route>ルート表示を閉じる</button>' : ''}
        ${state.placements.length ? '<button class="ghost" data-share-map>このマップを共有</button>' : ''}
      </div>
      ${ui.sharedMap ? `<aside class="shared-map-notice"><b>共有されたマップを表示中</b><span>この端末に保存している自分のマップは変更していません。</span><button class="text-button" data-return-own-map>自分のマップに戻る</button></aside>` : ''}
      ${ui.mapShareLink ? `<section class="map-share-result" tabindex="-1" id="map-share-result">
        <h2>共有リンクができました</h2>
        <textarea readonly rows="4" aria-label="進路マップの共有リンク">${escape(ui.mapShareLink)}</textarea>
        <button class="secondary" data-copy-map-share>リンクをコピー</button>
        <p>共有されるもの：ノード名・接続・時期・配置・外部URL。共有されないもの：写真・行動記録・学年・考えのメモ・受信箱。</p>
      </section>` : ''}
      ${fieldViewMarkup()}
      ${ui.about ? '<p class="field-about">縦軸は時間です。追加した項目と関連する学問を線で結びます。異なる興味が同じ学問につながることもあります。</p>' : ''}
      ${ui.gradePicker ? `<div class="grade-choices">
        ${GRADES.map(item => `<button class="grade-choice${state.grade === item.id ? ' on' : ''}" data-grade="${item.id}">${escape(item.label)}</button>`).join('')}
        <button class="grade-choice clear" data-grade="">答えない</button>
      </div><p class="grade-note">次の選択時期まであと何か月かを出すためだけに使います。この端末の中だけです。</p>` : ''}
    </section>

    ${renderInterestBuilder({
      topics,
      verbs,
      domains,
      placedRefs: new Set(state.placements.filter(placement => placement.kind === 'topic').map(placement => placement.ref)),
      open: state.placements.length === 0
    })}
    ${recommendationInboxMarkup()}
    ${contextMarkup(next, grade, week)}

    ${ui.listView
      ? `${listSortMarkup()}
         ${view.scope.placements.length
            ? renderFieldList(listWithSource(listGroups(view.scope.placements, ui.listSort)), convergences(view.scope.placements))
            : '<p class="field-list-empty">まだ項目がありません。</p>'}
         ${scopeMarkup(view.scope)}`
      : `<div class="field-stage">
           <div class="field-wrap" id="field-wrap">${renderField(view, {selected: ui.selected, highlight: highlightFor(view), next: next.decision})}</div>
         </div>
         ${expandedMarkup(view)}
         ${scopeMarkup(view.scope)}
         <p class="field-legend">時期の見出しをタップすると、その時期の選択について読めます。追加した項目は指でも、選んでから矢印キーでも動かせます。混みあった時期は「広げる」で1件ずつ表示できます。図が読みにくいときは「一覧で読む」へ。</p>`}

    ${selectionPanel(view)}
    ${convergenceMarkup()}

    ${storageSection()}
    <section class="family-entry" aria-labelledby="family-entry-title">
      <p class="eyebrow">家族と見つける</p>
      <h2 id="family-entry-title">おすすめを送ってもらう</h2>
      <p>家族が作ったリンクから、この受信箱へ1件ずつ届きます。進路マップに追加するかは自分で決められます。</p>
      <a class="secondary inline-action" href="#recommend">家族用の送り方を開く</a>
    </section>
    ${pickerMarkup()}
    ${draftMarkup()}`;
}

function recommendationCard(item) {
  let host = '';
  try { host = new URL(item.url).hostname; } catch { host = item.url; }
  const tags = [item.topic ? topics[item.topic]?.label : null, item.verb ? verbById(item.verb)?.label : null].filter(Boolean);
  return `<li class="recommend-card${item.status === 'later' ? ' is-later' : ''}">
    <p class="recommend-from">家族から · ${escape(item.receivedOn)}</p>
    <h3>${escape(item.title)}</h3>
    ${item.note ? `<p class="recommend-note">「${escape(item.note)}」</p>` : ''}
    ${tags.length ? `<p class="recommend-tags">${tags.map(tag => `<span>${escape(tag)}</span>`).join('')}</p>` : ''}
    <a class="recommend-url" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer nofollow">${escape(host)}を開く</a>
    <div class="recommend-actions">
      <button class="primary small" data-recommend-place="${escape(item.id)}">進路マップに追加</button>
      ${item.status === 'new' ? `<button class="ghost small" data-recommend-later="${escape(item.id)}">あとで見る</button>` : ''}
      <button class="text-button" data-recommend-dismiss="${escape(item.id)}">受信箱から消す</button>
    </div>
  </li>`;
}

function recommendationInboxMarkup() {
  const items = state.recommendations ?? [];
  if (!items.length) return '';
  const fresh = items.filter(item => item.status === 'new');
  const later = items.filter(item => item.status === 'later');
  return `<section class="recommend-inbox" aria-labelledby="recommend-inbox-title">
    <p class="eyebrow">届いたもの ${fresh.length ? `<strong>${fresh.length}</strong>` : ''}</p>
    <h2 id="recommend-inbox-title">家族からのおすすめ</h2>
    <p class="panel-hint">リンク先の内容はこのアプリでは確認していません。開くか、進路マップへ追加するかは自分で選べます。</p>
    ${fresh.length ? `<ul class="recommend-list">${fresh.map(recommendationCard).join('')}</ul>` : '<p class="recommend-empty">新しく届いたものはありません。</p>'}
    ${later.length ? `<details class="recommend-later"><summary>あとで見る（${later.length}件）</summary><ul class="recommend-list">${later.map(recommendationCard).join('')}</ul></details>` : ''}
  </section>`;
}

function recommendPage() {
  return `<section class="recommend-maker page-head">
    <a class="back" href="#now">← 進路マップへ</a>
    <p class="eyebrow">家族用</p>
    <h1>1件だけ、おすすめを渡す</h1>
    <p class="lead">気になったページと一言をリンクにします。受け取った本人が、進路マップに追加するかを決めます。</p>
    <form data-recommend-form class="recommend-form">
      <label>おすすめの名前 <input name="title" type="text" maxlength="${RECOMMENDATION_TITLE_LIMIT}" required placeholder="例：海の研究を体験できるイベント"></label>
      <label>ページのURL <input name="url" type="url" inputmode="url" maxlength="${RECOMMENDATION_URL_LIMIT}" required placeholder="https://"></label>
      <label>一言（なくても大丈夫） <textarea name="note" maxlength="${RECOMMENDATION_NOTE_LIMIT}" rows="3" placeholder="例：前に話していたことと近そう"></textarea></label>
      <div class="recommend-form-row">
        <label>何について <select name="topic"><option value="">選ばない</option>${Object.entries(topics).map(([id, topic]) => `<option value="${escape(id)}">${escape(topic.label)}</option>`).join('')}</select></label>
        <label>どんな関わり方 <select name="verb"><option value="">選ばない</option>${verbs.map(verb => `<option value="${escape(verb.id)}">${escape(verb.label)}</option>`).join('')}</select></label>
      </div>
      <button class="primary" type="submit">渡すリンクを作る</button>
    </form>
    ${ui.shareLink ? `<div class="share-result" tabindex="-1" id="share-result">
      <h2>このリンクを本人へ送る</h2>
      <textarea readonly rows="4">${escape(ui.shareLink)}</textarea>
      <button class="secondary" data-copy-share>リンクをコピー</button>
      <p>このリンクには上の1件だけが入っています。本人の記録や進路マップは家族側には見えません。</p>
    </div>` : ''}
    <aside class="recommend-boundary"><strong>共有されるもの</strong><span>名前・URL・一言・選んだタグ</span><strong>共有されないもの</strong><span>本人の進路マップ・記録・学年・保存内容</span></aside>
  </section>`;
}

/* ---------- 探す（動詞から） ---------- */

function activityMarkup(activity) {
  return `<li class="activity">
    <p class="activity-label">${escape(activity.label)}${activity.athome ? ' · 家でできる' : ' · 人や場所がいる'}</p>
    <h4>${escape(activity.title)}</h4>
    <p>${escape(activity.description)}</p>
    <p class="activity-time">目安 ${activity.minutes}分</p>
    <button class="primary small" data-place-activity="${escape(activity.id)}">進路マップに追加</button>
  </li>`;
}

function resourceMarkup(item) {
  const placed = state.placements.some(placement => placement.ref === item.id);
  // 古い情報を隠さず、消さず、そう言う。通信しないので、言えるのは日付から分かることだけ。
  const fresh = freshnessOf(item, today());
  const category = CATEGORIES.find(entry => entry.id === item.category);
  return `<li class="resource${fresh.state === 'ok' ? '' : ' resource-aged'}">
    <p class="resource-kind">${category ? `<b class="resource-category">${escape(category.label)}</b> ` : ''}${escape(item.kind)}${item.prefecture ? ` · ${escape(item.prefecture)}` : ''}${item.online ? ' · オンライン' : ''}</p>
    <h4>${escape(item.name)}</h4>
    ${fresh.state === 'ok' ? '' : `<p class="resource-freshness">${escape(fresh.note)}</p>`}
    <p>${escape(item.summary)}</p>
    <details><summary>条件と、なぜここに出るのか</summary>
      <p class="resource-reason">${escape(item.reason)}</p>
      <dl>${item.conditions.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>
      <p class="resource-source">出典 ${escape(item.source)}（確認 ${escape(item.checkedOn)}）${item.date ? ` · 開催 ${escape(item.date)}` : ''}${item.deadline ? ` · 申込期限 ${escape(item.deadline)}` : ''}</p>
      <p class="resource-source">対象 ${item.grades?.length ? item.grades.map(id => escape(gradeById(id)?.label ?? id)).join('・') : '公式案内で確認'} · 費用 ${escape({free: '無料と確認', paid: '有料', unknown: '公式案内で確認'}[item.cost] ?? '公式案内で確認')}</p>
    </details>
    <div class="resource-actions">
      <a class="secondary" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">公式情報を見る ↗<small>別のタブで開きます</small></a>
      <button class="text-button" data-place-resource="${escape(item.id)}"${placed ? ' disabled' : ''}>${placed ? '✓ 追加済み' : '進路マップに追加'}</button>
    </div>
  </li>`;
}

function verbDetail(verbId) {
  const verb = verbById(verbId);
  const groups = activitiesByTopic(verbId, {athome: ui.athome});
  const fields = domainsForVerb(verbId);
  const items = resourcesForVerb(verbId, {athome: ui.athome});
  const coverage = verbCoverage(verbId);
  const sections = [
    ['activities', 'やってみる', groups.reduce((total, group) => total + group.items.length, 0)],
    ['domains', '学問', fields.length],
    ['resources', '掲載情報', items.length]
  ];
  const activitySection = `<section class="verb-pane" aria-label="今日できること">
    <h3>今日できること</h3>
    ${groups.length
      ? `<p class="verb-note">同じ「${escape(verb.label)}」が、好きなことをまたいで並びます。${ui.athome ? `家でできるのは${coverage.athome}件。` : `全部で${coverage.activities}件。`}</p>
         ${groups.map(group => `<div class="activity-group"><h4 class="activity-topic">${escape(group.label)}</h4><ul class="activity-list">${group.items.map(activityMarkup).join('')}</ul></div>`).join('')}`
      : '<p class="empty-note">この条件に合う活動アイデアは、まだ用意できていません。条件を外すと出ます。</p>'}
    <p class="editorial">活動のアイデアです。募集中のイベントや、特定の団体の案内ではありません。関わり方の分類はこのアプリの編集です。</p>
  </section>`;
  const domainSection = `<section class="verb-pane" aria-label="つながる学問">
    <h3>この関わり方につながる学問</h3>
    <p class="verb-note">向き不向きの判定ではありません。「${escape(verb.label)}」を仕事や研究として続けている分野です。</p>
    <ul class="domain-list">${fields.map(field => `<li>
      <h4>${escape(field.name)}</h4>
      <p>${escape(field.summary)}</p>
      <p class="domain-example">${escape(field.example)}</p>
      <a class="secondary" href="#routes/${escape(field.id)}">${escape(field.name)}への進路ルートを見る →</a>
    </li>`).join('')}</ul>
  </section>`;
  const resourceSection = `<section class="verb-pane" aria-label="掲載情報">
    <h3>掲載情報（${items.length}件）</h3>
    ${items.length ? `<ul class="resource-list">${items.map(resourceMarkup).join('')}</ul>`
      : '<p class="empty-note">この条件の掲載情報はありません。掲載がないことと、世の中に存在しないことは別です。</p>'}
  </section>`;
  const panes = {activities: activitySection, domains: domainSection, resources: resourceSection};
  return `<section class="verb-detail">
    <a class="back" href="#find">← ほかの関わり方を見る</a>
    <h2><span aria-hidden="true">${escape(verb.icon)}</span> ${escape(verb.label)}</h2>
    <p class="verb-summary">${escape(verb.summary)}</p>
    <p class="verb-detail-text">${escape(verb.detail)}</p>
    <label class="athome"><input type="checkbox" data-athome ${ui.athome ? 'checked' : ''}> 家でできるものだけ</label>
    <div class="verb-section-tabs" role="group" aria-label="見る内容">
      ${sections.map(([id, label, count]) => `<button class="verb-section-tab${ui.verbSection === id ? ' on' : ''}" data-verb-section="${id}" aria-pressed="${ui.verbSection === id}">${label}<span>${count}</span></button>`).join('')}
    </div>
    ${panes[ui.verbSection] ?? activitySection}
  </section>`;
}

function searchResultMarkup(entry) {
  const labels = {verb: '関わり方', topic: '好きなこと', activity: 'やってみる', domain: '学問分野', resource: '掲載情報'};
  const href = entry.type === 'verb' ? `#find/${entry.id}`
    : entry.type === 'domain' ? (hasRoutes(entry.id) ? `#routes/${entry.id}` : '')
    : entry.type === 'activity' ? `#find/${entry.activity.verb}`
    : entry.type === 'topic' ? '#find' : entry.resource.url;
  const external = entry.type === 'resource';
  const placeAction = entry.type === 'resource'
    ? `<button class="text-button" data-place-resource="${escape(entry.id)}">進路マップに追加</button>`
    : entry.type === 'activity'
      ? `<button class="text-button" data-place-activity="${escape(entry.id)}">進路マップに追加</button>`
      : entry.type === 'topic'
        ? `<button class="text-button" data-quick-topic="${escape(entry.id)}">進路マップに追加</button>` : '';
  return `<li class="result">
    <p class="result-type">${escape(labels[entry.type])}</p>
    <div class="result-head">${href ? `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(entry.name)}${external ? ' ↗' : ''}</a>` : `<span>${escape(entry.name)}</span>`}${placeAction}</div>
    <p>${escape(entry.summary)}</p>
  </li>`;
}

function resultsMarkup() {
  if (!ui.query.trim()) return '';
  const found = searchCatalog(ui.query, ui.filter);
  return `<p class="result-count">${found.length}件 · 掲載範囲のなかの検索です</p>${found.length
    ? `<ul>${found.slice(0, 40).map(searchResultMarkup).join('')}</ul>`
    : '<p class="empty-note">見つかりませんでした。掲載していないものを、それらしく作ることはしません。</p>'}`;
}

/* ---------- 掲載情報をしぼる（Build 24） ---------- */

const resourceList = () => Object.entries(resources).map(([id, item]) => ({id, ...item}));

/**
 * いま効いている絞り込み。都道府県だけは画面の一時状態ではなく、
 * 本人が設定したもの（state.prefecture）をそのまま使う。設定していなければ絞らない。
 */
function activePicks() {
  return {...ui.picks, prefecture: state.prefecture};
}

const PICK_LABELS = {
  category: id => CATEGORIES.find(item => item.id === id)?.label ?? id,
  prefecture: value => value,
  online: () => 'オンライン',
  cost: () => '無料と確認できたもの',
  grade: id => gradeById(id)?.label ?? id,
  when: value => value === 'upcoming' ? 'これからのもの' : '終わったもの'
};

function pickChips(name, options, current) {
  return `<div class="pick-row" role="group" aria-label="${escape(name)}">
    ${options.map(([value, label]) => `<button class="lane-chip${current === value ? ' on' : ''}" data-pick-filter="${escape(name)}" data-pick-value="${escape(String(value))}" aria-pressed="${current === value}">${escape(label)}</button>`).join('')}
  </div>`;
}

/** 掲載範囲と、いま何件に絞れているかを必ず言う。全国を網羅しているように見せない。 */
function listingsMarkup() {
  const all = resourceList();
  const picks = activePicks();
  const now = today();
  const found = filterResources(all, picks, now);
  const chosen = Object.entries(picks).filter(([, value]) => value !== null && value !== false);
  const stats = coverage(all);
  const thin = stats.byDomain.filter(item => item.thin);
  const here = picks.prefecture
    ? stats.byPrefecture.find(item => item.prefecture === picks.prefecture)?.count ?? 0
    : null;

  return `<section class="listings">
    <h2>掲載情報をしぼる</h2>
    <p class="coverage-line">${escape(coverageSentence(all))}</p>

    <button class="ghost" data-picks-open aria-expanded="${ui.picksOpen}">${ui.picksOpen ? 'しぼりこみを閉じる' : 'しぼりこみを開く'}</button>

    ${ui.picksOpen ? `<div class="picks">
      <p class="panel-label">どんな種類？</p>
      ${pickChips('category', [['', 'すべて'], ...CATEGORIES.map(item => [item.id, item.label])], picks.category ?? '')}

      <p class="panel-label">住んでいるところ（任意）</p>
      <div class="pick-row">
        <select data-prefecture aria-label="都道府県">
          <option value=""${state.prefecture ? '' : ' selected'}>選ばない</option>
          ${PREFECTURES.map(name => `<option value="${escape(name)}"${state.prefecture === name ? ' selected' : ''}>${escape(name)}</option>`).join('')}
        </select>
        <button class="lane-chip${picks.online ? ' on' : ''}" data-pick-filter="online" data-pick-value="${picks.online ? 'false' : 'true'}" aria-pressed="${picks.online}">オンラインだけ</button>
      </div>
      <p class="panel-hint">位置情報は取りません。学校名も市区町村も聞きません。選んだ県のものと、場所に縛られないものだけが残ります。${here === null ? '' : `いま選んでいる${escape(picks.prefecture)}の掲載は${here}件です。`}</p>

      <p class="panel-label">費用</p>
      ${pickChips('cost', [['', '指定しない'], ['free', '無料と確認できたものだけ']], picks.cost ?? '')}
      <p class="panel-hint">「無料」と言えるのは、公式の案内でそう確認できたものだけです。分からないものは、ここでは残しません。</p>

      <p class="panel-label">対象の学年</p>
      ${pickChips('grade', [['', '指定しない'], ...GRADES.map(item => [item.id, item.label])], picks.grade ?? '')}
      <p class="panel-hint">対象が書かれていないものも残します。書かれていない＝対象外、ではありません。</p>

      <p class="panel-label">開催の時期</p>
      ${pickChips('when', [['', '指定しない'], ['upcoming', 'これから'], ['past', '終わったもの']], picks.when ?? '')}
    </div>` : ''}

    ${chosen.length ? `<p class="picks-active">いま絞っているもの：${chosen.map(([name, value]) => `<button class="lane-chip on" data-pick-filter="${escape(name)}" data-pick-value="" aria-label="${escape(PICK_LABELS[name](value))}をやめる">${escape(PICK_LABELS[name](value))} ✕</button>`).join('')}</p>` : ''}

    <p class="result-count">${found.length}件 / 全${all.length}件</p>
    ${found.length
      ? `<ul class="resource-list">${found.map(resourceMarkup).join('')}</ul>`
      : '<p class="empty-note">この条件に当てはまる掲載はありません。載せていないものを、それらしく作ることはしません。条件をゆるめるか、「探す」で関わり方から見てください。</p>'}

    <button class="ghost" data-coverage-open aria-expanded="${ui.coverageOpen}">${ui.coverageOpen ? '掲載の偏りを閉じる' : '掲載の偏りを見る'}</button>
    ${ui.coverageOpen ? `<div class="coverage">
      <h3>どこに載っていて、どこに載っていないか</h3>
      <p class="panel-label">種類ごと</p>
      <ul class="coverage-list">${stats.byCategory.map(item => `<li><span>${escape(item.label)}</span><b>${item.count}件</b></li>`).join('')}</ul>
      <p class="panel-label">場所ごと</p>
      <ul class="coverage-list">${stats.byPrefecture.map(item => `<li><span>${escape(item.prefecture ?? 'どこからでも')}</span><b>${item.count}件</b></li>`).join('')}</ul>
      <p class="panel-label">学問ごと</p>
      <ul class="coverage-list">${stats.byDomain.map(item => `<li><span>${escape(item.name)}</span><b>${item.count}件</b>${item.thin ? '<em>掲載が少ない</em>' : ''}</li>`).join('')}</ul>
      ${thin.length ? `<p class="panel-hint">${thin.map(item => escape(item.name)).join('・')}は掲載が少ない領域です。進路の選択肢が少ないという意味ではなく、まだ調べきれていないためです。</p>` : ''}
    </div>` : ''}
  </section>`;
}

function findPage(verbId) {
  return `
    <section class="page-head">
      <h1>探す</h1>
      <p class="lead">学問の名前からではなく、いまやっていることから探せます。見つけたものは進路マップに追加できます。</p>
    </section>

    <form class="search" data-search>
      <label for="search-input">掲載範囲のなかを探す</label>
      <div class="search-row">
        <input id="search-input" name="query" type="search" value="${escape(ui.query)}" placeholder="海、つくる、発酵、ギター" autocomplete="off">
        <select name="filter" aria-label="検索結果の絞り込み">
          ${[['all', 'すべて'], ['home', '家でできる'], ['activity', 'やってみる'], ['study', '学校・大学']]
            .map(([value, label]) => `<option value="${value}"${ui.filter === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </form>
    ${ui.query.trim() ? `<section class="results">${resultsMarkup()}</section>` : ''}

    ${verbId ? '' : listingsMarkup()}

    ${verbId ? verbDetail(verbId) : `<section class="verb-section">
      <h2>いま、どれをやっている？</h2>
      <p>新しく始めることではなく、もうやっていることを選んでください。</p>
      <ul class="verb-list">${verbs.map(verb => {
        const coverage = verbCoverage(verb.id);
        return `<li><a href="#find/${verb.id}">
          <p class="verb-icon" aria-hidden="true">${escape(verb.icon)}</p>
          <h3>${escape(verb.label)}</h3>
          <p>${escape(verb.summary)}</p>
          <p class="verb-count">できること${coverage.activities}件 · 学問${coverage.domains}件 · 掲載情報${coverage.resources}件</p>
        </a></li>`;
      }).join('')}</ul>
      <p class="editorial">掲載しているのは${Object.keys(resources).length}件の実在する情報と、${Object.keys(topics).length}つの好きなことに対する活動アイデアです。学校や活動を網羅した一覧ではありません。</p>
    </section>`}`;
}

function routesPage(domainId) {
  return `<section class="page-head">
      <a class="back" href="#now">← 進路マップに戻る</a>
      <h1>${escape(domains[domainId].name)}への進み方</h1>
      <p class="lead">同じ学問へ進むルートは1つではありません。高校までに決める内容が、ルートごとに違います。</p>
    </section>
    <div class="routes-body">${renderRoutes({domainId, domain: domains[domainId], saved: new Set(state.heldRoutes), checkedOn: ROUTES_CHECKED_ON})}</div>`;
}

function storageSection() {
  return `<section class="storage-section" aria-label="記録の保存">
    <h2>記録の保存</h2>
    <label class="storage-switch"><input type="checkbox" data-persist ${persist ? 'checked' : ''}> このブラウザに記録を残す</label>
    <p>進路マップに追加した項目・いまの考え・やったこと・学年を、このブラウザだけに保存します。サーバーには送りません。同じブラウザを使う人が開ける場合があります。</p>
    <p class="storage-state">${persist ? 'いまは保存しています。オフにすると、この端末の記録を消します。' : 'いまは保存していません。再読み込みすると消えます。'}</p>
    ${storageNote ? `<p class="storage-warning">${escape(storageNote)}</p>` : ''}
    ${ui.legacy ? '<p class="storage-warning">Build 18 までの形式の記録が、このブラウザに残っています。いまのアプリでは読めませんが、消してもいません。</p>' : ''}
  </section>`;
}

/* ---------- 描画 ---------- */


function measureField() {
  const wrap = $('field-wrap') || $('main-content');
  const width = wrap ? Math.max(280, Math.floor(wrap.clientWidth)) : 360;
  if (Math.abs(width - ui.fieldWidth) < 2) return false;
  ui.fieldWidth = width;
  return true;
}

function render() {
  const current = route();
  const main = $('main-content');
  main.innerHTML = current.page === 'find' ? findPage(current.verb)
    : current.page === 'routes' ? routesPage(current.domain)
    : current.page === 'recommend' ? recommendPage()
    : nowPage();
  main.dataset.page = current.page;
  const tab = current.page === 'now' ? 'now' : ['find', 'routes'].includes(current.page) ? 'find' : null;
  for (const element of document.querySelectorAll('.tab')) {
    element.classList.toggle('active', element.dataset.tab === tab);
    element.setAttribute('aria-current', element.dataset.tab === tab ? 'page' : 'false');
  }
  const chip = $('storage-toggle');
  chip.textContent = `次回も残す：${persist ? 'オン' : 'オフ'}`;
  chip.setAttribute('aria-pressed', String(persist));
  chip.classList.toggle('attention', !persist && state.placements.length > 0);
  // 幅は実際の表示幅をそのまま使う。合わなければ測り直して一度だけ描き直す。
  if (current.page === 'now' && !ui.listView && measureField()) return render();
  const wrap = $('field-wrap');
  if (wrap) {
    // 本人が動かすまでは「いま」が見える下端に留める。動かしたら、その位置を保つ。
    settingScroll = true;
    wrap.scrollTop = ui.fieldScroll === null ? wrap.scrollHeight : ui.fieldScroll;
    requestAnimationFrame(() => {settingScroll = false;});
    wrap.addEventListener('scroll', () => {if (!settingScroll) ui.fieldScroll = wrap.scrollTop;}, {passive: true});
    fieldObserver.disconnect();
    fieldObserver.observe(wrap);
  }
  if (ui.picker) {
    const dialog = $('picker');
    dialog?.showModal();
    dialog?.addEventListener('close', () => {
      if (!ui.picker) return;
      ui.picker = null;
      render();
      document.querySelector('[data-open-picker]')?.focus();
    }, {once: true});
  }
  if (ui.draft) {
    // 確認画面を Escape で閉じたら、下書きは捨てる。黙って置かない。
    const dialog = $('draft');
    dialog?.showModal();
    dialog?.addEventListener('close', () => {
      if (!ui.draft) return;
      ui.draft = null;
      render();
      document.querySelector('[data-open-picker]')?.focus();
    }, {once: true});
  }
  if (ui.editing) {
    const input = $('stance-input');
    if (input) {input.focus(); input.setSelectionRange(input.value.length, input.value.length);}
  }
}

/* ---------- 野原に置く ---------- */

function place({kind, ref, label, verb = null, lane = 'now', topic = null, url = null, title = null, photo = null, domains: customDomains = null, source = null, note = ''}) {
  if (state.placements.length >= PLACEMENT_LIMIT) { notify(`進路マップに追加できるのは${PLACEMENT_LIMIT}件までです。`); return false; }
  if (ref && state.placements.some(placement => placement.ref === ref && placement.lane === lane)) { notify('同じ時期に追加済みです。'); return false; }
  if (url && state.placements.some(placement => placement.url === url)) { notify('このページは追加済みです。'); return false; }
  const placement = {
    id: newPlacementId(), lane, x: freeX(state.placements, lane),
    label: String(label).slice(0, LABEL_LIMIT), kind, ref: ref ?? null, verb, note,
    topic, url, title, photo, domains: customDomains, source: source ?? (['custom', 'link', 'photo'].includes(kind) ? 'self' : 'catalog')
  };
  const before = convergences(state.placements).length;
  state.placements = [...state.placements, placement];
  ui.selected = placement.id;
  ui.highlighted = placement.id;
  ui.routeDomain = null;
  ui.picker = null;
  ui.draft = null;
  save();
  const after = convergences(state.placements);
  render();
  if (after.length > before) {
    const fresh = after[after.length - 1];
    notify(`共通する学問：${fresh.labels.join('と')} → ${fresh.name}`);
  } else {
    notify(`「${placement.label}」を追加しました。${persist ? '' : ' 次回も残すなら、右上で保存をオンに。'}`);
  }
  return true;
}

/** 最初に選んだ複数の興味を、1回の保存と描画でまとめて追加する。 */
function placeInterestPlan(plan) {
  const existingTopics = new Set(state.placements.filter(item => item.kind === 'topic').map(item => item.ref));
  const existingCustom = new Set(state.placements
    .filter(item => item.kind === 'custom')
    .map(item => item.label.trim().toLocaleLowerCase('ja')));
  const additions = plan.filter(item => item.kind === 'topic'
    ? !existingTopics.has(item.ref)
    : !existingCustom.has(item.label.trim().toLocaleLowerCase('ja')));
  if (!plan.length) { notify('追加する興味を選んでください。'); return false; }
  if (!additions.length) { notify('選んだ興味はすべて追加済みです。'); return false; }
  if (state.placements.length + additions.length > PLACEMENT_LIMIT) {
    notify(`進路マップに追加できるのは${PLACEMENT_LIMIT}件までです。`);
    return false;
  }

  const before = convergences(state.placements).length;
  let placements = [...state.placements];
  const created = additions.map(item => {
    const placement = {
      id: newPlacementId(), lane: 'now', x: freeX(placements, 'now'),
      label: item.label, kind: item.kind, ref: item.ref, verb: item.verb, note: '',
      topic: item.topic, url: null, title: null, photo: null, domains: item.domains ?? null, source: item.source
    };
    placements.push(placement);
    return placement;
  });
  state.placements = placements;
  ui.selected = created.at(-1).id;
  ui.highlighted = ui.selected;
  ui.routeDomain = null;
  save();
  const after = convergences(state.placements);
  render();
  if (after.length > before) {
    notify(`${created.length}件の興味を追加しました。共通する学問もマップに表示しています。`);
  } else {
    notify(`${created.length}件の興味からマップを作りました。${persist ? '' : ' 次回も残すなら、右上で保存をオンに。'}`);
  }
  return true;
}

/* ---------- 操作 ---------- */

document.addEventListener('click', event => {
  // 動かした直後の click は、選択の切り替えとして扱わない。
  if (justDragged) {justDragged = false; return;}

  // 段を広げる・まとめるは、段そのものの選択より先に拾う。
  const expand = event.target.closest('[data-expand-lane]');
  if (expand) return expandLane(expand.dataset.expandLane, expand.dataset.expandFrom ?? 'field');

  const svgNode = event.target.closest('[data-node]');
  if (svgNode) {
    const clickedId = svgNode.dataset.node;
    ui.highlighted = highlightAfterClick(ui.highlighted, clickedId);
    ui.expandedSchoolId = schoolExpansionAfterClick(lastView?.byId.get(clickedId), ui.expandedSchoolId);
    const routeNode = clickedId.startsWith('route-') || clickedId.startsWith('school-option-');
    const next = selectFieldNode({currentSelected: ui.selected, clickedId, routeDomain: ui.routeDomain});
    ui.selected = next.selected;
    ui.routeDomain = next.routeDomain;
    if (!routeNode) ui.routeKind = null;
    if (ui.moving !== ui.selected) ui.moving = null;
    return render();
  }
  const laneHit = event.target.closest('.lane');
  if (laneHit) {
    const found = [...laneHit.classList].find(name => name.startsWith('lane-') && LANE_IDS.includes(name.slice(5)));
    if (found) {ui.selected = `lane-${found.slice(5)}`; ui.routeKind = null; return render();}
  }

  const target = event.target.closest('button');
  if (!target) return;

  if (target.id === 'storage-toggle') {setPersist(!persist); return render();}
  if (target.hasAttribute('data-share-map')) {
    try {
      const encoded = encodeMapShare(state.placements, catalog);
      ui.mapShareLink = `${location.origin}${location.pathname}#shared?d=${encoded}`;
      render();
      $('map-share-result')?.focus();
    } catch (error) {
      notify(error.message);
    }
    return;
  }
  if (target.hasAttribute('data-copy-map-share')) {
    if (!ui.mapShareLink) return;
    navigator.clipboard.writeText(ui.mapShareLink)
      .then(() => notify('マップの共有リンクをコピーしました。'))
      .catch(error => notify(`コピーできませんでした（${error.name}）。リンクを選んでコピーしてください。`));
    return;
  }
  if (target.hasAttribute('data-return-own-map')) return location.reload();
  if (target.hasAttribute('data-copy-share')) {
    if (!ui.shareLink) return;
    navigator.clipboard.writeText(ui.shareLink)
      .then(() => notify('リンクをコピーしました。'))
      .catch(error => notify(`コピーできませんでした（${error.name}）。リンクを選んでコピーしてください。`));
    return;
  }
  if (target.dataset.recommendPlace) {
    const item = state.recommendations.find(entry => entry.id === target.dataset.recommendPlace);
    if (!item) return notify('このおすすめは受信箱にありません。');
    const placed = place({kind: 'link', ref: null, label: item.title, title: item.title, url: item.url,
                          topic: item.topic, verb: item.verb, lane: 'now', source: 'family', note: item.note});
    if (placed) {
      state.recommendations = state.recommendations.filter(entry => entry.id !== item.id);
      save();
      render();
    }
    return;
  }
  if (target.dataset.recommendLater) {
    state.recommendations = state.recommendations.map(item => item.id === target.dataset.recommendLater ? {...item, status: 'later'} : item);
    save();
    notify('「あとで見る」に移しました。');
    return render();
  }
  if (target.dataset.recommendDismiss) {
    state.recommendations = state.recommendations.filter(item => item.id !== target.dataset.recommendDismiss);
    save();
    notify('受信箱から消しました。');
    return render();
  }
  if (target.hasAttribute('data-deselect')) {ui.selected = null; ui.expandedSchoolId = null; return render();}
  if (target.hasAttribute('data-clear-highlight')) {ui.highlighted = null; return render();}
  if (target.hasAttribute('data-close-route')) {
    ui.routeDomain = null;
    ui.routeKind = null;
    ui.expandedSchoolId = null;
    if (ui.selected?.startsWith('route-') || ui.selected?.startsWith('school-option-')) ui.selected = null;
    return render();
  }
  if (target.dataset.nodeOpen) {
    if (!target.dataset.nodeOpen.startsWith('lane-')) {
      ui.highlighted = highlightAfterClick(ui.highlighted, target.dataset.nodeOpen);
    }
    const next = selectFieldNode({currentSelected: ui.selected, clickedId: target.dataset.nodeOpen, routeDomain: ui.routeDomain});
    ui.selected = next.selected;
    ui.routeDomain = next.routeDomain;
    ui.routeKind = null;
    ui.listView = false;
    return render();
  }
  if (target.hasAttribute('data-list-view')) {ui.listView = !ui.listView; return render();}
  if (target.dataset.fieldView) {ui.fieldView = target.dataset.fieldView; return render();}
  if (target.hasAttribute('data-picks-open')) {ui.picksOpen = !ui.picksOpen; return render();}
  if (target.hasAttribute('data-coverage-open')) {ui.coverageOpen = !ui.coverageOpen; return render();}
  if (target.dataset.pickFilter) {
    const name = target.dataset.pickFilter;
    const raw = target.dataset.pickValue;
    // 都道府県は本人の設定そのものなので、外すときは設定を消す。
    if (name === 'prefecture') {state.prefecture = raw || null; save(); return render();}
    // 空文字は「指定しない」。絞り込みを外すのと、外れていることは同じ状態にする。
    const value = raw === '' ? (name === 'online' ? false : null) : name === 'online' ? raw === 'true' : raw;
    ui.picks = {...ui.picks, [name]: value};
    return render();
  }
  if (target.dataset.listSort) {ui.listSort = target.dataset.listSort; return render();}
  if (target.hasAttribute('data-about')) {ui.about = !ui.about; return render();}
  if (target.hasAttribute('data-grade-open')) {ui.gradePicker = !ui.gradePicker; return render();}
  if (target.dataset.grade !== undefined) {state.grade = target.dataset.grade || null; ui.gradePicker = false; save(); return render();}

  if (target.dataset.quickTopic) {
    place({kind: 'topic', ref: target.dataset.quickTopic, label: topics[target.dataset.quickTopic].label});
    if (route().page !== 'now') location.hash = '#now';
    return;
  }
  if (target.dataset.openPicker) {ui.picker = {tab: target.dataset.openPicker, lane: 'now'}; return render();}
  if (target.hasAttribute('data-close-picker')) {ui.picker = null; return render();}
  if (target.dataset.pickerTab) {ui.picker = {...ui.picker, tab: target.dataset.pickerTab}; return render();}
  if (target.dataset.pickerLane) {ui.picker = {...ui.picker, lane: target.dataset.pickerLane}; return render();}
  if (target.dataset.pick) {
    const [kind, ref] = target.dataset.pick.split(':');
    const label = kind === 'topic' ? topics[ref].label : kind === 'activity' ? activityById(ref).title : resources[ref].name;
    return place({kind, ref, label, lane: ui.picker.lane});
  }
  if (target.dataset.placeActivity) {
    const activity = activityById(target.dataset.placeActivity);
    place({kind: 'activity', ref: activity.id, label: activity.title});
    location.hash = '#now';
    return;
  }
  if (target.dataset.placeResource) {
    const resourceId = target.dataset.placeResource;
    place(placementForResource(resourceId, resources[resourceId]));
    location.hash = '#now';
    return;
  }

  if (target.dataset.draftTopic) {ui.draft = {...ui.draft, topic: ui.draft.topic === target.dataset.draftTopic ? null : target.dataset.draftTopic}; return render();}
  if (target.dataset.draftVerb) {ui.draft = {...ui.draft, verb: ui.draft.verb === target.dataset.draftVerb ? null : target.dataset.draftVerb}; return render();}
  if (target.dataset.draftDomain) {
    const domainId = target.dataset.draftDomain;
    const connected = ui.draft.domains.includes(domainId);
    ui.draft = {...ui.draft, domains: connected ? ui.draft.domains.filter(id => id !== domainId) : [...ui.draft.domains, domainId]};
    return render();
  }
  if (target.dataset.draftLane) {ui.draft = {...ui.draft, lane: target.dataset.draftLane}; return render();}
  if (target.hasAttribute('data-draft-cancel')) {ui.draft = null; notify('追加をやめました。何も残していません。'); return render();}

  if (target.dataset.setTopic) {
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? {...placement, topic: placement.topic === target.dataset.setTopic ? null : target.dataset.setTopic} : placement);
    save();
    return render();
  }
  if (target.dataset.setVerb) {
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? {...placement, verb: placement.verb === target.dataset.setVerb ? null : target.dataset.setVerb} : placement);
    save();
    return render();
  }
  if (target.hasAttribute('data-reset-connections')) {
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? resetDomainConnections(placement) : placement);
    save();
    notify('提示された接続に戻しました。');
    return render();
  }
  if (target.dataset.moveLane) {
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? {...placement, lane: target.dataset.moveLane} : placement);
    save();
    return render();
  }
  if (target.dataset.removePlacement) {
    const id = target.dataset.removePlacement;
    state.placements = state.placements.filter(placement => placement.id !== id);
    state.log = state.log.map(entry => entry.placement === id ? {...entry, placement: null} : entry);
    ui.selected = null;
    if (ui.highlighted === id) ui.highlighted = null;
    ui.routeDomain = null;
    save();
    notify('進路マップから削除しました。やったことの記録は残しています。');
    return render();
  }
  if (target.dataset.routeKind) {ui.routeKind = ui.routeKind === target.dataset.routeKind ? null : target.dataset.routeKind; return render();}
  if (target.hasAttribute('data-route-all')) {ui.routeKind = null; return render();}
  if (target.dataset.verbSection) {ui.verbSection = target.dataset.verbSection; return render();}

  if (target.dataset.stanceEdit) {ui.editing = target.dataset.stanceEdit; return render();}
  if (target.hasAttribute('data-stance-cancel')) {ui.editing = null; return render();}
  if (target.dataset.stanceClear) {
    delete state.stances[laneById(target.dataset.stanceClear).decision];
    ui.editing = null;
    save();
    return render();
  }
  if (target.dataset.logRemove) {state.log = removeEntry(state.log, target.dataset.logRemove); save(); return render();}
  if (target.dataset.routeHold) {
    const id = target.dataset.routeHold;
    state.heldRoutes = state.heldRoutes.includes(id) ? state.heldRoutes.filter(item => item !== id) : [...state.heldRoutes, id];
    save();
    return render();
  }
  if (target.dataset.routeMath) {
    const panel = $(`route-math-${target.dataset.routeMath}`);
    if (panel) panel.hidden = !panel.hidden;
  }
});

document.addEventListener('keydown', event => {
  // 指で動かせることは、キーボードでも同じようにできなければならない。
  const movable = event.target.closest('[data-movable]');
  if (movable && NUDGE[event.key]) {
    const placement = state.placements.find(item => item.id === movable.dataset.node);
    if (placement) {
      event.preventDefault();
      return nudge(placement, event.key, event.shiftKey);
    }
  }
  if (!['Enter', ' '].includes(event.key)) return;
  const target = event.target.closest('[data-node], [data-expand-lane], .lane');
  if (!target) return;
  event.preventDefault();
  target.dispatchEvent(new MouseEvent('click', {bubbles: true}));
});

const NUDGE = {ArrowLeft: 'x', ArrowRight: 'x', ArrowUp: 'lane', ArrowDown: 'lane'};

/** キーボードで置きものを動かす。横は本人の位置をずらすだけ、縦は段を1つ移す。 */
function nudge(placement, key, fine) {
  const step = fine ? 0.01 : 0.05;
  let moved = placement;
  if (NUDGE[key] === 'x') {
    const x = Math.min(Math.max(placement.x + (key === 'ArrowLeft' ? -step : step), 0), 1);
    moved = {...placement, x};
  } else {
    // LANES は上が未来。↑で未来へ、↓で今へ。
    const index = LANE_IDS.indexOf(placement.lane) + (key === 'ArrowUp' ? -1 : 1);
    if (index < 0 || index >= LANE_IDS.length) return;
    moved = {...placement, lane: LANE_IDS[index]};
  }
  state.placements = state.placements.map(item => item.id === placement.id ? moved : item);
  ui.moving = placement.id;
  save();
  render();
  document.querySelector(`[data-node="${CSS.escape(placement.id)}"]`)?.focus();
  if (moved.lane !== placement.lane) notify(`「${placement.label}」を「${laneById(moved.lane).title}」の時期へ移動しました。`);
}

/** 段を広げる／まとめる。見え方だけを変えるので、保存はしない。 */
function expandLane(id, from = 'field') {
  ui.expandedLanes = ui.expandedLanes.includes(id)
    ? ui.expandedLanes.filter(item => item !== id)
    : [...ui.expandedLanes, id];
  render();
  // 押した場所に近いほうへ戻す。野原の外から閉じたときに、段の見出しへ飛ばさない。
  const selector = from === 'list'
    ? `.field-expanded [data-expand-lane="${CSS.escape(id)}"]`
    : `.lane-toggle[data-expand-lane="${CSS.escape(id)}"]`;
  (document.querySelector(selector) ?? document.querySelector(`[data-expand-lane="${CSS.escape(id)}"]`))?.focus();
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.hasAttribute('data-search')) return event.preventDefault();
  if (form.dataset.renamePlacement) {
    event.preventDefault();
    const label = form.elements.label.value.trim().slice(0, LABEL_LIMIT);
    if (!label) return notify('項目名を入力してください。');
    state.placements = state.placements.map(placement =>
      placement.id === form.dataset.renamePlacement ? {...placement, label} : placement);
    save();
    render();
    notify('項目名を変更しました。');
    return;
  }
  if (form.hasAttribute('data-interest-builder')) {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const plan = buildInterestPlan({
        topicIds: data.getAll('topics'),
        customLabel: data.get('customLabel'),
        domainIds: data.getAll('domainIds'),
        verbId: data.get('verbId') || null
      });
      placeInterestPlan(plan);
    } catch (error) {
      notify(error.message);
    }
    return;
  }
  if (form.hasAttribute('data-recommend-form')) {
    event.preventDefault();
    try {
      const encoded = encodeRecommendation({
        title: form.elements.title.value.trim(), url: form.elements.url.value.trim(),
        note: form.elements.note.value.trim(), topic: form.elements.topic.value || null,
        verb: form.elements.verb.value || null
      }, catalog);
      ui.shareLink = `${location.origin}${location.pathname}#inbox?d=${encoded}`;
      render();
      $('share-result')?.focus();
    } catch (error) {
      notify(error.message);
    }
    return;
  }
  if (form.dataset.stanceForm) {
    event.preventDefault();
    const decision = laneById(form.dataset.stanceForm).decision;
    const value = form.elements.stance.value.trim();
    if (value) state.stances[decision] = value.slice(0, STANCE_LIMIT);
    else delete state.stances[decision];
    ui.editing = null;
    save();
    return render();
  }
  if (form.hasAttribute('data-pick-link')) {
    event.preventDefault();
    try {
      startLinkDraft(form.elements.url.value.trim());
    } catch (error) {
      return notify(error.message);
    }
    return render();
  }
  if (form.hasAttribute('data-draft-form')) {
    event.preventDefault();
    const draft = ui.draft;
    const title = form.elements.title.value.trim();
    if (!title) return notify('進路マップに表示する名前を書いてください。');
    if (draft.kind === 'link' && !draft.domains.length) return notify('外部情報とつなぐジャンルを1つ以上選んでください。');
    return place({
      kind: draft.kind, ref: null, label: title, verb: draft.verb, lane: draft.lane,
      topic: draft.topic, url: draft.url, title, photo: draft.photo, domains: draft.domains
    });
  }
  if (form.hasAttribute('data-pick-write')) {
    event.preventDefault();
    const label = form.elements.label.value.trim();
    if (!label) return notify('追加する内容を書いてください。');
    return place({kind: 'custom', ref: null, label, verb: form.elements.verb.value || null, lane: ui.picker.lane});
  }
  if (form.dataset.logForm) {
    event.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return notify('1行だけ書いてください。');
    const placement = state.placements.find(item => item.id === form.dataset.logForm);
    try {
      state.log = addEntry(state.log, {text, verb: placement?.verb ?? null, placement: form.dataset.logForm});
    } catch (error) {
      return notify(error.message);
    }
    save();
    render();
    notify('記録に残しました。');
  }
});

document.addEventListener('change', event => {
  if (event.target.hasAttribute('data-domain-connection')) {
    const id = event.target.dataset.domainConnection;
    ui.connectionEditorOpenFor = ui.selected;
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? setDomainConnection(placement, id, event.target.checked) : placement);
    save();
    render();
    notify(event.target.checked ? '接続を追加しました。' : '接続を外しました。');
    return;
  }
  if (event.target.hasAttribute('data-prefecture')) {
    // 位置情報からは決して決めない。ここで本人が選んだときだけ入る。
    state.prefecture = event.target.value || null;
    ui.picks = {...ui.picks, prefecture: null};
    save();
    return render();
  }
  if (event.target.hasAttribute('data-photo-input')) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (state.placements.filter(placement => placement.photo).length >= PHOTO_LIMIT) {
      return notify(`写真を置けるのは${PHOTO_LIMIT}枚までです。`);
    }
    shrinkPhoto(file).then(photo => {
      ui.draft = {kind: 'photo', url: null, title: '', photo, topic: null, verb: null, lane: ui.picker?.lane ?? 'now'};
      ui.picker = null;
      render();
    }).catch(error => notify(error.message));
    return;
  }
  if (event.target.hasAttribute('data-persist')) {setPersist(event.target.checked); return render();}
  if (event.target.hasAttribute('data-athome')) {ui.athome = event.target.checked; return render();}
  if (event.target.name === 'filter') {ui.filter = event.target.value; return render();}
});

// 検索は結果だけを描き直す。日本語入力の途中で input が差し替わらないようにする。
document.addEventListener('input', event => {
  if (event.target.id !== 'search-input') return;
  ui.query = event.target.value;
  const results = document.querySelector('.results');
  const markup = resultsMarkup();
  if (results) results.innerHTML = markup;
  else if (markup) event.target.closest('form').insertAdjacentHTML('afterend', `<section class="results">${markup}</section>`);
});

/* ---------- 置いたものを動かす ---------- */

let drag = null;
let justDragged = false;

document.addEventListener('pointerdown', event => {
  const handle = event.target.closest('[data-movable]');
  if (!handle || !lastView) return;
  const svg = handle.closest('svg');
  drag = {id: handle.dataset.node, handle, svg, box: svg.getBoundingClientRect(),
          moved: false, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
          x: null, lane: null};
});

/**
 * 動かしている最中は、画面全体を描き直さない。
 * 20件置いてあると描き直しが指に追いつかないので、動かしているノードと、
 * そこにつながる線だけを書き換える。段の高さはこの間は動かさない。
 */
function paintDrag() {
  const placement = state.placements.find(item => item.id === drag.id);
  const box = placement && previewBox({label: placement.label, x: drag.x, lane: drag.lane}, lastView);
  if (!box) return;
  drag.handle.setAttribute('transform', `translate(${box.left.toFixed(1)} ${box.y.toFixed(1)})`);
  const id = CSS.escape(drag.id);
  for (const path of drag.svg.querySelectorAll(`path[data-from="${id}"], path[data-to="${id}"]`)) {
    const from = path.dataset.from === drag.id ? box : lastView.byId.get(path.dataset.from);
    const to = path.dataset.to === drag.id ? box : lastView.byId.get(path.dataset.to);
    if (from && to) path.setAttribute('d', curve(from, to));
  }
}

document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  // 少し動いてからドラッグ扱いにする。タップで選ぶ操作を邪魔しない。
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
  if (!drag.moved) {drag.moved = true; drag.handle.classList.add('is-dragging');}
  event.preventDefault();
  drag.x = Math.min(Math.max((event.clientX - drag.box.left) / drag.box.width, 0), 1);
  drag.lane = laneAt((event.clientY - drag.box.top) * (lastView.height / drag.box.height), lastView.lanes);
  paintDrag();
});

function endDrag(event, commit) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const finished = drag;
  drag = null;
  if (!finished.moved) return;
  // 動かしたときは選択を変えない。クリック扱いにもしない。
  event.preventDefault();
  justDragged = true;
  setTimeout(() => {justDragged = false;}, 300);
  if (commit) {
    state.placements = state.placements.map(placement =>
      placement.id === finished.id ? {...placement, x: finished.x, lane: finished.lane} : placement);
    ui.moving = finished.id;
    save();
  }
  // 指を離したここで初めて確定して描き直す。段の高さもここでそろう。
  render();
}

document.addEventListener('pointerup', event => endDrag(event, true), true);
document.addEventListener('pointercancel', event => endDrag(event, false), true);

// 幅の変化は resize より要素の観測のほうが確実に拾える。
const fieldObserver = new ResizeObserver(() => {
  if (route().page !== 'now' || ui.listView || drag) return;
  if (measureField()) render();
});

window.addEventListener('hashchange', () => {
  ui.editing = null;
  ui.picker = null;
  // ブックマークレットから届いた取り込み要求は、ここで下書きに変える。
  consumeAddHash();
  consumeRecommendationHash();
  consumeSharedMapHash();
  render();
  $('main-content').focus();
  window.scrollTo(0, 0);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
restore();
consumeAddHash();
consumeRecommendationHash();
consumeSharedMapHash();
render();
