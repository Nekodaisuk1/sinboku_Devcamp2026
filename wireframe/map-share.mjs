import {validatePlacements} from './field.mjs';

export const MAP_SHARE_LIMIT = 6000;

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

/** 写真本体と個人的なメモを除き、グラフを再描画するための情報だけをリンクへ入れる。 */
export function encodeMapShare(placements, catalog) {
  const checked = validatePlacements(placements, catalog);
  const compact = checked.map(item => [
    item.id, item.lane, item.x, item.label, item.kind === 'photo' ? 'custom' : item.kind,
    item.kind === 'photo' ? null : item.ref, item.verb, item.topic,
    item.kind === 'photo' ? null : item.url, item.domains, item.kind === 'photo' ? 'self' : item.source
  ]);
  const encoded = toBase64Url(JSON.stringify({v: 1, p: compact}));
  if (encoded.length > MAP_SHARE_LIMIT) throw new Error('マップの共有リンクが長すぎます。共有する項目を減らしてください。');
  return encoded;
}

export function decodeMapShare(value, catalog) {
  if (typeof value !== 'string' || value.length > MAP_SHARE_LIMIT) throw new Error('マップの共有リンクが長すぎます。');
  try {
    const payload = JSON.parse(fromBase64Url(value));
    if (payload?.v !== 1 || !Array.isArray(payload.p)) throw new Error('Invalid map share');
    const placements = payload.p.map(item => {
      if (!Array.isArray(item) || item.length !== 11) throw new Error('Invalid map node');
      const [id, lane, x, label, kind, ref, verb, topic, url, domains, source] = item;
      return {
        id, lane, x, label, kind, ref, verb, note: '', topic, url,
        title: kind === 'link' ? label : null, photo: null, domains, source
      };
    });
    return validatePlacements(placements, catalog);
  } catch (error) {
    if (/長すぎ/.test(error.message)) throw error;
    throw new Error('マップの共有リンクを読み取れませんでした。');
  }
}
