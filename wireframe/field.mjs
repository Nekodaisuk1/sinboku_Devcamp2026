import {decisionPoints} from './routes.mjs';
import {routesForDomain, hasRoutes, routeDomains} from './routes.mjs';
import knowledge from './knowledge-data.mjs';
import {verbById, domainsForActivity} from './verbs.mjs';
import {universityCandidatesForDomain} from './education.mjs';

/**
 * 時間の野原。縦軸は時間だけが決め、横軸は本人が自由に置く。
 * 横の位置そのものに意味はない。意味は「線がどこで合流するか」が持つ。
 *
 * 最初は空で、置いたぶんだけ世界が現れる。学問は勝手に並んでいるのではなく、
 * 本人が置いたものから線が伸びた先に生まれる。
 */

// 上が未来、下が今。routes.mjs の段の向きをそのまま使う。
export const LANES = [
  {id: 'lab',        decision: 'lab',        title: '専攻・研究室を選ぶ', horizon: '大学2〜3年ごろ', minRows: 1},
  {id: 'faculty',    decision: 'faculty',    title: '学部・学科を選ぶ',   horizon: '高3の夏ごろ',   minRows: 0},
  {id: 'course',     decision: 'course',     title: '文理・コースを選ぶ', horizon: '高1の11月ごろ', minRows: 0},
  {id: 'highschool', decision: 'highschool', title: '高校を選ぶ',        horizon: '中3の12月ごろ', minRows: 0},
  {id: 'now',        decision: null,         title: 'いま',              horizon: 'ここが今日',    minRows: 1}
];

export const LANE_IDS = LANES.map(lane => lane.id);
export const PLACEMENT_LIMIT = 60;
export const LABEL_LIMIT = 40;
export const INTEREST_PLAN_LIMIT = 5;

/** 学校検索の掲載情報は、教育段階そのものを表す位置へ置く。 */
export function laneForResource(resource) {
  if (resource?.category === 'school') return 'highschool';
  if (resource?.category === 'university') return 'faculty';
  return 'now';
}

/** 検索結果のIDを保ったまま、マップへ渡す置きものに変換する。 */
export function placementForResource(resourceId, resource) {
  return {kind: 'resource', ref: resourceId, label: resource.name, lane: laneForResource(resource)};
}

/**
 * 最初に本人が選んだ興味を、進路マップへ追加できる形にそろえる。
 * 名前から興味や学問を推測せず、チェックした項目と明示した関わり方だけを使う。
 */
export function buildInterestPlan({topicIds = [], customLabel = '', domainIds = [], verbId = null} = {}) {
  if (!Array.isArray(topicIds)) throw new Error('Interests must be a list');
  if (!Array.isArray(domainIds)) throw new Error('Domains must be a list');
  const uniqueTopicIds = [...new Set(topicIds.map(id => String(id)))];
  for (const id of uniqueTopicIds) {
    if (!knowledge.topics[id]) throw new Error(`Unknown topic: ${id}`);
  }

  const label = String(customLabel ?? '').trim();
  if (label.length > LABEL_LIMIT) throw new Error(`興味の名前は${LABEL_LIMIT}文字までです。`);
  const uniqueDomainIds = [...new Set(domainIds.map(id => String(id)))];
  for (const id of uniqueDomainIds) {
    if (!knowledge.domains[id]) throw new Error(`Unknown domain: ${id}`);
  }
  const verb = verbId ? verbById(String(verbId)) : null;
  if (label && !uniqueDomainIds.length && !verb) throw new Error('自由に書いた興味には、関係があるジャンルを選んでください。');

  const plan = uniqueTopicIds.map(id => ({
    kind: 'topic', ref: id, label: knowledge.topics[id].label, verb: null,
    topic: null, source: 'catalog'
  }));
  if (label) plan.push({
    kind: 'custom', ref: null, label, verb: verb?.id ?? null,
    topic: null, domains: uniqueDomainIds.length ? uniqueDomainIds : null, source: 'self'
  });
  if (plan.length > INTEREST_PLAN_LIMIT) {
    throw new Error(`最初に選べる興味は${INTEREST_PLAN_LIMIT}件までです。`);
  }
  return plan;
}

// Build 23: 置きものの出どころと中身を、kind だけでなく統一した形で持たせる。
// PLACEMENT_KINDS は保存データが名乗れる kind の全部。SELF_KINDS はそのうち
// 「本人が足したもの」――カタログの裏付けがないので、線を推測で伸ばさない対象。
export const PLACEMENT_KINDS = ['topic', 'activity', 'resource', 'custom', 'link', 'photo'];
export const SELF_KINDS = ['custom', 'link', 'photo'];
export const URL_LIMIT = 400;
export const TITLE_LIMIT = 80;
export const PHOTO_LIMIT = 12; // 端末保存に収めるための上限（枚数）
export const PHOTO_BYTES = 160 * 1024; // 1枚あたりの上限。dataURL の文字数で判定する

/** 外部で見つけた情報を、本人が選んだジャンルと一緒に確認用の下書きへそろえる。 */
export function buildExternalInformationDraft({url, title = '', domainIds = [], lane = 'now'} = {}) {
  let parsed;
  try {
    parsed = new URL(String(url ?? ''));
  } catch {
    throw new Error('これはページのアドレスとして読み取れませんでした。');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('置けるのは http と https のページだけです。');
  if (String(url).length > URL_LIMIT) throw new Error(`アドレスが長すぎます（${URL_LIMIT}文字まで）。`);
  if (!LANE_IDS.includes(lane)) throw new Error('Unknown lane');
  if (!Array.isArray(domainIds)) throw new Error('Domains must be a list');
  const uniqueDomainIds = [...new Set(domainIds.map(id => String(id)))];
  for (const id of uniqueDomainIds) {
    if (!knowledge.domains[id]) throw new Error(`Unknown domain: ${id}`);
  }
  return {
    kind: 'link', url: String(url), title: (String(title).trim() || parsed.hostname).slice(0, LABEL_LIMIT),
    photo: null, topic: null, verb: null, domains: uniqueDomainIds, lane
  };
}

// 20件も置くと野原が読めなくなるので、表示側の絞り込みと並べ替えの選択肢をここで定義する。
// 保存データには一切影響しない「見せ方」だけの語彙。
export const FIELD_VIEWS = [
  {id: 'all', label: '全体を見る', hint: '追加した項目を全部'},
  {id: 'selected', label: '選んだものだけ', hint: '選んだものと、つながっている先だけ'},
  {id: 'recent', label: '最近追加したもの', hint: 'あとから追加した5件'}
];

export const LIST_SORTS = [
  {id: 'lane', label: '時期順'},
  {id: 'added', label: '追加順'},
  {id: 'domain', label: 'つながる学問'}
];

export const laneById = id => LANES.find(lane => lane.id === id) || null;
export const laneIndex = id => LANE_IDS.indexOf(id);

/* ---------- 置いたものの出どころと中身 ---------- */

/**
 * 置きものの出どころ。掲載情報と、自分で足したものを、同じ顔にしないための1か所。
 * 保存データに source があればそれを使い、無ければ（Build 22 までの記録）kind から導く。
 */
export function sourceOf(placement) {
  return placement.source ?? (SELF_KINDS.includes(placement.kind) ? 'self' : 'catalog');
}

/** 置きものの中身の種類。custom だけ kind と名前が違う（自由入力＝text）。 */
export function contentOf(placement) {
  return placement.kind === 'custom' ? 'text' : placement.kind;
}

/**
 * 画面に出す出どころの説明を、1か所で決める。
 * 自分で足したもの／家族からのものには、必ず「内容は確認していません」を添える。
 * 掲載情報（出典と確認日がある）には付けない。同じ顔をさせないための境目。
 */
export function describeSource(placement) {
  const source = sourceOf(placement);
  if (source === 'self') return {label: '自分で追加', caution: '内容は確認していません'};
  if (source === 'family') return {label: '家族から', caution: '内容は確認していません'};
  return {label: contentOf(placement) === 'resource' ? '掲載情報' : 'このアプリの項目', caution: null};
}

/* ---------- 置いたものが、どの学問につながるか ---------- */

/**
 * 置いたもの1つから伸びる先の学問。
 * 好きなこと → その入口が扱う領域。活動 → その活動グループが扱う領域。
 * 自分で足したもの（自由入力・リンク・写真）→ 本人が選んだタグを続けている領域。
 * 掲載情報 → その情報が属する領域。つながりが分からないものは、線を作らない。
 */
export function suggestedReachOf(placement) {
  if (placement.kind === 'topic') return knowledge.topics[placement.ref]?.ids ?? [];
  if (placement.kind === 'resource') return knowledge.resources[placement.ref]?.domains ?? [];
  if (placement.kind === 'activity') return domainsForActivity(placement.ref);
  if (SELF_KINDS.includes(placement.kind)) {
    // 自分で足したものは、本人が明示的に選んだタグからだけつながる。推測でつながない。
    const topicDomains = placement.topic ? knowledge.topics[placement.topic]?.ids ?? [] : null;
    const verbDomains = placement.verb ? verbById(placement.verb)?.domains ?? [] : null;
    if (topicDomains && verbDomains) {
      // 「何について」と「関わり方」の両方があるときは積集合。
      // 和集合にすると1つ置いただけで何領域にも線が伸び、合流が意味を失う。
      const both = topicDomains.filter(domain => verbDomains.includes(domain));
      // 積が空なら「何について」の方を採る。そちらの方が具体的だから。
      return both.length ? both : topicDomains;
    }
    return topicDomains ?? verbDomains ?? [];
  }
  return [];
}

/** 本人が接続を編集していればその内容を使い、未編集なら提示された接続を使う。 */
export function reachOf(placement) {
  return Array.isArray(placement.domains) ? placement.domains : suggestedReachOf(placement);
}

/** 1本の接続を追加・解除し、この時点から本人が編集した接続として保持する。 */
export function setDomainConnection(placement, domainId, connected) {
  if (!Object.hasOwn(knowledge.domains, domainId)) throw new Error(`Unknown domain: ${domainId}`);
  const current = Array.isArray(placement.domains) ? placement.domains : suggestedReachOf(placement);
  const next = connected
    ? [...new Set([...current, domainId])]
    : current.filter(id => id !== domainId);
  return {...placement, domains: next};
}

/** 本人の接続編集を外し、データから提示された接続へ戻す。 */
export function resetDomainConnections(placement) {
  return {...placement, domains: null};
}

/**
 * 置かれたものから現れる学問と、そこへ届いている線。
 * 学問の横位置は、そこへ届いている置きものの平均。合流するほど、間に寄る。
 */
export function revealWorld(placements) {
  const reached = new Map();
  for (const placement of placements) {
    for (const domain of reachOf(placement)) {
      if (!knowledge.domains[domain]) continue;
      if (!reached.has(domain)) reached.set(domain, []);
      reached.get(domain).push(placement);
    }
  }
  const domains = [...reached].map(([id, from]) => ({
    id,
    ...knowledge.domains[id],
    from: from.map(placement => placement.id),
    // 2つ以上の別の置きものが届いていれば合流。1つの興味の言い換えではない。
    converged: new Set(from.map(placement => placement.ref ?? placement.id)).size >= 2,
    x: from.reduce((total, placement) => total + placement.x, 0) / from.length,
    hasRoutes: hasRoutes(id)
  })).sort((a, b) => a.x - b.x);
  const links = [];
  for (const domain of domains) for (const id of domain.from) links.push({from: id, to: `domain-${domain.id}`, kind: 'reach'});
  return {domains, links};
}

/** 合流した学問だけを、言葉で言えるようにする。図が読めなくても同じことが分かるように。 */
export function convergences(placements) {
  const {domains} = revealWorld(placements);
  const byId = new Map(placements.map(placement => [placement.id, placement]));
  return domains.filter(domain => domain.converged).map(domain => ({
    domain: domain.id,
    name: domain.name,
    labels: [...new Set(domain.from.map(id => byId.get(id)?.label).filter(Boolean))]
  }));
}

// 合流の文に並べる名前の上限。20件置くと1つの学問に8件届くことがあり、
// 全部並べると1文が画面を埋めてしまう。
export const CONVERGENCE_NAMES = 3;

/**
 * 合流を1文にするための部品。名前は上限までにして、残りは件数で言う。
 * 「どちらも」は2件のときだけ正しいので、3件以上は「どれも」にする。
 */
export function convergenceSentence({labels, name, domain}) {
  const shown = labels.slice(0, CONVERGENCE_NAMES);
  return {domain, name, shown, rest: labels.length - shown.length, all: labels.length === 2 ? 'どちらも' : 'どれも'};
}

/**
 * 選んだ1つに、線1本でつながっている相手。置きものを選べばその学問、
 * 学問を選べばそこへ届いている置きもの。
 *
 * 合流相手（学問をまたいだ2ホップ先）までは含めない。含めると
 * 「選んだものだけ」が20件中16件になって絞り込みにならず、
 * まとめから外す対象に使ったときは選んだ瞬間に段が一気に伸びる。
 * 合流を見たいときは、学問のほうを選ぶ。それが2ホップ目にあたる。
 */
export function linkedSet(placements, selected) {
  if (!selected) return new Set();
  const {domains} = revealWorld(placements);
  if (selected.startsWith('domain-')) {
    const domain = domains.find(item => `domain-${item.id}` === selected);
    return domain ? new Set([selected, ...domain.from]) : new Set();
  }
  if (!placements.some(placement => placement.id === selected)) return new Set();
  return new Set([selected, ...domains.filter(domain => domain.from.includes(selected)).map(domain => `domain-${domain.id}`)]);
}

/**
 * 描く置きものを絞る。絞るのは表示だけで、保存データにも合流計算にも触らない。
 * 何も隠さないときも、何を隠したかも、黙らずに note で言葉にして返す。
 */
export function visibleFor(placements, {view = 'all', selected = null} = {}) {
  if (view === 'recent') {
    const shown = placements.slice(-RECENT_COUNT);
    return {placements: shown, hidden: placements.length - shown.length, note: '最近追加した5件だけを表示しています。'};
  }
  if (view === 'selected') {
    const focus = linkedSet(placements, selected);
    // 選んでいない・つながる相手がいないときは絞れないので、隠さず全部見せる。
    if (!selected || focus.size === 0) {
      return {placements, hidden: 0, note: '先に1つ選ぶと、そこにつながるものだけになります。'};
    }
    const shown = placements.filter(placement => focus.has(placement.id));
    // 学問を選んだときと置きものを選んだときでは、残るものが違う。同じ文で済ませない。
    const note = selected.startsWith('domain-')
      ? 'この学問につながっている項目だけです。'
      : '選んだ項目と、そこにつながる学問だけです。同じ学問につながる他の項目は、学問のほうを選ぶと表示されます。';
    return {placements: shown, hidden: placements.length - shown.length, note};
  }
  return {placements, hidden: 0, note: null};
}

function pathForRoute(route, domainId, x) {
  const stages = {university: 'faculty', course: 'course', highschool: 'highschool'};
  const nodes = [];
  let previous = `domain-${domainId}`;
  const links = [];
  for (const step of route.steps) {
    const lane = stages[step.stage];
    if (!lane) continue;
    const id = `route-${route.id}-${step.stage}`;
    nodes.push({id, lane, label: step.title, kind: 'route', route: route.kind, stage: step.stage,
      domain: domainId, detail: step.detail, link: step.link ?? null, x});
    links.push({from: id, to: previous, kind: 'route'});
    previous = id;
  }
  return {nodes, links};
}

/**
 * 学問を選んだとき、そこへ至る経路を中間の段に出す。
 * kindId がない間は決める前の比較として全経路を横に並べ、選ばれたら1本に絞る。
 */
function highSchoolCandidates(domainId, excludeUrl) {
  const found = [];
  const seen = new Set([excludeUrl].filter(Boolean));
  const orderedDomains = [domainId, ...routeDomains().filter(id => id !== domainId)];
  for (const candidateDomain of orderedDomains) {
    for (const route of routesForDomain(candidateDomain, knowledge.domains[candidateDomain])) {
      const step = route.steps.find(item => item.stage === 'highschool');
      if (!step?.link?.url || seen.has(step.link.url)) continue;
      seen.add(step.link.url);
      found.push({id: `${candidateDomain}-${route.kind}`, name: step.link.name ?? step.title,
        activity: step.title, link: step.link});
      if (found.length === 4) return found;
    }
  }
  return found;
}

function expandedSchoolNodes(selected, domainId) {
  if (!selected || !['university', 'highschool'].includes(selected.stage)) return {nodes: [], links: []};
  const candidates = selected.stage === 'university'
    ? universityCandidatesForDomain(domainId, {limit: 4, excludeUrl: selected.link?.url}).map(item => ({
        id: item.id, name: item.name, activity: item.activity,
        link: {name: item.name, url: item.url, source: item.source}
      }))
    : highSchoolCandidates(domainId, selected.link?.url);
  const offsets = [-0.34, -0.17, 0.17, 0.34];
  const nodes = candidates.map((candidate, index) => ({
    id: `school-option-${selected.stage}-${candidate.id}`,
    lane: selected.lane, label: candidate.name, kind: 'school-option', stage: selected.stage,
    domain: domainId, activity: candidate.activity, detail: candidate.activity, link: candidate.link,
    x: Math.max(0.08, Math.min(0.92, selected.x + offsets[index]))
  }));
  return {nodes, links: nodes.map(node => ({from: node.id, to: selected.id, kind: 'school-option'}))};
}

export function routePath(domainId, kindId, anchorX, {expandedSchoolId = null} = {}) {
  if (!knowledge.domains[domainId]) return {nodes: [], links: [], routes: []};
  if (!hasRoutes(domainId)) {
    const lead = universityCandidatesForDomain(domainId, {limit: 1})[0];
    if (!lead) return {nodes: [], links: [], routes: []};
    const university = {
      id: `route-${domainId}-general-university`, lane: 'faculty', label: lead.name,
      kind: 'route', route: 'general', stage: 'university', domain: domainId,
      detail: lead.activity, link: {name: lead.name, url: lead.url, source: lead.source}, x: anchorX
    };
    const highschool = {
      id: `route-${domainId}-general-highschool`, lane: 'highschool',
      label: '理科・数学と探究活動を続けられる高校', kind: 'route', route: 'general',
      stage: 'highschool', domain: domainId,
      detail: `${knowledge.domains[domainId].name}に近い授業・部活動・課題研究があるかを学校案内で確認する。`,
      link: {name: '都立高校の入試・学科を調べる', url: 'https://www.kyoiku.metro.tokyo.lg.jp/admission/high_school/', source: '東京都教育委員会'},
      x: anchorX
    };
    const baseNodes = [university, highschool];
    const expanded = expandedSchoolNodes(baseNodes.find(node => node.id === expandedSchoolId), domainId);
    return {
      nodes: [...baseNodes, ...expanded.nodes],
      links: [
        {from: university.id, to: `domain-${domainId}`, kind: 'route'},
        {from: highschool.id, to: university.id, kind: 'route'},
        ...expanded.links
      ],
      routes: [], route: null
    };
  }
  const routes = routesForDomain(domainId, knowledge.domains[domainId]);
  const chosen = kindId ? routes.find(item => item.kind === kindId) : null;
  if (kindId && !chosen) return {nodes: [], links: [], routes: []};
  const visible = chosen ? [chosen] : routes;
  const paths = visible.map((route, index) => {
    // 比較中は同じ段の4項目を横へ散らし、選択後は学問の真下へ1本通す。
    const x = chosen || visible.length === 1
      ? anchorX
      : 0.12 + index * (0.76 / (visible.length - 1));
    return pathForRoute(route, domainId, x);
  });
  const pathNodes = paths.flatMap(path => path.nodes);
  const expanded = expandedSchoolNodes(pathNodes.find(node => node.id === expandedSchoolId), domainId);
  return {
    nodes: [...pathNodes, ...expanded.nodes],
    links: [...paths.flatMap(path => path.links), ...expanded.links],
    routes: visible,
    route: chosen ?? null
  };
}

/** 中間ノードを選んでも、ルートを描く起点の学問は維持する。 */
export function selectFieldNode({currentSelected = null, clickedId, routeDomain = null}) {
  if (clickedId.startsWith('route-') || clickedId.startsWith('school-option-')) {
    return {selected: clickedId, routeDomain};
  }
  const selected = currentSelected === clickedId ? null : clickedId;
  return {
    selected,
    routeDomain: clickedId.startsWith('domain-') ? clickedId.slice(7) : routeDomain
  };
}

/** 詳細表示の対象が変わっても、本人が見ている接続の起点は明示的に外すまで維持する。 */
export function highlightAfterClick(currentHighlight, clickedId) {
  return currentHighlight || clickedId;
}

/** 大学・高校は追加の操作部品を挟まず、ノードそのもののクリックで候補を開閉する。 */
export function schoolExpansionAfterClick(node, currentExpandedId = null) {
  if (node?.kind === 'school-option') return currentExpandedId;
  if (node?.kind !== 'route' || !['university', 'highschool'].includes(node.stage)) return null;
  return currentExpandedId === node.id ? null : node.id;
}

/* ---------- 並べ方：縦は時間、横は置いた場所。重なる分だけ段が厚くなる ---------- */

const NODE_HEIGHT = 34;
const ROW_GAP = 10;
const SIDE = 14;
const LANE_PAD = 18;
const LANE_HEAD = 26;

// 1つの段に何行まで許すか。それを超えたら個別には描かず「まとめ」に送る。
// 4行（約180px）までは、スマートフォンの画面でも段ごと見渡せる。
// ここを小さくすると、まとめが例外ではなく既定になり、本人が置いたものが画面から消える。
export const MAX_ROWS = 4;
// 「最近置いたもの」表示で見せる件数。
export const RECENT_COUNT = 5;

export function nodeWidth(label, width) {
  return Math.min(Math.max(64, [...String(label)].length * 13 + 26), Math.max(90, width - SIDE * 2));
}

// packLane と previewBox の両方が使う、横位置から実際の箱を出す式。
// ここを1か所にしておかないと、ドラッグ中のプレビューと確定後の位置がずれる。
function boxFor(x, label, width) {
  const w = nodeWidth(label, width);
  const left = Math.min(Math.max(x * width - w / 2, SIDE), Math.max(SIDE, width - SIDE - w));
  return {left, w};
}

/**
 * 同じ段の中で重なったものを、下の行へ送る。横位置は本人が置いたまま動かさない。
 * - expanded: 密集をほぐす表示。1ノード1行にして、ラベルの重なりをなくす（一時表示・保存しない）。
 * - maxRows: これを超えて入らないノードは配置せず overflow に送る（まとめ側で描く）。
 */
export function packLane(nodes, width, {maxRows = MAX_ROWS, expanded = false, keep = new Set()} = {}) {
  const sorted = [...nodes].sort((a, b) => a.x - b.x);
  if (expanded) {
    const placed = sorted.map((node, row) => ({...node, ...boxFor(node.x, node.label, width), row}));
    return {nodes: placed, rows: placed.length, overflow: []};
  }
  const rows = [];
  const placed = [];
  const overflow = [];
  const put = (node, limit) => {
    const {left, w} = boxFor(node.x, node.label, width);
    let row = rows.findIndex(items => items.every(item => left > item.left + item.w + ROW_GAP || left + w + ROW_GAP < item.left));
    if (row === -1) {
      // 空いている行が無い。上限に達していれば個別には描かず、まとめへ送る。
      if (rows.length >= limit) return false;
      row = rows.length;
      rows.push([]);
    }
    const entry = {...node, left, w, row};
    rows[row].push(entry);
    placed.push(entry);
    return true;
  };
  // 選んだものと、そこへ線が伸びている先は、まとめに隠さない。
  // 隠してしまうと「1つ選べば学問までの線を追える」が成り立たなくなる。
  for (const node of sorted.filter(node => keep.has(node.id))) put(node, Infinity);
  const limit = Math.max(maxRows, rows.length);
  for (const node of sorted.filter(node => !keep.has(node.id))) if (!put(node, limit)) overflow.push(node);
  return {nodes: placed, rows: rows.length, overflow};
}

/**
 * ドラッグ中に、保存せずに位置だけ見せるための箱。layout と同じ式（boxFor）を使うので、
 * 指を離した後にレイアウトが確定しても、プレビューとずれない。
 * 段の中の行までは分からない（ドラッグ中はまだどの行に落ち着くか未定なので）ので、
 * その段の先頭行（row 0）の位置を仮の高さとして返す。
 */
export function previewBox({label, x, lane}, view) {
  const laneInfo = view.lanes.find(item => item.id === lane);
  if (!laneInfo) return null;
  const {left, w} = boxFor(x, label, view.width);
  const y = laneInfo.top + LANE_HEAD + LANE_PAD;
  return {left, w, y, h: NODE_HEIGHT};
}

/**
 * 野原ぜんぶの配置を出す。幅は実際の表示幅をそのまま使い、文字を縮小しない。
 * 段の高さは中身で決まるので、置くほど野原が広がる。
 */
export function layout({placements = [], extraNodes = [], width = 360, expandedLanes = [], keep = new Set()} = {}) {
  const {domains, links} = revealWorld(placements);
  const all = [
    ...placements.map(placement => ({...placement, node: 'placement'})),
    ...domains.map(domain => ({id: `domain-${domain.id}`, lane: 'lab', label: domain.name, x: domain.x, node: 'domain', domain})),
    ...extraNodes.map(node => ({...node, node: 'world'}))
  ];
  let top = 0;
  const lanes = [];
  const positioned = new Map();
  // まとめられた個々のノード id → まとめノード id。線の付け替えと、描くものを減らすために使う。
  const aliases = new Map();
  for (const lane of LANES) {
    const laneNodes = all.filter(node => node.lane === lane.id);
    const expanded = expandedLanes.includes(lane.id);
    const packed = packLane(laneNodes, width, {expanded, keep});
    // まとめが出るときは、その分の1行を余分に確保する（一番下の行に置くため）。
    const rows = Math.max(packed.rows + (packed.overflow.length > 0 ? 1 : 0), lane.minRows);
    // 何も置かれていない段は薄くする。時間の隔たりは見出しの日付が示す。
    const height = rows === 0
      ? LANE_HEAD + 34
      : LANE_HEAD + LANE_PAD + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP + LANE_PAD;
    for (const node of packed.nodes) {
      positioned.set(node.id, {
        ...node,
        y: top + LANE_HEAD + LANE_PAD + node.row * (NODE_HEIGHT + ROW_GAP),
        h: NODE_HEIGHT
      });
    }
    if (packed.overflow.length > 0) {
      // まとめノードの x は、まとめた中身の平均。中身そのものの x は一切触らない。
      const clusterId = `cluster-${lane.id}`;
      const avgX = packed.overflow.reduce((total, node) => total + node.x, 0) / packed.overflow.length;
      const label = `ほか${packed.overflow.length}件`;
      const row = packed.rows;
      positioned.set(clusterId, {
        id: clusterId,
        node: 'cluster',
        lane: lane.id,
        label,
        members: packed.overflow.map(node => node.id),
        x: avgX,
        ...boxFor(avgX, label, width),
        row,
        y: top + LANE_HEAD + LANE_PAD + row * (NODE_HEIGHT + ROW_GAP),
        h: NODE_HEIGHT
      });
      for (const node of packed.overflow) aliases.set(node.id, clusterId);
    }
    lanes.push({
      ...lane,
      top,
      height,
      rows,
      empty: packed.nodes.length === 0 && packed.overflow.length === 0,
      count: laneNodes.length,
      overflow: packed.overflow.length,
      expanded
    });
    top += height;
  }
  // まとめへ送られたノードへの線は、まとめノードへ付け替える。行き先が同じになった線は1本に。
  const seen = new Set();
  const rerouted = [];
  for (const link of [...links, ...extraNodes.flatMap(node => node.links ?? [])]) {
    const from = aliases.get(link.from) ?? link.from;
    const to = aliases.get(link.to) ?? link.to;
    if (from === to) continue; // まとめの中どうしをつなぐ線は、もう意味を持たない
    if (!positioned.has(from) || !positioned.has(to)) continue;
    const key = `${from}>${to}>${link.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rerouted.push({...link, from, to});
  }
  return {
    width,
    height: top,
    lanes,
    nodes: [...positioned.values()],
    links: rerouted,
    byId: positioned,
    aliases
  };
}

/** 画面の縦位置から、どの段に落ちたかを決める。段の外へは出られない。 */
export function laneAt(y, lanes) {
  for (const lane of lanes) if (y >= lane.top && y < lane.top + lane.height) return lane.id;
  return y < 0 ? LANE_IDS[0] : LANE_IDS[LANE_IDS.length - 1];
}

/**
 * 一覧表示の中身。野原の絵を諦めるかわりに、20件でも取りこぼさず読めるようにする。
 * 並べ替えを変えても中身の置きものは消えない――ただ「どうグループ分けするか」が変わるだけ。
 */
export function listGroups(placements, sort = 'lane') {
  if (!placements.length) return [];

  if (sort === 'added') {
    return [{
      id: 'added',
      title: '追加順',
      note: '先に追加したものが上',
      items: placements.map(placement => ({id: placement.id, label: placement.label, kind: 'placement', sub: '', converged: false}))
    }];
  }

  const {domains} = revealWorld(placements);

  if (sort === 'domain') {
    const byId = new Map(placements.map(placement => [placement.id, placement]));
    const linked = new Set();
    const groups = domains.map(domain => {
      for (const id of domain.from) linked.add(id);
      return {
        id: `domain-${domain.id}`,
        title: domain.name,
        note: domain.converged ? '複数の項目に共通' : '',
        items: domain.from.map(id => ({
          id,
          label: byId.get(id)?.label ?? id,
          kind: 'placement',
          sub: domain.name,
          converged: domain.converged
        }))
      };
    });
    // どこにもつながっていない置きものは、ここで初めて姿が見える。無ければ出さない。
    const loose = placements.filter(placement => !linked.has(placement.id));
    if (loose.length) {
      groups.push({
        id: 'loose',
        title: 'まだつながっていない',
        note: '',
        items: loose.map(placement => ({id: placement.id, label: placement.label, kind: 'placement', sub: '', converged: false}))
      });
    }
    return groups;
  }

  // lane（既定）: 段ごと。学問は layout と同じく lab の段に入れる。
  const byLane = new Map(LANES.map(lane => [lane.id, []]));
  for (const placement of placements) byLane.get(placement.lane).push({
    id: placement.id, label: placement.label, kind: 'placement', sub: '', converged: false
  });
  for (const domain of domains) byLane.get('lab').push({
    id: `domain-${domain.id}`, label: domain.name, kind: 'domain', sub: '', converged: domain.converged
  });
  return LANES
    .filter(lane => byLane.get(lane.id).length > 0)
    .map(lane => ({id: lane.id, title: lane.title, note: lane.horizon, items: byLane.get(lane.id)}));
}

/* ---------- 保存するかたち ---------- */

export function validatePlacements(value, catalog) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > PLACEMENT_LIMIT) throw new Error('Invalid placements');
  const seen = new Set();
  const placements = value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid placement');
    if (typeof item.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(item.id) || seen.has(item.id)) throw new Error('Invalid placement id');
    seen.add(item.id);
    if (!LANE_IDS.includes(item.lane)) throw new Error('Unknown lane');
    if (typeof item.x !== 'number' || !Number.isFinite(item.x) || item.x < 0 || item.x > 1) throw new Error('Invalid placement position');
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > LABEL_LIMIT) throw new Error('Invalid placement label');
    if (!PLACEMENT_KINDS.includes(item.kind)) throw new Error('Unknown placement kind');
    const isCatalogKind = item.kind === 'topic' || item.kind === 'activity' || item.kind === 'resource';
    const ref = item.ref ?? null;
    if (item.kind === 'topic' && !Object.hasOwn(knowledge.topics, ref)) throw new Error('Unknown interest');
    if (item.kind === 'activity' && !catalog.activities.has(ref)) throw new Error('Unknown activity');
    if (item.kind === 'resource' && !catalog.resources.has(ref)) throw new Error('Unknown resource');
    // custom / link / photo はどれも本人が足したもので、カタログの裏付けを持たない。
    if (SELF_KINDS.includes(item.kind) && ref !== null) throw new Error('A written entry has no catalog reference');
    const verb = item.verb ?? null;
    if (verb !== null && !catalog.verbs.has(verb)) throw new Error('Unknown verb on placement');
    const note = item.note ?? '';
    if (typeof note !== 'string' || note.length > 140) throw new Error('Invalid placement note');

    // null は提示された接続を使う状態。配列は本人が明示的に編集した接続で、空配列も有効。
    const customDomains = item.domains ?? null;
    if (customDomains !== null) {
      if (!Array.isArray(customDomains) || customDomains.length > catalog.domains.size) throw new Error('Invalid placement domains');
      if (new Set(customDomains).size !== customDomains.length) throw new Error('Duplicate placement domain');
      if (!customDomains.every(id => typeof id === 'string' && catalog.domains.has(id))) throw new Error('Unknown domain on placement');
    }

    // 「何について」のタグ。catalog 由来のものは、既にそれ自身が何についてかを名乗っている。
    const topic = item.topic ?? null;
    if (topic !== null) {
      if (isCatalogKind) throw new Error('A catalog entry cannot carry its own topic tag');
      if (!Object.hasOwn(knowledge.topics, topic)) throw new Error('Unknown topic tag');
    }

    // URL はネットワーク通信をしないので中身までは見ない。javascript: や data: を
    // 貼られて実行してしまわないよう、http/https だけを通す。
    const url = item.url ?? null;
    if (url !== null) {
      if (isCatalogKind) throw new Error('A catalog entry cannot carry a url');
      if (typeof url !== 'string' || url.length > URL_LIMIT) throw new Error('Invalid placement url');
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Invalid placement url');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid placement url');
    }
    if (item.kind === 'link' && url === null) throw new Error('A link entry needs a url');

    const title = item.title ?? null;
    if (title !== null) {
      if (isCatalogKind) throw new Error('A catalog entry cannot carry its own title');
      if (typeof title !== 'string' || title.length > TITLE_LIMIT) throw new Error('Invalid placement title');
    }

    // 写真は端末に保存する dataURL そのもの。画像以外や大きすぎるものは保存できないと伝える。
    const photo = item.photo ?? null;
    if (photo !== null) {
      if (isCatalogKind) throw new Error('A catalog entry cannot carry a photo');
      if (typeof photo !== 'string' || photo.length > PHOTO_BYTES) throw new Error('Invalid placement photo');
      if (!photo.startsWith('data:image/jpeg;base64,') && !photo.startsWith('data:image/png;base64,')) throw new Error('Invalid placement photo');
    }
    if (item.kind === 'photo' && photo === null) throw new Error('A photo entry needs a photo');

    // source は保存データにあればそれだけを信じ、無ければ kind から導く。
    const rawSource = item.source ?? null;
    if (rawSource !== null && !['catalog', 'self', 'family'].includes(rawSource)) throw new Error('Unknown placement source');
    const source = rawSource ?? (SELF_KINDS.includes(item.kind) ? 'self' : 'catalog');

    return {id: item.id, lane: item.lane, x: item.x, label: item.label.trim(), kind: item.kind, ref, verb, note, topic, url, title, photo, domains: customDomains, source};
  });
  if (placements.filter(placement => placement.photo !== null).length > PHOTO_LIMIT) throw new Error('Too many photos');
  return placements;
}

export function newPlacementId() {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

/** 置く場所を決めていないときに、その段の空いているところへ置く。 */
export function freeX(placements, lane) {
  const taken = placements.filter(placement => placement.lane === lane).map(placement => placement.x).sort((a, b) => a - b);
  if (!taken.length) return 0.5;
  let best = 0.5;
  let bestGap = -1;
  for (const candidate of [0.16, 0.32, 0.5, 0.68, 0.84]) {
    const gap = Math.min(...taken.map(x => Math.abs(x - candidate)));
    if (gap > bestGap) {bestGap = gap; best = candidate;}
  }
  return best;
}
