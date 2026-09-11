const fields=['question','plan','observation','learned','next'];
export function validateInquiry(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid inquiry');
  const clean={};
  for(const key of fields) {
    if(value[key]!==undefined) {
      if(typeof value[key]!=='string' || value[key].length>1500) throw new Error('Invalid inquiry text');
      clean[key]=value[key];
    }
  }
  if(value.status!==undefined) {
    if(!['considering','planned','tried','paused'].includes(value.status)) throw new Error('Invalid inquiry status');
    clean.status=value.status;
  }
  if(value.criteria!==undefined) {
    if(!Array.isArray(value.criteria) || value.criteria.length>5 || !value.criteria.every(text=>typeof text==='string' && text.trim() && text.length<=80) || new Set(value.criteria).size!==value.criteria.length) throw new Error('Invalid criteria');
    clean.criteria=value.criteria;
  }
  if(value.answers!==undefined) {
    if(!value.answers || typeof value.answers!=='object' || Array.isArray(value.answers) || Object.keys(value.answers).length>20) throw new Error('Invalid assessments');
    clean.answers={};
    for(const [key,text] of Object.entries(value.answers)) {
      if(!key.trim() || key.length>80 || typeof text!=='string' || text.length>500) throw new Error('Invalid assessment');
      Object.defineProperty(clean.answers,key,{value:text,enumerable:true,writable:true,configurable:true});
    }
  }
  return clean;
}

export function evidenceFor(node,items) {
  const item=items[node.source];
  const condition=labels=>item?.conditions?.filter(([label])=>labels.includes(label)).map(([,value])=>value).join(' / ') || '未確認';
  return {title:node.title,original:item?.name || node.reference?.title || '',url:item?.url || node.reference?.url || '',checkedOn:item?.checkedOn || '',summary:item?.summary || '未確認（元のページで内容を確かめてください）',cost:condition(['費用']),eligibility:condition(['対象','参加','入学','所属','手続']),location:condition(['地域','場所','機器']),step:item?.step || '元の情報を読み、最初に確かめたいことを決める',kind:item?.kind || '自分で取り込んだ資料'};
}

export function inquiryCandidates(map,parent,items) {
  const ids=new Set([parent]);let changed=true;
  while(changed) {changed=false;for(const node of map.nodes) if(ids.has(node.parent) && !ids.has(node.id)) {ids.add(node.id);changed=true;}}
  return map.nodes.filter(node=>ids.has(node.id) && (node.reference || items[node.source]?.domain));
}

export function nextInquiryStep(node,items) {
  const research=node.inquiry || {};
  if(research.next?.trim()) return {label:'自分で決めた次の一歩',text:research.next};
  if(research.status==='tried') return {label:'体験を次の判断に使う',text:research.learned?.trim() ? 'わかったことを一覧の自分のメモに反映し、ほかの気になるものとの違いを確かめる' : '試して面白かったこと・違ったことを記録する'};
  if(research.status==='paused') return {label:'いったん保留',text:'急いで決めず、ほかの気になるものや気になることを見てみる'};
  if(research.plan?.trim()) return {label:'試す計画',text:research.plan};
  return {label:'小さく確かめるなら',text:evidenceFor(node,items).step};
}
