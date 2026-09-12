import knowledge from './knowledge-data.mjs';
import {allActivities} from './verbs.mjs';

export const CHECKED_ON = '2026-09-11';

export function normalizeQuery(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .trim();
}

function entries() {
  const {domains, topics, resources, verbs} = knowledge;
  return [
    ...verbs.map(verb => ({
      id: verb.id, type: 'verb', name: verb.label, summary: verb.summary,
      text: [verb.label, verb.summary, verb.detail]
    })),
    ...Object.entries(topics).map(([id, topic]) => ({
      id, type: 'topic', name: topic.label, summary: topic.root,
      text: [topic.label, topic.root, ...(topic.keywords || [])]
    })),
    ...allActivities().map(activity => ({
      id: activity.id, type: 'activity', name: activity.title, summary: activity.description,
      activity, text: [activity.title, activity.description, activity.label, topics[activity.topic]?.label || '']
    })),
    ...Object.entries(domains).map(([id, domain]) => ({
      id, type: 'domain', name: domain.name, summary: domain.summary,
      text: [domain.name, domain.summary, domain.question, ...domain.tags]
    })),
    ...Object.entries(resources).map(([id, resource]) => ({
      id, type: 'resource', name: resource.name, summary: resource.summary, resource,
      text: [resource.name, resource.summary, resource.reason, resource.kind,
             ...(resource.keywords || []),
             ...resource.domains.map(key => domains[key].name)]
    }))
  ];
}

/**
 * 掲載範囲のなかだけを検索する。該当がなければ0件と表示し、近い候補を捏造しない。
 * filter: all | home（家で無料でできる）| activity（やってみる）| study（学校・大学）
 */
export function searchCatalog(query, filter = 'all') {
  const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
  return entries().filter(entry => {
    if (filter === 'home' && !(entry.activity?.athome || (entry.resource?.online && entry.resource?.free))) return false;
    if (filter === 'activity' && !(entry.activity || ['try', 'continue'].includes(entry.resource?.group))) return false;
    if (filter === 'study' && entry.resource?.group !== 'study') return false;
    if (!terms.length) return true;
    const text = normalizeQuery(entry.text.join(' '));
    return terms.every(term => text.includes(term));
  }).map(entry => ({
    ...entry,
    score: terms.reduce((score, term) => score + (normalizeQuery(entry.name).includes(term) ? 2 : 1), 0)
  })).sort((a, b) => b.score - a.score);
}

export function catalogIds() {
  return {
    resources: new Set(Object.keys(knowledge.resources)),
    verbs: new Set(knowledge.verbs.map(verb => verb.id)),
    activities: new Set(allActivities().map(activity => activity.id)),
    topics: new Set(Object.keys(knowledge.topics)),
    domains: new Set(Object.keys(knowledge.domains))
  };
}

/* --- Build 24: 絞り込み・鮮度・掲載範囲 ---
 * ここから下は純粋な関数だけ。DOM に触らない・通信しない。
 * resources はどれも [{id, ...resource}, ...] という配列で受け取る（呼び出し側が
 * knowledge.resources のオブジェクトから変換して渡す）。today は 'YYYY-MM-DD' の
 * 文字列で受け取る。checkedOn / date / deadline / reviewAfter もすべて同じ形なので、
 * 文字列のまま比較すれば時差や Date のタイムゾーンでずれない。
 */

export const CATEGORIES = [
  {id: 'material', label: '教材'},
  {id: 'place', label: '施設'},
  {id: 'event', label: 'イベント'},
  {id: 'continuing', label: '継続活動'},
  {id: 'club', label: '部活動'},
  {id: 'school', label: '学校'},
  {id: 'university', label: '大学'}
];

// これより古い確認日を「そろそろ確認したほうがいい」とみなす日数。通信して確かめられない代わりの目安。
export const STALE_DAYS = 180;

// 'YYYY-MM-DD' 文字列同士の日数差。両方 UTC 深夜として解釈するので、時差でずれない。
function daysBetween(fromDateString, toDateString) {
  const ms = Date.parse(`${toDateString}T00:00:00Z`) - Date.parse(`${fromDateString}T00:00:00Z`);
  return Math.floor(ms / 86400000);
}

/**
 * 掲載情報の鮮度。通信しないので、日付から分かることだけを言う。
 * リンクが生きているかどうかはここでは分からない。分からないことを分かったふりをしない。
 * 複数の状態にあてはまるときは、開催日 > 期限 > 確認日 の順で1つだけ返す
 *（もう終わったこと・もう申し込めないことのほうが、確認が古いことより先に言うべきだから）。
 */
export function freshnessOf(resource, today) {
  if (resource.date && resource.date < today) {
    return {state: 'closed', note: '開催日をすでに過ぎています。'};
  }
  if (resource.deadline && resource.deadline < today) {
    return {state: 'over', note: '申込の期限をすでに過ぎています。'};
  }
  if (resource.reviewAfter && resource.reviewAfter < today) {
    return {state: 'over', note: '確認が必要な時期を過ぎています。公式案内で確認してください。'};
  }
  if (resource.checkedOn && daysBetween(resource.checkedOn, today) >= STALE_DAYS) {
    return {state: 'stale', note: `最後の確認から${daysBetween(resource.checkedOn, today)}日たっています。公式案内で確認してください。`};
  }
  return {state: 'ok', note: null};
}

/**
 * 絞り込み。指定が無い項目では絞らない（絞るのは本人が操作したときだけ）。
 * 不明（unknown / null / []）は「該当なし」ではないので、意味のある絞り込みでは基本的に残す。
 * filters: {category, prefecture, online, cost, grade, when}
 */
export function filterResources(resources, filters = {}, today) {
  const {category, prefecture, online, cost, grade, when} = filters;
  return resources.filter(resource => {
    if (category && resource.category !== category) return false;

    // 場所に縛られないもの（prefecture: null）は、どの県を選んでも対象からは外さない。
    if (prefecture) {
      const place = resource.prefecture ?? null;
      if (place !== null && place !== prefecture) return false;
    }

    if (online && !resource.online) return false;

    // cost は「無料だと確認できたものだけ」を出すための絞り込み。unknown を無料扱いしない。
    if (cost === 'free' && resource.cost !== 'free') return false;

    // 対象学年が書かれていない（grades: []）ものは、絞り込みで消さない。
    if (grade) {
      const grades = resource.grades ?? [];
      if (grades.length && !grades.includes(grade)) return false;
    }

    // 日付を持たないものは、いつでも良い情報として upcoming 側に残す。
    if (when === 'upcoming' && resource.date && resource.date < today) return false;
    if (when === 'past' && !(resource.date && resource.date < today)) return false;

    return true;
  });
}

/** どこまで載っているか。数えるだけで、足りないことを隠さない。 */
export function coverage(resources) {
  const total = resources.length;

  const prefectureCounts = new Map();
  for (const resource of resources) {
    const key = resource.prefecture ?? null;
    prefectureCounts.set(key, (prefectureCounts.get(key) || 0) + 1);
  }
  // null（場所に縛られない）は「どこからでも」として最後に置く。件数の多さでは並べない特別扱い。
  const byPrefecture = [...prefectureCounts.entries()]
    .filter(([prefecture]) => prefecture !== null)
    .sort((a, b) => b[1] - a[1])
    .map(([prefecture, count]) => ({prefecture, count}));
  if (prefectureCounts.has(null)) {
    byPrefecture.push({prefecture: null, count: prefectureCounts.get(null)});
  }

  // 7種類全部を返す。0件の種類も「まだ載せていない」という意味のある情報なので隠さない。
  const categoryCounts = new Map();
  for (const resource of resources) {
    categoryCounts.set(resource.category, (categoryCounts.get(resource.category) || 0) + 1);
  }
  const byCategory = CATEGORIES
    .map(category => ({category: category.id, label: category.label, count: categoryCounts.get(category.id) || 0}));

  // knowledge.domains の全学問を基準にする。0件の学問こそ「掲載が薄い」の一番極端な形なので、
  // 実際に出てきた domain だけを数えると消えてしまう。
  const domainCounts = new Map();
  for (const resource of resources) {
    if (!resource.domain) continue;
    domainCounts.set(resource.domain, (domainCounts.get(resource.domain) || 0) + 1);
  }
  const byDomain = Object.keys(knowledge.domains)
    .map(domain => ({
      domain, name: knowledge.domains[domain].name, count: domainCounts.get(domain) || 0
    }))
    .sort((a, b) => b.count - a.count)
    .map(entry => ({...entry, thin: entry.count < 3})); // 掲載が薄い領域（0件も含む）を隠さないため

  return {total, byPrefecture, byCategory, byDomain};
}

/** 掲載範囲を一文で言う。全国対応のように見せないための文。 */
export function coverageSentence(resources) {
  const {total, byPrefecture} = coverage(resources);
  const withPlace = byPrefecture.filter(entry => entry.prefecture !== null);
  if (!withPlace.length) {
    return `いま載っているのは${total}件です。都道府県で絞れる情報はまだありません。`;
  }
  const top = withPlace.slice(0, 3).map(entry => `${entry.prefecture}${entry.count}件`).join('・');
  return `いま載っているのは${total}件です。場所のあるものは${top}に偏っていて、全国は網羅していません。`;
}
