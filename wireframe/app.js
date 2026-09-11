const pendingCaptureParams=new URLSearchParams(location.hash.includes('?')?location.hash.split('?').slice(1).join('?'):location.search);
import {concepts,renderResourcePreview,attachConcept} from './knowledge-ui.mjs';
import {validateCapture,captureBookmark} from './capture.mjs';
import {directions,addDirectionActivity} from './directions.mjs';
import {emptyProgress,renderWelcome} from './guide.mjs';
import {validateInquiry,inquiryCandidates} from './inquiry.mjs';
import {renderInquiryComparison} from './inquiry-ui.mjs';
import {renderStudio,renderStudioDiscovery,branchContext,startInquiry,attachResource,attachReference} from './studio.mjs';
import {emptyPersonalMap,validatePersonalMap,descendants,removeMapBranch,integratePaths} from "./personal-map.mjs";
import {familyRequest} from "./family.js";
import {extraDomains, extraTopics, extraNeighbors, liveOpportunities, searchCatalog} from "./catalog.mjs";
import { hasRoutes, routeDomains, routesForDomain, ROUTES_CHECKED_ON } from "./routes.mjs";
import { renderRoutes } from "./routes-ui.mjs";
import { drawTreeConnections, roundedRoute } from "./geometry.mjs";
import { STORAGE_KEY, encodeWorkspace, decodeWorkspace, publicCandidates, validateRecommendation } from "./workspace.mjs";

const domains = {
  ecology: { name: "生態学", question: "生き物の暮らしを知りたい", summary: "生き物と、その周りの環境との関係を探る。", example: "同じ海岸でも、場所によって生き物が違うのはなぜ？", method: "観察する · 記録する", tags: ["フィールド観察", "比較", "データ分析"], learning: "生物の暮らしや環境を観察し、記録を比べて関係を考える。", related: "environment", relation: "同じ環境を、違う視点で見る", reason: "生態学は生き物と環境の関係に、環境科学は環境の変化やその要因にも目を向けます。", opportunity: "観察・調査の体験" },
  environment: { name: "環境科学", question: "海の環境を守りたい", summary: "環境が変わる仕組みを調べ、課題への関わり方を考える。", example: "海の変化を知るには、何を測り、どう比べればいい？", method: "測る · 調べる", tags: ["観測", "実験", "データ分析"], learning: "自然の仕組みと人の活動を、観測や分析を通して考える。", related: "ecology", relation: "生き物を知ることが、環境を考える手がかりに", reason: "生態学と環境科学は、生き物と環境の関係を扱う点で重なります。扱う気になることや対象の範囲には違いがあります。", opportunity: "環境を調べる体験" },
  engineering: { name: "海洋工学", question: "海で使う仕組みを作りたい", summary: "海という環境で役立つ技術や仕組みを考える。", example: "海で観測を続けられる機械は、どう作る？", method: "設計する · 作る", tags: ["設計", "実験", "プログラミング"], learning: "海の条件を考慮しながら、機械やシステムを設計して確かめる。", related: "information", relation: "違う対象でも、方法でつながる", reason: "観測機器の制御やデータ処理を考えると、情報分野との接点が見えてきます。個別の授業・研究で扱う内容は確認が必要です。", opportunity: "制作・設計の体験" },
  information: { name: "情報科学", question: "仕組みを考えて動かしたい", summary: "情報を扱う仕組みを考え、課題を解く方法を探る。", example: "ゲームのキャラクターを、キーを押した方向へ動かすには？", method: "組み立てる · 分析する", tags: ["プログラミング", "モデル化", "データ分析"], learning: "情報の表し方や処理の方法を学び、問題を分解して考える。", related: "engineering", relation: "方法を別の現場へ持っていく", reason: "データ処理や制御の方法は、海を対象にした技術を考える入口にもなります。", opportunity: "プログラミングの体験" },
  design: { name: "デザイン", question: "使いやすさを考えたい", summary: "使う人や状況を理解し、形や体験を考える。", example: "はじめての人でも使える道具にするには？", method: "観察する · 試作する", tags: ["観察", "試作", "表現"], learning: "人の行動や課題を調べ、試作と検証で改善する。", related: "information", relation: "技術を、使う人の体験へつなぐ", reason: "情報を扱う仕組みを、どう使い、どう理解するかという気になることで接点があります。", opportunity: "観察・試作の体験" }
};
const topics = {
  sea: { label: "海・生き物", root: "海が好き", ids: ["ecology", "environment", "engineering"], title: "「海が好き」の、その先。" },
  making: { label: "技術・ものづくり", root: "仕組みを作りたい", ids: ["engineering", "information", "design"], title: "「作ってみたい」の、その先。" },
  observing: { label: "人・暮らしを観察", root: "なぜ？を見つけたい", ids: ["design", "ecology", "environment"], title: "「なぜ？」から、広がる学び。" }
};
const opportunities = {};
const exampleNames = {
  ecology: ["海岸の生き物観察会", "生態を知る公開講座", "生物部", "地域の生き物調査", "探究に取り組む高校A", "生態を研究する大学B"],
  environment: ["水辺の環境調査体験", "環境を知る公開講座", "環境科学部", "地域の水質調査", "環境探究のある高校A", "環境を研究する大学B"],
  engineering: ["観測装置づくり体験", "海の技術の公開講座", "ものづくり部", "地域の制作プロジェクト", "技術を学ぶ高校A", "海の技術を研究する大学B"],
  information: ["データ分析の体験会", "情報を知る公開講座", "情報研究部", "学外のプログラミング活動", "情報探究のある高校A", "情報を研究する大学B"],
  design: ["観察と試作の体験会", "デザインの公開講座", "デザイン部", "地域の制作活動", "表現を学ぶ高校A", "デザインを研究する大学B"]
};
for (const [domainId, names] of Object.entries(exampleNames)) {
  const d = domains[domainId];
  const base = { domain: domainId, example: true };
  const records = [
    {type:"event",group:"try",kind:"イベント",name:names[0],summary:`${d.tags[0]}を体験し、自分が面白いと感じるか確かめる。`,reason:`${d.name}で使う「${d.tags[0]}」という方法を、短い体験で知る入口です。`,conditions:[["対象","中学生向けを想定"],["開催","日程・地域・料金は未設定"],["主催","地域の活動団体を想定"]]},
    {type:"lecture",group:"try",kind:"公開講座",name:names[1],summary:`${d.example}という気になることに触れる。`,reason:`研究の気になることを聞くことで、${d.name}の内容を知る入口です。`,host:`${domainId}-university`,conditions:[["対象","中高生向けを想定"],["開催","日程・参加条件は未設定"],["主催","大学B（架空）"]]},
    {type:"club",group:"continue",kind:"校内・部活動",name:names[2],summary:`${d.tags.slice(0,2).join('・')}を、仲間と継続して取り組む。`,reason:`${d.name}に関わる方法を、日常の活動として試す想定です。`,host:`${domainId}-school`,conditions:[["所属","高校A（架空）の校内部活動"],["参加","この高校の在校生を想定"],["頻度","活動日・兼部条件は未設定"]]},
    {type:"community",group:"continue",kind:"学外・継続活動",name:names[3],summary:`学校外の仲間と、${d.tags[0]}を続ける。`,reason:"進学先とは別に、興味を継続できる場所の例です。学校との両立条件は確認が必要です。",conditions:[["対象","中高生向けを想定"],["頻度","活動日・地域・料金は未設定"],["所属","学校に所属しない活動の例"]]},
    {type:"school",group:"study",kind:"高校・進学",name:names[4],summary:`授業・探究と、${names[2]}の活動から学ぶ。`,reason:`${d.name}への関心を、授業と課外活動の両方で育てる学校の例です。`,child:`${domainId}-club`,conditions:[["学校","高校A（架空）"],["内容","授業・探究・部活動の掲載例"],["入学","地域・学科・出願条件は未設定"]]},
    {type:"university",group:"study",kind:"大学・進学",name:names[5],summary:`${d.learning}`,reason:"学科名だけでなく、研究する気になることや方法から大学を知る入口です。",child:`${domainId}-lecture`,conditions:[["大学","大学B（架空）"],["内容","学科・研究テーマの掲載例"],["入学","履修・出願条件は未設定"]]}
  ];
  for (const record of records) opportunities[`${domainId}-${record.type}`] = {...base,...record};
}
Object.assign(domains, extraDomains);
Object.assign(topics, extraTopics);
topics.sea.keywords = ['海','うみ','魚','さかな','生き物','生物','水族館','深海'];
Object.assign(opportunities, liveOpportunities);
const getItem = (id) => domains[id] || opportunities[id];
const savedDomains = () => [...state.saved].filter(id => Boolean(domains[id]));
const allRouteIds = () => routeDomains().flatMap(id => routesForDomain(id, domains[id]).map(route => route.id));
const heldRouteList = () => routeDomains().flatMap(id => routesForDomain(id, domains[id]).filter(route => state.heldRoutes.has(route.id)));

const state = { topic: "sea", selected: "ecology", view: "learn", page: "home", filter: "all", opportunity: null, saved: new Set(), notes: {}, reflections: {}, personalMap:emptyPersonalMap(), compare: ["ecology", "environment"], heldRoutes: new Set(), sharing: {visibility:{},recommendations:[]} };
// 機能5：このプロトタイプには保護者アカウントも共有導線も出さない。サーバー側の実装はfamily-api.mjsに残してあるが、UIからは到達できない。
const FAMILY_SHARING_ENABLED = false;
history.scrollRestoration='manual';
window.addEventListener('pageshow',()=>requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'})));
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let toastTimer;
let persistenceEnabled = false;
let storageWarning = '';
let lineFrame;
let routeStarted = false;
let renderedPage = null;
let searchQuery = '';
let searchFilter = 'all';
let savedTab = 'candidates';
let savedQuery = '';
let savedFilter = 'all';
const expandedSaved = new Set();
const selectedCandidates = new Set();
let integrationContext = null;
let compactGroup = 'try';
let routeDomain = 'ecology';
let remoteFamily = null;
let remoteBusy = false;
let remoteMessage = '';
let remoteInvitation = null;
let sharingRevision = 0;
let personalSelected='root';
let journeyMode='map';
let roomPreview=null;
let studioTab='discover';
let studioEntrances=false;
let studioCustom=false;
let studioMobileView='map';
let studioAdded=null;
let inquiryParent='root';
let inquiryReturn=null;
const comparisonDrafts={};
const inquiryDrafts={};
const assessmentDrafts={};
let studioQuery='';
let studioFilter='all';
const collapsedBranches=new Set();
const personalUndo=[];
const personalDrafts={};
const personalObserver=new ResizeObserver(()=>requestAnimationFrame(drawPersonalLines));
const compactMedia = window.matchMedia('(max-width: 600px)');
const lineObserver = new ResizeObserver(() => scheduleConnections());

function scheduleConnections() {
  cancelAnimationFrame(lineFrame);
  lineFrame = requestAnimationFrame(() => {
    const canvas = document.querySelector('.tree-canvas');
    if (canvas && state.page === 'explore') drawTreeConnections(canvas, state.anchor);
  });
}

function saveWorkspace() {
  if (!persistenceEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEY, encodeWorkspace(state));
    storageWarning = '';
  } catch (error) {
    persistenceEnabled = false;
    storageWarning = '保存できませんでした。この画面の記録は残っています。空き容量やブラウザの保存設定を確認してください。';
    console.error('Workspace write failed:', error.name);
    notify(storageWarning);
  }
  updateStorageStatus();
}

function updateStorageStatus() {
  $('storage-shortcut').textContent = persistenceEnabled ? '端末保存：オン' : '端末保存：オフ';
  document.querySelector('.session-note').textContent = persistenceEnabled ? 'このブラウザに保存しています' : '記録はこの画面を開いている間だけ';
  $('storage-status').textContent = storageWarning || (persistenceEnabled ? '保存中 · 次回はこの続きから' : '端末への保存はオフ');
  $('storage-status').classList.toggle('storage-error', Boolean(storageWarning));
  if ($('save-on-device')) $('save-on-device').checked = persistenceEnabled;
  if ($('welcome-save-message')) $('welcome-save-message').textContent=persistenceEnabled?'このブラウザに記録しています。次回もここから再開できます。':'保存がオフの間は、ページを閉じたり更新したりすると記録が消えます。';
  if ($('welcome-save-device')) $('welcome-save-device').checked=persistenceEnabled;
  if ($('personal-save-device')) $('personal-save-device').checked = persistenceEnabled;
  if ($('saved-persistence-note')) $('saved-persistence-note').textContent = persistenceEnabled ? 'このブラウザに保存しています。' : '再読み込みすると記録は消えます。';
}

function restoreWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      Object.assign(state, decodeWorkspace(raw, {items:{...domains,...opportunities},domains,opportunities,topics,routes:allRouteIds()}));
      persistenceEnabled = true;
    }
  } catch (error) {
    storageWarning = '保存データを読み込めませんでした。元のデータは変更していません。';
    console.error('Workspace restore failed:', error.name);
  }
}

function storageControls() {
  return `<section class="storage-controls" aria-label="端末への保存"><div><label class="storage-switch"><input id="save-on-device" type="checkbox" ${persistenceEnabled?'checked':''}>このブラウザに記録を残す</label><p>自分のマップ・気になるもの・自分用メモ・見返す経路・探索位置を、このブラウザだけに保存します。サーバーには送りません。同じブラウザを使う人が開ける場合があります。</p><p id="saved-persistence-note"></p></div><button class="text-button" id="clear-workspace">このブラウザの記録を削除</button></section>`;
}


function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
}

function rememberViewed(source) {
  const item=getItem(source);if(!item) return;
  state.progress ||= emptyProgress();
  state.progress.visited=[source,...(state.progress.visited || state.progress.recent.filter(entry=>entry.source).map(entry=>entry.source)).filter(id=>id!==source)].slice(0,100);
  if(state.progress.recent[0]?.action==='viewed' && state.progress.recent[0]?.source===source) return;
  state.progress.recent.unshift({title:item.name.slice(0,80),source,action:'viewed',at:new Date().toISOString()});
  state.progress.recent=state.progress.recent.slice(0,5);
}

function render() {
  const route = state.page === 'explore' ? '#map' : `#${state.page}`;
  if (location.hash !== route) {
    history[routeStarted ? 'pushState' : 'replaceState']({page:state.page}, '', route);
  }
  routeStarted = true;
  $('main-content').dataset.route = state.page;
  document.title = `${state.page === 'home' ? '好きから始める' : state.page === 'personal' ? '自分のマップ' : state.page === 'saved' ? '気になるもの' : state.page === 'routes' ? '進み方を見る' : '学びの地図'} — シンボク`;
  const topic = topics[state.topic];
  $("interests").innerHTML = Object.entries(topics).map(([id, item]) => `<button class="interest ${id === state.topic ? "active" : ""}" data-topic="${id}" aria-pressed="${id === state.topic}">${item.label}</button>`).join("");
  $("saved-count").textContent = state.saved.size + (FAMILY_SHARING_ENABLED ? state.sharing.recommendations.filter(item => item.status === "kept").length : 0);
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === state.page);
    if (button.dataset.page === state.page) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("page-title").textContent = state.page === "home" ? "探す" : state.page === "explore" ? topic.title : "気になる";
  $("breadcrumb").textContent = state.page === "home" ? "シンボク / 探索の入口" : state.page === "explore" ? `学びの地図 / ${topic.label}` : "自分のスペース / 気になるもの";
  $("intro").textContent = state.page === "home" ? "学校も、部活も、学校の外も。興味からつながりを見つけよう。" : state.page === "explore" ? "同じ「好き」から、違う気になることや学び方が広がっています。" : "あとで調べる気になるものを置く場所です。選んだ気になるものは、自分のマップへまとめて追加できます。";
  if(state.page==='personal') {
    $('page-title').textContent='自分のマップ';
    $('breadcrumb').textContent='MY INQUIRY / 自分のマップ';
    $('intro').textContent='興味のある情報を集めて、自分に合う選択肢を考えよう。';
  }
  if(state.page==='routes') {
    $('page-title').textContent='進み方を見る';
    $('breadcrumb').textContent=`学問から逆に引く / ${domains[routeDomain].name}`;
    $('intro').textContent='同じ学問にたどり着く道は、1本ではありません。高校の段階で決まることが、経路ごとに違います。';
  }
  $('routes-page').hidden=state.page!=='routes';
  $('personal-page').hidden=state.page!=='personal';
  $("home-page").hidden = state.page !== "home";
  document.querySelector(".side-section").hidden = state.page !== "explore";
  $("explore-page").hidden = state.page !== "explore";
  $("saved-page").hidden = state.page !== "saved";
  $("learn-tab").setAttribute("aria-pressed", String(state.view === "learn"));
  $("places-tab").setAttribute("aria-pressed", String(state.view === "places"));
  $("view-caption").textContent = state.view === "learn" ? "まずは、気になる気になることを選ぶ" : `${domains[state.selected].name}から、具体的な機会へ`;
  renderMap();
  renderDetail();
  if (FAMILY_SHARING_ENABLED) renderRelatedRecommendations();
  $('detail-panel').insertAdjacentHTML('beforeend',`<div class="personal-add-action"><button class="secondary block" data-map-import="${state.opportunity || state.selected}">つながりごと自分のマップへ →</button></div>`);
  if(state.page==='personal') renderPersonalMap();
  if (state.page === 'routes') renderRoutesPage();
  if (state.page === "saved") renderSaved();
  if (state.page === "home") renderHome();
  saveWorkspace();
  updateStorageStatus();
  if(renderedPage!==state.page) {
    renderedPage=state.page;
    window.scrollTo({top:0,behavior:'instant'});
    $('page-title').setAttribute('tabindex','-1');
    $('page-title').focus({preventScroll:true});
  }
}

function renderSearchResults() {
  const found = searchCatalog(searchQuery,topics,domains,liveOpportunities,searchFilter);
  $('search-count').textContent = `${found.length}件 · 掲載範囲内の検索です`;
  $('search-results').innerHTML = found.length ? found.map(item=>`<button class="search-result" ${item.type==='topic'?`data-topic="${item.id}"`:item.type==='domain'?`data-domain="${item.id}"`:`data-opportunity="${item.id}"`} data-search-result="true"><span class="search-result-type">${item.type==='topic'?'興味の入口':item.type==='domain'?'学びの領域':item.resource.kind}</span><strong>${item.name}<span>↗</span></strong><p>${item.summary}</p>${item.resource?.online && item.resource?.free?'<small>自宅で · 無料</small>':''}</button>`).join('') : `<div class="search-empty"><h3>この言葉では、まだ見つかりませんでした。</h3><p>掲載していない分野もあります。「ゲーム」「料理」「ギター」など短い言葉で試すか、条件を外してみてください。</p><button class="secondary" id="reset-search">すべての入口を見る</button></div>`;
}

function renderRoutesPage() {
  const domain = domains[routeDomain];
  const picker = `<div class="route-picker" aria-label="学問を選ぶ"><span class="subtle">学問から引く：</span>${routeDomains().map(id=>`<button data-route-domain="${id}" aria-pressed="${id===routeDomain}">${escapeHtml(domains[id].name)}</button>`).join('')}</div>`;
  $('routes-page').innerHTML = picker + renderRoutes({domainId:routeDomain,domain,saved:state.heldRoutes,checkedOn:ROUTES_CHECKED_ON});
}

function openRoutes(domainId) {
  if (!hasRoutes(domainId)) { notify('この学問の経路はまだ掲載していません'); return; }
  routeDomain = domainId;
  state.page = 'routes';
  render();
}

function routeEntry(domainId) {
  if (!hasRoutes(domainId)) return '';
  const count = routesForDomain(domainId, domains[domainId]).length;
  return `<button class="secondary block route-entry" data-routes="${domainId}">${escapeHtml(domains[domainId].name)}にたどり着く道を見る（${count}本）↟</button>`;
}

function renderHome() {
  const hasHistory = persistenceEnabled || state.saved.size > 0;
  $('home-page').innerHTML = `
    <section class="discovery-search" aria-label="興味や学びを検索"><label for="interest-search">いま、何が気になる？</label><form id="interest-search-form"><input id="interest-search" type="search" maxlength="100" value="${escapeHtml(searchQuery)}" placeholder="ゲーム、料理、ギター、海の生き物…" autocomplete="off"><button class="primary" type="submit">探す →</button></form><div class="quick-interests">${['games','cooking','music','sea'].map(id=>`<button data-topic="${id}">${topics[id].label} ↗</button>`).join('')}</div><div class="route-picker route-entry" aria-label="学問から進み方を引く"><span class="subtle">学問から高校までを逆に引く：</span>${routeDomains().map(id=>`<button data-routes="${id}">${escapeHtml(domains[id].name)} ↟</button>`).join('')}</div><div class="discovery-filters" aria-label="探す情報の条件">${[['all','すべて'],['home','自宅で・無料'],['activity','体験・活動'],['study','高校・大学']].map(([id,label])=>`<button data-search-filter="${id}" aria-pressed="${searchFilter===id}">${label}</button>`).join('')}</div>${hasHistory ? `<section class="workspace-shortcuts" aria-label="続きから開く"><button data-page="explore"><small>最近見た領域</small><strong>${domains[state.selected].name} →</strong></button><button data-page="saved"><small>保存した気になるもの</small><strong>${state.saved.size}件の気になる →</strong></button><button data-page="personal"><small>自分でつなげる</small><strong>自分のマップ →</strong></button></section>` : ''}<p class="search-count" id="search-count" role="status"></p><div id="search-results" class="search-results"></div></section><p class="catalog-note">現在は${Object.keys(domains).length}領域・${Object.keys(liveOpportunities).length}件の公式情報を掲載。学校や活動を網羅した一覧ではありません。領域のつながりは、気になること・方法・内容をもとに編集しています。</p>`;
  renderSearchResults();
}

function renderLiveDetail(item) {
  const target = item.host || item.child;
  const dateLabel = item.date ? (new Date(`${item.date}T23:59:59+09:00`) < new Date() ? '開催日を過ぎています。次回開催は公式案内へ。' : `${item.date.replaceAll('-','/')} 開催予定・受付状況は公式案内へ`) : '';
  $('detail-panel').innerHTML = `<div class="detail-head"><p class="eyebrow">${item.kind}</p><h2>${item.name}</h2><p>${item.summary}</p></div><div class="detail-body">${dateLabel ? `<p class="resource-date">${dateLabel}</p>`:''}<section class="detail-block"><h3>興味と、どうつながる？</h3><p class="quote">${item.reason}</p><p class="subtle">関連づけはシンボクの編集です。</p></section>${item.step ? `<section class="first-step"><span>まず、これだけ</span><p>${item.step}</p></section>`:''}<section class="detail-block"><h3>開く前に知っておくこと</h3><dl class="op-conditions">${item.conditions.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl></section><a class="primary block external-action" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.group==='study'?'学ぶ内容を公式サイトで見る':item.type==='event'?'実施要項・参加条件を見る':'内容を公式サイトで見る'} ↗</a><p class="source-caption">${item.source} · 確認 ${item.checkedOn}<br>新しいタブで開きます。ここから申し込みは行いません。</p><button class="secondary block" data-save="${state.opportunity}" aria-pressed="${state.saved.has(state.opportunity)}">${state.saved.has(state.opportunity)?'✓ 気になるに追加済み':'＋ 気になるに置く'}</button>${Object.values(liveOpportunities).filter(other=>other.type===item.type).length>1?`<button class="text-button resource-compare-action" data-resource-compare="${state.opportunity}">同じ種類の気になるものと比べる ↔</button>`:''}${reflectionControl(state.opportunity)}${target?`<section class="detail-block"><h3>学校と活動のつながり</h3><button class="affiliation-link" data-opportunity="${target}"><span>${opportunities[target].kind}<strong>${opportunities[target].name}</strong></span><span>→</span></button></section>`:''}<section class="detail-block"><h3>別の領域からも見る</h3><div class="tags">${item.domains.map(id=>`<button class="tag" data-related="${id}">${domains[id].name} ↗</button>`).join('')}</div></section></div>`;
}


const neighbors = {
  ecology: [["environment", "同じ環境を扱う"], ["information", "観測記録を分析する"]],
  environment: [["ecology", "生き物との関係を探る"], ["engineering", "環境を測る技術を作る"]],
  engineering: [["information", "制御・データ処理を使う"], ["design", "使う人の視点を重ねる"]],
  information: [["engineering", "現場の技術へ応用する"], ["design", "情報を人に伝える"]],
  design: [["information", "情報の伝え方を考える"], ["ecology", "観察という方法を共有する"]]
};

Object.assign(neighbors, extraNeighbors);

function renderMap() {
  if(compactMedia.matches) {renderCompactMap();return;}
  const previousScroll = document.querySelector('.tree-scroll')?.scrollLeft;
  const topic = topics[state.topic];
  const current = domains[state.selected];
  const expanded = state.view === "places";
  const rows = Math.max(2,...['try','continue','study'].map(group=>Object.values(liveOpportunities).filter(item=>item.domains.includes(state.selected) && item.group===group).length));
  const growth = (rows-2)*145+60;
  const treeHeight = expanded ? 1090 + growth : 680;
  const xs = [145, 380, 615];
  if (topic.ids.includes(state.selected)) state.anchor = state.selected;
  $("map-content").innerHTML = `
    <div class="map-top"><p class="eyebrow">YOUR TREE OF POSSIBILITIES</p><span class="tree-instruction">枝を選ぶと、近い領域が広がる</span></div>
    <div class="tree-legend"><span><i class="solid-sample"></i>興味からの枝分かれ</span><span><i class="dashed-sample"></i>領域をまたぐつながり</span></div>
    <div class="tree-scroll" tabindex="0" role="region" aria-label="樹形図。狭い画面では横にスクロールできます">
      <div class="tree-canvas ${expanded ? "has-opportunities" : ""}" style="height:${treeHeight}px;--branch-growth:${growth}px">
        <div class="tree-band"><span>興味から、学びをほどく</span></div>
        <svg class="tree-lines" style="height:${treeHeight}px" aria-hidden="true"></svg>
        <div class="tree-root" id="tree-root"><small>いまの興味</small><strong>${topic.root}</strong></div>
        ${topic.ids.map((id,index) => {const d=domains[id]; return `
          <div class="tree-question" id="question-${id}" style="--x:${xs[index]/7.6}%">${topic.questions?.[id] || d.question}</div>
          <button id="branch-${id}" class="tree-domain ${state.selected===id ? "selected" : ""}" style="--x:${xs[index]/7.6}%" data-domain="${id}" aria-pressed="${state.selected===id}"><small>学びの領域</small><strong>${d.name}</strong><span aria-hidden="true">↗</span></button>
          <div class="tree-leaves" id="leaves-${id}" style="--x:${xs[index]/7.6}%">${d.tags.slice(0,2).map((tag,index)=>`<span id="leaf-${id}-${index}">${tag}</span>`).join("")}</div>
        `;}).join("")}
        ${expanded ? renderOpportunityBranches() : `<button class="open-branches" id="expand-branches" aria-expanded="false">${current.name}から、イベント・部活・進学先を見る ＋</button>`}
        <div class="near-landscape" aria-hidden="true"></div>
        <div class="near-heading"><span>NEARBY FIELDS</span><strong>この枝から、隣の領域へ</strong></div>
        <button id="near-focus" class="near-focus" data-domain="${state.selected}"><small>いま見ている学び</small><strong>${current.name}</strong></button>
        ${neighbors[state.selected].map(([id,reason],index)=>`<div class="near-group ${index===0 ? "near-left" : "near-right"}"><button id="near-node-${id}" class="near-node" data-related="${id}"><small>${topic.ids.includes(id)?"別の枝ともつながる":"新しい領域へ"}</small><strong>${domains[id].name} <span aria-hidden="true">↗</span></strong></button><p>${reason}</p><button class="near-compare" data-compare="${state.selected},${id}">違いを見る</button></div>`).join("")}
        <p class="near-footnote">対象が近い。方法が似ている。つながり方も、ひとつではありません。</p>
      </div>
    </div><div class="tree-mobile-hint">↔ 樹形図は横に動かして見られます</div>`;
  const scroller = document.querySelector('.tree-scroll');
  scroller.scrollLeft = previousScroll ?? Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
  lineObserver.disconnect();
  const canvas = document.querySelector('.tree-canvas');
  lineObserver.observe(canvas);
  canvas.querySelectorAll('.tree-root, .tree-domain, .tree-question, .tree-leaves span, .op-root, .op-column, .op-node, .near-focus, .near-node').forEach(node => lineObserver.observe(node));
  scheduleConnections();
}

function renderCompactMap() {
  const topic=topics[state.topic], current=domains[state.selected];
  if(topic.ids.includes(state.selected)) state.anchor=state.selected;
  if(!topic.ids.includes(state.anchor)) state.anchor=topic.ids[0];
  const groups=[['try','まず触れる'],['continue','続ける'],['study','進学する']];
  const resources=Object.entries(liveOpportunities).filter(([,item])=>item.domains.includes(state.selected));
  $('map-content').innerHTML=`<div class="compact-map tree-canvas" data-layout="compact"><svg class="tree-lines" aria-hidden="true"></svg><p class="compact-instruction">同じ「好き」から、3つの見方。</p><div class="compact-root" id="compact-root">${topic.root}</div><div class="compact-branches">${topic.ids.map(id=>`<button class="compact-branch ${state.selected===id?'selected':''}" id="compact-branch-${id}" data-domain="${id}" data-compact-select="true" aria-pressed="${state.selected===id}"><span>${topic.questions?.[id] || domains[id].question}</span><strong>${domains[id].shortName || domains[id].name}</strong></button>`).join('')}</div><section class="compact-focus" id="compact-focus"><p>${topic.ids.includes(state.selected)?'選んだ枝':`${domains[state.anchor].name}から広がる領域`}</p><h2>${current.name}</h2><p>${current.summary}</p><button class="text-button" data-domain="${state.selected}">どんな学び？ 詳細を見る ↗</button></section>
    <section class="compact-opportunities" aria-label="選んだ学びから試せること"><h3 id="compact-options">${current.name}から、できること</h3><div class="compact-tabs" aria-label="機会の種類">${groups.map(([id,label])=>`<button data-compact-group="${id}" aria-pressed="${compactGroup===id}">${label}<small>${resources.filter(([,item])=>item.group===id).length}</small></button>`).join('')}</div><div class="compact-candidates">${resources.filter(([,item])=>item.group===compactGroup).map(([id,item])=>`<button class="compact-candidate" data-opportunity="${id}"><span>${item.kind}${item.online && item.free?' · 自宅で無料':''}</span><strong>${item.name} ↗</strong><p>${item.summary}</p></button>`).join('') || '<p class="op-empty">この種類の情報はまだ掲載していません。別の種類も見てみよう。</p>'}</div></section>
    <section class="compact-near"><p>この学びの、すぐとなり。</p><div class="compact-near-anchor" id="compact-near-anchor">${current.name}</div><div class="compact-near-grid">${neighbors[state.selected].map(([id,reason])=>`<div><button id="compact-near-${id}" data-related="${id}" data-compact-select="true"><strong>${domains[id].name} ↗</strong><span>${reason}</span></button><button class="text-button" data-compare="${state.selected},${id}">違いを比べる</button></div>`).join('')}</div></section></div>`;
  lineObserver.disconnect();
  const canvas=document.querySelector('.compact-map');
  lineObserver.observe(canvas);
  canvas.querySelectorAll('.compact-root,.compact-branch,.compact-focus,.compact-near-anchor,.compact-near-grid button').forEach(node=>lineObserver.observe(node));
  scheduleConnections();
}
compactMedia.addEventListener('change',()=>{renderMap();});

function renderDetail() {
  if (state.opportunity) { renderOpportunityDetail(); return; }
  const d = domains[state.selected];
  const saved = state.saved.has(state.selected);
  $("detail-panel").innerHTML = `<div class="detail-head"><p class="eyebrow">SELECTED FIELD / 選んだ学び</p><h2>${d.name}</h2><p>${d.summary}</p></div><div class="detail-body"><section class="detail-block"><h3>たとえば、こんな気になること</h3><p class="quote">${d.example}</p></section><section class="detail-block"><h3>どんなことをする？</h3><div class="tags">${d.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div><p style="margin-top:10px">${d.learning}</p></section><section class="detail-block"><h3>となりの学び</h3><button class="related-button" data-related="${d.related}"><span>${domains[d.related].name}<small>${d.relation}</small></span><span aria-hidden="true">→</span></button><details class="evidence"><summary>なぜ、この2つがつながる？</summary><p>${d.reason}</p><p>気になることや方法から見たつながりです。必修科目や、進学に必要な順路ではありません。</p></details></section><div class="detail-actions"><button class="primary block" id="show-places">学べる・試せる場所を見る ↗</button>${routeEntry(state.selected)}<button class="secondary block" data-save="${state.selected}" aria-pressed="${saved}">${saved ? "✓ 気になるに追加済み" : "＋ 気になるに置く"}</button></div><details class="evidence"><summary>説明と情報源について</summary><p>分野の説明と関係はシンボクの編集です。学ぶ範囲は学校・教材ごとに異なります。具体的な内容はこちらで確認できます。</p>${Object.values(liveOpportunities).filter(item=>item.domains.includes(state.selected)).slice(0,2).map(item=>`<a class="domain-source" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name} ↗<br><small>${item.source} · 確認 ${item.checkedOn}</small></a>`).join('')}</details></div>`;
}

function renderOpportunityBranches() {
  const groups = [["try","今、触れてみる","短い体験から"],["continue","続けて取り組む","日常の活動に"],["study","進学して学ぶ","学ぶ環境を選ぶ"]];
  const selected = opportunities[state.opportunity];
  const linked = selected?.host || selected?.child;
  return `<section class="op-tree" aria-label="学びから広がるイベント・活動・進学先"><div class="op-root" id="op-root"><strong>${domains[state.selected].name}</strong><span>から、実際の選択肢へ</span><button id="collapse-branches" aria-label="機会の枝を閉じる" aria-expanded="true">−</button></div>${groups.map(([group,title,caption],index)=>`<div class="op-column" style="--x:${[145,380,615][index]/7.6}%"><h3 id="op-heading-${group}">${title}</h3><p class="op-caption" id="op-caption-${group}">${caption}</p><div class="op-nodes">${Object.entries(liveOpportunities).filter(([,item])=>item.domains.includes(state.selected) && item.group===group).map(([id,item])=>`<button id="op-node-${id}" data-opportunity="${id}" class="op-node ${state.opportunity===id?'selected':''} ${linked===id?'associated':''}" aria-pressed="${state.opportunity===id}"><span class="op-kind">${item.kind}</span><strong>${item.name}</strong><small>${item.online && item.free?'自宅で・無料':item.host?'所属・主催もたどれる':item.child?'関連する活動もある':'内容・条件を見る'} ↗</small>${linked===id?'<span class="association-label">選択中の気になるものとの関係</span>':''}</button>`).join('') || '<p class="op-empty">この枝の情報はまだ掲載していません</p>'}</div></div>`).join('')}<p class="op-tree-note">掲載は選択肢の一部です。参加・入学の条件は各公式ページで確認してください。</p></section>`;
}

function renderOpportunityDetail() {
  const id = state.opportunity;
  const item = opportunities[id];
  if (!item.example) { renderLiveDetail(item); return; }
  const target = item.host || item.child;
  const reference = ['lecture','university'].includes(item.type) ? ['https://www.kaiyodai.ac.jp/faculty/','参考：実在する大学の学部紹介'] : ['https://www.jst.go.jp/cpse/stella/','参考：JSTの学外学習事業'];
  $("detail-panel").innerHTML = `<div class="detail-head"><button class="text-button" id="back-to-domain">← ${domains[item.domain].name}に戻る</button><p class="eyebrow" style="margin-top:14px">${item.kind} / 掲載イメージ</p><h2>${item.name}</h2><p>${item.summary}</p></div><div class="detail-body"><section class="detail-block"><h3>この学びと、どうつながる？</h3><p class="quote">${item.reason}</p></section><section class="detail-block"><h3>参加・進学の前に知りたいこと</h3><dl class="op-conditions">${item.conditions.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl></section>${target?`<section class="detail-block"><h3>${item.host?(item.type==='club'?'この部活がある学校':'この講座を開く大学'):'ここでできる活動'}</h3><button class="affiliation-link" data-opportunity="${target}"><span>${opportunities[target].kind}<strong>${opportunities[target].name}</strong></span><span>→</span></button><p class="op-note">${item.type==='club'?'活動から学校を知ることもできます。':item.type==='lecture'?'主催の関係です。参加が入学につながることを意味しません。':'学校と活動は、所属・主催の関係でつながっています。'}</p></section>`:''}<button class="secondary block" data-save="${id}" aria-pressed="${state.saved.has(id)}">${state.saved.has(id)?'✓ 気になるに追加済み':'＋ この気になるものを気になるに置く'}</button><details class="evidence"><summary>外部情報へのつなぎ方</summary><p>本番では、この気になるものの活動紹介・募集案内・授業内容へ直接つなぎます。架空の気になるもののため、個別の公式ページはありません。</p><a href="${reference[0]}" target="_blank" rel="noopener noreferrer">${reference[1]} ↗</a><p>上記は一般的な参考情報で、この架空の気になるものの公式ページではありません。</p></details></div>`;
}

function renderSaved() {
  const incoming=state.sharing.recommendations.filter(item=>item.status==='new').length;
  const tabs=[['candidates','気になるもの一覧'],...(FAMILY_SHARING_ENABLED?[['family',`保護者との共有${incoming ? ` · ${incoming}件の新着` : ''}`]]:[]),['settings','保存設定']];
  if(!FAMILY_SHARING_ENABLED && savedTab==='family') savedTab='candidates';
  $('saved-page').innerHTML=`<div class="saved-tabs" aria-label="気になるの表示">${tabs.map(([id,label])=>`<button data-saved-tab="${id}" aria-pressed="${savedTab===id}">${label}</button>`).join('')}</div><div id="saved-tab-content"></div>`;
  if(savedTab==='family') {$('saved-tab-content').innerHTML=sharingHub();return;}
  if(savedTab==='settings') {$('saved-tab-content').innerHTML=storageControls();return;}
  const held=heldRouteList();
  const heldMarkup=held.length?`<section class="held-routes" aria-label="見返す経路"><h2>見返す経路 <span class="count">${held.length}</span></h2><p class="subtle">学問から高校までの進み方です。決めた道ではありません。</p><div class="held-route-grid">${held.map(route=>`<article class="held-route"><span>${escapeHtml(domains[route.domain].name)}</span><h3>${escapeHtml(route.kindName)}</h3><p>必要な数学：${escapeHtml(route.math.label)}</p><p>高校の段階：${escapeHtml(route.steps.find(step=>step.stage==='highschool').title)}</p><div class="place-actions"><button class="secondary" data-routes="${route.domain}">経路を開く →</button><button class="text-button" data-route-hold="${route.id}">見返す経路から外す</button></div></article>`).join('')}</div></section>`:'';
  $('saved-tab-content').innerHTML=heldMarkup+`<div class="saved-tools"><label for="saved-search">気になるものを検索<input id="saved-search" type="search" value="${escapeHtml(savedQuery)}" placeholder="名前・内容・自分用メモ" maxlength="100"></label><label for="saved-filter">絞り込み<select id="saved-filter">${[['all','すべて'],['domain','学びの領域'],['activity','体験・活動'],['study','高校・大学'],['curious','もっと知りたい'],['tried','試してみた'],...(FAMILY_SHARING_ENABLED?[['family','共有する気になるもの']]:[])].map(([id,label])=>`<option value="${id}" ${savedFilter===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="saved-header"><p id="saved-result-count" role="status"></p><div class="place-actions"><button class="primary" id="integrate-saved">選んでまとめてマップへ</button><button class="secondary" id="compare-saved" ${savedDomains().length<2?'disabled':''}>学べることを並べて見る</button>${FAMILY_SHARING_ENABLED?`<button class="secondary" id="create-share" ${!state.saved.size?'disabled':''}>相談カードを作る</button>`:''}</div></div><div id="saved-results" class="saved-grid"></div>`;
  renderSavedResults();
}

function renderSavedResults() {
  const query=savedQuery.normalize('NFKC').toLocaleLowerCase().trim();
  const ids=[...state.saved].filter(id=>{
    const item=getItem(id);
    const matches=({all:true,domain:!!domains[id],activity:['try','continue'].includes(item.group),study:item.group==='study',curious:state.reflections[id]==='curious',tried:state.reflections[id]==='tried',family:state.sharing.visibility[id]==='family'})[savedFilter];
    return matches && `${item.name} ${item.summary} ${state.notes[id] || ''}`.normalize('NFKC').toLocaleLowerCase().includes(query);
  });
  for(const id of selectedCandidates) if(!state.saved.has(id)) selectedCandidates.delete(id);
  updateIntegrationSelection();
  $('saved-result-count').textContent=`${ids.length} / ${state.saved.size}件の気になるもの`;
  $('saved-results').innerHTML=ids.length ? ids.map(id=>{
    const d=getItem(id), feeling={curious:'もっと知りたい',tried:'試してみた',unsure:'まだピンとこない'}[state.reflections[id]];
    return `<article class="saved-card"><label class="candidate-pick"><input type="checkbox" data-pick-candidate="${id}" ${selectedCandidates.has(id)?'checked':''}>まとめて整理する気になるものに選ぶ</label><div class="candidate-meta"><span>${d.example?'旧モックの架空例 · ':''}${d.kind || '学びの領域'}</span><span>${FAMILY_SHARING_ENABLED?(state.sharing.visibility[id]==='family'?'共有する気になるもの':'自分だけ'):'自分だけ'}</span></div><h2>${d.name}</h2><p>${d.summary}</p>${feeling?`<span class="feeling-badge">${feeling}</span>`:''}<div class="candidate-actions"><button class="secondary" data-revisit="${id}">詳しく見る →</button><button class="text-button" data-map-import="${id}">マップに追加 ＋</button></div><details class="candidate-details" data-saved-details="${id}" ${expandedSaved.has(id)?'open':''}><summary>メモ・振り返り${FAMILY_SHARING_ENABLED?'・公開範囲':''}${state.notes[id]?' · メモあり':''}</summary>${FAMILY_SHARING_ENABLED?visibilityControl(id):''}${reflectionControl(id)}<label for="note-${id}">自分用メモ（共有されません）</label><textarea id="note-${id}" data-note="${id}" placeholder="気になった理由や、試した感想">${escapeHtml(state.notes[id] || '')}</textarea><button class="text-button" data-save="${id}">気になるものから外す</button></details></article>`;
  }).join('') : `<div class="empty"><h2>${state.saved.size?'条件に合う気になるものがありません':'気になったものを、ここに。'}</h2><p>${state.saved.size?'別の言葉や条件で探してみてください。':'学び・学校・活動の詳細から「気になるに置く」で残せます。'}</p>${state.saved.size?'<button class="secondary" id="reset-saved-search">絞り込みを解除</button>':'<button class="primary" data-page="home">興味から探す →</button>'}</div>`;
}

document.addEventListener('toggle',event=>{
  const id=event.target.dataset.savedDetails;
  if(id && event.target.isConnected) {if(event.target.open) expandedSaved.add(id);else expandedSaved.delete(id);}
},true);
document.addEventListener('input',event=>{if(event.target.id==='saved-search') {savedQuery=event.target.value;renderSavedResults();}});
document.addEventListener('change',event=>{if(event.target.id==='saved-filter') {savedFilter=event.target.value;renderSavedResults();}});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button) return;
  if(button.dataset.savedTab) {savedTab=button.dataset.savedTab;renderSaved();updateStorageStatus();document.querySelector(`[data-saved-tab="${savedTab}"]`).focus();}
  if(button.id==='reset-saved-search') {savedQuery='';savedFilter='all';renderSaved();$('saved-search').focus();}
});

function showCompare(first, second) {
  state.compareMode = 'domain';
  state.compare = [first, second];
  renderCompare();
  $("compare-content").insertAdjacentHTML('beforeend','<button class="primary block" id="integrate-comparison">比べた2つを一緒にマップへ</button>');
  $("compare-dialog").showModal();
}

function renderCompare() {
  if(state.compareMode === 'resource') {renderResourceCompare();return;}
  const [first, second] = state.compare;
  const a = domains[first], b = domains[second];
  const rows = [["知りたいこと", a.question,b.question],["気になることの例",a.example,b.example],["取り組み方",a.method,b.method],["学ぶこと",a.learning,b.learning]];
  $("compare-content").innerHTML = `<div class="compare-picker">${state.compare.map((selected,index)=>`<label>並べるもの ${index+1}<select data-compare-select="${index}">${Object.entries(domains).map(([id,d])=>`<option value="${id}" ${id===selected?"selected":""} ${id===state.compare[1-index]?"disabled":""}>${d.name}</option>`).join("")}</select></label>`).join("")}</div><table class="compare-table"><thead><tr><th scope="col">見るポイント</th><th scope="col">${a.name}</th><th scope="col">${b.name}</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th scope="row">${label}</th><td>${left}</td><td>${right}</td></tr>`).join("")}</tbody></table><p class="dialog-note">どちらが上かではなく、何が気になるかで見てみよう。内容はモック用の説明例です。</p><div class="place-actions">${[first,second].map(id=>`<button class="secondary" data-save="${id}" aria-pressed="${state.saved.has(id)}">${domains[id].name} ${state.saved.has(id)?"✓ 追加済み":"＋ 気になる"}</button>`).join("")}</div>`;
  $('compare-content').insertAdjacentHTML('beforeend','<button class="primary block" id="integrate-comparison">比べた2つを一緒にマップへ</button>');
}

function showShare() {
  $("share-content").innerHTML = `<p class="dialog-note">伝える気になるものだけ選べます。一言メモや他の気になるものは含めません。</p>${[...state.saved].map(id=>`<label class="share-option"><input type="checkbox" name="share-item" value="${id}"> ${getItem(id).name}</label>`).join("")}<label class="share-label" for="share-request">今、お願いしたいこと</label><select id="share-request" class="share-select"><option>まず、話を聞いてほしい</option><option>一緒に違いを調べたい</option><option>通学や費用を相談したい</option><option>体験への参加を相談したい</option></select><p class="dialog-note">まだ志望を決めたわけではない、と添えます。外部には送信しません。</p><button class="primary block" id="preview-share" disabled>選んだ内容を確認する →</button>`;
  $("share-dialog").showModal();
}

document.addEventListener("click", (event) => {
  if(event.target.closest('.skip-link')) {event.preventDefault();$('main-content').focus();return;}
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.close) { $(button.dataset.close).close(); return; }
  if (button.dataset.topic) { state.opportunity=null;state.topic=button.dataset.topic;state.selected=topics[state.topic].ids[0];state.page="explore";state.view="learn";state.filter="all";render();return; }
  if (button.dataset.page) { state.page=button.dataset.page;render();return; }
  if (button.dataset.routes) { openRoutes(button.dataset.routes); return; }
  if (button.dataset.routeDomain) { routeDomain=button.dataset.routeDomain; render(); return; }
  if (button.dataset.routeMath) { const panel=$(`route-math-${button.dataset.routeMath}`); panel.hidden=!panel.hidden; button.textContent=panel.hidden?'数学の中身をもう少し見る':'数学の説明を閉じる'; return; }
  if (button.dataset.routeHold) {
    const id=button.dataset.routeHold;
    if (state.heldRoutes.has(id)) { state.heldRoutes.delete(id); notify('見返す経路から外しました'); }
    else { state.heldRoutes.add(id); notify('この経路を、あとで見返せるようにしました'); }
    render();return;
  }
  if (button.dataset.opportunity) {
    state.opportunity=button.dataset.opportunity;state.selected=opportunities[state.opportunity].domains?.includes(state.selected) ? state.selected : opportunities[state.opportunity].domain;
    if (!topics[state.topic].ids.includes(state.selected) && button.dataset.searchResult) state.topic=Object.keys(topics).find(id=>topics[id].ids.includes(state.selected));
    state.page="explore";state.view="places";rememberViewed(state.opportunity || state.selected);render();
    showMobileDetail();
    return;
  }
  if (button.dataset.domain || button.dataset.related || button.dataset.revisit) {
    const id=button.dataset.domain || button.dataset.related || button.dataset.revisit;
    if(state.page==='personal' && button.dataset.revisit) {rememberViewed(id);roomPreview=id;renderPersonalMap();saveWorkspace();return;}
    state.opportunity=opportunities[id] ? id : null;
    state.selected=opportunities[id]?.domain || id;
    if((button.dataset.searchResult || button.dataset.revisit) && !topics[state.topic].ids.includes(state.selected)) state.topic=Object.keys(topics).find(id=>topics[id].ids.includes(state.selected));
    state.page="explore";state.view="places";rememberViewed(state.opportunity || state.selected);render();
    if(!button.dataset.compactSelect) showMobileDetail();
    else if(button.dataset.related) $('compact-focus').scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (button.dataset.save) {
    const id=button.dataset.save;
    sharingRevision++;
    if (state.saved.has(id)) {state.saved.delete(id);delete state.notes[id];delete state.reflections[id];delete state.sharing.visibility[id];notify("気になるものから外しました");} else {state.saved.add(id);notify("気になるものに置きました");}
    render();if($("compare-dialog").open) renderCompare();return;
  }
  if (button.dataset.compare) {showCompare(...button.dataset.compare.split(","));return;}
  if (button.id==="learn-tab" || button.id==="collapse-branches") {state.opportunity=null;state.view="learn";render();}
  if (button.id==="places-tab" || button.id==="show-places" || button.id==="expand-branches") {if($("detail-dialog").open) $("detail-dialog").close();state.view="places";state.filter="all";render();if(window.matchMedia("(max-width: 900px)").matches) (document.querySelector(".compact-opportunities") || document.querySelector(".op-tree")).scrollIntoView({behavior:"smooth",block:"start"});}
  if (button.id==="back-to-domain") {state.opportunity=null;render();}
  if (button.id==="reset-view") {state.opportunity=null;state.selected=topics[state.topic].ids[0];state.view="learn";render();}
  if (button.id==="compare-saved") {showCompare(...savedDomains().slice(0,2));}
  if (button.id==="create-share") showShare();
  if (button.id==='clear-workspace') {
    $('delete-message').textContent = 'このブラウザの自分のマップ・気になるもの・メモ・見返す経路・探索位置をすべて削除します。この操作は元に戻せません。';
    $('confirm-delete').dataset.mode = 'all';
    $('delete-dialog').showModal();
  }
  if (button.id==='confirm-delete') {
    try { localStorage.removeItem(STORAGE_KEY); }
    catch(error) { console.error('Workspace removal failed:',error.name); notify('削除できませんでした。記録は変更していません。'); return; }
    persistenceEnabled = false;
    storageWarning = '';
    if (button.dataset.mode === 'all') {
      for(const cache of [inquiryDrafts,assessmentDrafts,comparisonDrafts]) for(const id of Object.keys(cache)) delete cache[id];inquiryReturn=null;state.progress=emptyProgress();state.saved.clear();state.personalMap=emptyPersonalMap();personalUndo.length=0;for(const id of Object.keys(personalDrafts)) delete personalDrafts[id];personalSelected='root';state.notes={};state.reflections={};state.heldRoutes.clear();state.sharing={visibility:{},recommendations:[]};state.topic='sea';state.selected='ecology';state.anchor='ecology';state.opportunity=null;state.view='learn';
    }
    $('delete-dialog').close();render();notify(button.dataset.mode === 'all' ? '記録を削除しました' : '端末への保存をオフにしました。この画面では続けられます。');
  }
  if (button.id==="preview-share") {
    const ids=[...document.querySelectorAll('input[name="share-item"]:checked')].map(input=>input.value);
    if(!ids.length) return;
    const request=$("share-request").value;
    $("share-content").innerHTML=`<article class="conversation-card"><p class="eyebrow">今、ちょっと気になっていること</p><h3>${ids.map(id=>getItem(id).name).join("と")}</h3><p>まだ志望を決めたわけではないけど、もう少し知りたいと思っています。</p><hr><p><strong>お願いしたいこと</strong><br>${escapeHtml(request)}</p><p class="subtle">申し込みなどを進める前に、相談してほしいです。</p></article><p class="dialog-note">このカードを同じ端末で見せられます。外部送信は行いません。</p><button class="secondary block" id="edit-share">内容を選び直す</button>`;
  }
  if(button.id==="edit-share") {$("share-dialog").close();showShare();}
});
document.addEventListener("input", (event) => {if(event.target.dataset.note) {state.notes[event.target.dataset.note]=event.target.value;saveWorkspace();}});
document.addEventListener("change", (event) => {
  if(['save-on-device','personal-save-device','welcome-save-device'].includes(event.target.id)) {
    if(event.target.checked) {
      persistenceEnabled=true;saveWorkspace();
      if(persistenceEnabled) notify('このブラウザに保存しました');
    } else {
      event.target.checked=true;
      $('delete-message').textContent='このブラウザに保存した記録を消して、保存をオフにします。この画面では引き続き使えますが、再読み込みすると記録は消えます。';
      $('confirm-delete').dataset.mode='storage';
      $('delete-dialog').showModal();
    }
  }
  if(event.target.matches('input[name="share-item"]')) $("preview-share").disabled=!document.querySelector('input[name="share-item"]:checked');
  if(event.target.dataset.compareSelect!==undefined) {state.compare[Number(event.target.dataset.compareSelect)]=event.target.value;renderCompare();}
});

function reflectionControl(id) {
  return `<section class="reflection-control" aria-label="自分用の振り返り"><p>見たり、試したりしてどうだった？ <small>自分だけの記録</small></p><div>${[['curious','もっと知りたい'],['tried','試してみた'],['unsure','まだピンとこない']].map(([value,label])=>`<button data-reflection="${id}" data-feeling="${value}" aria-pressed="${state.reflections[id]===value}">${label}</button>`).join('')}</div><p class="subtle">もう一度押すと取り消せます。選んでも向き不向きは判定しません。</p></section>`;
}

function visibilityControl(id) {
  return `<label class="visibility-control">公開範囲<select data-visibility="${id}" aria-label="${getItem(id).name}の公開範囲"><option value="private" ${state.sharing.visibility[id] !== 'family' ? 'selected' : ''}>自分だけ</option><option value="family" ${state.sharing.visibility[id] === 'family' ? 'selected' : ''}>保護者に共有</option></select></label>`;
}

function recommendationCard(item) {
  return `<article class="recommendation-card"><div class="recommendation-meta"><span>${item.remote?'保護者から':'保護者役から（操作モック）'} · ${escapeHtml(item.kind)}</span><span>${item.status === 'new' ? '未確認' : item.status === 'kept' ? '気になるに残した' : '見送った'}</span></div><h3>${escapeHtml(item.title)}</h3>${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="おすすめに添えられた写真" loading="lazy">` : ''}<p>${escapeHtml(item.message)}</p><div class="tags">${item.tags.map(id=>`<button class="tag" data-related="${id}">${domains[id].name} ↗</button>`).join('')}</div>${item.url ? `<a class="recommendation-url" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(item.url).hostname)} を確認する ↗</a>` : ''}<div class="place-actions">${item.status !== 'kept' ? `<button class="secondary" data-recommendation="${item.id}" data-status="kept">気になるに残す</button>` : ''}${item.status !== 'dismissed' ? `<button class="text-button" data-recommendation="${item.id}" data-status="dismissed">今は見送る</button>` : `<button class="text-button" data-recommendation="${item.id}" data-status="new">受け取り箱に戻す</button>`}</div></article>`;
}

function sharingHub() {
  const shared = publicCandidates(state,{...domains,...opportunities});
  const incoming = state.sharing.recommendations.filter(item => item.status === 'new');
  const kept = state.sharing.recommendations.filter(item => item.status === 'kept');
  const dismissed = state.sharing.recommendations.filter(item => item.status === 'dismissed');
  return `${remoteSharingHub(shared)}<section class="recommendation-inbox" aria-label="おすすめの受け取り箱"><h2>届いたおすすめ <span class="count">${incoming.length}</span></h2><p class="subtle">自分で選んで取り込めます。確認したか、見送ったかは保護者側に表示しません。</p>${incoming.length ? `<div class="recommendation-grid">${incoming.map(recommendationCard).join('')}</div>` : '<p class="inbox-empty">新しいおすすめはありません。共有した興味に、URLや写真を添えてもらえます。</p>'}${kept.length ? `<h3>おすすめから気になるに残したもの</h3><div class="recommendation-grid">${kept.map(recommendationCard).join('')}</div>` : ''}${dismissed.length ? `<details><summary>見送ったおすすめ（${dismissed.length}）</summary><div class="recommendation-grid">${dismissed.map(recommendationCard).join('')}</div></details>` : ''}</section>`;
}

function remoteSharingHub(shared) {
  const ids=shared.map(item=>item.id).sort();
  const pending=remoteFamily && JSON.stringify([...remoteFamily.ids].sort())!==JSON.stringify(ids);
  return `<section class="sharing-hub"><div><p class="eyebrow">WITH YOUR FAMILY</p><h2>気になることを、会話の入口に。</h2><p>${remoteFamily?`サーバーで共有中：${remoteFamily.ids.length}件 · ${remoteFamily.connected?'保護者が接続済み':'保護者の接続待ち'}`:'共有したい気になるものを選んで、保護者を招待できます。'}</p><p>メモ・振り返り・非公開の気になるものは送りません。</p></div><div class="remote-share-controls">${remoteFamily?`<button class="primary" data-family-action="publish" ${remoteBusy?'disabled':''}>${pending?'変更を共有に反映':'選んだ気になるものを共有に反映'}</button><button class="secondary" data-family-action="invite" ${remoteBusy?'disabled':''}>招待リンクを作る</button><button class="secondary" data-family-action="refresh" ${remoteBusy?'disabled':''}>おすすめを受け取る ↻</button><button class="text-button" data-family-action="revoke" ${remoteBusy?'disabled':''}>接続と共有を解除</button><button class="text-button" data-family-action="delete" ${remoteBusy?'disabled':''}>共有データを削除</button>`:`<button class="primary" data-family-action="start" ${remoteBusy || !ids.length?'disabled':''}>選んだ${ids.length}件で共有を始める</button>`}</div><p class="remote-status" role="status">${remoteBusy?'通信しています…':remoteMessage || (pending?'公開範囲の変更はまだ反映されていません。':'')}</p>${remoteInvitation?`<div class="remote-invitation"><label for="family-invite-link">保護者に渡す招待リンク</label><input class="invite-link" id="family-invite-link" readonly value="${escapeHtml(remoteInvitation.url)}"><p>24時間・1回限り有効。リンクを知る人が接続できます。相手を確かめて渡してください。</p><button class="secondary" id="copy-family-invite">リンクをコピー</button><p>現在はこのPCのローカルサーバー用です。別端末から使うにはHTTPSでの公開が必要です。</p></div>`:''}<p class="sharing-disclaimer">共有を始めると、選んだ気になるものと受信したおすすめをサーバーに保存します。本人の接続はこのブラウザで最大30日間。ブラウザのCookieを削除すると本人用の接続を失います。</p><details><summary>送信せずに操作だけ試す</summary><button class="text-button" id="family-preview">同じ端末の操作モックを開く →</button></details></section>`;
}

function receiveRemoteFamily(data) {
  remoteFamily=data;
  for(const recommendation of data.recommendations) {
    if(!state.sharing.recommendations.some(item=>item.id===recommendation.id)) state.sharing.recommendations.unshift(validateRecommendation({...recommendation,remote:true},domains));
  }
}

async function remoteAction(action) {
  if(remoteBusy) return;
  remoteBusy=true;remoteMessage='';if(state.page==='saved') renderSaved();
  try {
    if(action==='start') {
      receiveRemoteFamily(await familyRequest('/create','POST'));
      action='publish';
    }
    if(action==='publish') {
      receiveRemoteFamily(await familyRequest('/candidates','PUT',{ids:publicCandidates(state,{...domains,...opportunities}).map(item=>item.id)}));
      remoteMessage='選んだ気になるものを共有に反映しました。';
    }
    if(action==='invite') {remoteInvitation=await familyRequest('/invite','POST');remoteMessage='以前の未使用の招待リンクは無効になりました。新しい相手が受け取ると、以前の接続相手は解除されます。';}
    if(action==='refresh') {receiveRemoteFamily(await familyRequest('/owner'));remoteMessage='届いたおすすめを確認しました。';}
    if(action==='delete') {
      await familyRequest('/space','DELETE');remoteFamily=null;remoteInvitation=null;
      state.sharing.recommendations=state.sharing.recommendations.filter(item=>!item.remote);
      for(const id of Object.keys(state.sharing.visibility)) state.sharing.visibility[id]='private';
      remoteMessage='サーバーの共有気になるもの・おすすめ・接続を削除しました。';
    }
    if(action==='revoke') {
      receiveRemoteFamily(await familyRequest('/access','DELETE'));remoteInvitation=null;
      for(const id of Object.keys(state.sharing.visibility)) state.sharing.visibility[id]='private';
      remoteMessage='相手の接続と招待リンクを解除し、共有気になるものを非公開にしました。';
    }
  } catch(error) {remoteMessage=error.message;console.error('Family operation failed:',error.status||error.name);}
  finally {remoteBusy=false;render();}
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button) return;
  if(button.dataset.familyAction) {
    if(['revoke','delete'].includes(button.dataset.familyAction)) {
      const deleting=button.dataset.familyAction==='delete';
      $('revoke-family-title').textContent=deleting?'サーバーの共有データを削除しますか？':'保護者との接続を解除しますか？';
      $('revoke-family-message').textContent=deleting?'共有気になるもの・受信したおすすめ・接続を削除します。元に戻せません。端末の自分用メモは残ります。':'相手の閲覧・投稿と招待リンクを無効にし、共有気になるものを非公開にします。受信済みのおすすめは残ります。';
      $('confirm-revoke-family').dataset.action=button.dataset.familyAction;
      $('confirm-revoke-family').textContent=deleting?'共有データを削除':'接続と共有を解除';
      $('revoke-family-dialog').showModal();return;
    }
    await remoteAction(button.dataset.familyAction);
  }
  if(button.id==='confirm-revoke-family') {$('revoke-family-dialog').close();await remoteAction(button.dataset.action);}
  if(button.id==='copy-family-invite') {
    try {await navigator.clipboard.writeText(remoteInvitation.url);notify('招待リンクをコピーしました');}
    catch(error) {console.error('Invite copy failed:',error.name);notify('コピーできませんでした。リンク欄から選択してコピーしてください。');}
  }
});

async function restoreRemoteFamily() {
  const revision=sharingRevision;
  try {
    const data=await familyRequest('/owner');receiveRemoteFamily(data);
    if(revision===sharingRevision) {
      for(const id of Object.keys(state.sharing.visibility)) state.sharing.visibility[id]='private';
      for(const id of data.ids) {state.saved.add(id);state.sharing.visibility[id]='family';}
    }
    render();
  } catch(error) {
    if(error.status===401) return;
    remoteMessage='共有サーバーを確認できませんでした。気になるものはこの画面で使えます。';
    console.error('Family connection check failed:',error.status||error.name);
    if(state.page==='saved') renderSaved();
  }
}

function renderRelatedRecommendations() {
  const items = state.sharing.recommendations.filter(item => item.status !== 'dismissed' && item.tags.includes(state.selected));
  if (!items.length) return;
  $('detail-panel').insertAdjacentHTML('beforeend', `<section class="related-recommendations"><p class="eyebrow">FROM YOUR FAMILY</p><h3>この領域に届いたおすすめ</h3><p class="subtle">タグが「${domains[state.selected].name}」の情報。内容はまだ確認されていません。</p>${items.map(recommendationCard).join('')}</section>`);
}

function showFamilyPreview() {
  const shared = publicCandidates(state,{...domains,...opportunities});
  $('family-content').innerHTML = `<div class="family-preview-note">保護者側のプレビュー · 実際の招待や送信はまだ行いません</div><p>本人が共有を選んだ「気になる」です。進路の決定ではありません。</p><div class="shared-candidates">${shared.map(item=>`<span>${escapeHtml(item.name)}</span>`).join('') || '<p>共有されている気になるものはありません。</p>'}</div>${shared.length ? `<form id="recommendation-form"><h3>興味につながりそうな情報を添える</h3><p class="subtle">申し込みを進める前に、本人と相談してください。</p><label>関連する気になる<select name="target">${shared.map(item=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label>見出し<input name="title" required maxlength="100" placeholder="例：週末に参加できる観察会"></label><div class="form-pair"><label>情報の種類<select name="kind">${['イベント','進学','部活動','学外活動','読みもの'].map(kind=>`<option>${kind}</option>`).join('')}</select></label><label>URL<input name="url" type="url" maxlength="2048" placeholder="https://…"></label></div><label>写真（任意・JPEG / PNG / WebP・5MBまで）<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="photo-preview"></div><fieldset><legend>つながる領域のタグ</legend><p class="subtle">選んだ気になるものの領域を含めます。追加したタグでも本人の地図に表示されます。</p>${Object.entries(domains).map(([id,item])=>`<label class="tag-choice"><input name="tags" type="checkbox" value="${id}">${item.name}</label>`).join('')}</fieldset><label>ひとこと（任意）<textarea name="message" maxlength="600" placeholder="面白そうだったので。見るだけでもどうかな？"></textarea></label><p id="recommendation-error" role="alert"></p><p class="subtle">URLか写真を1つ以上添えてください。URLの内容取得や写真の文字認識は行わず、見出しとタグでつなぎます。</p><button class="primary block" type="submit">本人の受け取り箱に追加して試す</button></form>` : '<p class="inbox-empty">本人の「気になるもの」で、見せたい項目の公開範囲を「保護者に共有」に変えると試せます。</p>'}`;
  $('family-dialog').showModal();
}

async function readRecommendationPhoto(file) {
  if (!file || !file.size) return '';
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('JPEG・PNG・WebPの5MB以下の写真を選んでください。');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1000 / Math.max(bitmap.width,bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.7);
  } finally { bitmap.close(); }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'family-preview') showFamilyPreview();
  if(button.dataset.compactGroup) {compactGroup=button.dataset.compactGroup;renderMap();document.querySelector(`[data-compact-group="${compactGroup}"]`).focus();}

  if (button.dataset.resourceCompare) {
    const first=button.dataset.resourceCompare;
    const second=Object.keys(liveOpportunities).find(id=>id!==first && liveOpportunities[id].type===liveOpportunities[first].type);
    if(!second) return;
    state.compareMode='resource';state.compare=[first,second];renderCompare();$('compare-dialog').showModal();
  }
  if (button.dataset.reflection) {
    const id=button.dataset.reflection;
    if(state.reflections[id]===button.dataset.feeling) delete state.reflections[id];
    else {state.saved.add(id);state.reflections[id]=button.dataset.feeling;}
    render();notify('自分用の記録を更新しました');
  }
  if (button.dataset.recommendation) {
    const item = state.sharing.recommendations.find(item => item.id === button.dataset.recommendation);
    item.status = button.dataset.status;render();notify(item.status === 'kept' ? 'おすすめを気になるに残しました' : item.status === 'dismissed' ? '見送りました。あとで戻せます' : '受け取り箱に戻しました');
  }
});
document.addEventListener('change', event => {
  if (!event.target.dataset.visibility) return;
  sharingRevision++;
  state.sharing.visibility[event.target.dataset.visibility] = event.target.value;
  render();notify(remoteFamily ? '共有に反映ボタンで変更を確定してください' : '共有する気になるものを変更しました。まだ送信していません');
});
document.addEventListener('change', async event => {
  if (!event.target.matches('#recommendation-form [name="photo"]')) return;
  const preview = $('photo-preview');
  const error = $('recommendation-error');
  const file = event.target.files[0];
  preview.textContent = '写真を読み込んでいます…';
  error.textContent = '';
  try {
    const photo = await readRecommendationPhoto(file);
    if (event.target.files[0] !== file) return;
    preview.innerHTML = photo ? `<img src="${photo}" alt="添付する写真のプレビュー"><p class="subtle">写真は縮小してこのブラウザ内で扱います。</p>` : '';
  } catch (cause) {
    preview.textContent = '';error.textContent = cause.message;
    console.error('Photo preview failed:',cause.message);
  }
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'recommendation-form') return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  $('recommendation-error').textContent = '';
  try {
    if (state.sharing.recommendations.length >= 20) throw new Error('モックで保存できるおすすめは20件までです。');
    const data = new FormData(form);
    const target = publicCandidates(state,{...domains,...opportunities}).find(item => item.id === data.get('target'));
    if (!target) throw new Error('共有されている気になるものを選んでください。');
    const photo = await readRecommendationPhoto(data.get('photo'));
    const item = validateRecommendation({id:crypto.randomUUID(),title:data.get('title'),url:data.get('url').trim(),photo,message:data.get('message'),kind:data.get('kind'),tags:[...new Set([target.domain,...data.getAll('tags')])],status:'new'},domains);
    state.sharing.recommendations.unshift(item);
    $('family-dialog').close();state.page='saved';render();notify('プレビューのおすすめを追加しました');
  } catch(error) {
    console.error('Recommendation could not be added:',error.message);
    $('recommendation-error').textContent = error.message;
  } finally { button.disabled = false; }
});

document.addEventListener('input', event => {
  if(event.target.id === 'interest-search') {searchQuery=event.target.value;renderSearchResults();}
});
document.addEventListener('click', event => {
  const button=event.target.closest('button');
  if(!button) return;
  if(button.dataset.searchFilter) {searchFilter=button.dataset.searchFilter;renderHome();document.querySelector(`[data-search-filter="${searchFilter}"]`).focus();}
  if(button.id==='reset-search') {searchQuery='';searchFilter='all';renderHome();$('interest-search').focus();}
});
document.addEventListener('submit', event => {
  if(event.target.id!=='interest-search-form') return;
  event.preventDefault();renderSearchResults();$('search-results').scrollIntoView({behavior:'smooth',block:'start'});
});
function showMobileDetail() {
  if(!window.matchMedia('(max-width: 900px)').matches) return;
  $('mobile-detail-content').append($('detail-panel'));
  if(!$('detail-dialog').open) $('detail-dialog').showModal();
  $('detail-dialog').scrollTop=0;
}
$('detail-dialog').addEventListener('close',()=>document.querySelector('.workspace').append($('detail-panel')));
window.addEventListener('resize',()=>{
  if(!window.matchMedia('(max-width: 900px)').matches && $('detail-dialog').open) $('detail-dialog').close();
});

function renderResourceCompare() {
  const [first,second]=state.compare;
  const a=liveOpportunities[first], b=liveOpportunities[second];
  const options=Object.entries(liveOpportunities).filter(([,item])=>item.type===a.type);
  const condition=(item,labels)=>item.conditions.filter(([label])=>labels.includes(label)).map(([,value])=>value).join(' / ') || '公式ページで確認';
  const rows=[['知れる内容',a.summary,b.summary],['興味との関係',a.reason,b.reason],['地域・利用場所',condition(a,['地域','場所','機器']),condition(b,['地域','場所','機器'])],['費用',condition(a,['費用']),condition(b,['費用'])],['参加・入学条件',condition(a,['対象','参加','入学','所属','手続']),condition(b,['対象','参加','入学','所属','手続'])]];
  $('compare-content').innerHTML=`<p class="dialog-note">同じ種類の気になるものを比べています。知らない条件は空想で埋めず、公式情報で確認します。</p><div class="compare-picker">${state.compare.map((selected,index)=>`<label>比べる気になるもの ${index+1}<select data-compare-select="${index}">${options.map(([id,item])=>`<option value="${id}" ${id===selected?'selected':''} ${id===state.compare[1-index]?'disabled':''}>${item.name}</option>`).join('')}</select></label>`).join('')}</div><div class="comparison-scroll" tabindex="0" role="region" aria-label="気になるものの一覧。横にスクロールできます"><table class="compare-table"><thead><tr><th scope="col">見るポイント</th><th scope="col">${a.name}</th><th scope="col">${b.name}</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th scope="row">${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}<tr><th scope="row">公式情報</th>${[a,b].map(item=>`<td><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.source} ↗</a><small>確認 ${item.checkedOn}</small></td>`).join('')}</tr></tbody></table></div><div class="place-actions">${[first,second].map(id=>`<button class="secondary" data-save="${id}" aria-pressed="${state.saved.has(id)}">${liveOpportunities[id].name} ${state.saved.has(id)?'✓ 保存済み':'＋ 気になる'}</button>`).join('')}</div>`;
  $('compare-content').insertAdjacentHTML('beforeend','<button class="primary block" id="integrate-comparison">比べた2つを一緒にマップへ</button>');
}
function changePersonalMap(next,selected=personalSelected) {
  const clean=validatePersonalMap(next,{...domains,...opportunities});
  personalUndo.push(structuredClone(state.personalMap));if(personalUndo.length>15) personalUndo.shift();
  const previous=state.personalMap;
  state.progress ||= emptyProgress();
  state.progress.lastNode=selected;
  const changed=clean.nodes.find(node=>JSON.stringify(node)!==JSON.stringify(previous.nodes.find(old=>old.id===node.id))) || clean.nodes.find(node=>node.id===selected);
  state.progress.recent.unshift({title:changed?.title || 'マップ',action:clean.nodes.length>previous.nodes.length?'added':clean.nodes.length<previous.nodes.length?'organized':'recorded',at:new Date().toISOString()});
  state.progress.recent=state.progress.recent.slice(0,5);
  state.personalMap=clean;personalSelected=selected;render();
}

function updateIntegrationSelection() {
  if($('integrate-saved')) {
    $('integrate-saved').textContent=selectedCandidates.size ? `選んだ${selectedCandidates.size}件をマップへ` : '気になるものを選んでマップへ';
    $('integrate-saved').disabled=!selectedCandidates.size;
  }
}

function openIntegration(sources, parent='root') {
  integrationContext={sources:[...new Set(sources)],topic:state.page==='explore' && topics[state.topic].ids.includes(state.selected)?state.topic:null,domain:state.selected};
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  $('integration-content').innerHTML=`<form id="integration-form"><p class="dialog-note">見つけた情報を、つながる理由と自分用メモごと取り込みます。すでにある枝は再利用し、編集した内容は保ちます。</p><label>どの枝から広げる？<select name="parent">${state.personalMap.nodes.map(node=>`<option value="${node.id}" ${node.id===parent?'selected':''}>${escapeHtml(node.title)}</option>`).join('')}</select></label><label>まとめ方<select name="mode"><option value="path">${integrationContext.topic?'興味 → 学び → 情報のつながりを残す':'学びの領域ごとにまとめる'}</option><option value="direct" ${state.page==='personal'?'selected':''}>選んだ枝に直接つなぐ</option></select></label><p class="subtle">関連づけは掲載情報をもとにした編集案です。追加後に名前・つなぐ先・理由を変えられます。</p><div id="integration-preview" aria-live="polite"></div><p id="integration-error" role="alert"></p><button class="primary block" type="submit" id="integration-submit">このつながりで取り込む</button></form>`;
  renderIntegrationPreview();$('integration-dialog').showModal();
}

function integrationPlan() {
  const data=new FormData($('integration-form'));
  const paths=integrationContext.sources.map(source=>{
    const item=getItem(source),path=[];
    const domain=domains[source]?source:item.domains?.includes(integrationContext.domain)?integrationContext.domain:item.domain;
    if(data.get('mode')==='path') {
      if(integrationContext.topic && topics[integrationContext.topic].ids.includes(domain)) path.push({key:integrationContext.topic,title:topics[integrationContext.topic].root});
      if(domain!==source) path.push({source:domain,title:domains[domain].name,reason:topics[integrationContext.topic]?.questions?.[domain] || domains[domain].question,note:state.notes[domain] || ''});
    }
    path.push({source,title:item.name,reason:(domains[source] ? topics[integrationContext.topic]?.questions?.[source] || item.question : item.reason || '').slice(0,160),note:(state.notes[source] || '').slice(0,1500)});
    return path;
  });
  return integratePaths(state.personalMap,paths,data.get('parent'),{...domains,...opportunities});
}

function renderIntegrationPreview() {
  try {
    const result=integrationPlan(),oldIds=new Set(state.personalMap.nodes.map(node=>node.id));
    const parent=new FormData($('integration-form')).get('parent');
    const renderBranch=id=>result.map.nodes.filter(node=>node.parent===id).map(node=>`<li><span>${escapeHtml(node.title)} <small>${oldIds.has(node.id)?'既存の枝':'追加'}</small></span>${node.reason?`<p>${escapeHtml(node.reason)}</p>`:''}${node.note?'<small>自分用メモを保持</small>':''}<ul>${renderBranch(node.id)}</ul></li>`).join('');
    $('integration-preview').innerHTML=`<h3>取り込み後のプレビュー · ${result.added}個追加</h3><strong>${escapeHtml(result.map.nodes.find(node=>node.id===parent).title)}</strong><ul>${renderBranch(parent)}</ul>`;
    $('integration-error').textContent='';$('integration-submit').disabled=false;
  } catch(error) {
    $('integration-preview').replaceChildren();$('integration-error').textContent='枝は40個までです。取り込む気になるものを減らすか、既存の枝に直接つないでください。';$('integration-submit').disabled=true;
  }
}

function importPersonalItem(source,parent='root') {openIntegration([source],parent);}

document.addEventListener('change',event=>{
  if(event.target.dataset.pickCandidate) {if(event.target.checked) selectedCandidates.add(event.target.dataset.pickCandidate);else selectedCandidates.delete(event.target.dataset.pickCandidate);updateIntegrationSelection();}
  if(event.target.closest('#integration-form')) renderIntegrationPreview();
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  if(button.id==='integrate-saved') openIntegration([...selectedCandidates].filter(id=>state.saved.has(id)));
  if(button.id==='integrate-comparison') openIntegration(state.compare);
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='integration-form') return;
  event.preventDefault();
  try {
    const result=integrationPlan();
    $('integration-dialog').close();studioMobileView='map';state.page='personal';changePersonalMap(result.map,result.selected);
    const selectedNode=$(`personal-node-${result.selected}`);selectedNode.scrollIntoView({block:'center'});selectedNode.focus({preventScroll:true});
    notify(result.added?`${result.added}個の枝を取り込みました。名前やつながりを自分の言葉に変えられます`:'既存の枝を開きました。自分の編集はそのままです');
  } catch(error) {console.error('Integration failed:',error.message);$('integration-error').textContent='取り込めませんでした。枝の数とつなぐ先を確認してください。';}
});

function sizeJourney(action='auto') {
  const world=document.querySelector('.journey-world'),space=document.querySelector('.journey-space'),viewport=document.querySelector('.journey-scroll');
  if(!world || !viewport.clientWidth) return;
  const width=Number(world.dataset.width),height=Number(world.dataset.height);
  const previous=Number(world.dataset.scale || 1);
  const scale=['fit','auto'].includes(action)?Math.max(action==='auto'?.65:0,Math.min(1,(viewport.clientWidth-12)/width,(viewport.clientHeight-12)/height)):Math.max(.15,Math.min(2,previous*(action==='keep'?1:action==='in'?1.25:.8)));
  world.dataset.scale=scale;world.style.transform=`scale(${scale})`;world.style.margin='0';
  space.style.width=`${Math.max(viewport.clientWidth,width*scale)}px`;space.style.height=`${Math.max(viewport.clientHeight,height*scale)}px`;
  world.style.left=`${Math.max(0,(viewport.clientWidth-width*scale)/2)}px`;world.style.top=`${Math.max(0,(viewport.clientHeight-height*scale)/2)}px`;
  if(action==='fit') {viewport.scrollLeft=0;viewport.scrollTop=0;}
  if(action==='auto') {const selected=world.querySelector('.is-current') || world.querySelector('.journey-root');if(selected){viewport.scrollLeft=Math.max(0,(selected.offsetLeft+selected.offsetWidth/2)*scale-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,(selected.offsetTop+selected.offsetHeight/2)*scale-viewport.clientHeight/2);}}
}
function renderPersonalMap() {
  const oldWorld=document.querySelector('.journey-world'),oldViewport=document.querySelector('.journey-scroll');
  const oldView=oldWorld?{width:oldWorld.dataset.width,height:oldWorld.dataset.height,scale:oldWorld.dataset.scale,left:oldViewport.scrollLeft,top:oldViewport.scrollTop}:null;
  const map=state.personalMap;
  if(!map.nodes.some(node=>node.id===personalSelected)) personalSelected='root';
  const selected={...map.nodes.find(node=>node.id===personalSelected),...personalDrafts[personalSelected]};
  $('personal-page').innerHTML=`<div class="personal-room"><section class="room-map">${renderWelcome(map,state.progress || emptyProgress(),{...domains,...opportunities},persistenceEnabled,journeyMode,window.matchMedia('(max-width:850px)').matches)}</section><section class="room-details" aria-label="選んだものの詳細">${roomPreview?renderResourcePreview(getItem(roomPreview),roomPreview):renderStudio({map,selected,domains,resources:liveOpportunities,topics,items:{...domains,...opportunities},tab:studioTab,collapsed:collapsedBranches,undoCount:personalUndo.length,showEntrances:studioEntrances,showCustom:studioCustom,mobileView:studioMobileView,added:studioAdded,hasDraft:!!personalDrafts[personalSelected],recordDraft:inquiryDrafts[personalSelected],saved:state.saved,notes:state.notes,recommendations:FAMILY_SHARING_ENABLED?state.sharing.recommendations:[],query:studioQuery,filter:studioFilter})}</section></div>`;
  requestAnimationFrame(()=>{sizeJourney();const world=document.querySelector('.journey-world'),view=document.querySelector('.journey-scroll');if(oldView && world.dataset.width===oldView.width && world.dataset.height===oldView.height){world.dataset.scale=oldView.scale;sizeJourney('keep');view.scrollLeft=oldView.left;view.scrollTop=oldView.top;}});
  if(studioTab==='write' && inquiryReturn && map.nodes.some(node=>node.id===inquiryReturn)) $('inquiry-record')?.insertAdjacentHTML('afterend',`<button class="secondary block" data-inquiry-compare="${inquiryReturn}">体験を踏まえて、並べた画面に戻る →</button>`);
  personalObserver.disconnect();const area=document.querySelector('.personal-tree-area');if(!area) return;personalObserver.observe(area);area.querySelectorAll('.personal-node').forEach(node=>personalObserver.observe(node));
  requestAnimationFrame(drawPersonalLines);
}

function focusRoomDetails() {document.querySelector('.studio-panel h2')?.focus({preventScroll:true});}

function commitStudio(result,message,keepParent=false) {
  const previous=personalSelected;
  if(keepParent) studioAdded={id:result.selected,parent:previous};
  for(let node=result.map.nodes.find(node=>node.id===result.selected);node;node=result.map.nodes.find(parent=>parent.id===node.parent)) collapsedBranches.delete(node.id);
  changePersonalMap(result.map,keepParent?previous:result.selected);
  if(keepParent) {focusRoomDetails();document.querySelector('.studio-receipt button')?.focus({preventScroll:true});notify(message);return;}
  const button=$(`personal-node-${result.selected}`);focusRoomDetails();
  notify(message);
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  try {
    if(button.dataset.conceptOpen) {
      const concept=concepts.find(c=>c.id===button.dataset.conceptOpen);if(!concept) throw new Error('Unknown concept');
      const result=attachConcept(state.personalMap,personalSelected,concept.id,{...domains,...opportunities});
      studioTab='discover';studioMobileView='panel';commitStudio(result,'関連する楽しみ方を開きました');
    }
    if(button.dataset.directionOpen) {
      const topic=button.dataset.directionTopic,group=directions[topic]?.find(group=>group[0]===button.dataset.directionOpen);
      if(!group) throw new Error('Unknown direction');
      const result=integratePaths(state.personalMap,[[{key:`${topic}-${group[0]}`,title:group[2],reason:group[3]}]],`interest-${topic}-root`,{...domains,...opportunities});
      studioMobileView='panel';studioTab='discover';commitStudio(result,'この方向の活動を見てみよう');focusRoomDetails();
    }
    if(button.dataset.activityIndex!==undefined) {
      const result=addDirectionActivity(state.personalMap,personalSelected,button.dataset.activityTopic,button.dataset.activityGroup,Number(button.dataset.activityIndex),{...domains,...opportunities});
      studioMobileView='panel';studioTab='write';commitStudio(result,'活動のアイデアを追加しました。自分の言葉で編集できます');focusRoomDetails();
    }
    if(button.id==='studio-custom-toggle') {studioCustom=!studioCustom;renderPersonalMap();$('custom-interest')?.focus();}
    if(button.dataset.studioView) {studioMobileView=button.dataset.studioView;renderPersonalMap();focusRoomDetails();}
    if(button.dataset.studioReview || button.dataset.studioLocate) {personalSelected=button.dataset.studioReview || button.dataset.studioLocate;studioTab='write';studioMobileView=button.dataset.studioLocate?'map':'panel';renderPersonalMap();if(button.dataset.studioLocate) $(`personal-node-${personalSelected}`).scrollIntoView({block:'center'});else {focusRoomDetails();document.querySelector('.studio-panel h2').focus({preventScroll:true});}}
    if(button.dataset.studioTab) {studioMobileView='panel';studioTab=button.dataset.studioTab;renderPersonalMap();document.querySelector(`[data-studio-tab="${studioTab}"]`).focus();}
    if(button.dataset.studioFilter) {studioFilter=button.dataset.studioFilter;renderPersonalMap();document.querySelector(`[data-studio-filter="${studioFilter}"]`).focus();}
    if(button.id==='studio-entrances') {studioEntrances=!studioEntrances;renderPersonalMap();document.querySelector('.studio-start')?.scrollIntoView({block:'start'});}
    if(button.dataset.studioStart) {studioMobileView='map';studioAdded=null;studioEntrances=false;studioTab='discover';studioQuery='';studioFilter='all';commitStudio(startInquiry(state.personalMap,button.dataset.studioStart,topics,domains,{...domains,...opportunities}),'選んだ楽しみ方を開きました');}
    if(button.dataset.studioAttach) {
      const result=attachResource(state.personalMap,personalSelected,button.dataset.studioAttach,{...domains,...opportunities},state.notes);
      commitStudio(result,result.added?'情報と出典をこの枝に加えました':'この枝には追加済みです',true);
    }
    if(button.dataset.studioRecommendation) {
      const item=state.sharing.recommendations.find(item=>item.id===button.dataset.studioRecommendation);
      const result=attachReference(state.personalMap,personalSelected,{title:item.title,url:item.url,photo:item.photo,by:item.remote?'保護者から':'操作モックから',tags:item.tags},{...domains,...opportunities},item.message);
      commitStudio(result,'共有された情報を、自分のマップに取り込みました',true);
    }
    if(button.dataset.studioCollapse) {const id=button.dataset.studioCollapse;if(collapsedBranches.has(id)) collapsedBranches.delete(id);else {collapsedBranches.add(id);if(descendants(state.personalMap,id).has(personalSelected)) personalSelected=id;}renderPersonalMap();}
    if(button.id==='studio-expand-all') {collapsedBranches.clear();renderPersonalMap();}
  } catch(error) {console.error('Studio operation failed:',error.message);notify('追加できませんでした。枝は40個までです。枝の数や情報を確認してください。');}
});
function updateStudioSearch(event) {
  if(event.target.id!=='studio-search' || event.isComposing) return;
  studioQuery=event.target.value;
  const selected=state.personalMap.nodes.find(node=>node.id===personalSelected);
  const temporary=document.createElement('div');
  temporary.innerHTML=renderStudioDiscovery({map:state.personalMap,selected,context:branchContext(state.personalMap,personalSelected,domains,liveOpportunities),domains,resources:liveOpportunities,saved:state.saved,notes:state.notes,recommendations:FAMILY_SHARING_ENABLED?state.sharing.recommendations:[],query:studioQuery,filter:studioFilter});
  $('studio-discovery-results').replaceWith(temporary.querySelector('#studio-discovery-results'));
}
document.addEventListener('input',updateStudioSearch);
document.addEventListener('compositionend',updateStudioSearch);
document.addEventListener('submit',event=>{
  if(!['studio-reference','studio-move','studio-custom-start'].includes(event.target.id)) return;
  event.preventDefault();const data=new FormData(event.target);
  try {
    if(event.target.id==='studio-custom-start') {
      const next=structuredClone(state.personalMap),id=crypto.randomUUID();next.nodes.push({id,parent:'root',title:data.get('title').trim(),note:'',reason:'',source:null});studioEntrances=false;studioCustom=false;studioMobileView='map';commitStudio({map:next,selected:id},'興味の枝を作りました。枝を押すと情報を探せます');
    } else if(event.target.id==='studio-reference') {
      const result=attachReference(state.personalMap,personalSelected,{title:data.get('title').trim(),url:data.get('url').trim(),photo:'',by:'自分で追加',tags:data.get('domain')?[data.get('domain')]:[]},{...domains,...opportunities},data.get('note'));
      commitStudio(result,result.added?'出典とメモをこの枝に加えました':'同じURLはこの枝に追加済みです',true);
    } else {
      const next=structuredClone(state.personalMap),node=next.nodes.find(node=>node.id===personalSelected);node.parent=data.get('parent');
      validatePersonalMap(next,{...domains,...opportunities});
      if(personalDrafts[personalSelected]) personalDrafts[personalSelected].parent=node.parent;
      commitStudio({map:next,selected:personalSelected},'枝を組み合わせました');
    }
  } catch(error) {console.error('Studio form failed:',error.message);$('personal-error').textContent='保存できませんでした。http / https のURL、名前、枝の数を確認してください。';}
});

function drawPersonalLines() {
  if(state.page!=='personal') return;
  const area=document.querySelector('.personal-tree-area'),svg=area?.querySelector('svg');if(!svg) return;
  svg.style.width='0px';svg.style.height='0px';
  svg.style.width=`${area.scrollWidth}px`;svg.style.height=`${area.scrollHeight}px`;
  const bounds=svg.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);svg.replaceChildren();
  for(const node of state.personalMap.nodes.filter(node=>node.parent!==null)) {
    const parentElement=$(`personal-node-${node.parent}`),childElement=$(`personal-node-${node.id}`);
    if(!parentElement || !childElement) continue;
    const parent=parentElement.getBoundingClientRect(),child=childElement.getBoundingClientRect();
    const from={x:parent.left-bounds.left+16,y:parent.bottom-bounds.top};
    const to={x:child.left-bounds.left,y:child.top-bounds.top+child.height/2};
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',roundedRoute([from,{x:from.x,y:to.y},to],8));path.dataset.from=node.parent;path.dataset.to=node.id;svg.append(path);
  }
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  try {
    if(button.dataset.mapImport) importPersonalItem(button.dataset.mapImport,state.page==='personal'?personalSelected:'root');
    if(button.dataset.personalSelect) {studioMobileView='panel';studioAdded=null;studioTab='discover';personalSelected=button.dataset.personalSelect;state.progress ||= emptyProgress();state.progress.lastNode=personalSelected;saveWorkspace();studioQuery='';studioFilter='all';for(let node=state.personalMap.nodes.find(node=>node.id===personalSelected);node;node=state.personalMap.nodes.find(parent=>parent.id===node.parent)) collapsedBranches.delete(node.id);renderPersonalMap();document.querySelector('.personal-editor h2').focus({preventScroll:true});if(window.matchMedia('(max-width:850px)').matches) focusRoomDetails();}
    if(button.id==='personal-back-to-tree') {studioMobileView='map';renderPersonalMap();const node=$(`personal-node-${personalSelected}`);node.scrollIntoView({behavior:'smooth',block:'center'});node.focus({preventScroll:true});}
    if(button.id==='personal-undo' && personalUndo.length) {studioAdded=null;state.personalMap=personalUndo.pop();for(const id of Object.keys(personalDrafts)) delete personalDrafts[id];render();notify('マップの変更を戻しました');}
    if(button.id==='personal-remove') {const parent=state.personalMap.nodes.find(node=>node.id===personalSelected).parent;changePersonalMap(removeMapBranch(state.personalMap,personalSelected),parent);}
    if(button.dataset.personalUnlink!==undefined) {const next=structuredClone(state.personalMap);next.links.splice(Number(button.dataset.personalUnlink),1);changePersonalMap(next);}
  } catch(error) {console.error('Personal map operation failed:',error.message);notify('マップを変更できませんでした。枝の数やつながりを確認してください。');}
});
document.addEventListener('input',event=>{
  if(!event.target.closest('#personal-edit')) return;
  const data=new FormData($('personal-edit'));
  personalDrafts[personalSelected]={title:data.get('title'),note:data.get('note'),...(data.has('parent')?{parent:data.get('parent'),reason:data.get('reason')}:{})};
  $('personal-draft-status').textContent='未保存の変更があります';
});
document.addEventListener('submit',event=>{
  if(!['personal-edit','personal-add','personal-import','personal-link'].includes(event.target.id)) return;
  event.preventDefault();const data=new FormData(event.target),next=structuredClone(state.personalMap),node=next.nodes.find(node=>node.id===personalSelected);
  try {
    if(event.target.id==='personal-import') {importPersonalItem(data.get('source'),personalSelected);return;}
    if(event.target.id==='personal-edit') {node.title=data.get('title').trim();node.note=data.get('note');if(node.parent!==null) {node.parent=data.get('parent');node.reason=data.get('reason');}validatePersonalMap(next,{...domains,...opportunities});delete personalDrafts[personalSelected];changePersonalMap(next);notify('枝を更新しました');}
    if(event.target.id==='personal-add') {const id=crypto.randomUUID();next.nodes.push({id,parent:personalSelected,title:data.get('title').trim(),reason:'',note:'',source:null});changePersonalMap(next,id);notify('新しい枝を追加しました');}
    if(event.target.id==='personal-link') {
      const target=data.get('target');const existing=next.links.find(link=>[link.from,link.to].includes(personalSelected) && [link.from,link.to].includes(target));
      if(existing) existing.reason=data.get('reason').trim();else next.links.push({from:personalSelected,to:target,reason:data.get('reason').trim()});
      changePersonalMap(next);notify('つながりを残しました');
    }
  } catch(error) {console.error('Personal map update failed:',error.message);$('personal-error').textContent='保存できませんでした。空の名前、枝の上限、つながりを確認してください。';}
});

function renderInquiryBoard() {
  const display=structuredClone(state.personalMap);
  for(const node of display.nodes) if(assessmentDrafts[node.id]) node.inquiry={...node.inquiry,answers:{...node.inquiry?.answers,...assessmentDrafts[node.id]}};
  $('inquiry-content').innerHTML=renderInquiryComparison(display,inquiryParent,{...domains,...opportunities});
  if(comparisonDrafts[inquiryParent]) for(const [key,value] of Object.entries(comparisonDrafts[inquiryParent])) $('inquiry-question').elements.namedItem(key).value=value;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  if(button.dataset.inquiryCompare) {inquiryParent=button.dataset.inquiryCompare;renderInquiryBoard();$('inquiry-dialog').showModal();}
  if(button.dataset.inquiryExperience) {inquiryReturn=inquiryParent;personalSelected=button.dataset.inquiryExperience;studioTab='write';studioMobileView='panel';$('inquiry-dialog').close();renderPersonalMap();focusRoomDetails();}
  if(button.dataset.inquiryNext) {
    const parent=state.personalMap.nodes.find(node=>node.id===button.dataset.inquiryNext),title=parent.inquiry.next.trim();
    if(!title) return;
    const existing=state.personalMap.nodes.find(node=>node.parent===parent.id && node.inquiry?.question===title);
    if(existing) {personalSelected=existing.id;renderPersonalMap();notify('この気になることはすでに枝になっています');return;}
    const next=structuredClone(state.personalMap),id=crypto.randomUUID();
    next.nodes.push({id,parent:parent.id,title:title.slice(0,80),source:null,note:'',reason:'体験から生まれた気になること',inquiry:{question:title}});
    try {studioTab='discover';studioMobileView='map';commitStudio({map:next,selected:id},'体験から生まれた気になることを、次の探索につなげました');}
    catch(error) {console.error('Inquiry branch failed:',error.message);notify('枝を追加できませんでした。枝は40個までです。');}
  }
});
document.addEventListener('input',event=>{
  if(event.target.closest('#inquiry-question')) comparisonDrafts[inquiryParent]=Object.fromEntries(new FormData($('inquiry-question')));
  if(event.target.closest('#inquiry-record')) {inquiryDrafts[personalSelected]=Object.fromEntries(new FormData($('inquiry-record')));$('inquiry-record-status').textContent='未保存の記録があります';}
  if(event.target.dataset.assessNode) {
    const root=state.personalMap.nodes.find(node=>node.id===inquiryParent),criteria=root.inquiry?.criteria || ['自分が面白そうと思うところ','続けるうえで気になること'];
    const id=event.target.dataset.assessNode;
    assessmentDrafts[id] ??= {};
    Object.defineProperty(assessmentDrafts[id],criteria[Number(event.target.dataset.assessAxis)],{value:event.target.value,writable:true,configurable:true,enumerable:true});
    $('inquiry-assessment-status').textContent='自分のメモに未保存の変更があります';
  }
});
document.addEventListener('submit',event=>{
  if(!['inquiry-record','inquiry-question','inquiry-assessment'].includes(event.target.id)) return;
  event.preventDefault();
  const next=structuredClone(state.personalMap),data=new FormData(event.target);
  try {
    if(event.target.id==='inquiry-record') {
      const node=next.nodes.find(node=>node.id===personalSelected);
      node.inquiry=validateInquiry({...node.inquiry,...Object.fromEntries(data)});
      changePersonalMap(next);delete inquiryDrafts[personalSelected];renderPersonalMap();notify('記録しました。一覧にも体験と次の一歩が反映されます');
    } else if(event.target.id==='inquiry-question') {
      const root=next.nodes.find(node=>node.id===inquiryParent),criteria=data.get('criteria').split('\n').map(text=>text.trim()).filter(Boolean);
      root.inquiry=validateInquiry({...root.inquiry,question:data.get('question').trim(),criteria});
      changePersonalMap(next);delete comparisonDrafts[inquiryParent];renderInquiryBoard();notify('見るポイントを保存しました');
    } else {
      for(const node of inquiryCandidates(next,inquiryParent,{...domains,...opportunities})) if(assessmentDrafts[node.id]) node.inquiry=validateInquiry({...node.inquiry,answers:{...node.inquiry?.answers,...assessmentDrafts[node.id]}});
      changePersonalMap(next);
      for(const node of inquiryCandidates(next,inquiryParent,{...domains,...opportunities})) delete assessmentDrafts[node.id];
      renderInquiryBoard();notify('自分のメモを保存しました');
    }
  } catch(error) {console.error('Inquiry save failed:',error.message);const target=event.target.id==='inquiry-record'?$('personal-error'):$('inquiry-error');target.textContent='保存できませんでした。見るポイントは重複なしで5つまで、1つ80文字までです。入力内容を確認してください。';}
});

let guideStep=0;
function renderGuide() {
  const steps=[['1. 興味を選ぶ','ゲーム・料理・音楽など、気になることを1つ選びます。選んだ興味と関係する学びが、マップに表示されます。','例：ゲーム → 情報科学・映像・デザイン'],['2. 情報をマップに追加する','学びの項目を押すと、関連する教材・活動・学校が表示されます。内容を読んで「マップに追加」を押してください。','追加した情報は、選んだ項目の下につながります。'],['3. 比べて、試して、振り返る','気になるものが集まったら「並べて見る」で違いを確認します。試すことや感想は「計画と感想」に記録できます。','次回は最初の画面に、最後の操作と次の行動が表示されます。保存をオンにしておきましょう。']];
  const [title,body,example]=steps[guideStep];
  $('guide-content').innerHTML=`<p class="guide-progress">使い方 ${guideStep+1} / 3</p><h2 id="guide-title">${title}</h2><p>${body}</p><div class="guide-example">${example}</div><div class="place-actions">${guideStep?'<button class="secondary" id="guide-back">戻る</button>':''}<button class="primary" id="guide-next">${guideStep===2?'閉じて始める':'次へ →'}</button></div>`;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  if(button.dataset.journeyZoom) sizeJourney(button.dataset.journeyZoom);
  if(button.dataset.journeyMode) {journeyMode=button.dataset.journeyMode;renderPersonalMap();document.querySelector(`[data-journey-mode="${journeyMode}"]`).focus({preventScroll:true});}
  if(button.id==='open-guide') {guideStep=0;renderGuide();$('guide-dialog').showModal();}
  if(button.id==='guide-back') {guideStep--;renderGuide();}
  if(button.id==='guide-next') {if(guideStep<2) {guideStep++;renderGuide();} else {state.progress ||= emptyProgress();state.progress.guideSeen=true;saveWorkspace();$('guide-dialog').close();}}
  if(button.id==='welcome-show-map') {studioMobileView='map';renderPersonalMap();document.querySelector('.studio-canvas')?.scrollIntoView({block:'start'});}
  if(button.dataset.nextAction) {
    personalSelected=button.dataset.nextNode;state.progress ||= emptyProgress();state.progress.lastNode=personalSelected;rememberViewed(state.personalMap.nodes.find(node=>node.id===personalSelected)?.source);saveWorkspace();studioEntrances=false;studioMobileView='panel';
    if(button.dataset.nextAction==='compare') {inquiryParent=personalSelected;renderInquiryBoard();$('inquiry-dialog').showModal();return;}
    if(button.dataset.nextAction==='next') {studioTab='write';renderPersonalMap();document.querySelector('[data-inquiry-next]')?.click();return;}
    studioTab=button.dataset.nextAction==='write'?'write':'discover';renderPersonalMap();focusRoomDetails();
  }
});

window.addEventListener('resize', scheduleConnections);
window.addEventListener('resize',drawPersonalLines);
let compactRoom=window.matchMedia('(max-width:850px)').matches;
window.addEventListener('resize',()=>{const compact=window.matchMedia('(max-width:850px)').matches;if(state.page==='personal' && compact!==compactRoom){compactRoom=compact;renderPersonalMap();}else sizeJourney();});
document.fonts.ready.then(scheduleConnections);
restoreWorkspace();
personalSelected=state.progress?.lastNode || 'root';
const pageFromHash = () => {const hash=location.hash.split('?')[0];return !hash ? 'personal' : hash === '#map' ? 'explore' : hash === '#saved' ? 'saved' : hash === '#personal' ? 'personal' : hash === '#routes' ? 'routes' : 'home';};
state.page = pageFromHash();
window.addEventListener('popstate', () => { document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()); state.page = pageFromHash(); render(); });
render();

if (FAMILY_SHARING_ENABLED) restoreRemoteFamily();

// Record catalog links without intercepting navigation to the original source.
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');
  if(!anchor) return;
  const entry=Object.entries({...domains,...opportunities}).find(([,item])=>item.url===anchor.href);
  if(entry) {rememberViewed(entry[0]);saveWorkspace();}
});

function openCapture(title='',url='') {
  const form=$('capture-form');form.reset();form.elements.title.value=title;form.elements.url.value=url;
  $('capture-parent').innerHTML=state.personalMap.nodes.map(node=>`<option value="${escapeHtml(node.id)}" ${node.id===personalSelected?'selected':''}>${escapeHtml(node.title)}</option>`).join('');
  $('capture-error').textContent='';$('capture-bookmark').href=captureBookmark(location.origin);$('capture-dialog').showModal();
}
document.addEventListener('click',event=>{if(event.target.closest('#capture-open')) openCapture();});
$('capture-form').addEventListener('submit',event=>{
  event.preventDefault();const data=new FormData(event.target);
  try {
    const reference=validateCapture(data.get('title'),data.get('url'));
    const result=attachReference(state.personalMap,data.get('parent'),reference,{...domains,...opportunities},data.get('note'));
    state.page='personal';studioMobileView='panel';studioTab='write';commitStudio(result,result.added?'出典付きで取り込みました':'同じURLはこの枝に追加済みです');$('capture-dialog').close();focusRoomDetails();
  } catch(error) {$('capture-error').textContent=error.message;}
});
const captureParams=pendingCaptureParams;
if(captureParams.has('captureUrl')) {
  const url=captureParams.get('captureUrl'),title=captureParams.get('captureTitle') || '';
  history.replaceState(history.state,'',location.pathname+location.hash);
  openCapture(title.slice(0,80),url);
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button) return;
  if(['nextAction','personalSelect','studioStart','conceptOpen','directionOpen','studioTab','studioAttach','activityIndex'].some(key=>button.dataset[key]!==undefined)) roomPreview=null;
  if(button.hasAttribute('data-room-close-preview')) {roomPreview=null;renderPersonalMap();}
},true);
