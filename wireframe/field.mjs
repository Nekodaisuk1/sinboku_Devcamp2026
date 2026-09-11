import {decisionPoints} from './routes.mjs';
import {routesForDomain, hasRoutes} from './routes.mjs';
import knowledge from './knowledge-data.mjs';
import {verbById, activityById} from './verbs.mjs';

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

export const laneById = id => LANES.find(lane => lane.id === id) || null;
export const laneIndex = id => LANE_IDS.indexOf(id);

/* ---------- 置いたものが、どの学問につながるか ---------- */

/**
 * 置いたもの1つから伸びる先の学問。
 * 好きなこと → その入口が扱う領域。活動・自由入力 → その動詞を続けている領域。
 * 掲載情報 → その情報が属する領域。つながりが分からないものは、線を作らない。
 */
export function reachOf(placement) {
  if (placement.kind === 'topic') return knowledge.topics[placement.ref]?.ids ?? [];
  if (placement.kind === 'resource') return knowledge.resources[placement.ref]?.domains ?? [];
  if (placement.kind === 'activity') {
    const activity = activityById(placement.ref);
    return activity ? verbById(activity.verb)?.domains ?? [] : [];
  }
  // 自由入力は、本人が動詞を選んだときだけつながる。推測でつながない。
  if (placement.kind === 'custom') return placement.verb ? verbById(placement.verb)?.domains ?? [] : [];
  return [];
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

/**
 * 学問を選んだときだけ、そこへの経路が中間の段に現れる。
 * 4本ぶんを一度に出すと読めないので、選んだ1本だけを通す。
 */
export function routePath(domainId, kindId, anchorX) {
  if (!hasRoutes(domainId)) return {nodes: [], links: []};
  const route = routesForDomain(domainId, knowledge.domains[domainId]).find(item => item.kind === kindId);
  if (!route) return {nodes: [], links: []};
  const stages = {university: 'faculty', course: 'course', highschool: 'highschool'};
  const nodes = [];
  let previous = `domain-${domainId}`;
  const links = [];
  for (const step of route.steps) {
    const lane = stages[step.stage];
    if (!lane) continue;
    const id = `route-${route.id}-${step.stage}`;
    nodes.push({id, lane, label: step.title, kind: 'route', detail: step.detail, link: step.link ?? null, x: anchorX});
    links.push({from: id, to: previous, kind: 'route'});
    previous = id;
  }
  return {nodes, links, route};
}

/* ---------- 並べ方：縦は時間、横は置いた場所。重なる分だけ段が厚くなる ---------- */

const NODE_HEIGHT = 34;
const ROW_GAP = 10;
const SIDE = 14;
const LANE_PAD = 18;
const LANE_HEAD = 26;

export function nodeWidth(label, width) {
  return Math.min(Math.max(64, [...String(label)].length * 13 + 26), Math.max(90, width - SIDE * 2));
}

/** 同じ段の中で重なったものを、下の行へ送る。横位置は本人が置いたまま動かさない。 */
export function packLane(nodes, width) {
  const rows = [];
  const placed = [];
  for (const node of [...nodes].sort((a, b) => a.x - b.x)) {
    const w = nodeWidth(node.label, width);
    const left = Math.min(Math.max(node.x * width - w / 2, SIDE), Math.max(SIDE, width - SIDE - w));
    let row = rows.findIndex(items => items.every(item => left > item.left + item.w + ROW_GAP || left + w + ROW_GAP < item.left));
    if (row === -1) {row = rows.length; rows.push([]);}
    const entry = {...node, left, w, row};
    rows[row].push(entry);
    placed.push(entry);
  }
  return {nodes: placed, rows: rows.length};
}

/**
 * 野原ぜんぶの配置を出す。幅は実際の表示幅をそのまま使い、文字を縮小しない。
 * 段の高さは中身で決まるので、置くほど野原が広がる。
 */
export function layout({placements = [], extraNodes = [], width = 360} = {}) {
  const {domains, links} = revealWorld(placements);
  const all = [
    ...placements.map(placement => ({...placement, node: 'placement'})),
    ...domains.map(domain => ({id: `domain-${domain.id}`, lane: 'lab', label: domain.name, x: domain.x, node: 'domain', domain})),
    ...extraNodes.map(node => ({...node, node: 'world'}))
  ];
  let top = 0;
  const lanes = [];
  const positioned = new Map();
  for (const lane of LANES) {
    const packed = packLane(all.filter(node => node.lane === lane.id), width);
    const rows = Math.max(packed.rows, lane.minRows);
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
    lanes.push({...lane, top, height, rows, empty: packed.nodes.length === 0});
    top += height;
  }
  return {
    width,
    height: top,
    lanes,
    nodes: [...positioned.values()],
    links: [...links, ...extraNodes.flatMap(node => node.links ?? [])].filter(link => positioned.has(link.from) && positioned.has(link.to)),
    byId: positioned
  };
}

/** 画面の縦位置から、どの段に落ちたかを決める。段の外へは出られない。 */
export function laneAt(y, lanes) {
  for (const lane of lanes) if (y >= lane.top && y < lane.top + lane.height) return lane.id;
  return y < 0 ? LANE_IDS[0] : LANE_IDS[LANE_IDS.length - 1];
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
    if (!['topic', 'activity', 'resource', 'custom'].includes(item.kind)) throw new Error('Unknown placement kind');
    const ref = item.ref ?? null;
    if (item.kind === 'topic' && !Object.hasOwn(knowledge.topics, ref)) throw new Error('Unknown interest');
    if (item.kind === 'activity' && !catalog.activities.has(ref)) throw new Error('Unknown activity');
    if (item.kind === 'resource' && !catalog.resources.has(ref)) throw new Error('Unknown resource');
    if (item.kind === 'custom' && ref !== null) throw new Error('A written entry has no catalog reference');
    const verb = item.verb ?? null;
    if (verb !== null && !catalog.verbs.has(verb)) throw new Error('Unknown verb on placement');
    const note = item.note ?? '';
    if (typeof note !== 'string' || note.length > 140) throw new Error('Invalid placement note');
    return {id: item.id, lane: item.lane, x: item.x, label: item.label.trim(), kind: item.kind, ref, verb, note};
  });
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
