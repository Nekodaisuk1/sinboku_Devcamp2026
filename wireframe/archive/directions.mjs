import knowledge from './knowledge-data.mjs';
import {integratePaths} from './personal-map.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Editorial activity ideas, not listings of available programs or aptitude judgments.
export const directions=knowledge.directions;
export function directionContext(map,selected) {
  for(let node=map.nodes.find(n=>n.id===selected);node;node=map.nodes.find(n=>n.id===node.parent)) {
    for(const [topic,groups] of Object.entries(directions)) for(const group of groups) if(node.id.startsWith(`interest-${topic}-${group[0]}-`)) return {topic,group};
    for(const topic of Object.keys(directions)) if(node.id===`interest-${topic}-root`) return {topic,group:null};
  }
  return null;
}
export function addDirectionActivity(map,parent,topic,key,index,items) {
  const group=directions[topic]?.find(group=>group[0]===key),activity=group?.[5][index];
  if(!activity) throw new Error('Unknown activity');
  let target=map.nodes.find(node=>node.id===parent);
  while(target && !target.id.startsWith(`interest-${topic}-${key}-`)) target=map.nodes.find(node=>node.id===target.parent);
  if(!target) throw new Error('Choose an activity direction first');
  return integratePaths(map,[[{key:`activity-${index}`,title:activity[0],reason:activity[2],note:activity[1]}]],target.id,items);
}
export function renderDirections(map,selected) {
  if(selected.source || selected.reference) return '';
  const context=directionContext(map,selected.id);
  if(!context) return '';
  const groups=context.group?[context.group]:directions[context.topic];
  return `<section class="direction-explorer"><span class="direction-eyebrow">${context.group?'どんな関わり方が気になる？':'まずは、楽しみ方を見渡そう'}</span><p class="direction-intro">${context.group?'一人でも、誰かとでも。正解や順番はありません。':'学校や教材を決める前に、やってみたい方向を選べます。'}</p>${groups.map((group,i)=>`<article class="direction-card" style="--direction-color:var(--branch-${i%4})"><div class="direction-heading"><span aria-hidden="true">${group[1]}</span><h3>${group[2]}</h3></div><p>${group[3]}</p>${!context.group?`<div class="direction-preview">${group[5].map(activity=>`<span>${activity[0]}</span>`).join('')}</div><button class="secondary" data-direction-open="${group[0]}" data-direction-topic="${context.topic}">この方向を見てみる →</button>`:group[5].map((activity,index)=>`<div class="activity-option"><span>${activity[2]}</span><h4>${activity[0]}</h4><p>${activity[1]}</p><button data-activity-index="${index}" data-activity-group="${group[0]}" data-activity-topic="${context.topic}">＋ やってみたい枝にする</button></div>`).join('')}</article>`).join('')}<small>活動のアイデアです。募集中のイベントや、特定の団体の案内ではありません。</small></section>`;
}
