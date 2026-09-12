import {conceptForNode,renderConceptConnections} from './knowledge-ui.mjs';
import {directions,directionContext,renderDirections} from './directions.mjs';
import {inquiryCandidates} from './inquiry.mjs';
import {renderInquiryRecord} from './inquiry-ui.mjs';
import {descendants,integratePaths,validatePersonalMap,validateReference} from './personal-map.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function branchContext(map,selected,domains,resources) {
  const selectedNode=map.nodes.find(node=>node.id===selected);
  if(domains[selectedNode?.source]) return [selectedNode.source];
  if(resources[selectedNode?.source]) return resources[selectedNode.source].domains || [resources[selectedNode.source].domain];
  const concept=conceptForNode(map,selected);
  if(concept) return concept.domains;
  const direction=directionContext(map,selected);
  if(direction) return [...new Set((direction.group?[direction.group]:directions[direction.topic]).flatMap(group=>group[4]))];
  let node=map.nodes.find(node=>node.id===selected);
  while(node) {
    if(domains[node.source]) return [node.source];
    if(resources[node.source]) return resources[node.source].domains || [resources[node.source].domain];
    if(node.reference?.tags.length) return node.reference.tags.filter(id=>domains[id]);
    const below=descendants(map,node.id);
    const fields=map.nodes.filter(candidate=>below.has(candidate.id) && domains[candidate.source]).map(candidate=>candidate.source);
    if(fields.length) return [...new Set(fields)];
    node=map.nodes.find(candidate=>candidate.id===node.parent);
  }
  return [];
}

export function startInquiry(map,topicId,topics,domains,items=domains,makeId=()=>crypto.randomUUID()) {
  const topic=topics[topicId];
  if(!topic) throw new Error('Unknown interest');
  if(directions[topicId]) {
    const result=integratePaths(map,directions[topicId].map(group=>[{key:topicId,title:topic.root},{key:`${topicId}-${group[0]}`,title:group[2],reason:group[3]}]),'root',items,makeId);
    return {...result,selected:`interest-${topicId}-root`};
  }
  const result=integratePaths(map,topic.ids.map(source=>[
    {key:topicId,title:topic.root},
    {source,title:domains[source].name,reason:topic.questions?.[source] || domains[source].question}
  ]),'root',items,makeId);
  return {...result,selected:`interest-${topicId}-root`};
}

export function attachResource(map,parent,source,items,notes,makeId=()=>crypto.randomUUID()) {
  if(!Object.hasOwn(items,source)) throw new Error('Unknown source');
  const item=items[source];
  if(map.nodes.find(node=>node.id===parent)?.source===source) return {map,selected:parent,added:0};
  return integratePaths(map,[[{source,title:item.name,reason:(item.domain?item.reason:item.question || '').slice(0,160),note:(notes[source] || '').slice(0,1500)}]],parent,items,makeId);
}

export function attachReference(map,parent,reference,items,note='',makeId=()=>crypto.randomUUID()) {
  const clean=validateReference(reference,items);
  const existing=map.nodes.find(node=>node.parent===parent && node.reference && (clean.url ? node.reference.url===clean.url : node.reference.photo===clean.photo));
  if(existing) return {map,selected:existing.id,added:0};
  const id=makeId(),next=structuredClone(map);
  next.nodes.push({id,parent,title:clean.title.slice(0,80),note,reason:'',source:null,reference:clean});
  return {map:validatePersonalMap(next,items),selected:id,added:1};
}

function treeMarkup(map,selected,collapsed) {
  function branch(node) {
    const children=map.nodes.filter(candidate=>candidate.parent===node.id);
    const closed=collapsed.has(node.id);
    return `<li><div class="studio-node-row"><button class="personal-node ${node.id===selected?'selected':''} ${node.source?'has-source':''}" id="personal-node-${node.id}" data-personal-select="${node.id}" aria-pressed="${node.id===selected}"><span>${node.id==='root'?'MY INQUIRY':node.reference?escape(node.reference.by):node.source?'学び・見つけた情報':'自分の興味'}</span><strong>${escape(node.title)}</strong>${node.reason?`<small>${escape(node.reason)}</small>`:''}${node.inquiry?.status==='tried'?'<em>✓ 試した経験あり</em>':node.inquiry?.status==='planned'?'<em>試す計画あり</em>':node.note?'<em>考えのメモあり</em>':''}</button>${children.length?`<button class="studio-collapse" data-studio-collapse="${node.id}" aria-expanded="${!closed}" aria-label="${escape(node.title)}の下の枝を${closed?'開く':'たたむ'}">${closed?`＋${children.length}`:'−'}</button>`:''}</div>${children.length&&!closed?`<ul>${children.map(branch).join('')}</ul>`:''}</li>`;
  }
  return branch(map.nodes.find(node=>node.id==='root'));
}

function sourceMarkup(node,items) {
  const item=node.reference || items[node.source];
  if(!item) return '';
  return `<details class="studio-original"><summary>出典を確かめる · ${escape(item.title || item.name)}</summary>${item.summary?`<p>${escape(item.summary)}</p>`:''}${item.photo?`<img src="${escape(item.photo)}" alt="共有された情報の写真">`:''}${item.url?`<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">元のページを開く ↗</a>`:''}${node.source?`<button class="text-button" data-revisit="${node.source}">学びの地図で見る →</button>`:''}<p>自分の名前・メモを変えても、出典は残ります。</p></details>`;
}

export function renderStudioDiscovery({map,selected,context,domains,resources,saved,notes,recommendations,query,filter}) {
  const normalize=value=>value.normalize('NFKC').toLocaleLowerCase();
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
  const matches=(item)=>terms.every(term=>normalize(`${item.name} ${item.summary} ${item.reason}`).includes(term));
  const concept=conceptForNode(map,selected.id);
  const entries=Object.entries(resources).filter(([id,item])=>id!==selected.source && matches(item) && (!concept || query || item.conceptIds?.includes(concept.id)) && (!context.length || query || item.domains.some(domain=>context.includes(domain))) && (filter==='all' || filter==='saved' && saved.has(id) || filter===item.group));
  const isAdded=id=>map.nodes.some(node=>node.source===id && node.parent===selected.id);
  const incoming=recommendations.filter(item=>item.status!=='dismissed' && (!context.length || item.tags.some(id=>context.includes(id))) && terms.every(term=>normalize(`${item.title} ${item.message}`).includes(term)));
  const listing=`<div class="studio-context"><span>表示している情報の分野</span><p>${context.length?context.map(id=>escape(domains[id].name)).join('・'):'興味の枝を選ぶと、関連する情報がここに集まります。'}</p></div><label class="studio-search-label" for="studio-search">情報を検索<input id="studio-search" type="search" value="${escape(query)}" placeholder="キーワードで検索" maxlength="100"></label><div class="studio-filters" aria-label="情報の種類">${[['all','すべて'],['try','試す'],['continue','続ける'],['study','進学'],['saved','保存済み']].map(([id,label])=>`<button data-studio-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><div id="studio-discovery-results"><p class="studio-results-count" role="status">${entries.length}件${query || !context.length?' · 掲載情報全体から検索':' · 関連領域の掲載情報'}</p><div class="studio-resource-list">${entries.map(([id,item])=>`<article class="studio-resource"><span>${escape(item.kind)}${saved.has(id)?' · 保存済み':''}</span><h3>${escape(item.name)}</h3><p>${escape(item.reason)}</p>${item.conditions?`<details class="studio-conditions"><summary>対象・費用・利用条件</summary><dl>${item.conditions.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl><small>確認 ${escape(item.checkedOn)}</small></details>`:''}<div>${item.url?`<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a>`:''}<button data-studio-attach="${id}" ${isAdded(id)?'disabled':''}>${isAdded(id)?'✓ 追加済み':'＋ マップに追加'}</button></div><button class="studio-save" data-save="${id}" aria-pressed="${saved.has(id)}">${saved.has(id)?'✓ 気になるに保存済み':'気になるにも残す'}</button>${notes[id]?'<small>保存したメモも引き継ぎます</small>':''}</article>`).join('') || '<p class="studio-empty">この種類の情報は、まだ掲載していません。上のつながりから探すか、自分で見つけたURLを追加できます。</p>'}</div>${incoming.length?`<section class="studio-incoming"><h3>共有された情報も、ここから</h3>${incoming.map(item=>`<article class="studio-resource"><span>${item.remote?'保護者から':'操作モックから'}</span><h3>${escape(item.title)}</h3><p>${escape(item.message)}</p>${item.photo?`<img src="${escape(item.photo)}" alt="おすすめに添えられた写真">`:''}<button data-studio-recommendation="${item.id}">＋ この枝に取り込む</button></article>`).join('')}</section>`:''}<p class="studio-footnote">掲載情報の領域との関連です。向き不向きを判定するものではありません。</p></div>`;
  const overview=(concept?'':renderDirections(map,selected))+renderConceptConnections(map,selected,context);
  return overview?`${overview}<details class="direction-sources" ${query || filter!=='all'?'open':''}><summary>教材・活動・学校 <span>${entries.length}件</span></summary>${listing}</details>`:listing;
}

function writeMarkup({map,selected,excluded,hasDraft,items,recordDraft}) {
  return `<div class="record-invitation"><span>✎ 小さな一歩を残そう</span><p>${escape(selected.note || selected.reason || '気になったことを一つ試して、感じたことを残せます。')}</p><strong>${selected.inquiry?.status==='tried'?'試して、どうだった？':'まず何を試してみたい？'}</strong></div>${renderInquiryRecord({...selected,inquiry:{...selected.inquiry,...recordDraft}},items)}<details class="inquiry-edit-details"><summary>枝の名前・自由メモを編集する</summary><form id="personal-edit"><label>自分の言葉で名前をつける<input name="title" required maxlength="80" value="${escape(selected.title)}"></label>${selected.id!=='root'?`<label>この枝と、どうつながる？<input name="reason" maxlength="160" value="${escape(selected.reason)}" placeholder="例：遊ぶだけでなく、音も作りたい"></label><input type="hidden" name="parent" value="${selected.parent}">`:''}<label>わかったこと・次にやってみたいこと<textarea name="note" maxlength="1500" placeholder="面白かったところ、まだわからないこと…">${escape(selected.note)}</textarea></label><p id="personal-draft-status" role="status">${hasDraft?'未保存の変更があります':'このメモは自分だけに表示されます'}</p><button class="primary block">考えを保存</button></form></details><form id="personal-add"><h3>気になることを追加</h3><label>この枝から考えたこと<input name="title" required maxlength="80" placeholder="例：ゲームの音楽はどう作る？"></label><button class="secondary block">＋ 気になることを枝にする</button></form>`;
}

function arrangeMarkup({map,selected,excluded}) {
  const links=map.links.map((link,index)=>({...link,index})).filter(link=>[link.from,link.to].includes(selected.id));
  return `${selected.id!=='root'?`<form id="studio-move"><label>別の枝に組み合わせる<select name="parent">${map.nodes.filter(node=>!excluded.has(node.id)).map(node=>`<option value="${node.id}" ${node.id===selected.parent?'selected':''}>${escape(node.title)}</option>`).join('')}</select></label><p class="personal-hint">下にある枝も一緒に移動します。</p><button class="secondary block">つなぐ先を変える</button></form>`:''}<section class="personal-connections"><h3>離れた枝の共通点を残す</h3>${links.map(link=>{const target=map.nodes.find(node=>node.id===(link.from===selected.id?link.to:link.from));return `<div class="personal-related"><button data-personal-select="${target.id}">${escape(target.title)} ↗</button><p>${escape(link.reason)}</p><button class="text-button" data-personal-unlink="${link.index}">つながりを外す</button></div>`;}).join('')}${map.nodes.length>1?`<form id="personal-link"><label>関連する枝<select name="target">${map.nodes.filter(node=>node.id!==selected.id).map(node=>`<option value="${node.id}">${escape(node.title)}</option>`).join('')}</select></label><label>共通点・つながる理由<input name="reason" required maxlength="160" placeholder="例：どちらも音で気持ちを伝える"></label><button class="secondary block">つながりを残す</button></form>`:'<p class="personal-hint">枝が増えたら、別の興味との共通点もつなげられます。</p>'}</section>${selected.id!=='root'?`<button class="text-button personal-remove" id="personal-remove">この枝と下の枝を外す（${excluded.size}個）</button>`:''}`;
}

function starterMarkup(showCustom) {
  return `<section class="studio-start"><span>まずはここから</span><h2>まず、気になることを選んでください。</h2><p>後から別の興味も追加できます。</p><div>${[['games','ゲーム'],['cooking','料理・食べもの'],['music','ギター・音楽'],['sea','海・生き物']].map(([id,label])=>`<button data-studio-start="${id}">${label}<span>→</span></button>`).join('')}</div><button class="text-button" id="studio-custom-toggle" aria-expanded="${!!showCustom}">別の興味を自分で入力する</button>${showCustom?`<form id="studio-custom-start"><label for="custom-interest">いま気になること<input id="custom-interest" name="title" required maxlength="80" placeholder="例：写真を撮ること"></label><button class="primary">この興味で始める →</button></form>`:''}</section>`;
}

export function renderStudio(options) {
  const {map,selected,domains,resources,topics,items,tab,collapsed,undoCount}=options;
  const context=branchContext(map,selected.id,domains,resources);
  const data={...options,context,excluded:descendants(map,selected.id)};
  if(map.nodes.length===1) return `<section class="room-empty"><span aria-hidden="true">✦</span><h2>好きなことの、<br>まだ知らない楽しみ方。</h2><p>地図で気になるものをタップ。ここに、できることが並びます。</p><ul><li>まだ知らない活動を見つける</li><li>気になったものをマップに残す</li><li>次は、その続きから探す</li></ul><button class="text-button" id="studio-custom-toggle">ほかの好きなことを書く</button>${options.showCustom?`<form id="studio-custom-start"><label for="custom-interest">好きなこと<input id="custom-interest" name="title" required maxlength="80" placeholder="写真、昆虫、映画など"></label><button class="primary">マップに追加</button></form>`:''}</section>`;
  const added=map.nodes.find(node=>node.id===options.added?.id && node.parent===selected.id);
  const receipt=added?`<section class="studio-receipt" role="status"><strong>✓ 「${escape(selected.title)}」に追加しました</strong><p>${escape(added.title)}</p><div><button data-studio-review="${added.id}">試す計画・感想を書く →</button><button data-studio-locate="${added.id}">マップで確認</button></div></section>`:'';
  return `<div class="studio-toolbar"><div><span class="studio-live-dot"></span> マップの内容 <small>${map.nodes.length-1}個の枝 · 非公開</small></div><div class="studio-toolbar-actions"><button class="secondary" id="studio-entrances">＋ 別の興味</button><button class="secondary" id="personal-undo" ${undoCount?'':'disabled'}>元に戻す ↶</button></div></div>${options.showEntrances?starterMarkup(options.showCustom):''}<div class="studio-next-step"><strong>${domains[selected.source]?'気になる情報を、この学びに追加してみよう':selected.id==='root' || !selected.source && !selected.reference?'マップの中から、気になる枝を押してください':'調べてわかったことを、メモに残せます'}</strong><p>情報の追加先：「${escape(selected.title)}」。別の項目を選ぶと、追加先が変わります。</p></div><div class="studio-mobile-switch" aria-label="作業画面の切り替え"><button data-studio-view="map" aria-pressed="${options.mobileView!=='panel'}">マップを見る</button><button data-studio-view="panel" aria-pressed="${options.mobileView==='panel'}">楽しみ方・記録を見る</button></div><div class="studio-layout" data-mobile-view="${options.mobileView || 'map'}"><section class="studio-canvas"><div class="studio-canvas-heading"><span>自分のマップ</span><button class="text-button" id="studio-expand-all">すべての枝を開く</button></div><section class="personal-tree-area" aria-label="自分の探究マップ"><svg class="personal-lines" aria-hidden="true"></svg><ul class="personal-tree">${treeMarkup(map,selected.id,collapsed)}</ul></section><p class="studio-canvas-note">枝を選ぶ → 情報や気になることを加える → つながりを自分の言葉にする</p></section><aside class="personal-editor studio-panel" aria-label="選んだ枝の情報と操作"><button class="text-button" id="personal-back-to-tree">← マップを見る</button><p class="eyebrow">選択中の項目</p><h2 tabindex="-1">${escape(selected.title)}</h2>${inquiryCandidates(map,selected.source && items[selected.source]?.domain || selected.reference ? selected.parent || 'root' : selected.id,items).length>=2?`<button class="inquiry-open" data-inquiry-compare="${selected.source && items[selected.source]?.domain || selected.reference ? selected.parent || 'root' : selected.id}">並べて見る ↔</button>`: ''}${domains[selected.source]?`<button class="secondary block route-entry" data-routes="${selected.source}">${escape(domains[selected.source].name)}にたどり着く道を見る ↟</button>`:''}<div class="studio-tabs" aria-label="枝で行うこと">${[['discover','見つける'],['write','メモ'],['arrange','整理する']].map(([id,label])=>`<button data-studio-tab="${id}" aria-pressed="${tab===id}">${label}${id==='write'&&options.hasDraft?' •':''}</button>`).join('')}</div>${receipt}<div id="studio-panel-content">${tab==='discover'?renderStudioDiscovery(data):tab==='write'?writeMarkup(data):arrangeMarkup(data)}</div>${selected.inquiry?.next?`<button class="secondary block" data-inquiry-next="${selected.id}">次にやってみたいことを、新しい枝にする →</button>`:''}${sourceMarkup(selected,items)}<details class="studio-attach-url"><summary>自分で見つけたURLを追加する</summary><form id="studio-reference"><label>情報の名前<input name="title" required maxlength="80" placeholder="記事、学校の案内、活動など"></label><label>URL<input name="url" type="url" required maxlength="2048" placeholder="https://"></label><label>わかったこと<textarea name="note" maxlength="1500" placeholder="内容の要点や、気になる理由"></textarea></label><label>関連する領域<select name="domain"><option value="">まだ決めない</option>${Object.entries(domains).map(([id,item])=>`<option value="${id}" ${context[0]===id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></label><button class="secondary block">＋ 出典と一緒に追加</button></form></details><p id="personal-error" role="alert"></p></aside></div>`;
}
