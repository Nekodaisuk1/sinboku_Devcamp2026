import {buildTimeline, nextDecision, GRADES, STANCE_LIMIT, gradeById} from './timeline.mjs';
import {LOG_TEXT_LIMIT, addEntry, removeEntry, recentCount} from './log.mjs';
import {verbs, verbById, domains, topics, activitiesByTopic, activityById, domainsForVerb, resourcesForVerb, verbCoverage, resources, allActivities} from './verbs.mjs';
import {searchCatalog, catalogIds} from './catalog.mjs';
import {routesForDomain, hasRoutes, routeDomains, ROUTES_CHECKED_ON} from './routes.mjs';
import {renderRoutes} from './routes-ui.mjs';
import {STORAGE_KEY, emptyState, encodeState, decodeState, hasLegacyRecord} from './store.mjs';
import {LANES, LANE_IDS, laneById, layout, laneAt, revealWorld, convergences, reachOf, routePath, newPlacementId, freeX, previewBox, visibleFor, linkedSet, listGroups, convergenceSentence, FIELD_VIEWS, LIST_SORTS,
        sourceOf, contentOf, describeSource, URL_LIMIT, PHOTO_LIMIT, PHOTO_BYTES,
        PLACEMENT_LIMIT, LABEL_LIMIT} from './field.mjs';
import {renderField, renderFieldList, curve} from './field-ui.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const $ = id => document.getElementById(id);

const catalog = {...catalogIds(), routes: new Set(routeDomains().flatMap(id => routesForDomain(id, domains[id]).map(route => route.id)))};

let state = emptyState();
// 画面の一時的な状態。保存の対象にしない。
const ui = {query: '', filter: 'all', athome: false, editing: null, gradePicker: false, legacy: false,
            selected: null, routeKind: null, listView: false, about: false, picker: null,
            verbSection: 'activities', fieldWidth: 360, fieldScroll: null,
            // 表示の絞り込みと段の展開は、見え方だけの状態。保存しない。
            fieldView: 'all', listSort: 'lane', expandedLanes: [], moving: null,
            // 取り込む前の下書き。確認画面を通るまで state には入れない。
            draft: null};
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
      ? `記録を保存できませんでした。${error.message} 写真を置いた置きものを外すと、また保存できるようになります。画面を閉じるまでは、いまの内容は残っています。`
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
  return {page: 'now'};
}

/* ---------- 外から届いたページを、置く前に確認する ---------- */

/**
 * ブックマークレットから `#add?u=...&t=...` で届いたページを下書きにする。
 * 届いた文字列は、このアプリの外で作られたものとして扱う。中身を取りに行かない（通信しない）し、
 * 何についての話かも推測しない。開くかどうかも、タグを付けるかも、本人が決める。
 */
function startLinkDraft(url, title = '') {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('これはページのアドレスとして読み取れませんでした。');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('置けるのは http と https のページだけです。');
  if (url.length > URL_LIMIT) throw new Error(`アドレスが長すぎます（${URL_LIMIT}文字まで）。`);
  ui.draft = {kind: 'link', url, title: (title || parsed.hostname).slice(0, LABEL_LIMIT),
              photo: null, topic: null, verb: null, lane: ui.picker?.lane ?? 'now'};
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

/* ---------- 野原 ---------- */

function fieldView() {
  // 絞り込みは「描くものを減らす」だけ。保存された置きものには手を触れない。
  const scope = visibleFor(state.placements, {view: ui.fieldView, selected: ui.selected});
  const selected = ui.selected ?? '';
  const anchor = selected.startsWith('domain-')
    ? revealWorld(scope.placements).domains.find(domain => `domain-${domain.id}` === selected)?.x ?? 0.5
    : 0.5;
  const extra = selected.startsWith('domain-') && ui.routeKind ? routePath(selected.slice(7), ui.routeKind, anchor) : {nodes: [], links: []};
  const extraNodes = extra.nodes.map(node => ({...node, links: extra.links.filter(link => link.from === node.id)}));
  // 選んだものと、その線の行き先は「ほか◯件」に隠さない。隠れると線を最後まで追えない。
  // いま動かしているものも同じ。動かした先で消えてしまっては、動かした意味がない。
  const keep = new Set([...linkedSet(scope.placements, ui.selected), ui.moving].filter(Boolean));
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
  return `<p class="field-expanded">広げている段：${open.map(lane =>
    `<button class="lane-chip on" data-expand-lane="${escape(lane.id)}" data-expand-from="list" aria-label="${escape(lane.title)}の段をまとめる">${escape(lane.title)}<span aria-hidden="true"> ✕</span></button>`).join('')}</p>`;
}

function fieldViewMarkup() {
  if (state.placements.length === 0) return '';
  return `<div class="field-views" role="group" aria-label="野原の表示">
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
    return `<section class="tutor tutor-start" aria-label="野原のはじめかた">
      <p class="tutor-step">はじめかた</p>
      <h2>好きなものを、ひとつ置く</h2>
      <p>選ぶと線が伸びて、つながる学問が現れます。</p>
      <div class="tutor-choices">
        ${Object.entries(topics).map(([id, topic]) => `<button class="tutor-choice" data-quick-topic="${escape(id)}">${escape(topic.label)}</button>`).join('')}
        <button class="tutor-choice write" data-open-picker="custom">自分で書く</button>
      </div>
    </section>`;
  }
  return '';
}

function contextMarkup(next, grade, week) {
  const placement = state.placements.at(-1);
  const timing = next.when && next.when.months >= 0
    ? `あと${next.when.months}か月`
    : grade ? next.defer : '中3の12月ごろが目安';
  const decision = next.name || '次の分岐点';
  return `<section class="field-context" aria-label="いま確認できること">
    <button class="context-item context-decision" data-node-open="lane-${escape(next.decision)}">
      <span>次に開く扉</span>
      <b>${escape(decision)}</b>
      <small>${escape(timing)} · いま全部を決めなくて大丈夫</small>
    </button>
    ${state.placements.length === 1 ? `<button class="context-item context-resume" data-open-picker="topic">
      <span>つぎの一手</span>
      <b>もうひとつ置いて、共通点を見る</b>
      <small>別の好きなことや活動を選ぶ</small>
    </button>` : placement ? `<button class="context-item context-resume" data-node-open="${escape(placement.id)}">
      <span>野原のつづき</span>
      <b>「${escape(placement.label)}」を見る</b>
      <small>野原に${state.placements.length}件${week ? ` · 7日間の記録${week}件` : ''}</small>
    </button>` : `<a class="context-item context-explore" href="#find">
      <span>何を置くか迷ったら</span>
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
      <h2>まだ合流していません</h2>
      <p>${loose ? `${loose}件は、まだどこにもつながっていません。タップして関わり方を選ぶと線が伸びます。` : 'いま置いてあるものは、別々の領域に向かっています。それも一つの答えです。'}</p>
      <p class="converge-note">無理に共通点を作ることはしません。別の好きなことを足すか、「探す」で動詞から活動を足してみてください。</p>
    </section>`;
  }
  return `<section class="converge">
    <h2>ここで合流しています</h2>
    <ul>${found.map(item => {
      // 名前を全部並べない。1つの学問に8件届くことがあり、並べると1行が画面を埋める。
      const {shown, rest, all, name} = convergenceSentence(item);
      return `<li>
      <p class="converge-from">${shown.map(label => `<span>${escape(label)}</span>`).join('<em>と</em>')}${rest ? `<em>ほか</em><span>${rest}件</span>` : ''}</p>
      <p class="converge-to">${escape(all)} <button class="link-button" data-node-open="domain-${escape(item.domain)}">${escape(name)}</button> につながっています</p>
    </li>`;
    }).join('')}</ul>
    <p class="converge-note">同じ領域に届いているという意味です。向き不向きの判定ではありません。</p>
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
    ${origin.caution ? `<p class="placement-caution">${escape(origin.caution)}。${placement.url ? 'リンク先を開くかどうかは、自分で決めてください。' : ''}</p>` : ''}
    ${placement.photo ? `<img class="photo-preview" src="${escape(placement.photo)}" alt="「${escape(placement.label)}」として置いた写真">` : ''}
    ${placement.url ? `<a class="secondary" href="${escape(placement.url)}" target="_blank" rel="noopener noreferrer nofollow">このページを開く ↗<small class="confirm-url">${escape(placement.url)}</small></a>` : ''}
    ${reach.length
      ? `<p class="panel-reach">ここから <b>${reach.map(escape).join('・')}</b> に線が伸びています。</p>`
      : '<p class="panel-reach muted">まだどこにもつながっていません。下でタグを選ぶと線が伸びます。</p>'}

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
  const reach = reachOf({kind: draft.kind, ref: null, topic: draft.topic, verb: draft.verb})
    .map(id => domains[id]?.name).filter(Boolean);
  if (!reach.length) return 'いまのままだと、どこにもつながりません。タグを選ぶと線が伸びます。選ばないまま置いてもかまいません。';
  return `いまの選び方だと、${reach.join('・')}へ線が伸びます。`;
}

function draftMarkup() {
  if (!ui.draft) return '';
  const draft = ui.draft;
  return `<dialog class="picker confirm-panel" id="draft" aria-label="野原に置く前の確認">
    <div class="picker-head">
      <p class="picker-lane">置く前に確認します</p>
      <button class="text-button" data-draft-cancel>やめる</button>
    </div>
    <p class="placement-caution">これは<b>自分で追加</b>するものです。このアプリは中身を見に行っていないので、内容は確認していません。${draft.kind === 'link' ? 'リンク先を開くかどうかは、自分で決めてください。' : ''}</p>
    <form data-draft-form>
      ${draft.kind === 'link' ? `<div class="confirm-row"><span>リンク先</span><p class="confirm-url">${escape(draft.url)}</p></div>` : ''}
      ${draft.kind === 'photo' ? `<div class="confirm-row"><span>写真</span><img class="photo-preview" src="${escape(draft.photo)}" alt="置こうとしている写真"></div>` : ''}

      <label for="draft-title">野原に出す名前</label>
      <input id="draft-title" name="title" type="text" maxlength="${LABEL_LIMIT}" value="${escape(draft.title)}" placeholder="例：波の高さの調べ方" autocomplete="off" required>

      <p class="panel-label">何について？</p>
      <div class="lane-row">${Object.entries(topics).map(([id, topic]) => `<button type="button" class="lane-chip${draft.topic === id ? ' on' : ''}" data-draft-topic="${escape(id)}" aria-pressed="${draft.topic === id}">${escape(topic.label)}</button>`).join('')}</div>

      <p class="panel-label">どんなふうに関わる？</p>
      <div class="verb-row">${verbs.map(verb => `<button type="button" class="verb-chip small${draft.verb === verb.id ? ' on' : ''}" data-draft-verb="${escape(verb.id)}" aria-pressed="${draft.verb === verb.id}">${escape(verb.icon)} ${escape(verb.label)}</button>`).join('')}</div>

      <p class="panel-label">いつやりたい？</p>
      <div class="lane-row">${LANES.map(item => `<button type="button" class="lane-chip${draft.lane === item.id ? ' on' : ''}" data-draft-lane="${escape(item.id)}" aria-pressed="${draft.lane === item.id}">${escape(item.id === 'now' ? 'いま' : item.horizon)}</button>`).join('')}</div>

      <p class="panel-hint">${escape(draftReachNote(draft))}</p>
      <button class="primary" type="submit">野原に置く</button>
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
    <p><a class="bookmarklet-link" href="${escape(code)}" onclick="return false">野原へ送る</a></p>
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
              <button class="primary" type="submit">置く</button>
            </form>

            <form class="pick-link" data-pick-link>
              <label for="pick-url">見つけたページを置く</label>
              <input id="pick-url" name="url" type="url" inputmode="url" maxlength="${URL_LIMIT}" placeholder="https://" autocomplete="off" required>
              <button class="secondary" type="submit">確認する</button>
              <p class="panel-hint">貼り付けても、すぐには置きません。置く前に確認画面が出ます。中身は見に行きません。</p>
            </form>

            <div class="pick-photo">
              <label for="pick-photo">写真から置く</label>
              <input id="pick-photo" type="file" accept="image/*" data-photo-input>
              <p class="panel-hint">写真はこの端末の中だけに残ります。送信しません。保存できる大きさまで小さくしてから置きます（${PHOTO_LIMIT}枚まで）。</p>
            </div>

            ${bookmarkletMarkup()}
          </div>`;
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
      ${fieldViewMarkup()}
      ${ui.about ? '<p class="field-about">縦だけが時間です。横の位置に意味はありません。意味を持つのは、置いたものから伸びた線が、どこで合流するかです。関係がなさそうな2つが同じ学問に届くことがあります。</p>' : ''}
      ${ui.gradePicker ? `<div class="grade-choices">
        ${GRADES.map(item => `<button class="grade-choice${state.grade === item.id ? ' on' : ''}" data-grade="${item.id}">${escape(item.label)}</button>`).join('')}
        <button class="grade-choice clear" data-grade="">答えない</button>
      </div><p class="grade-note">分岐点まであと何か月かを出すためだけに使います。この端末の中だけです。</p>` : ''}
    </section>

    ${contextMarkup(next, grade, week)}

    ${ui.listView
      ? `${listSortMarkup()}
         ${view.scope.placements.length
            ? renderFieldList(listWithSource(listGroups(view.scope.placements, ui.listSort)), convergences(view.scope.placements))
            : '<p class="field-list-empty">まだ何も置いていません。</p>'}
         ${scopeMarkup(view.scope)}`
      : `<div class="field-stage">
           <div class="field-wrap" id="field-wrap">${renderField(view, {selected: ui.selected, highlight: highlightFor(view), next: next.decision})}</div>
           ${tutorialMarkup()}
         </div>
         ${expandedMarkup(view)}
         ${scopeMarkup(view.scope)}
         <p class="field-legend">段の見出しをタップすると、その分岐点について読めます。置いたものは指でも、選んでから矢印キーでも動かせます。混みあった段は「広げる」で1つずつに分けられます。図が読みにくいときは「一覧で読む」へ。</p>`}

    ${selectionPanel(view)}
    ${convergenceMarkup()}

    ${storageSection()}
    ${pickerMarkup()}
    ${draftMarkup()}`;
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
    <p class="editorial">活動のアイデアです。募集中のイベントや、特定の団体の案内ではありません。動詞の割り当てはこのアプリの編集です。</p>
  </section>`;
  const domainSection = `<section class="verb-pane" aria-label="つながる学問">
    <h3>この動詞を、学問にすると</h3>
    <p class="verb-note">向き不向きの判定ではありません。「${escape(verb.label)}」を仕事や研究として続けている分野です。</p>
    <ul class="domain-list">${fields.map(field => `<li>
      <h4>${escape(field.name)}</h4>
      <p>${escape(field.summary)}</p>
      <p class="domain-example">${escape(field.example)}</p>
      <a class="secondary" href="#routes/${escape(field.id)}">${escape(field.name)}にたどり着く道を見る →</a>
    </li>`).join('')}</ul>
  </section>`;
  const resourceSection = `<section class="verb-pane" aria-label="掲載情報">
    <h3>掲載情報（${items.length}件）</h3>
    ${items.length ? `<ul class="resource-list">${items.map(resourceMarkup).join('')}</ul>`
      : '<p class="empty-note">この条件の掲載情報はありません。掲載がないことと、世の中に存在しないことは別です。</p>'}
  </section>`;
  const panes = {activities: activitySection, domains: domainSection, resources: resourceSection};
  return `<section class="verb-detail">
    <a class="back" href="#find">← ほかの動詞を見る</a>
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
  const labels = {verb: '動詞', topic: '好きなこと', activity: 'やってみる', domain: '学びの領域', resource: '掲載情報'};
  const href = entry.type === 'verb' ? `#find/${entry.id}`
    : entry.type === 'domain' ? (hasRoutes(entry.id) ? `#routes/${entry.id}` : '')
    : entry.type === 'activity' ? `#find/${entry.activity.verb}`
    : entry.type === 'topic' ? '#find' : entry.resource.url;
  const external = entry.type === 'resource';
  const placeAction = entry.type === 'resource'
    ? `<button class="text-button" data-place-resource="${escape(entry.id)}">野原に置く</button>`
    : entry.type === 'activity'
      ? `<button class="text-button" data-place-activity="${escape(entry.id)}">野原に置く</button>`
      : entry.type === 'topic'
        ? `<button class="text-button" data-quick-topic="${escape(entry.id)}">野原に置く</button>` : '';
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

function place({kind, ref, label, verb = null, lane = 'now', topic = null, url = null, title = null, photo = null}) {
  if (state.placements.length >= PLACEMENT_LIMIT) return notify(`野原に置けるのは${PLACEMENT_LIMIT}件までです。`);
  if (ref && state.placements.some(placement => placement.ref === ref && placement.lane === lane)) return notify('同じ段に、もう置いてあります。');
  if (url && state.placements.some(placement => placement.url === url)) return notify('このページは、もう野原にあります。');
  const placement = {
    id: newPlacementId(), lane, x: freeX(state.placements, lane),
    label: String(label).slice(0, LABEL_LIMIT), kind, ref: ref ?? null, verb, note: '',
    topic, url, title, photo
  };
  const before = convergences(state.placements).length;
  state.placements = [...state.placements, placement];
  ui.selected = placement.id;
  ui.picker = null;
  ui.draft = null;
  save();
  const after = convergences(state.placements);
  render();
  if (after.length > before) {
    const fresh = after[after.length - 1];
    notify(`合流：${fresh.labels.join('と')} → ${fresh.name}`);
  } else {
    notify(`「${placement.label}」を置きました。${persist ? '' : ' 次回も残すなら、右上で保存をオンに。'}`);
  }
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
    ui.selected = ui.selected === svgNode.dataset.node ? null : svgNode.dataset.node;
    ui.routeKind = null;
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
  if (target.hasAttribute('data-deselect')) {ui.selected = null; ui.routeKind = null; return render();}
  if (target.dataset.nodeOpen) {ui.selected = target.dataset.nodeOpen; ui.routeKind = null; ui.listView = false; return render();}
  if (target.hasAttribute('data-list-view')) {ui.listView = !ui.listView; return render();}
  if (target.dataset.fieldView) {ui.fieldView = target.dataset.fieldView; return render();}
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
    place({kind: 'resource', ref: target.dataset.placeResource, label: resources[target.dataset.placeResource].name});
    location.hash = '#now';
    return;
  }

  if (target.dataset.draftTopic) {ui.draft = {...ui.draft, topic: ui.draft.topic === target.dataset.draftTopic ? null : target.dataset.draftTopic}; return render();}
  if (target.dataset.draftVerb) {ui.draft = {...ui.draft, verb: ui.draft.verb === target.dataset.draftVerb ? null : target.dataset.draftVerb}; return render();}
  if (target.dataset.draftLane) {ui.draft = {...ui.draft, lane: target.dataset.draftLane}; return render();}
  if (target.hasAttribute('data-draft-cancel')) {ui.draft = null; notify('置くのをやめました。何も残していません。'); return render();}

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
  if (moved.lane !== placement.lane) notify(`「${placement.label}」を${laneById(moved.lane).title}の段へ動かしました。`);
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
    if (!title) return notify('野原に出す名前を書いてください。');
    return place({
      kind: draft.kind, ref: null, label: title, verb: draft.verb, lane: draft.lane,
      topic: draft.topic, url: draft.url, title, photo: draft.photo
    });
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
  render();
  $('main-content').focus();
  window.scrollTo(0, 0);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
restore();
consumeAddHash();
render();
