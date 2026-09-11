import {renderJourney} from './journey.mjs';
export function emptyProgress() {return {lastNode:'root',recent:[],guideSeen:false};}
export function validateProgress(value,map) {
  if(value===undefined) return emptyProgress();
  if(!value || typeof value.lastNode!=='string' || !Array.isArray(value.recent) || value.recent.length>5 || typeof value.guideSeen!=='boolean') throw new Error('Invalid progress');
  const recent=value.recent.map(entry=>{
    if(!entry || typeof entry.title!=='string' || entry.title.length>80 || !['added','recorded','organized','viewed'].includes(entry.action) || typeof entry.at!=='string' || !Number.isFinite(Date.parse(entry.at))) throw new Error('Invalid activity');
    if(entry.source!==undefined && (typeof entry.source!=='string' || !/^[\w-]{1,80}$/.test(entry.source))) throw new Error('Invalid viewed source');
    return {title:entry.title,action:entry.action,at:entry.at,...(entry.source?{source:entry.source}:{})};
  });
  if(value.visited!==undefined && (!Array.isArray(value.visited) || value.visited.length>100 || value.visited.some(id=>typeof id!=='string' || !/^[\w-]{1,80}$/.test(id)))) throw new Error('Invalid visit history');
  return {...(value.visited?{visited:[...new Set(value.visited)]}:{}),lastNode:map.nodes.some(node=>node.id===value.lastNode)?value.lastNode:'root',recent,guideSeen:value.guideSeen};
}
export function suggestNext(map,selected,items) {
  const node=map.nodes.find(node=>node.id===selected) || map.nodes[0];
  const candidates=map.nodes.filter(n=>items[n.source]?.domain || n.reference);
  if(map.nodes.length===1) return {action:'start',node:'root',title:'まずは、気になることを1つ選ぼう。',reason:'選んだ興味から、関係する学びや体験を紹介します。',label:'興味を選ぶ'};
  const record=node.inquiry || {};
  if(record.status==='planned') return {action:'write',node:node.id,title:'決めた「試すこと」を見返そう。',reason:record.plan || `「${node.title}」を試す前後の気づきを残せます。`,label:'計画を見て、感想を書く'};
  if(record.status==='tried') return {action:record.next?'next':'write',node:node.id,title:record.next?'体験から生まれた、次の気になることへ。':'試してわかったことを残そう。',reason:record.next || '面白かったことや、思っていたこととの違いを書いてみましょう。',label:record.next?'次の気になることをマップに追加':'体験を振り返る'};
  if(items[node.source]?.domain || node.reference) return {action:'write',node:node.id,title:'この気になるもので、何を試すか決めよう。',reason:`「${node.title}」を追加しています。小さく試せることを1つ書いてみましょう。`,label:'試すことを考える'};
  if(candidates.length>=2) return {action:'compare',node:'root',title:'集めた気になるものの違いを見てみよう。',reason:`マップに${candidates.length}件の情報があります。費用や内容、自分が気になる点を並べて比べられます。`,label:'並べて見る'};
  const domain=items[node.source] && !items[node.source].domain ? node : map.nodes.find(n=>n.parent===node.id && n.source && !items[n.source]?.domain);
  const target=domain || node;
  return {action:'discover',node:target.id,title:'気になる体験や学校を1つ見てみよう。',reason:`「${target.title}」から、関連する情報を紹介します。`,label:'続きを見る'};
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderWelcome(map,progress,items,saving,mode='map',compact=false) {
  const next=suggestNext(map,progress.lastNode,items),last=progress.recent[0];
  return renderJourney(map,progress,items,mode,compact)+`<section class="journey-next" aria-label="次にできること"><div><span class="journey-kicker">${last?'続きから、もう一歩':'まずはここから'}</span><h2>${escape(next.title)}</h2>${last?`<p>前回：${escape(last.title)} <time>${escape(new Date(last.at).toLocaleDateString('ja-JP'))}</time></p>`:'<p>上の地図から好きなことを選ぶと、関連する学びが広がります。</p>'}</div>${next.action!=='start'?`<button class="primary" data-next-action="${next.action}" data-next-node="${escape(next.node)}">${escape(next.label)} →</button>`:''}</section><div class="journey-storage"><label><input id="welcome-save-device" type="checkbox" ${saving?'checked':''}>このブラウザに記録を残す</label><small id="welcome-save-message">${saving?'次回も続きから再開できます。':'オフの間は、更新すると記録が消えます。'}</small></div><div class="journey-divider"><span>↓ ここから詳しく</span><h2>${map.nodes.length===1?'ほかの興味から始める':'情報を集める・比べる・編集する'}</h2></div>`;
}
