import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PREFECTURES} from '../regions.mjs';
const fail=message=>{throw new Error(`Knowledge: ${message}`);};
const text=(value,label,max=1500)=>{if(typeof value!=='string' || !value.trim() || value.length>max || /[<>\u0000-\u0008]/.test(value)) fail(label);};
const id=value=>{if(typeof value!=='string' || !/^[a-z][a-z0-9-]{0,49}$/.test(value)) fail(`invalid id ${value}`);};
const unique=(values,label)=>{if(new Set(values).size!==values.length) fail(`duplicate ${label}`);};
const date=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10)===value;
const resourceCategories=new Set(['material','place','event','continuing','club','school','university']);
const gradeIds=new Set(['j1','j2','j3','h1','h2','h3']);
const costs=new Set(['free','paid','unknown']);
// イベントは「1回きりのもの」と「回ごとに条件が違う一覧」で言えることが違う。
// 一覧に1つの開催日を書かせると、載っていない日程を載っているように見せてしまう。
const occurrences=new Set(['single','listing']);

export function validateKnowledge(data) {
  if(data?.version!==2 || !Array.isArray(data.concepts) || !Array.isArray(data.resources) || !Array.isArray(data.verbs) || !data.directions || !data.topics || !data.domains) fail('invalid envelope');

  // 領域はデータ側の定義を唯一の出典にする。画面のコードに領域名を書かない。
  const fields=new Set(Object.keys(data.domains));
  if(fields.size<1) fail('no domains');
  const domainList=(list,label)=>{if(!Array.isArray(list) || !list.length || list.some(value=>!fields.has(value))) fail(`unknown domain in ${label}`);};
  for(const [key,domain] of Object.entries(data.domains)) {
    id(key);
    for(const name of ['name','question','summary','example','method','learning']) text(domain[name],`domain ${key}.${name}`,200);
    if(domain.shortName!==undefined) text(domain.shortName,`domain ${key}.shortName`,40);
    if(!Array.isArray(domain.tags) || !domain.tags.length || domain.tags.length>6) fail(`domain ${key}.tags`);
    for(const tag of domain.tags) text(tag,`domain ${key}.tag`,40);
  }

  // 動詞は興味と学問のあいだに置く層。中学生が既に持っている語彙だけを入れる。
  unique(data.verbs.map(verb=>verb.id),'verb');
  if(data.verbs.length<3 || data.verbs.length>8) fail('verb count out of range');
  for(const verb of data.verbs) {
    id(verb.id);
    for(const name of ['label','summary','detail']) text(verb[name],`verb ${verb.id}.${name}`,200);
    text(verb.icon,`verb ${verb.id}.icon`,8);
    domainList(verb.domains,`verb ${verb.id}`);
  }
  const verbs=new Set(data.verbs.map(verb=>verb.id));

  unique(data.concepts.map(c=>c.id),'concept');unique(data.resources.map(r=>r.id),'resource');
  const concepts=new Map(data.concepts.map(c=>[c.id,c]));
  for(const concept of data.concepts) {
    id(concept.id);text(concept.label,'concept label',80);text(concept.summary,'concept summary',240);domainList(concept.domains,`concept ${concept.id}`);
    if(!['field','activity','subject'].includes(concept.kind)) fail('concept kind');
    for(const key of ['broader','related']) if(!Array.isArray(concept[key]) || concept[key].some(value=>value===concept.id || !concepts.has(value))) fail('unknown concept edge');
    const walk=(current,seen)=>{if(seen.has(current.id)) fail('broader cycle');for(const parent of current.broader) walk(concepts.get(parent),new Set([...seen,current.id]));};walk(concept,new Set());
  }

  // 活動アイデアは全件に動詞が要る。動詞のない活動は入口から到達できなくなるため。
  const activityIds=[];
  for(const [topic,groups] of Object.entries(data.directions)) {
    id(topic);if(!Array.isArray(groups) || !groups.length) fail('empty directions');unique(groups.map(g=>g.id),'direction');
    for(const group of groups) {
      id(group.id);text(group.icon,'icon',8);text(group.title,'direction title',80);text(group.description,'description',160);domainList(group.domains,`direction ${group.id}`);
      if(!Array.isArray(group.activities) || !group.activities.length) fail('activities');
      for(const activity of group.activities) {
        id(activity.id);activityIds.push(activity.id);
        text(activity.title,'activity title',80);text(activity.description,'activity description',400);text(activity.label,'activity label',40);
        if(!verbs.has(activity.verb)) fail(`activity ${activity.id} has no known verb`);
        if(!Number.isInteger(activity.minutes) || activity.minutes<5 || activity.minutes>180) fail(`activity ${activity.id}.minutes`);
        if(typeof activity.athome!=='boolean') fail(`activity ${activity.id}.athome`);
      }
    }
  }
  unique(activityIds,'activity');
  for(const verb of data.verbs) {
    const count=activityIds.filter(activityId=>findActivity(data,activityId).verb===verb.id).length;
    if(count<3) fail(`verb ${verb.id} has only ${count} activities; a verb needs at least 3 to be an entry point`);
  }

  for(const [key,topic] of Object.entries(data.topics)) {
    id(key);domainList(topic.ids,`topic ${key}`);
    for(const name of ['root','label','title']) text(topic[name],`topic ${name}`,80);
    if(!Object.hasOwn(data.directions,key)) fail(`topic ${key} has no activity directions`);
  }

  const resources=new Set(data.resources.map(r=>r.id));
  for(const resource of data.resources) {
    id(resource.id);domainList(resource.domains,`resource ${resource.id}`);if(!resource.domains.includes(resource.domain)) fail('primary domain missing');
    for(const key of ['name','summary','reason','kind','source']) text(resource[key],`${resource.id}.${key}`,key==='name'?80:1500);
    const url=new URL(resource.url);if(resource.url.length>2048 || /["<>\s]/.test(resource.url) || !['https:','http:'].includes(url.protocol) || url.username || url.password) fail('unsafe source URL');
    if(!date(resource.checkedOn) || resource.checkedOn>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date())) fail('checkedOn');
    if(resource.reviewAfter!==null && !date(resource.reviewAfter)) fail('reviewAfter');
    if(!['published','draft'].includes(resource.reviewStatus) || !['try','continue','study'].includes(resource.group)) fail('resource status/group');
    if(!Array.isArray(resource.conceptIds) || resource.conceptIds.some(value=>!concepts.has(value))) fail('unknown resource concept');
    if(!Array.isArray(resource.conditions) || resource.conditions.some(pair=>!Array.isArray(pair) || pair.length!==2 || pair.some(value=>typeof value!=='string'))) fail('conditions');
    if(!Array.isArray(resource.verbs) || resource.verbs.some(value=>!verbs.has(value))) fail(`unknown verb on ${resource.id}`);
    // 学校・大学は動詞で選ぶものではないので空を許す。それ以外は動詞から到達できる必要がある。
    if(resource.group!=='study' && !resource.verbs.length) fail(`resource ${resource.id} needs at least one verb`);
    for(const key of ['host','child']) if(resource[key] && !resources.has(resource[key])) fail(`unknown ${key}`);
    if(resource.type==='event' && !date(resource.date)) fail('event requires date');
    if(!resourceCategories.has(resource.category)) fail(`unknown category on ${resource.id}`);
    if(resource.prefecture!==null && !PREFECTURES.includes(resource.prefecture)) fail(`unknown prefecture on ${resource.id}`);
    if(!Array.isArray(resource.grades) || resource.grades.some(value=>!gradeIds.has(value))) fail(`unknown grade on ${resource.id}`);
    unique(resource.grades,`grades on ${resource.id}`);
    if(!costs.has(resource.cost)) fail(`unknown cost on ${resource.id}`);
    // free と cost は同じことを2通りで言っている。片方だけ直して食い違うのを防ぐ。
    if(resource.free!==(resource.cost==='free')) fail(`free and cost disagree on ${resource.id}`);
    if(resource.deadline!==null && !date(resource.deadline)) fail(`invalid deadline on ${resource.id}`);
    if(resource.deadline && resource.date && resource.deadline>resource.date) fail(`deadline after event on ${resource.id}`);

    // イベントは「いつ・いつまでに・誰が」を必ず持つ。分からないものは null のまま持たせ、
    // 画面が「公式案内で確認」と言えるようにする。キーごと無いのは許さない（黙って空欄になるため）。
    if(resource.category==='event') {
      if(!occurrences.has(resource.occurrence)) fail(`event ${resource.id} must say whether it is single or a listing`);
      for(const field of ['date','deadline','grades']) if(!Object.hasOwn(resource,field)) fail(`event ${resource.id} is missing ${field}`);
      if(resource.occurrence==='single' && !date(resource.date)) fail(`a single event needs its date: ${resource.id}`);
      // 一覧に1つの開催日は無い。書いてあったら、それは回のうちの1つを全体のように見せている。
      if(resource.occurrence==='listing' && resource.date!==null && resource.date!==undefined) fail(`a listing of sessions must not claim one date: ${resource.id}`);
    } else if(resource.occurrence!==null) {
      fail(`only an event carries an occurrence: ${resource.id}`);
    }
  }
  return data;
}

function findActivity(data,activityId) {
  for(const groups of Object.values(data.directions)) for(const group of groups) for(const activity of group.activities) if(activity.id===activityId) return activity;
  fail(`missing activity ${activityId}`);
}

export async function buildKnowledge() {
  const data=validateKnowledge(JSON.parse(await readFile(new URL('../data/knowledge.json',import.meta.url),'utf8')));
  const runtime={
    verbs:data.verbs,
    domains:data.domains,
    concepts:data.concepts,
    topics:data.topics,
    directions:Object.fromEntries(Object.entries(data.directions).map(([topic,groups])=>[topic,groups.map(group=>({...group,activities:group.activities.map(activity=>({...activity,topic}))}))])),
    resources:Object.fromEntries(data.resources.filter(r=>r.reviewStatus==='published').map(({id,...resource})=>[id,resource]))
  };
  await writeFile(new URL('../knowledge-data.mjs',import.meta.url),`// Generated by npm run knowledge:build. Edit data/knowledge.json instead.\nexport default ${JSON.stringify(runtime,null,2)};\n`);
  return runtime;
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) {validateKnowledge(JSON.parse(await readFile(new URL('../data/knowledge.json',import.meta.url),'utf8')));console.log('Knowledge valid');}
  else {const data=await buildKnowledge();console.log(`Built ${Object.keys(data.resources).length} resources, ${data.verbs.length} verbs, ${Object.keys(data.domains).length} domains`);}
}
