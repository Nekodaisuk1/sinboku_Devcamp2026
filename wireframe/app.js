import {buildTimeline, nextDecision, GRADES, STANCE_LIMIT, gradeById} from './timeline.mjs';
import {LOG_TEXT_LIMIT, addEntry, removeEntry, recentCount} from './log.mjs';
import {verbs, verbById, domains, topics, activitiesByTopic, activityById, domainsForVerb, resourcesForVerb, verbCoverage, resources, allActivities} from './verbs.mjs';
import {searchCatalog, catalogIds} from './catalog.mjs';
import {routesForDomain, hasRoutes, routeDomains, ROUTES_CHECKED_ON} from './routes.mjs';
import {renderRoutes} from './routes-ui.mjs';
import {STORAGE_KEY, emptyState, encodeState, decodeState, hasLegacyRecord} from './store.mjs';
import {LANES, LANE_IDS, laneById, layout, laneAt, revealWorld, convergences, reachOf, routePath, newPlacementId, freeX, PLACEMENT_LIMIT, LABEL_LIMIT} from './field.mjs';
import {renderField, renderFieldList} from './field-ui.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const $ = id => document.getElementById(id);

const catalog = {...catalogIds(), routes: new Set(routeDomains().flatMap(id => routesForDomain(id, domains[id]).map(route => route.id)))};

let state = emptyState();
// 画面の一時的な状態。保存の対象にしない。
const ui = {query: '', filter: 'all', athome: false, editing: null, gradePicker: false, legacy: false,
            selected: null, routeKind: null, listView: false, about: false, picker: null, dragging: null, fieldWidth: 360, fieldScroll: null};
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
    persist = false;
    storageNote = `記録を保存できませんでした（${error.name}）。このブラウザの設定で保存が止められている可能性があります。`;
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
  return {page: 'now'};
}

/* ---------- 野原 ---------- */

function fieldView() {
  const selected = ui.selected ?? '';
  const anchor = selected.startsWith('domain-')
    ? revealWorld(state.placements).domains.find(domain => `domain-${domain.id}` === selected)?.x ?? 0.5
    : 0.5;
  const extra = selected.startsWith('domain-') && ui.routeKind ? routePath(selected.slice(7), ui.routeKind, anchor) : {nodes: [], links: []};
  const extraNodes = extra.nodes.map(node => ({...node, links: extra.links.filter(link => link.from === node.id)}));
  return layout({placements: state.placements, extraNodes, width: ui.fieldWidth});
}

/**
 * 選んだものに直接つながる線だけを明るくする。ほかは消さずに薄くする。
 * 経路だけは1本の道なので、最後までたどる。何もかも明るくすると、選んだ意味がなくなる。
 */
function highlightFor(view) {
  if (!ui.selected || !view.byId.has(ui.selected)) return new Set();
  const lit = new Set([ui.selected]);
  for (const link of view.links) {
    if (link.from === ui.selected) lit.add(link.to);
    if (link.to === ui.selected) lit.add(link.from);
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

function tutorialMarkup() {
  const count = state.placements.length;
  if (count === 0) {
    return `<section class="tutor tutor-start">
      <p class="tutor-step">はじめかた</p>
      <h2>まず、ひとつ置いてみよう。</h2>
      <p>いま好きなこと・やっていることを、いちばん下の「いま」に置きます。置くと、そこから線が伸びて学問が現れます。</p>
      <div class="tutor-choices">
        ${Object.entries(topics).map(([id, topic]) => `<button class="tutor-choice" data-quick-topic="${escape(id)}">${escape(topic.label)}</button>`).join('')}
        <button class="tutor-choice write" data-open-picker="custom">自分で書く</button>
      </div>
    </section>`;
  }
  if (count === 1) {
    const rest = Object.entries(topics).filter(([id]) => !state.placements.some(placement => placement.ref === id));
    return `<section class="tutor">
      <p class="tutor-step">つぎ</p>
      <h2>もうひとつ置くと、合流が見えます。</h2>
      <p>別の好きなことを置いてください。2本の線が同じ学問に届いたら、そこが光ります。関係がなさそうな2つほど、面白いことになります。</p>
      <div class="tutor-choices">
        ${rest.map(([id, topic]) => `<button class="tutor-choice" data-quick-topic="${escape(id)}">${escape(topic.label)}</button>`).join('')}
        <button class="tutor-choice write" data-open-picker="custom">自分で書く</button>
      </div>
    </section>`;
  }
  return '';
}

function convergenceMarkup() {
  const found = convergences(state.placements);
  if (!found.length) {
    // 合流しないことを失敗にしない。無理に線をつながず、次にできることだけを出す。
    if (state.placements.length < 2) return '';
    const loose = state.placements.filter(placement => !reachOf(placement).length).length;
    return `<section class="converge converge-none">
      <h2>まだ合流していません</h2>
      <p>${loose ? `${loose}件は、まだどこにもつながっていません。タップして関わり方を選ぶと線が伸びます。` : 'いま置いてあるものは、別々の領域に向かっています。それも一つの答えです。'}</p>
      <p class="converge-note">無理に共通点を作ることはしません。別の好きなことを足すか、「探す」で動詞から活動を足してみてください。</p>
    </section>`;
  }
  return `<section class="converge">
    <h2>ここで合流しています</h2>
    <ul>${found.map(item => `<li>
      <p class="converge-from">${item.labels.map(label => `<span>${escape(label)}</span>`).join('<em>と</em>')}</p>
      <p class="converge-to">どちらも <button class="link-button" data-node-open="domain-${escape(item.domain)}">${escape(item.name)}</button> につながっています</p>
    </li>`).join('')}</ul>
    <p class="converge-note">同じ領域に届いているという意味です。向き不向きの判定ではありません。</p>
  </section>`;
}

function placementPanel(placement) {
  const reach = reachOf(placement).map(id => domains[id]?.name).filter(Boolean);
  const lane = laneById(placement.lane);
  const records = state.log.filter(entry => entry.placement === placement.id);
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">自分で置いたもの · ${escape(lane.title)}</p>
    <h2>${escape(placement.label)}</h2>
    ${reach.length
      ? `<p class="panel-reach">ここから <b>${reach.map(escape).join('・')}</b> に線が伸びています。</p>`
      : '<p class="panel-reach muted">まだどこにもつながっていません。下で関わり方を選ぶと線が伸びます。</p>'}

    ${placement.kind === 'custom' || !reach.length ? `<div class="panel-block">
      <p class="panel-label">どんなふうに関わっている？</p>
      <div class="verb-row">${verbs.map(verb => `<button class="verb-chip small${placement.verb === verb.id ? ' on' : ''}" data-set-verb="${escape(verb.id)}" aria-pressed="${placement.verb === verb.id}">${escape(verb.icon)} ${escape(verb.label)}</button>`).join('')}</div>
    </div>` : ''}

    <div class="panel-block">
      <p class="panel-label">いつのこと？</p>
      <div class="lane-row">${LANES.map(item => `<button class="lane-chip${placement.lane === item.id ? ' on' : ''}" data-move-lane="${escape(item.id)}" aria-pressed="${placement.lane === item.id}">${escape(item.id === 'now' ? 'いま' : item.horizon)}</button>`).join('')}</div>
      <p class="panel-hint">未来の段に置けば「その頃にやりたいこと」として持っておけます。指で動かしても変えられます。</p>
    </div>

    <form class="panel-log" data-log-form="${escape(placement.id)}">
      <label for="log-text">これでやったことを残す（任意）</label>
      <div class="panel-log-row">
        <input id="log-text" name="text" type="text" maxlength="${LOG_TEXT_LIMIT}" placeholder="録音を昨日のと聴き比べた" autocomplete="off">
        <button class="primary small" type="submit">残す</button>
      </div>
    </form>
    ${records.length ? `<ul class="panel-records">${records.slice(0, 6).map(entry => `<li><span>${escape(entry.date.slice(5).replace('-', '/'))}</span>${escape(entry.text)}<button class="text-button warn" data-log-remove="${escape(entry.id)}">消す</button></li>`).join('')}</ul>` : ''}

    <button class="text-button warn panel-remove" data-remove-placement="${escape(placement.id)}">この置きものを外す</button>
  </section>`;
}

function domainPanel(domainId) {
  const domain = domains[domainId];
  const world = revealWorld(state.placements).domains.find(item => item.id === domainId);
  const from = (world?.from ?? []).map(id => state.placements.find(placement => placement.id === id)?.label).filter(Boolean);
  const routes = hasRoutes(domainId) ? routesForDomain(domainId, domain) : [];
  return `<section class="panel panel-domain">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">置いたものから現れた学問</p>
    <h2>${escape(domain.name)}</h2>
    <p>${escape(domain.summary)}</p>
    <p class="panel-example">${escape(domain.example)}</p>
    ${from.length ? `<p class="panel-reach">${from.map(label => `「${escape(label)}」`).join('と')}から線が届いています。</p>` : ''}

    ${routes.length ? `<div class="panel-block">
      <p class="panel-label">ここへの道は${routes.length}本。1本ずつ、野原に引けます。</p>
      <div class="route-chips">${routes.map(item => `<button class="route-chip${ui.routeKind === item.kind ? ' on' : ''}" data-route-kind="${escape(item.kind)}" aria-pressed="${ui.routeKind === item.kind}">${escape(item.kindName)}<small>数学 ${escape(item.math.label)}</small></button>`).join('')}</div>
      ${ui.routeKind ? `<p class="panel-hint">${escape(routes.find(item => item.kind === ui.routeKind)?.why ?? '')}</p>` : ''}
      <a class="secondary" href="#routes/${escape(domainId)}">4本を並べて読む →</a>
    </div>` : '<p class="empty-note">この学問の経路は、まだ用意できていません。</p>'}
  </section>`;
}

function routeNodePanel(node) {
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">経路の途中</p>
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
      <p class="panel-kind">いちばん下の段</p>
      <h2>いま</h2>
      <p>今日のこと。ここに置いたものが、上の段へ線を伸ばします。この段で決めることは、何もありません。</p>
    </section>`;
  }
  const editing = ui.editing === laneId;
  const away = rung.when === null ? ''
    : rung.when.months < 0 ? 'この段は過ぎています。'
    : rung.when.months === 0 ? '今月ごろです。'
    : `あと${rung.when.months}か月（${rung.when.year}年${rung.when.month}月ごろ）。`;
  return `<section class="panel">
    <button class="panel-close" data-deselect>× 閉じる</button>
    <p class="panel-kind">分岐点${rung.status === 'next' ? '・次はここ' : ''}</p>
    <h2>${escape(rung.name)}</h2>
    <p class="panel-defer">${escape(rung.defer)}保留できる。${escape(away)}</p>
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
        : `<p class="stance empty">まだ決める段階ではありません。<button class="text-button" data-stance-edit="${escape(laneId)}">いま思っていることを書く</button></p>`}
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

function pickerMarkup() {
  if (!ui.picker) return '';
  const {tab, lane: laneId} = ui.picker;
  const tabs = [['topic', '好きなこと'], ['activity', 'やってみる'], ['resource', '掲載情報'], ['custom', '自分で書く']];
  const body = tab === 'topic'
    ? `<ul class="pick-list">${Object.entries(topics).map(([id, topic]) => `<li><button data-pick="topic:${escape(id)}"><b>${escape(topic.label)}</b><span>${escape(topic.root)}</span></button></li>`).join('')}</ul>`
    : tab === 'activity'
      ? `<ul class="pick-list">${allActivities().map(activity => `<li><button data-pick="activity:${escape(activity.id)}"><b>${escape(activity.title)}</b><span>${escape(topics[activity.topic]?.label ?? '')} · ${escape(verbById(activity.verb)?.label ?? '')} · 目安${activity.minutes}分</span></button></li>`).join('')}</ul>`
      : tab === 'resource'
        ? `<ul class="pick-list">${Object.entries(resources).map(([id, item]) => `<li><button data-pick="resource:${escape(id)}"><b>${escape(item.name)}</b><span>${escape(item.kind)}</span></button></li>`).join('')}</ul>`
        : `<form class="pick-write" data-pick-write>
            <label for="pick-label">なにを置く？</label>
            <input id="pick-label" name="label" type="text" maxlength="${LABEL_LIMIT}" placeholder="例：アンプを自作する" autocomplete="off" required>
            <p class="panel-label">どんなふうに関わる？（あとで選んでもかまいません）</p>
            <div class="verb-row">${verbs.map(verb => `<label class="verb-chip small"><input type="radio" name="verb" value="${escape(verb.id)}"> ${escape(verb.icon)} ${escape(verb.label)}</label>`).join('')}</div>
            <button class="primary" type="submit">置く</button>
          </form>`;
  return `<dialog class="picker" id="picker" aria-label="野原に置くものを選ぶ">
    <div class="picker-head">
      <p class="picker-lane">${escape(laneById(laneId).id === 'now' ? 'いまの段に置きます' : `${laneById(laneId).horizon}の段に置きます`)}</p>
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
      <h1>時間の野原</h1>
      <p class="lead">下が今日、上が7年先。横はどこに置いてもかまいません。<button class="link-button" data-about>この野原について</button></p>
      <div class="field-controls">
        <button class="grade-open" data-grade-open>${grade ? `いま ${escape(grade.label)}` : 'いま何年生？'}</button>
        <button class="primary" data-open-picker="topic">＋ 置く</button>
        <button class="ghost" data-list-view aria-pressed="${ui.listView}">${ui.listView ? '野原で見る' : '一覧で読む'}</button>
      </div>
      ${ui.about ? '<p class="field-about">縦だけが時間です。横の位置に意味はありません。意味を持つのは、置いたものから伸びた線が、どこで合流するかです。関係がなさそうな2つが同じ学問に届くことがあります。</p>' : ''}
      ${ui.gradePicker ? `<div class="grade-choices">
        ${GRADES.map(item => `<button class="grade-choice${state.grade === item.id ? ' on' : ''}" data-grade="${item.id}">${escape(item.label)}</button>`).join('')}
        <button class="grade-choice clear" data-grade="">答えない</button>
      </div><p class="grade-note">分岐点まであと何か月かを出すためだけに使います。この端末の中だけです。</p>` : ''}
    </section>

    ${ui.listView
      ? renderFieldList(view, convergences(state.placements))
      : `<div class="field-wrap" id="field-wrap">${renderField(view, {selected: ui.selected, dragging: ui.dragging, highlight: highlightFor(view), next: next.decision})}</div>
         <p class="field-legend">段の見出しをタップすると、その分岐点について読めます。置いたものは指で動かせます。図が読みにくいときは「一覧で読む」へ。</p>`}

    ${selectionPanel(view)}
    ${tutorialMarkup()}
    ${convergenceMarkup()}

    <section class="today">
      <h2>今日決めること</h2>
      <p>${next.status === 'next'
        ? `「${escape(next.name)}」の1つだけです。${next.when && next.when.months >= 0 ? `あと${next.when.months}か月。` : ''}ほかの段は、まだ決める段階ではないか、すでに過ぎています。`
        : 'いちばん下の分岐点1つだけです。上の段は、まだ決める段階ではありません。'}</p>
      <p class="today-note">${week ? `この7日間に${week}件の記録。` : '記録は0件。空のままで問題ありません。'}　公立高校の一般入試を想定した目安で、地域・学校・入試方式によって前後します。</p>
    </section>

    ${storageSection()}
    ${pickerMarkup()}`;
}

/* ---------- 探す（動詞から） ---------- */

function activityMarkup(activity) {
  return `<li class="activity">
    <p class="activity-label">${escape(activity.label)}${activity.athome ? ' · 家でできる' : ' · 人や場所がいる'}</p>
    <h4>${escape(activity.title)}</h4>
    <p>${escape(activity.description)}</p>
    <p class="activity-time">目安 ${activity.minutes}分</p>
    <button class="primary small" data-place-activity="${escape(activity.id)}">野原に置く</button>
  </li>`;
}

function resourceMarkup(item) {
  const placed = state.placements.some(placement => placement.ref === item.id);
  return `<li class="resource">
    <p class="resource-kind">${escape(item.kind)}</p>
    <h4>${escape(item.name)}</h4>
    <p>${escape(item.summary)}</p>
    <details><summary>条件と、なぜここに出るのか</summary>
      <p class="resource-reason">${escape(item.reason)}</p>
      <dl>${item.conditions.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>
      <p class="resource-source">出典 ${escape(item.source)}（確認 ${escape(item.checkedOn)}）</p>
    </details>
    <div class="resource-actions">
      <a class="secondary" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">公式情報を見る ↗<small>別のタブで開きます</small></a>
      <button class="text-button" data-place-resource="${escape(item.id)}"${placed ? ' disabled' : ''}>${placed ? '✓ 野原にある' : '野原に置く'}</button>
    </div>
  </li>`;
}

function verbDetail(verbId) {
  const verb = verbById(verbId);
  const groups = activitiesByTopic(verbId, {athome: ui.athome});
  const fields = domainsForVerb(verbId);
  const items = resourcesForVerb(verbId, {athome: ui.athome});
  const coverage = verbCoverage(verbId);
  return `<section class="verb-detail">
    <a class="back" href="#find">← ほかの動詞を見る</a>
    <h2><span aria-hidden="true">${escape(verb.icon)}</span> ${escape(verb.label)}</h2>
    <p class="verb-summary">${escape(verb.summary)}</p>
    <p class="verb-detail-text">${escape(verb.detail)}</p>
    <label class="athome"><input type="checkbox" data-athome ${ui.athome ? 'checked' : ''}> 家でできるものだけ</label>

    <h3>今日できること</h3>
    ${groups.length
      ? `<p class="verb-note">同じ「${escape(verb.label)}」が、好きなことをまたいで並びます。${ui.athome ? `家でできるのは${coverage.athome}件。` : `全部で${coverage.activities}件。`}</p>
         ${groups.map(group => `<div class="activity-group"><h4 class="activity-topic">${escape(group.label)}</h4><ul class="activity-list">${group.items.map(activityMarkup).join('')}</ul></div>`).join('')}`
      : '<p class="empty-note">この条件に合う活動アイデアは、まだ用意できていません。条件を外すと出ます。</p>'}
    <p class="editorial">活動のアイデアです。募集中のイベントや、特定の団体の案内ではありません。動詞の割り当てはこのアプリの編集です。</p>

    <h3>この動詞を、学問にすると</h3>
    <p class="verb-note">向き不向きの判定ではありません。「${escape(verb.label)}」を仕事や研究として続けている分野です。</p>
    <ul class="domain-list">${fields.map(field => `<li>
      <h4>${escape(field.name)}</h4>
      <p>${escape(field.summary)}</p>
      <p class="domain-example">${escape(field.example)}</p>
      <a class="secondary" href="#routes/${escape(field.id)}">${escape(field.name)}にたどり着く道を見る →</a>
    </li>`).join('')}</ul>

    <h3>掲載情報（${items.length}件）</h3>
    ${items.length ? `<ul class="resource-list">${items.map(resourceMarkup).join('')}</ul>`
      : '<p class="empty-note">この条件の掲載情報はありません。掲載がないことと、世の中に存在しないことは別です。</p>'}
  </section>`;
}

function searchResultMarkup(entry) {
  const labels = {verb: '動詞', topic: '好きなこと', activity: 'やってみる', domain: '学びの領域', resource: '掲載情報'};
  const href = entry.type === 'verb' ? `#find/${entry.id}`
    : entry.type === 'domain' ? (hasRoutes(entry.id) ? `#routes/${entry.id}` : '')
    : entry.type === 'activity' ? `#find/${entry.activity.verb}`
    : entry.type === 'topic' ? '#find' : entry.resource.url;
  const external = entry.type === 'resource';
  return `<li class="result">
    <p class="result-type">${escape(labels[entry.type])}</p>
    ${href ? `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(entry.name)}${external ? ' ↗' : ''}</a>` : `<span>${escape(entry.name)}</span>`}
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

function findPage(verbId) {
  return `
    <section class="page-head">
      <h1>探す</h1>
      <p class="lead">学問の名前からではなく、いまやっていることから。見つけたものは野原に置けます。</p>
    </section>

    <form class="search" data-search>
      <label for="search-input">掲載範囲のなかを探す</label>
      <div class="search-row">
        <input id="search-input" name="query" type="search" value="${escape(ui.query)}" placeholder="海、つくる、発酵、ギター" autocomplete="off">
        <select name="filter" aria-label="絞り込み">
          ${[['all', 'すべて'], ['home', '家でできる'], ['activity', 'やってみる'], ['study', '学校・大学']]
            .map(([value, label]) => `<option value="${value}"${ui.filter === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
    </form>
    ${ui.query.trim() ? `<section class="results">${resultsMarkup()}</section>` : ''}

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
      <a class="back" href="#now">← 野原に戻る</a>
      <h1>${escape(domains[domainId].name)}への進み方</h1>
      <p class="lead">同じ学問にたどり着く道は1本ではありません。高校の段階で決まることが、経路ごとに違います。</p>
    </section>
    <div class="routes-body">${renderRoutes({domainId, domain: domains[domainId], saved: new Set(state.heldRoutes), checkedOn: ROUTES_CHECKED_ON})}</div>`;
}

function storageSection() {
  return `<section class="storage-section" aria-label="記録の保存">
    <h2>記録の保存</h2>
    <label class="storage-switch"><input type="checkbox" data-persist ${persist ? 'checked' : ''}> このブラウザに記録を残す</label>
    <p>野原に置いたもの・いまの考え・やったこと・学年を、このブラウザだけに保存します。サーバーには送りません。同じブラウザを使う人が開ける場合があります。</p>
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
    : nowPage();
  main.dataset.page = current.page;
  const tab = current.page === 'now' ? 'now' : 'find';
  for (const element of document.querySelectorAll('.tab')) {
    element.classList.toggle('active', element.dataset.tab === tab);
    element.setAttribute('aria-current', element.dataset.tab === tab ? 'page' : 'false');
  }
  const chip = $('storage-toggle');
  chip.textContent = `端末保存：${persist ? 'オン' : 'オフ'}`;
  chip.setAttribute('aria-pressed', String(persist));
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
  if (ui.picker) $('picker')?.showModal();
  if (ui.editing) {
    const input = $('stance-input');
    if (input) {input.focus(); input.setSelectionRange(input.value.length, input.value.length);}
  }
}

/* ---------- 野原に置く ---------- */

function place({kind, ref, label, verb = null, lane = 'now'}) {
  if (state.placements.length >= PLACEMENT_LIMIT) return notify(`野原に置けるのは${PLACEMENT_LIMIT}件までです。`);
  if (ref && state.placements.some(placement => placement.ref === ref && placement.lane === lane)) return notify('同じ段に、もう置いてあります。');
  const placement = {
    id: newPlacementId(), lane, x: freeX(state.placements, lane),
    label: String(label).slice(0, LABEL_LIMIT), kind, ref: ref ?? null, verb, note: ''
  };
  const before = convergences(state.placements).length;
  state.placements = [...state.placements, placement];
  ui.selected = placement.id;
  ui.picker = null;
  save();
  const after = convergences(state.placements);
  render();
  if (after.length > before) {
    const fresh = after[after.length - 1];
    notify(`合流：${fresh.labels.join('と')} → ${fresh.name}`);
  } else {
    notify(`「${placement.label}」を置きました。`);
  }
}

/* ---------- 操作 ---------- */

document.addEventListener('click', event => {
  const svgNode = event.target.closest('[data-node]');
  if (svgNode) {
    ui.selected = ui.selected === svgNode.dataset.node ? null : svgNode.dataset.node;
    ui.routeKind = null;
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
  if (target.hasAttribute('data-deselect')) {ui.selected = null; ui.routeKind = null; return render();}
  if (target.dataset.nodeOpen) {ui.selected = target.dataset.nodeOpen; ui.routeKind = null; ui.listView = false; return render();}
  if (target.hasAttribute('data-list-view')) {ui.listView = !ui.listView; return render();}
  if (target.hasAttribute('data-about')) {ui.about = !ui.about; return render();}
  if (target.hasAttribute('data-grade-open')) {ui.gradePicker = !ui.gradePicker; return render();}
  if (target.dataset.grade !== undefined) {state.grade = target.dataset.grade || null; ui.gradePicker = false; save(); return render();}

  if (target.dataset.quickTopic) return place({kind: 'topic', ref: target.dataset.quickTopic, label: topics[target.dataset.quickTopic].label});
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
    place({kind: 'resource', ref: target.dataset.placeResource, label: resources[target.dataset.placeResource].name});
    location.hash = '#now';
    return;
  }

  if (target.dataset.setVerb) {
    state.placements = state.placements.map(placement =>
      placement.id === ui.selected ? {...placement, verb: placement.verb === target.dataset.setVerb ? null : target.dataset.setVerb} : placement);
    save();
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
    save();
    notify('野原から外しました。やったことの記録は残しています。');
    return render();
  }
  if (target.dataset.routeKind) {ui.routeKind = ui.routeKind === target.dataset.routeKind ? null : target.dataset.routeKind; return render();}

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

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.hasAttribute('data-search')) return event.preventDefault();
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
  if (form.hasAttribute('data-pick-write')) {
    event.preventDefault();
    const label = form.elements.label.value.trim();
    if (!label) return notify('置くものを書いてください。');
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

document.addEventListener('pointerdown', event => {
  const handle = event.target.closest('[data-movable]');
  if (!handle || !lastView) return;
  const box = handle.closest('svg').getBoundingClientRect();
  drag = {id: handle.dataset.node, box, moved: false, pointer: event.pointerId, startX: event.clientX, startY: event.clientY};
});

document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  // 少し動いてからドラッグ扱いにする。タップで選ぶ操作を邪魔しない。
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
  drag.moved = true;
  ui.dragging = drag.id;
  event.preventDefault();
  const x = (event.clientX - drag.box.left) / drag.box.width;
  const lane = laneAt(event.clientY - drag.box.top, lastView.lanes);
  state.placements = state.placements.map(placement =>
    placement.id === drag.id ? {...placement, x: Math.min(Math.max(x, 0), 1), lane} : placement);
  render();
  const fresh = document.querySelector(`[data-node="${CSS.escape(drag.id)}"]`);
  if (fresh) drag.box = fresh.closest('svg').getBoundingClientRect();
});

document.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  const moved = drag.moved;
  drag = null;
  ui.dragging = null;
  if (!moved) return;
  // 動かしたときは選択を変えない。クリック扱いにもしない。
  event.preventDefault();
  save();
  render();
}, true);

// 幅の変化は resize より要素の観測のほうが確実に拾える。
const fieldObserver = new ResizeObserver(() => {
  if (route().page !== 'now' || ui.listView || drag) return;
  if (measureField()) render();
});

window.addEventListener('hashchange', () => {
  ui.editing = null;
  ui.picker = null;
  render();
  $('main-content').focus();
  window.scrollTo(0, 0);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
restore();
render();
