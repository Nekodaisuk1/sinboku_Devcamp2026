// 「やったこと」の記録。進捗管理ではない。締切・連続記録・達成率は持たない。
// 数えるのは回数ではなく、あとから自分で読み返せる行が残ることだけ。
export const LOG_LIMIT = 500;
export const LOG_TEXT_LIMIT = 140;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function today(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(date);
}

export function validateEntry(entry, {verbIds, activityIds, placementIds = null}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid record');
  if (typeof entry.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(entry.id)) throw new Error('Invalid record id');
  if (!DATE.test(entry.date) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date) throw new Error('Invalid record date');
  if (typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > LOG_TEXT_LIMIT) throw new Error('Invalid record text');
  const verb = entry.verb ?? null;
  if (verb !== null && !verbIds.has(verb)) throw new Error('Unknown verb on record');
  // 活動アイデアから作った記録は出どころを残す。あとで本人が書き換えても、元がどれかは消さない。
  const activity = entry.activity ?? null;
  if (activity !== null && !activityIds.has(activity)) throw new Error('Unknown activity on record');
  // 野原の置きものに紐づく記録。置きものを外しても記録は消さず、紐づけだけ切る。
  const placement = entry.placement ?? null;
  if (placement !== null && placementIds && !placementIds.has(placement)) throw new Error('Unknown placement on record');
  return {id: entry.id, date: entry.date, text: entry.text.trim(), verb, activity, placement};
}

export function validateLog(value, context) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LOG_LIMIT) throw new Error('Invalid record list');
  const entries = value.map(entry => validateEntry(entry, context));
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate record id');
  return sortLog(entries);
}

// 新しいものが上。同じ日のなかでは、あとから足したものが上に来る。
export function sortLog(entries) {
  return [...entries].sort((a, b) => a.date === b.date ? 0 : a.date < b.date ? 1 : -1);
}

export function addEntry(entries, {text, verb = null, activity = null, placement = null, date = today(), id = newId()}) {
  if (entries.length >= LOG_LIMIT) throw new Error(`記録は${LOG_LIMIT}件までです。古いものを消してから足してください。`);
  return sortLog([{id, date, text: String(text).trim().slice(0, LOG_TEXT_LIMIT), verb, activity, placement}, ...entries]);
}

export function removeEntry(entries, id) {
  return entries.filter(entry => entry.id !== id);
}

export function newId() {
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

// 記録を月ごとにまとめる。「中3の秋に何をしていたか」を後から読むための単位。
export function byMonth(entries) {
  const months = new Map();
  for (const entry of sortLog(entries)) {
    const key = entry.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(entry);
  }
  return [...months].map(([month, items]) => ({month, items}));
}

export function recentCount(entries, days = 7, from = new Date()) {
  const limit = new Date(from.getTime() - days * 86400000);
  return entries.filter(entry => new Date(`${entry.date}T00:00:00+09:00`) >= limit).length;
}
