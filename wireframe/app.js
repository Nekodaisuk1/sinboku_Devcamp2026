import {buildTimeline, nextDecision, GRADES, STANCE_LIMIT, gradeById} from './timeline.mjs';
import {LOG_TEXT_LIMIT, addEntry, removeEntry, byMonth, recentCount, today} from './log.mjs';
import {verbs, verbById, domains, topics, activitiesByTopic, activityById, domainsForVerb, resourcesForVerb, verbCoverage, resources} from './verbs.mjs';
import {searchCatalog, catalogIds} from './catalog.mjs';
import {routesForDomain, hasRoutes, routeDomains, ROUTES_CHECKED_ON} from './routes.mjs';
import {renderRoutes} from './routes-ui.mjs';
import {STORAGE_KEY, LEGACY_KEY, emptyState, encodeState, decodeState, hasLegacyRecord} from './store.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const $ = id => document.getElementById(id);

const catalog = {...catalogIds(), routes: new Set(routeDomains().flatMap(id => routesForDomain(id, domains[id]).map(route => route.id)))};

let state = emptyState();
// 画面の一時的な状態。保存の対象にしない。
const ui = {query: '', filter: 'all', athome: false, editing: null, showAllLog: false, gradePicker: false, legacy: false};
let persist = false;
let storageNote = '';
let toastTimer;

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
  toastTimer = setTimeout(() => {toast.hidden = true;}, 4000);
}

/* ---------- ルーティング：2タブと、そこから開く経路 ---------- */

function route() {
  const [name, argument] = location.hash.replace(/^#/, '').split('/');
  if (name === 'find') return {page: 'find', verb: verbById(argument) ? argument : null};
  if (name === 'routes' && hasRoutes(argument)) return {page: 'routes', domain: argument};
  return {page: 'now'};
}

/* ---------- 7年の地図 ---------- */

function gradePickerMarkup() {
  const grade = gradeById(state.grade);
  if (!ui.gradePicker) {
    return `<div class="grade-row">
      <button class="grade-open" data-grade-open>${grade ? `いま ${escape(grade.label)}` : 'いま何年生？'}</button>
      <p class="grade-note">${grade
        ? '変えたり、消したりできます。分岐点までの残りを出すためだけに使います。'
        : '答えなくても地図は見られます。答えると、分岐点まであと何か月かが出ます。'}</p>
    </div>`;
  }
  return `<div class="grade-row grade-open-row">
    <p class="grade-question">いま何年生？　<span>この端末の中だけで使います。</span></p>
    <div class="grade-choices">
      ${GRADES.map(item => `<button class="grade-choice${state.grade === item.id ? ' on' : ''}" data-grade="${item.id}" aria-pressed="${state.grade === item.id}">${escape(item.label)}</button>`).join('')}
      <button class="grade-choice clear" data-grade="">答えない</button>
    </div>
  </div>`;
}

function rungMarkup(rung, index) {
  const away = rung.when === null ? '' :
    rung.when.months < 0 ? '<span class="rung-past">この段は過ぎています</span>' :
    rung.when.months === 0 ? '<span class="rung-away now">今月ごろ</span>' :
    `<span class="rung-away${rung.status === 'next' ? ' now' : ''}">あと${rung.when.months}か月（${rung.when.year}年${rung.when.month}月ごろ）</span>`;
  const editing = ui.editing === rung.decision;
  return `<li class="rung rung-${rung.status}" data-rung="${rung.decision}">
    <div class="rung-mark" aria-hidden="true"></div>
    <div class="rung-body">
      <p class="rung-horizon">${escape(rung.horizon)}${rung.status === 'next' ? '<b>次はここ</b>' : ''}</p>
      <h3>${escape(rung.name)}</h3>
      <p class="rung-defer">${escape(rung.defer)}保留できる ${away}</p>
      <details class="rung-detail"><summary>この分岐点は何を決める段階か</summary><p>${escape(rung.detail)}</p></details>
      ${editing ? `<form class="stance-form" data-stance-form="${rung.decision}">
          <label for="stance-${rung.decision}">いまの考え（空欄のままでもかまいません）</label>
          <input id="stance-${rung.decision}" name="stance" type="text" maxlength="${STANCE_LIMIT}" value="${escape(rung.stance)}" placeholder="まだ決めてない／普通科で考えてる">
          <div class="stance-actions"><button class="primary" type="submit">残す</button><button class="text-button" type="button" data-stance-cancel>やめる</button>
          ${rung.stance ? '<button class="text-button warn" type="button" data-stance-clear="' + rung.decision + '">消す</button>' : ''}</div>
        </form>`
      : rung.stance
        ? `<p class="stance"><span>いまの考え</span>${escape(rung.stance)} <button class="text-button" data-stance-edit="${rung.decision}">書き直す</button></p>`
        : `<p class="stance empty">まだ決める段階ではありません。<button class="text-button" data-stance-edit="${rung.decision}">いま思っていることを書く</button></p>`}
    </div>
  </li>`;
}

function logFormMarkup() {
  return `<form class="log-form" data-log-form>
    <label for="log-text">今日やったことを1行で</label>
    <input id="log-text" name="text" type="text" maxlength="${LOG_TEXT_LIMIT}" placeholder="例：ギターの録音を昨日のと聴き比べた" autocomplete="off">
    <button class="primary" type="submit">残す</button>
  </form>`;
}

function logEntryMarkup(entry) {
  const verb = entry.verb ? verbById(entry.verb) : null;
  return `<li class="log-entry">
    <p class="log-date">${escape(entry.date.slice(5).replace('-', '/'))}</p>
    <p class="log-text">${escape(entry.text)}</p>
    ${verb ? `<p class="log-verb">${escape(verb.icon)} ${escape(verb.label)}</p>` : ''}
    <button class="text-button warn" data-log-remove="${escape(entry.id)}">消す</button>
  </li>`;
}

function nowPage() {
  const timeline = buildTimeline({gradeId: state.grade, stances: state.stances});
  // 畳んだ状態でも「次はここ」の段は必ず見える。学年が進むと、次の分岐点は上の段に移る。
  const nextIndex = timeline.findIndex(rung => rung.status === 'next');
  const start = state.expanded ? 0 : Math.min(nextIndex === -1 ? timeline.length - 2 : nextIndex, timeline.length - 2);
  const visible = timeline.slice(start);
  const next = nextDecision(timeline);
  const week = recentCount(state.log, 7);
  const shown = ui.showAllLog ? state.log : state.log.slice(0, 5);
  const marks = state.marks.map(id => ({id, ...resources[id]})).filter(item => item.name);
  return `
    <section class="page-head">
      <h1>7年の地図</h1>
      <p class="lead">いま中3なら、大学で専攻を決めるまで約7年。決める場所は、そのあいだに4回だけです。</p>
      ${gradePickerMarkup()}
    </section>

    <section class="ladder-section" aria-label="この先の分岐点">
      <ol class="ladder">${visible.map(rungMarkup).join('')}</ol>
      <button class="ladder-toggle" data-expand>${state.expanded ? '↑ 近いところだけ表示する' : `↓ もっと先まで見る（あと${timeline.length - visible.length}段）`}</button>
      <p class="ladder-note">${next.status === 'next'
        ? `今日決めなければならないのは、「${escape(next.name)}」の1つだけです。ほかの段は、まだ決める段階ではないか、すでに過ぎています。`
        : '今日決めなければならないのは、いちばん下の1つだけです。上の段は、まだ決める段階ではありません。'}公立高校の一般入試を想定した目安で、地域・学校・入試方式によって前後します。</p>
    </section>

    <section class="now-section" aria-label="いま">
      <h2>いま</h2>
      <p class="now-lead">${week ? `この7日間に${week}件。` : '記録はまだありません。'}やったことだけを置く場所です。締切も、続いた日数も数えません。</p>
      ${logFormMarkup()}
      ${state.log.length
        ? `<ul class="log-list">${shown.map(logEntryMarkup).join('')}</ul>
           ${state.log.length > 5 ? `<button class="text-button" data-log-all>${ui.showAllLog ? '最近の5件だけ表示' : `ぜんぶ見る（${state.log.length}件）`}</button>` : ''}
           ${ui.showAllLog && state.log.length > 5 ? `<div class="log-months">${byMonth(state.log).map(group => `<p><b>${escape(group.month.replace('-', '年'))}月</b> ${group.items.length}件</p>`).join('')}</div>` : ''}`
        : '<p class="empty-note">空のままで問題ありません。何か1つやった日に、1行だけ足せば足ります。</p>'}
    </section>

    <section class="next-section" aria-label="次にできること">
      <h2>次にできること</h2>
      <p>${escape(next.name)}のために、いま調べることはありません。かわりに、いまやっていることの先を見られます。</p>
      <div class="verb-row">${verbs.map(verb => `<a class="verb-chip" href="#find/${verb.id}"><span aria-hidden="true">${escape(verb.icon)}</span> ${escape(verb.label)}</a>`).join('')}</div>
    </section>

    ${marks.length ? `<section class="marks-section" aria-label="あとで見る">
      <h2>あとで見る（${marks.length}件）</h2>
      <ul class="mark-list">${marks.map(item => `<li><div><p class="mark-kind">${escape(item.kind)}</p><p class="mark-name">${escape(item.name)}</p></div><a class="secondary" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">開く ↗</a><button class="text-button" data-unmark="${escape(item.id)}">外す</button></li>`).join('')}</ul>
    </section>` : ''}

    ${storageSection()}`;
}

/* ---------- 探す：動詞から ---------- */

function activityMarkup(activity) {
  return `<li class="activity">
    <p class="activity-label">${escape(activity.label)}${activity.athome ? ' · 家でできる' : ' · 人や場所がいる'}</p>
    <h4>${escape(activity.title)}</h4>
    <p>${escape(activity.description)}</p>
    <p class="activity-time">目安 ${activity.minutes}分</p>
    <button class="primary small" data-did="${escape(activity.id)}">やった</button>
  </li>`;
}

function resourceMarkup(item) {
  const marked = state.marks.includes(item.id);
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
      <button class="text-button" data-mark="${escape(item.id)}" aria-pressed="${marked}">${marked ? '✓ あとで見るに入れた' : 'あとで見る'}</button>
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

function verbListMarkup() {
  return `<ul class="verb-list">${verbs.map(verb => {
    const coverage = verbCoverage(verb.id);
    return `<li><a href="#find/${verb.id}">
      <p class="verb-icon" aria-hidden="true">${escape(verb.icon)}</p>
      <h3>${escape(verb.label)}</h3>
      <p>${escape(verb.summary)}</p>
      <p class="verb-count">できること${coverage.activities}件 · 学問${coverage.domains}件 · 掲載情報${coverage.resources}件</p>
    </a></li>`;
  }).join('')}</ul>`;
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

function findPage(verbId) {
  const results = ui.query.trim() ? searchCatalog(ui.query, ui.filter) : [];
  return `
    <section class="page-head">
      <h1>探す</h1>
      <p class="lead">学問の名前からではなく、いまやっていることから。</p>
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
    ${ui.query.trim() ? `<section class="results"><p class="result-count">${results.length}件 · 掲載範囲のなかの検索です</p>
      ${results.length ? `<ul>${results.slice(0, 40).map(searchResultMarkup).join('')}</ul>` : '<p class="empty-note">見つかりませんでした。掲載していないものを、それらしく作ることはしません。</p>'}</section>` : ''}

    ${verbId ? verbDetail(verbId) : `<section class="verb-section">
      <h2>いま、どれをやっている？</h2>
      <p>新しく始めることではなく、もうやっていることを選んでください。</p>
      ${verbListMarkup()}
      <h2>好きなことから見る</h2>
      <ul class="topic-list">${Object.entries(topics).map(([id, topic]) => `<li><b>${escape(topic.label)}</b><span>${escape(topic.root)}</span></li>`).join('')}</ul>
      <p class="editorial">掲載しているのは${Object.keys(resources).length}件の実在する情報と、${Object.keys(topics).length}つの好きなことに対する活動アイデアです。学校や活動を網羅した一覧ではありません。</p>
    </section>`}`;
}

/* ---------- 経路：学問から逆に引く（Build 14 の資産をそのまま使う） ---------- */

function routesPage(domainId) {
  return `<section class="page-head">
      <a class="back" href="#find">← 探すに戻る</a>
      <h1>${escape(domains[domainId].name)}への進み方</h1>
      <p class="lead">同じ学問にたどり着く道は1本ではありません。高校の段階で決まることが、経路ごとに違います。</p>
    </section>
    <div class="routes-body">${renderRoutes({domainId, domain: domains[domainId], saved: new Set(state.heldRoutes), checkedOn: ROUTES_CHECKED_ON})}</div>`;
}

/* ---------- 保存の設定 ---------- */

function storageSection() {
  return `<section class="storage-section" aria-label="記録の保存">
    <h2>記録の保存</h2>
    <label class="storage-switch"><input type="checkbox" data-persist ${persist ? 'checked' : ''}> このブラウザに記録を残す</label>
    <p>学年・いまの考え・やったこと・あとで見る・見返す経路を、このブラウザだけに保存します。サーバーには送りません。同じブラウザを使う人が開ける場合があります。</p>
    <p class="storage-state">${persist ? 'いまは保存しています。オフにすると、この端末の記録を消します。' : 'いまは保存していません。再読み込みすると消えます。'}</p>
    ${storageNote ? `<p class="storage-warning">${escape(storageNote)}</p>` : ''}
    ${ui.legacy ? '<p class="storage-warning">Build 18 までの形式の記録が、このブラウザに残っています。いまのアプリでは読めませんが、消してもいません。</p>' : ''}
  </section>`;
}

/* ---------- 描画 ---------- */

function render() {
  const current = route();
  const main = $('main-content');
  main.innerHTML = current.page === 'find' ? findPage(current.verb)
    : current.page === 'routes' ? routesPage(current.domain)
    : nowPage();
  main.dataset.page = current.page;
  const tab = current.page === 'find' || current.page === 'routes' ? 'find' : 'now';
  for (const element of document.querySelectorAll('.tab')) {
    element.classList.toggle('active', element.dataset.tab === tab);
    element.setAttribute('aria-current', element.dataset.tab === tab ? 'page' : 'false');
  }
  const chip = $('storage-toggle');
  chip.textContent = `端末保存：${persist ? 'オン' : 'オフ'}`;
  chip.setAttribute('aria-pressed', String(persist));
  const focus = ui.editing ? $(`stance-${ui.editing}`) : null;
  if (focus) {focus.focus(); focus.setSelectionRange(focus.value.length, focus.value.length);}
}

/* ---------- 操作 ---------- */

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.id === 'storage-toggle') {setPersist(!persist); return render();}
  if (target.hasAttribute('data-expand')) {state.expanded = !state.expanded; save(); return render();}
  if (target.hasAttribute('data-grade-open')) {ui.gradePicker = true; return render();}
  if (target.dataset.grade !== undefined) {
    state.grade = target.dataset.grade || null;
    ui.gradePicker = false;
    save();
    return render();
  }
  if (target.dataset.stanceEdit) {ui.editing = target.dataset.stanceEdit; return render();}
  if (target.hasAttribute('data-stance-cancel')) {ui.editing = null; return render();}
  if (target.dataset.stanceClear) {
    delete state.stances[target.dataset.stanceClear];
    ui.editing = null;
    save();
    notify('いまの考えを消しました。空欄でも問題ありません。');
    return render();
  }
  if (target.dataset.logRemove) {
    state.log = removeEntry(state.log, target.dataset.logRemove);
    save();
    return render();
  }
  if (target.hasAttribute('data-log-all')) {ui.showAllLog = !ui.showAllLog; return render();}
  if (target.dataset.did) {
    const activity = activityById(target.dataset.did);
    try {
      state.log = addEntry(state.log, {text: activity.title, verb: activity.verb, activity: activity.id});
    } catch (error) {
      return notify(error.message);
    }
    save();
    notify(`「${activity.title}」を、いまの記録に残しました。`);
    return render();
  }
  if (target.dataset.mark) {
    const id = target.dataset.mark;
    state.marks = state.marks.includes(id) ? state.marks.filter(item => item !== id) : [...state.marks, id];
    save();
    return render();
  }
  if (target.dataset.unmark) {
    state.marks = state.marks.filter(item => item !== target.dataset.unmark);
    save();
    return render();
  }
  // Build 14 から引き継いだ経路の操作。
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
    const value = form.elements.stance.value.trim();
    if (value) state.stances[form.dataset.stanceForm] = value.slice(0, STANCE_LIMIT);
    else delete state.stances[form.dataset.stanceForm];
    ui.editing = null;
    save();
    return render();
  }
  if (form.hasAttribute('data-log-form')) {
    event.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return notify('1行だけ書いてください。');
    try {
      state.log = addEntry(state.log, {text});
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
  const markup = ui.query.trim()
    ? (() => {
        const found = searchCatalog(ui.query, ui.filter);
        return `<p class="result-count">${found.length}件 · 掲載範囲のなかの検索です</p>${found.length ? `<ul>${found.slice(0, 40).map(searchResultMarkup).join('')}</ul>` : '<p class="empty-note">見つかりませんでした。掲載していないものを、それらしく作ることはしません。</p>'}`;
      })()
    : '';
  if (results) results.innerHTML = markup;
  else if (markup) event.target.closest('form').insertAdjacentHTML('afterend', `<section class="results">${markup}</section>`);
});

window.addEventListener('hashchange', () => {
  ui.editing = null;
  render();
  $('main-content').focus();
  window.scrollTo(0, 0);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
restore();
render();
