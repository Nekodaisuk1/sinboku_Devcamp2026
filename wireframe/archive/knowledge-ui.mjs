import {validatePersonalMap} from './personal-map.mjs';
import knowledge from './knowledge-data.mjs';
export const concepts=knowledge.concepts;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function conceptForNode(map,id) {
  for(let node=map.nodes.find(n=>n.id===id);node;node=map.nodes.find(n=>n.id===node.parent)) {
    const concept=concepts.find(c=>node.id.startsWith(`interest-concept-${c.id}-`));
    if(concept) return concept;
  }
  return null;
}
export function renderConceptConnections(map,selected,domains) {
  const current=conceptForNode(map,selected.id);
  const choices=current?[...new Set([...current.broader,...current.related])].map(id=>concepts.find(c=>c.id===id)):concepts.filter(c=>c.domains.some(id=>domains.includes(id)));
  if(!choices.length) return '';
  return `<section class="concept-connections"><h3>${current?'ここから、ほかにも':'こんな楽しみ方も'}</h3>${current?`<p>${escape(current.summary)}</p>`:''}<div>${choices.map(c=>`<button data-concept-open="${c.id}"><small>${current?.broader.includes(c.id)?'もっと広く':c.kind==='activity'?'やってみる':c.kind==='subject'?'別の場所へ':'知る'}</small><strong>${escape(c.label)}</strong><span>→</span></button>`).join('')}</div></section>`;
}
export function renderResourcePreview(item,id) {
  return `<aside class="studio-panel personal-editor"><button class="text-button" data-room-close-preview>← 戻る</button><h2 tabindex="-1">${escape(item.name)}</h2><p class="resource-preview-kind">${escape(item.kind || '学べること')}</p><p>${escape(item.summary)}</p>${item.reason?`<p>${escape(item.reason)}</p>`:''}${item.conditions?.length?`<dl class="resource-preview-facts">${item.conditions.map(([key,value])=>`<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`:''}${item.url?`<a class="secondary" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">元のページを見る ↗</a>`:''}<button class="primary block" data-studio-attach="${escape(id)}">自分のマップに残す</button></aside>`;
}

export function attachConcept(map,parent,id,items) {
  const concept=concepts.find(c=>c.id===id);if(!concept) throw new Error('Unknown concept');
  const existing=map.nodes.find(node=>node.id.startsWith(`interest-concept-${id}-`));
  if(existing) return {map,selected:existing.id,added:0};
  const node={id:`interest-concept-${id}-node`,parent,title:concept.label,note:concept.summary,reason:'関連する楽しみ方',source:null};
  return {map:validatePersonalMap({...map,nodes:[...map.nodes,node]},items),selected:node.id,added:1};
}
