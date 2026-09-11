const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function layoutJourney(nodes) {
  if(!nodes.length) return [];
  const children=id=>nodes.filter(node=>node.parent===id);
  const weight=node=>Math.max(1,children(node.id).reduce((sum,child)=>sum+weight(child),0));
  const placed=[];
  function place(node,depth,start,end,color) {
    const angle=(start+end)/2;
    placed.push({...node,x:Math.cos(angle)*depth*160,y:Math.sin(angle)*depth*85,color});
    const branches=children(node.id),total=branches.reduce((sum,child)=>sum+weight(child),0);
    let cursor=start;
    for(const [index,child] of branches.entries()) {
      const span=(end-start)*weight(child)/total;
      place(child,depth+1,cursor,cursor+span,depth===0?index%4:color);
      cursor+=span;
    }
  }
  place(nodes[0],0,-Math.PI,Math.PI,0);
  // Increase radial spacing until every card has a clear outline.
  let scale=1;
  for(let i=0;i<placed.length;i++) for(let j=i+1;j<placed.length;j++) {
    const dx=Math.abs(placed[i].x-placed[j].x),dy=Math.abs(placed[i].y-placed[j].y);
    scale=Math.max(scale,Math.min(dx?190/dx:Infinity,dy?100/dy:Infinity));
  }
  const minX=Math.min(...placed.map(node=>node.x*scale)),minY=Math.min(...placed.map(node=>node.y*scale));
  return placed.map(node=>({...node,x:node.x*scale-minX+110,y:node.y*scale-minY+65}));
}

export function renderJourney(map,progress,items,mode='map',compact=false) {
  const empty=map.nodes.length===1;
  let nodes=map.nodes;
  if(mode==='history') {
    const sources=[...new Set([...(progress.visited || []),...progress.recent.filter(entry=>entry.source).map(entry=>entry.source)])].filter(id=>items[id]);
    nodes=[{id:'history-root',parent:null,title:'見つけたもの'}];
    for(const source of sources) {
      const item=items[source],domain=item.domain || source,group=`group-${domain}`;
      if(!nodes.some(node=>node.id===group)) nodes.push({id:group,parent:'history-root',title:items[domain]?.name || '学び',source:domain});
      if(source!==domain) nodes.push({id:`visit-${source}`,parent:group,title:item.name,source});
    }
  } else if(empty) nodes=[{id:'start',parent:null,title:'何が好き？'},...Object.entries({games:'ゲーム',cooking:'料理',music:'音楽・ギター',sea:'海・生き物'}).map(([id,title])=>({id,parent:'start',title,topic:id}))];
  const starter=empty && mode==='map';
  if(compact && !starter && mode==='map' && nodes.length>1) {
    const selected=nodes.find(node=>node.id===progress.lastNode) || nodes[0];
    let focus=nodes.some(node=>node.parent===selected.id)?selected:nodes.find(node=>node.id===selected.parent) || selected;
    if(focus.id==='root' && nodes.filter(node=>node.parent==='root').length===1) focus=nodes.find(node=>node.parent==='root');
    const children=nodes.filter(node=>node.parent===focus.id);
    if(children.length && children.length<=4) nodes=[{...focus,parent:null},...children];
  }
  const compactLayout=compact && nodes.length>1 && nodes.length<=5;

  const positions=compactLayout?nodes.map((node,index)=>({...node,x:index===0?175:nodes.length===4?[175,70,280][index-1]:85+((index-1)%2)*180,y:index===0?105:nodes.length===4?[25,175,175][index-1]:30+Math.floor((index-1)/2)*150,color:Math.max(0,index-1)})):starter?nodes.map((node,index)=>({...node,x:index===0?175:90+((index-1)%2)*170,y:index===0?190:65+Math.floor((index-1)/2)*250,color:Math.max(0,index-1)})):layoutJourney(nodes);
  const nodeWidth=compactLayout?120:starter?145:170,width=compactLayout?350:starter?350:Math.max(500,...positions.map(n=>n.x+110)),height=compactLayout?215:starter?380:Math.max(360,...positions.map(n=>n.y+65));
  const lines=positions.filter(n=>n.parent).map(node=>{
    const parent=positions.find(n=>n.id===node.parent);
    return `<path d="M ${parent.x} ${parent.y} Q ${parent.x} ${node.y} ${node.x} ${node.y}" stroke="var(--branch-${node.color})"/>`;
  }).join('');
  return `<section class="journey" aria-label="興味と調べた情報の地図"><header class="journey-heading"><div><span class="journey-kicker">YOUR EXPLORATION</span><h2>${empty && mode==='map'?'「好き」を、ひろげよう。':'今日は、何が気になる？'}</h2></div><button id="open-guide" class="journey-help">? 使い方</button></header><div class="journey-tabs" aria-label="地図の表示"><button data-journey-mode="map" aria-pressed="${mode==='map'}">✦ 自分のマップ <span>${map.nodes.length-1}</span></button><button data-journey-mode="history" aria-pressed="${mode==='history'}">↗ 見た情報 <span>${new Set([...(progress.visited || []),...progress.recent.filter(e=>e.source).map(e=>e.source)]).size}</span></button></div><div class="map-categories" aria-label="好きなことを選ぶ">${Object.entries({music:'音楽',games:'ゲーム',cooking:'料理',sea:'海'}).map(([id,label])=>`<button data-studio-start="${id}">${label}</button>`).join('')}<button data-concept-open="biology">生き物</button></div><div class="journey-tools"><span>中心から、気になる方向へ</span><div><button data-journey-zoom="out" aria-label="地図を縮小">−</button><button data-journey-zoom="fit">全体を見る</button><button data-journey-zoom="in" aria-label="地図を拡大">＋</button></div></div><div class="journey-scroll" tabindex="0" role="region" aria-label="地図。上下左右にスクロールできます"><div class="journey-space"><div data-width="${width}" data-height="${height}" class="journey-world ${compactLayout?'journey-compact':''} ${starter?'journey-starter':''}" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true">${lines}</svg>${positions.map(node=>`<button class="journey-node ${node.parent?'':'journey-root'} ${node.id===progress.lastNode?'is-current':''}" style="width:${nodeWidth}px;left:${node.x-nodeWidth/2}px;top:${node.y-32}px;--node-color:var(--branch-${node.color})" ${node.topic?`data-studio-start="${node.topic}"`:mode==='history' && node.source?`data-revisit="${escape(node.source)}"`:!empty && mode==='map'?`data-next-action="discover" data-next-node="${escape(node.id)}"`:'disabled'}><small>${node.topic?'ここから始める':!node.parent?'✦ わたしの興味':mode==='history'?'調べた情報':node.inquiry?.status==='tried'?'✓ 試した':node.id===progress.lastNode?'● 前回の続き':items[node.source]?.domain?'体験・学校':node.source?'学びの分野':'気になること'}</small><strong>${escape(node.id==='root' && !starter && mode==='map'?'わたしの興味':node.title)}</strong></button>`).join('')}${mode==='history' && nodes.length===1?'<p class="journey-empty">まだ見た情報はありません。<br>「探す」で開いた情報が、ここにつながります。<button class="primary" data-page="home">情報を探す →</button></p>':''}</div></div></div><footer><span>枝を押すと、その先の情報へ。</span><span>↔ スクロールして地図を探索</span></footer></section>`;
}
