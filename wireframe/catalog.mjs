import knowledge from './knowledge-data.mjs';
export const CHECKED_ON = '2026-09-11';
export const extraDomains = {
  food: {name:'食品科学',question:'おいしさの仕組みを知りたい',summary:'食材が変わる仕組みや、食品を作り届ける方法を調べる。',example:'同じ牛乳から、チーズとヨーグルトができるのはなぜ？',method:'比べる · 実験する',tags:['食品','微生物','化学'],learning:'成分や微生物の働き、加工・保存の技術を学ぶ。料理の技術だけでなく、食品の仕組みを扱う。',related:'ecology',relation:'小さな生き物の働きを知る',reason:'発酵は微生物の働きを使います。食品科学は食品の変化に、生態学は生物と環境の関係に目を向けます。',opportunity:'食の仕組みを知る'},
  sound: {name:'音響・音楽',question:'好きな音を探したい',summary:'音の生まれ方、聞こえ方、音楽としての表現を考える。',example:'同じフレーズでも、ギターの音色で印象が変わるのはなぜ？',method:'聴き比べる · 記録する',tags:['音楽','振動','聴覚'],learning:'音の物理的な性質と、人の感じ方、文化や表現を行き来する。演奏だけに限らない学び方がある。',related:'information',relation:'音をデータとして扱う',reason:'録音や音の加工には信号処理を使います。情報科学の方法を、音の記録や聞こえ方の分析に応用できます。',opportunity:'音の仕組みに触れる'},
  media: {shortName:'映像・表現',name:'映像・ゲーム表現',question:'遊びや物語を作りたい',summary:'映像・ゲーム・物語で、どんな体験を届けるか考える。',example:'ゲームの説明を読まなくても、操作がわかるのはなぜ？',method:'作る · 遊んで確かめる',tags:['ゲーム','映像','物語'],learning:'映像や音、ルールの組み合わせが体験にどう影響するか、作品を作りながら考える。',related:'design',relation:'体験を設計する',reason:'ゲーム表現とデザインは、使う人・遊ぶ人の視点を重視する点で重なります。表現する内容と使いやすさは別の問いにもなります。',opportunity:'小さな作品を作る'}
};
export const extraTopics = knowledge.topics;
export const extraNeighbors = {
  food:[['ecology','発酵を支える微生物'],['environment','食と資源の使い方']],
  sound:[['information','音を記録・加工する'],['design','音のある体験を作る']],
  media:[['design','遊ぶ人の視点を重ねる'],['sound','音で世界観を伝える']]
};
export const liveOpportunities = knowledge.resources;

export function normalizeQuery(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, char=>String.fromCharCode(char.charCodeAt(0)-0x60)).trim();
}

export function searchCatalog(query, topics, domains, resources, filter='all') {
  const terms=normalizeQuery(query).split(/\s+/).filter(Boolean);
  const entries=[...Object.entries(topics).map(([id,value])=>({id,type:'topic',name:value.label,summary:value.root,text:[value.label,...(value.keywords||[])]})),...Object.entries(domains).map(([id,value])=>({id,type:'domain',name:value.name,summary:value.summary,text:[value.name,value.summary,...value.tags]})),...Object.entries(resources).filter(([,value])=>!value.example).map(([id,value])=>({id,type:'resource',name:value.name,summary:value.summary,text:[value.name,value.summary,value.reason,value.kind,...(value.keywords||[]),...value.domains.map(id=>domains[id].name)],resource:value}))];
  return entries.filter(entry=>{
    if(filter==='home' && !(entry.resource?.online && entry.resource?.free)) return false;
    if(filter==='study' && entry.resource?.group!=='study') return false;
    if(filter==='activity' && !['continue','try'].includes(entry.resource?.group)) return false;
    const text=normalizeQuery(entry.text.join(' '));
    return terms.every(term=>text.includes(term));
  }).map(entry=>({...entry,score:terms.reduce((score,term)=>score+(normalizeQuery(entry.name).includes(term)?2:1),0)})).sort((a,b)=>b.score-a.score);
}
