import {validateProgress} from './guide.mjs';
import {validatePersonalMap} from "./personal-map.mjs";
export const STORAGE_KEY = 'shimboku.workspace.v1';

export function encodeWorkspace(state) {
  return JSON.stringify({version:1, progress:state.progress, personalMap:state.personalMap, saved:[...state.saved], notes:Object.fromEntries([...state.saved].map(id => [id,state.notes[id] || ''])), topic:state.topic, selected:state.selected, view:state.view, opportunity:state.opportunity, anchor:state.anchor || null, reflections:Object.fromEntries([...state.saved].filter(id=>state.reflections?.[id]).map(id=>[id,state.reflections[id]])), routes:[...(state.heldRoutes || [])], sharing:state.sharing || {visibility:{},recommendations:[]}});
}

export function decodeWorkspace(raw, catalog) {
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.saved) || !data.notes || typeof data.notes !== 'object' || Array.isArray(data.notes)) throw new Error('Invalid workspace format');
  if (!data.saved.every(id => typeof id === 'string' && Object.hasOwn(catalog.items,id))) throw new Error('Workspace contains unknown candidates');
  if (!Object.hasOwn(catalog.topics,data.topic) || !Object.hasOwn(catalog.domains,data.selected) || !['learn','places'].includes(data.view)) throw new Error('Invalid exploration state');
  if (data.opportunity !== null && (!Object.hasOwn(catalog.opportunities,data.opportunity) || catalog.opportunities[data.opportunity].domain !== data.selected && !catalog.opportunities[data.opportunity].domains?.includes(data.selected))) throw new Error('Invalid opportunity');
  const notes = {};
  for (const id of data.saved) {
    const note = Object.hasOwn(data.notes,id) ? data.notes[id] : '';
    if (typeof note !== 'string') throw new Error('Invalid note');
    notes[id] = note;
  }
  const anchor = data.anchor && catalog.topics[data.topic].ids.includes(data.anchor) ? data.anchor : catalog.topics[data.topic].ids[0];
  const reflections = {};
  if (data.reflections !== undefined) {
    if (!data.reflections || typeof data.reflections !== 'object' || Array.isArray(data.reflections)) throw new Error('Invalid reflections');
    for(const [id,value] of Object.entries(data.reflections)) {
      if(!data.saved.includes(id) || !['curious','tried','unsure'].includes(value)) throw new Error('Invalid reflection');
      reflections[id]=value;
    }
  }
  const heldRoutes = new Set();
  if (data.routes !== undefined) {
    if (!Array.isArray(data.routes) || data.routes.length > 100) throw new Error('Invalid held routes');
    const known = new Set(catalog.routes || []);
    for (const id of data.routes) {
      if (typeof id !== 'string' || !known.has(id)) throw new Error('Workspace contains unknown routes');
      heldRoutes.add(id);
    }
  }
  const sharing = validateSharing(data.sharing, catalog, data.saved);
  const personalMap=validatePersonalMap(data.personalMap,catalog.items);
  return {progress:validateProgress(data.progress,personalMap),personalMap,sharing,reflections,heldRoutes,saved:new Set(data.saved),notes,topic:data.topic,selected:data.selected,view:data.view,opportunity:data.opportunity,anchor};
}


export function publicCandidates(state, items) {
  return [...state.saved].filter(id => state.sharing?.visibility[id] === 'family').map(id => ({id, name:items[id].name, domain:items[id].domain || id}));
}

export function validateRecommendation(item, domains) {
  if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 || typeof item.message !== 'string' || item.message.length > 600) throw new Error('おすすめのタイトル・メッセージを確認してください。');
  if (!Array.isArray(item.tags) || !item.tags.length || item.tags.length > 5 || !item.tags.every(id => Object.hasOwn(domains,id))) throw new Error('関連する領域を1つ以上選んでください。');
  if (!['イベント','進学','部活動','学外活動','読みもの'].includes(item.kind) || !['new','kept','dismissed'].includes(item.status)) throw new Error('おすすめの種類・状態が正しくありません。');
  if (typeof item.url !== 'string' || typeof item.photo !== 'string' || (!item.url && !item.photo)) throw new Error('URLか写真を添えてください。');
  if (item.url) {
    let url;
    try { url = new URL(item.url); } catch { throw new Error('正しいURLを入力してください。'); }
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password || item.url.length > 2048) throw new Error('http または https のURLを入力してください。');
  }
  if (item.photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(item.photo) || item.photo.length > 700000)) throw new Error('写真の形式またはサイズを確認してください。');
  return {id:item.id,title:item.title.trim(),message:item.message,url:item.url,photo:item.photo,tags:[...new Set(item.tags)],kind:item.kind,status:item.status,...(item.remote===true?{remote:true}:{})};
}

export function validateSharing(value, catalog, saved) {
  if (value === undefined) return {visibility:{},recommendations:[]};
  if (!value || !value.visibility || typeof value.visibility !== 'object' || Array.isArray(value.visibility) || !Array.isArray(value.recommendations) || value.recommendations.length > 100) throw new Error('Invalid sharing data');
  const visibility = {};
  for (const [id,status] of Object.entries(value.visibility)) {
    if (!saved.includes(id) || !['private','family'].includes(status)) throw new Error('Invalid visibility');
    visibility[id] = status;
  }
  const recommendations = value.recommendations.map(item => validateRecommendation(item,catalog.domains));
  if (new Set(recommendations.map(item => item.id)).size !== recommendations.length) throw new Error('Duplicate recommendations');
  return {visibility,recommendations};
}
