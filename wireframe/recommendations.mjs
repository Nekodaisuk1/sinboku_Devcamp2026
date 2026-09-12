export const RECOMMENDATION_LIMIT = 30;
export const RECOMMENDATION_TITLE_LIMIT = 80;
export const RECOMMENDATION_NOTE_LIMIT = 140;
export const RECOMMENDATION_URL_LIMIT = 400;

const idPattern = /^[a-z0-9-]{1,40}$/;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

function safeUrl(value) {
  if (typeof value !== 'string' || value.length > RECOMMENDATION_URL_LIMIT) return false;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function validateRecommendation(value, catalog, {stored = true} = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('おすすめの形式が正しくありません。');
  const id = stored ? value.id : null;
  if (stored && (typeof id !== 'string' || !idPattern.test(id))) throw new Error('おすすめのIDが正しくありません。');
  if (!safeUrl(value.url)) throw new Error('おすすめのURLは http または https で入力してください。');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > RECOMMENDATION_TITLE_LIMIT) throw new Error('おすすめの名前が正しくありません。');
  const note = value.note ?? '';
  if (typeof note !== 'string' || note.length > RECOMMENDATION_NOTE_LIMIT) throw new Error('おすすめの一言が長すぎます。');
  const topic = value.topic ?? null;
  if (topic !== null && !catalog.topics.has(topic)) throw new Error('おすすめの「何について」が正しくありません。');
  const verb = value.verb ?? null;
  if (verb !== null && !catalog.verbs.has(verb)) throw new Error('おすすめの「関わり方」が正しくありません。');
  const status = stored ? value.status ?? 'new' : 'new';
  if (!['new', 'later'].includes(status)) throw new Error('おすすめの状態が正しくありません。');
  const receivedOn = stored ? value.receivedOn : null;
  if (stored && !validDate(receivedOn)) throw new Error('おすすめの受取日が正しくありません。');
  return {id, url: value.url, title: value.title.trim(), note: note.trim(), topic, verb, status, receivedOn};
}

export function validateRecommendations(value, catalog) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > RECOMMENDATION_LIMIT) throw new Error('おすすめが多すぎます。');
  const result = value.map(item => validateRecommendation(item, catalog));
  if (new Set(result.map(item => item.id)).size !== result.length) throw new Error('同じおすすめIDがあります。');
  return result;
}

export function encodeRecommendation(value, catalog) {
  const checked = validateRecommendation(value, catalog, {stored: false});
  return toBase64Url(JSON.stringify({
    version: 1,
    url: checked.url,
    title: checked.title,
    note: checked.note,
    topic: checked.topic,
    verb: checked.verb
  }));
}

export function decodeRecommendation(value, catalog) {
  if (typeof value !== 'string' || value.length > 1800) throw new Error('おすすめの共有リンクが長すぎます。');
  let parsed;
  try {
    parsed = JSON.parse(fromBase64Url(value));
  } catch {
    throw new Error('おすすめの共有リンクを読み取れませんでした。');
  }
  if (parsed?.version !== 1) throw new Error('おすすめの共有リンクの形式が違います。');
  return validateRecommendation(parsed, catalog, {stored: false});
}

export function receiveRecommendation(payload, existing, catalog, {id, receivedOn}) {
  const checked = validateRecommendation(payload, catalog, {stored: false});
  if (existing.some(item => item.url === checked.url && item.title === checked.title)) return {items: existing, added: false};
  const stored = validateRecommendation({...checked, id, receivedOn, status: 'new'}, catalog);
  const items = [stored, ...existing];
  return {items: items.slice(0, RECOMMENDATION_LIMIT), added: true};
}

export function newRecommendationId() {
  return `r${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}
