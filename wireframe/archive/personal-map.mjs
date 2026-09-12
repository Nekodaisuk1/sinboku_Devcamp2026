import {validateInquiry} from './inquiry.mjs';
export const emptyPersonalMap=()=>({version:1,nodes:[{id:'root',parent:null,title:'今の自分の「気になる」',note:'',reason:'',source:null}],links:[]});
export function validatePersonalMap(value,items) {
  if(value===undefined) return emptyPersonalMap();
  if(!value || value.version!==1 || !Array.isArray(value.nodes) || !Array.isArray(value.links) || !value.nodes.length || value.nodes.length>40 || value.links.length>80) throw new Error('Invalid personal map');
  const ids=new Set(value.nodes.map(node=>node?.id));
  if(ids.size!==value.nodes.length || !ids.has('root')) throw new Error('Invalid map identifiers');
  const nodes=value.nodes.map(node=>{
    if(!node || typeof node.id!=='string' || !/^[\w-]{1,80}$/.test(node.id) || typeof node.title!=='string' || !node.title.trim() || node.title.length>80 || typeof node.note!=='string' || node.note.length>1500 || typeof node.reason!=='string' || node.reason.length>160) throw new Error('Invalid map node');
    if(node.id==='root'?node.parent!==null:!ids.has(node.parent)) throw new Error('Missing map parent');
    if(node.source!==null && (typeof node.source!=='string' || !Object.hasOwn(items,node.source))) throw new Error('Unknown map source');
    return {id:node.id,parent:node.parent,title:node.title,note:node.note,reason:node.reason,source:node.source,...(node.inquiry ? {inquiry:validateInquiry(node.inquiry)} : {}),...(node.reference ? {reference:validateReference(node.reference,items)} : {})};
  });
  for(const node of nodes) {
    const seen=new Set();let current=node;
    while(current.parent!==null) {if(seen.has(current.id)) throw new Error('Map cannot contain a cycle');seen.add(current.id);current=nodes.find(item=>item.id===current.parent);}
  }
  const pairs=new Set();
  const links=value.links.map(link=>{
    if(!link || !ids.has(link.from) || !ids.has(link.to) || link.from===link.to || typeof link.reason!=='string' || !link.reason.trim() || link.reason.length>160) throw new Error('Invalid map connection');
    const pair=[link.from,link.to].sort().join(':');if(pairs.has(pair)) throw new Error('Duplicate map connection');pairs.add(pair);
    return {from:link.from,to:link.to,reason:link.reason};
  });
  return {version:1,nodes,links};
}
export function descendants(map,id) {
  const found=new Set([id]);let changed=true;
  while(changed) {changed=false;for(const node of map.nodes) if(found.has(node.parent) && !found.has(node.id)) {found.add(node.id);changed=true;}}
  return found;
}
export function removeMapBranch(map,id) {
  if(id==='root') throw new Error('The root cannot be removed');
  const removed=descendants(map,id);
  return {...map,nodes:map.nodes.filter(node=>!removed.has(node.id)),links:map.links.filter(link=>!removed.has(link.from) && !removed.has(link.to))};
}

// Import paths atomically, preserving edits on branches already in the map.
export function integratePaths(map, paths, parent, items, makeId=()=>crypto.randomUUID()) {
  const next=structuredClone(map);
  if(!next.nodes.some(node=>node.id===parent)) throw new Error('Unknown integration parent');
  const imported=[];
  for(const path of paths) {
    let target=parent;
    for(const entry of path) {
      const stableId=entry.key ? `interest-${entry.key}-${target}` : null;
      let node=next.nodes.find(node=>node.parent===target && (entry.source ? node.source===entry.source : stableId && node.id===stableId));
      if(!node) {
        node={id:stableId || makeId(),parent:target,title:entry.title,source:entry.source || null,reason:entry.reason || '',note:entry.note || ''};
        next.nodes.push(node);
      }
      target=node.id;
    }
    imported.push(target);
  }
  return {map:validatePersonalMap(next,items),selected:imported.at(-1) || parent,added:next.nodes.length-map.nodes.length};
}

export function validateReference(value,items) {
  if(!value || typeof value.title!=='string' || !value.title.trim() || value.title.length>100 || typeof value.url!=='string' || typeof value.photo!=='string' || !['自分で追加','保護者から','操作モックから'].includes(value.by) || !Array.isArray(value.tags) || value.tags.length>5 || !value.tags.every(id=>Object.hasOwn(items,id))) throw new Error('Invalid reference');
  if(value.url) {
    const url=new URL(value.url);
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password || value.url.length>2048) throw new Error('Invalid reference URL');
  }
  if(value.photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.photo) || value.photo.length>700000)) throw new Error('Invalid reference photo');
  if(!value.url && !value.photo) throw new Error('Missing reference');
  return {title:value.title,url:value.url,photo:value.photo,by:value.by,tags:[...new Set(value.tags)]};
}
