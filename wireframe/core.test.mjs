import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { downwardCurve, roundedRoute } from './geometry.mjs';
import { encodeWorkspace, decodeWorkspace } from './workspace.mjs';
import { routeDomains, routesForDomain, decisionPoints, mathLevels, mathSpread, ROUTES_CHECKED_ON } from './routes.mjs';

const catalog = {items:{ecology:{},event:{}},domains:{ecology:{}},topics:{sea:{ids:['ecology']}},opportunities:{event:{domain:'ecology'}}};
const state = {saved:new Set(['event']),notes:{event:'A < B\n観察したい',ecology:'Not saved'},topic:'sea',selected:'ecology',view:'places',opportunity:'event',anchor:'ecology'};

test('workspace preserves selected candidates and text, excluding unselected notes', () => {
  const value = decodeWorkspace(encodeWorkspace(state), catalog);
  assert.deepEqual([...value.saved], ['event']);
  assert.equal(value.notes.event,state.notes.event);
  assert.equal(value.notes.ecology,undefined);
  assert.equal(value.opportunity,'event');
});
test('workspace rejects corrupt, incompatible and unknown data without overwriting', () => {
  assert.throws(()=>decodeWorkspace('{',catalog));
  for (const update of [{version:2},{saved:['missing']},{notes:{event:42}},{selected:'__proto__'},{opportunity:'missing'}]) {
    assert.throws(()=>decodeWorkspace(JSON.stringify({...JSON.parse(encodeWorkspace(state)),...update}),catalog));
  }
});
test('an empty workspace is valid after deleting the last candidate',()=>{
  const value=decodeWorkspace(encodeWorkspace({...state,saved:new Set()}),catalog);
  assert.equal(value.saved.size,0);
  assert.deepEqual(value.notes,{});
});
test('curved connections start and end at the actual requested ports',()=>{
  assert.match(downwardCurve({x:101.5,y:24},{x:208,y:109.25}),/^M101.5 24 C.*208 109.25$/);
});
test('rounded connections handle coincident waypoints without NaN or shifted endpoints',()=>{
  const d=roundedRoute([{x:50,y:10},{x:50,y:40},{x:50,y:40},{x:50,y:60}]);
  assert.ok(d.startsWith('M50 10'));
  assert.ok(d.endsWith('L50 60'));
  assert.ok(!d.includes('NaN'));
});

import { publicCandidates, validateRecommendation } from './workspace.mjs';
const recommendation = {id:'sample-1',title:'Explore',message:'A private suggestion',url:'https://example.com/info',photo:'',kind:'読みもの',tags:['ecology'],status:'new'};
test('family projection excludes private candidates, notes and feedback',()=>{
  const projected=publicCandidates({...state,saved:new Set(['ecology','event']),notes:{ecology:'secret'},sharing:{visibility:{ecology:'family'},recommendations:[recommendation]}},{ecology:{name:'Ecology'},event:{name:'Event',domain:'ecology'}});
  assert.deepEqual(projected,[{id:'ecology',name:'Ecology',domain:'ecology'}]);
  assert.deepEqual(publicCandidates({...state,sharing:{visibility:{event:'private'}}},catalog.items),[]);
});
test('sharing survives reload and older workspaces default to private',()=>{
  const sharing={visibility:{event:'family'},recommendations:[recommendation]};
  assert.deepEqual(decodeWorkspace(encodeWorkspace({...state,sharing}),catalog).sharing,sharing);
  const old=JSON.parse(encodeWorkspace(state)); delete old.sharing;
  assert.deepEqual(decodeWorkspace(JSON.stringify(old),catalog).sharing,{visibility:{},recommendations:[]});
});
test('recommendations reject unsafe URLs, unrecognized tags, oversized photos and invalid states',()=>{
  for(const update of [{url:'javascript:alert(1)'},{url:'data:text/html,hello'},{url:'https://user:pass@example.com'},{tags:['unknown']},{photo:'data:image/svg+xml;base64,AAAA'},{photo:'data:image/jpeg;base64,'+'A'.repeat(700000)},{status:'public'},{title:' '},{url:'',photo:''}]) {
    assert.throws(()=>validateRecommendation({...recommendation,...update},catalog.domains));
  }
  assert.equal(validateRecommendation({...recommendation,url:'',photo:'data:image/jpeg;base64,AAAA'},catalog.domains).photo,'data:image/jpeg;base64,AAAA');
});
test('sharing rejects orphaned publication and duplicate recommendations',()=>{
  for(const sharing of [{visibility:{missing:'family'},recommendations:[]},{visibility:{event:'everyone'},recommendations:[]},{visibility:{},recommendations:[recommendation,recommendation]}]) {
    assert.throws(()=>decodeWorkspace(encodeWorkspace({...state,sharing}),catalog));
  }
});

import {extraDomains,extraTopics,extraNeighbors,liveOpportunities,normalizeQuery,searchCatalog} from './catalog.mjs';
const allDomains={ecology:{name:'生態学',tags:[]},environment:{name:'環境科学',tags:[]},engineering:{name:'海洋工学',tags:[]},information:{name:'情報科学',tags:[]},design:{name:'デザイン',tags:[]},...extraDomains};
test('search normalizes kana, case and width without inventing unknown matches',()=>{
  assert.equal(normalizeQuery(' ＳＣＲＡＴＣＨ '),'scratch');
  assert.ok(searchCatalog('ぎたー',extraTopics,allDomains,liveOpportunities).some(item=>item.id==='guitar-anatomy'));
  assert.ok(searchCatalog('料理',extraTopics,allDomains,liveOpportunities).some(item=>item.id==='cooking'));
  assert.deepEqual(searchCatalog('not-a-listed-topic',extraTopics,allDomains,liveOpportunities),[]);
});
test('filters require explicit conditions and exclude legacy fictional resources',()=>{
  const resources={...liveOpportunities,old:{example:true}};
  const home=searchCatalog('',extraTopics,allDomains,resources,'home');
  assert.equal(home.length,4);
  assert.ok(home.every(item=>item.resource.online && item.resource.free));
  assert.ok(searchCatalog('',extraTopics,allDomains,resources,'study').every(item=>item.resource.group==='study'));
  assert.ok(!searchCatalog('',extraTopics,allDomains,resources).some(item=>item.id==='old'));
});
test('live resources and graph relations have valid endpoints and source metadata',()=>{
  for(const item of Object.values(liveOpportunities)) {
    assert.equal(new URL(item.url).protocol,'https:');
    assert.match(item.checkedOn,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(item.source && item.reason && item.conditions.length);
    assert.ok(item.domains.includes(item.domain));
    for(const id of item.domains) assert.ok(allDomains[id]);
    for(const id of [item.host,item.child].filter(Boolean)) assert.ok(liveOpportunities[id]);
  }
  for(const topic of Object.values(extraTopics)) {assert.equal(topic.ids.length,3);assert.ok(topic.ids.every(id=>allDomains[id]));}
  for(const list of Object.values(extraNeighbors)) assert.ok(list.every(([id])=>allDomains[id]));
});
test('a resource opened from another supported domain retains its exploration state',()=>{
  const resource=liveOpportunities['ocean-steam'];
  const expandedCatalog={items:{...allDomains,...liveOpportunities},domains:allDomains,topics:{sea:{ids:['environment']}},opportunities:liveOpportunities};
  const value=decodeWorkspace(encodeWorkspace({...state,saved:new Set(['ocean-steam']),selected:'environment',opportunity:'ocean-steam'}),expandedCatalog);
  assert.equal(value.selected,'environment');
  assert.equal(value.opportunity,'ocean-steam');
  assert.ok(resource.domains.includes(value.selected));
});

test('private reflections survive reload, omit unsaved records and reject invalid values',()=>{
  const value=decodeWorkspace(encodeWorkspace({...state,reflections:{event:'tried',ecology:'unsure'}}),catalog);
  assert.deepEqual(value.reflections,{event:'tried'});
  assert.deepEqual(decodeWorkspace(encodeWorkspace(state),catalog).reflections,{});
  assert.throws(()=>decodeWorkspace(encodeWorkspace({...state,reflections:{event:'suitable'}}),catalog));
});

import {emptyPersonalMap,validatePersonalMap,descendants,removeMapBranch} from './personal-map.mjs';
const personal={version:1,nodes:[...emptyPersonalMap().nodes,{id:'games',parent:'root',title:'ゲームが好き',note:'自分だけのメモ',reason:'楽しい',source:null},{id:'audio',parent:'games',title:'音も作りたい',note:'',reason:'世界観を作る',source:'ecology'},{id:'cooking',parent:'root',title:'料理',note:'',reason:'',source:null}],links:[{from:'audio',to:'cooking',reason:'どちらも自分で作る'}]};
test('personal map persists custom interests, references and cross-connections without public exposure',()=>{
  const value=decodeWorkspace(encodeWorkspace({...state,personalMap:personal}),catalog);
  assert.deepEqual(value.personalMap,personal);
  assert.deepEqual(publicCandidates({...state,personalMap:personal},catalog.items),[]);
  assert.deepEqual(decodeWorkspace(encodeWorkspace(state),catalog).personalMap,emptyPersonalMap());
});
test('personal map rejects cycles, dangling parents and malformed connections',()=>{
  const invalids=[{...personal,nodes:personal.nodes.map(node=>node.id==='games'?{...node,parent:'audio'}:node)},{...personal,nodes:personal.nodes.map(node=>node.id==='games'?{...node,parent:'missing'}:node)},{...personal,links:[{from:'audio',to:'missing',reason:'test'}]},{...personal,links:[personal.links[0],{from:'cooking',to:'audio',reason:'duplicate'}]},{...personal,nodes:personal.nodes.map(node=>node.id==='audio'?{...node,source:'__proto__'}:node)}];
  for(const value of invalids) assert.throws(()=>validatePersonalMap(value,catalog.items));
});
test('removing a branch removes descendants and crossing links without changing siblings',()=>{
  assert.deepEqual([...descendants(personal,'games')],['games','audio']);
  const next=removeMapBranch(personal,'games');
  assert.deepEqual(next.nodes.map(node=>node.id),['root','cooking']);
  assert.deepEqual(next.links,[]);
  assert.throws(()=>removeMapBranch(personal,'root'));
  assert.equal(personal.nodes.length,4);
});

import {integratePaths} from './personal-map.mjs';

test('integration groups paths and preserves personalized branches on repeat import',()=>{
  let sequence=0;const id=()=>`import-${++sequence}`;
  const items={science:{},school:{},club:{}};
  const path=source=>[{key:'sea',title:'海が好き'},{source:'science',title:'Science',reason:'Observe'},{source,title:source,note:'My research',reason:'Try it'}];
  const initial=integratePaths(emptyPersonalMap(),[path('school'),path('club')],'root',items,id);
  assert.equal(initial.added,4);
  assert.equal(initial.map.nodes.filter(node=>node.source==='science').length,1);
  const school=initial.map.nodes.find(node=>node.source==='school');
  school.title='My own school idea';school.note='Edited note';
  const repeated=integratePaths(initial.map,[path('school')],'root',items,id);
  assert.equal(repeated.added,0);
  assert.equal(repeated.map.nodes.find(node=>node.id===school.id).note,'Edited note');
  assert.equal(repeated.map.nodes.find(node=>node.id===school.id).title,'My own school idea');
  assert.equal(repeated.selected,school.id);
});

test('integration attaches to an existing branch atomically and enforces capacity',()=>{
  const map=emptyPersonalMap();
  map.nodes.push({id:'custom',parent:'root',source:null,title:'My project',note:'',reason:''});
  const direct=integratePaths(map,[[{source:'school',title:'School',note:'Saved private note'}]],'custom',{school:{}},()=> 'new-source');
  assert.equal(direct.map.nodes.at(-1).parent,'custom');
  assert.equal(map.nodes.length,2);
  assert.throws(()=>integratePaths(map,[[{source:'unknown',title:'Unknown'}]],'custom',{}));
  assert.throws(()=>integratePaths(map,[],'missing',{}));
  for(let i=0;i<38;i++) map.nodes.push({id:`branch-${i}`,parent:'root',source:null,title:'Branch',note:'',reason:''});
  assert.throws(()=>integratePaths(map,[[{source:'school',title:'School'}]],'custom',{school:{}},()=> 'overflow'));
  assert.equal(map.nodes.length,40);
});

import {startInquiry,attachResource,attachReference,branchContext} from './studio.mjs';
test('inquiry starters preserve research and context follows a custom question',()=>{
  const domains={a:{name:'A',question:'Question A'},b:{name:'B',question:'Question B'}};
  const resources={resource:{name:'Resource',domain:'a',domains:['a'],reason:'A practical example'}};
  const topics={topic:{root:'Interest',ids:['a','b']}};
  const all={...domains,...resources};
  const started=startInquiry(emptyPersonalMap(),'topic',topics,domains,all,randomUUID);
  const a=started.map.nodes.find(node=>node.source==='a');
  const attached=attachResource(started.map,a.id,'resource',all,{resource:'Private note'},randomUUID);
  assert.equal(attached.map.nodes.find(node=>node.id===attached.selected).note,'Private note');
  assert.equal(attachResource(attached.map,attached.selected,'resource',all,{},randomUUID).added,0);
  const again=startInquiry(attached.map,'topic',topics,domains,all,randomUUID);
  assert.equal(again.added,0);
  assert.equal(again.map.nodes.length,5);
  again.map.nodes.push({id:'question',parent:attached.selected,title:'My question',source:null,reason:'',note:''});
  assert.deepEqual(branchContext(again.map,'question',domains,resources),['a']);
});

test('external research preserves provenance privately through storage and validates URLs',()=>{
  const reference={title:'A research page',url:'https://example.com/research',photo:'',tags:['ecology'],by:'自分で追加'};
  const result=attachReference(emptyPersonalMap(),'root',reference,catalog.items,'Private observation',randomUUID);
  result.map.nodes.at(-1).title='My interpretation';
  const restored=decodeWorkspace(encodeWorkspace({...state,personalMap:result.map}),catalog);
  assert.equal(restored.personalMap.nodes.at(-1).reference.title,'A research page');
  assert.equal(restored.personalMap.nodes.at(-1).title,'My interpretation');
  assert.equal(restored.personalMap.nodes.at(-1).note,'Private observation');
  assert.equal(attachReference(result.map,'root',reference,catalog.items).added,0);
  assert.deepEqual(publicCandidates({...state,personalMap:result.map},catalog.items),[]);
  for(const url of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.com']) assert.throws(()=>attachReference(emptyPersonalMap(),'root',{...reference,url},catalog.items));
  assert.throws(()=>attachReference(emptyPersonalMap(),'root',{...reference,tags:['missing']},catalog.items));
});

test('starting an inquiry keeps the chosen interest selected, not an arbitrary domain',()=>{
  const domains={a:{name:'A',question:'A?'},b:{name:'B',question:'B?'}};
  const result=startInquiry(emptyPersonalMap(),'topic',{topic:{root:'My interest',ids:['a','b']}},domains,domains,randomUUID);
  assert.equal(result.map.nodes.find(node=>node.id===result.selected).title,'My interest');
});

import {validateInquiry,evidenceFor,inquiryCandidates,nextInquiryStep} from './inquiry.mjs';
test('research facts retain source metadata and never infer facts from an arbitrary URL',()=>{
  const items={r:{name:'Original',domain:'science',summary:'Make something',url:'https://example.com/official',checkedOn:'2026-09-11',conditions:[['費用','無料'],['対象','中学生']],step:'Create one scene'}};
  const node={source:'r',title:'My title'};
  assert.equal(evidenceFor(node,items).cost,'無料');
  assert.equal(evidenceFor(node,items).original,'Original');
  assert.equal(evidenceFor(node,items).location,'未確認');
  const external={title:'My link',reference:{title:'External',url:'https://example.com'}};
  assert.equal(evidenceFor(external,items).cost,'未確認');
  assert.match(evidenceFor(external,items).summary,/未確認/);
});
test('experience updates the next step and persists privately alongside personal criteria',()=>{
  const map=emptyPersonalMap();
  const record={question:'Do I like making sound?',criteria:['Can I create?'],answers:{'Can I create?':'I enjoyed changing sounds'},plan:'Create one scene',status:'tried',observation:'Changed the sound',learned:'I like making atmosphere',next:'Record my own sound'};
  map.nodes.push({id:'research',parent:'root',source:'event',title:'Try',reason:'',note:'',inquiry:record});
  const restored=decodeWorkspace(encodeWorkspace({...state,personalMap:map}),catalog);
  assert.deepEqual(restored.personalMap.nodes[1].inquiry,record);
  assert.equal(nextInquiryStep(restored.personalMap.nodes[1],catalog.items).text,record.next);
  assert.deepEqual(publicCandidates({...state,personalMap:map},catalog.items),[]);
  assert.deepEqual(inquiryCandidates(map,'root',catalog.items).map(node=>node.id),[]);
  assert.equal(nextInquiryStep({inquiry:{status:'tried',learned:'I enjoyed it'}},{}).label,'体験を次の判断に使う');
});
test('inquiry validation rejects malformed criteria, assessments and statuses',()=>{
  for(const value of [{status:'suited'},{criteria:['same','same']},{criteria:Array(6).fill('axis')},{criteria:['a'.repeat(81)]},{answers:{axis:1}},{next:4}]) assert.throws(()=>validateInquiry(value));
  const map=emptyPersonalMap();map.nodes[0].inquiry={status:'suited'};
  assert.throws(()=>validatePersonalMap(map,{}));
});

// --- Build 14: 学問から高校までの逆引き経路 ---

test('every published field offers at least three routes of different kinds', () => {
  for (const domainId of routeDomains()) {
    const routes = routesForDomain(domainId, {name: domainId});
    assert.ok(routes.length >= 3, `${domainId} has ${routes.length} routes`);
    assert.equal(new Set(routes.map(route => route.kind)).size, routes.length, `${domainId} repeats a route kind`);
    assert.deepEqual(routes.map(route => route.order), [...routes.map(route => route.order)].sort((a, b) => a - b));
  }
});

test('each route ends at the present and states a deferral deadline for every earlier decision', () => {
  for (const domainId of routeDomains()) {
    for (const route of routesForDomain(domainId, {name: domainId})) {
      const last = route.steps.at(-1);
      assert.equal(last.stage, 'now');
      assert.equal(last.decision, null, 'the final step is what cannot be deferred');
      for (const step of route.steps.slice(0, -1)) {
        const point = decisionPoints[step.decision];
        assert.ok(point, `${route.id}/${step.stage} has no decision point`);
        assert.match(point.defer, /まで/);
        assert.ok(point.detail.length > 20);
      }
      assert.deepEqual(route.steps.map(step => step.decision), ['lab', 'faculty', 'course', 'highschool', null]);
    }
  }
});

test('routes carry a math level, and the requirement differs between routes to the same field', () => {
  let varied = 0;
  for (const domainId of routeDomains()) {
    const routes = routesForDomain(domainId, {name: domainId});
    for (const route of routes) {
      assert.ok(mathLevels[route.math.level], `${route.id} has no math level`);
      assert.equal(route.math.label, mathLevels[route.math.level].label);
      assert.ok(route.math.detail.length > 20);
    }
    if (mathSpread(routes).varies) varied += 1;
  }
  assert.equal(varied, routeDomains().length, 'every field should show that the maths ceiling depends on the route');
});

test('route sources are official https pages with an attribution and a check date', () => {
  for (const domainId of routeDomains()) {
    for (const route of routesForDomain(domainId, {name: domainId})) {
      assert.equal(route.checkedOn, ROUTES_CHECKED_ON);
      for (const step of route.steps) {
        if (!step.link) continue;
        assert.match(step.link.url, /^https:\/\//, `${route.id} links to ${step.link.url}`);
        assert.ok(step.link.source.trim(), `${route.id} has an unattributed link`);
      }
      assert.ok(route.steps.find(step => step.stage === 'university').link, `${route.id} must cite the university`);
    }
  }
});

test('held routes survive saving and unknown route ids are rejected', () => {
  const known = routeDomains().flatMap(id => routesForDomain(id, {name: id}).map(route => route.id));
  const withRoutes = {...catalog, routes: known};
  const held = decodeWorkspace(encodeWorkspace({...state, heldRoutes: new Set([known[0]])}), withRoutes);
  assert.deepEqual([...held.heldRoutes], [known[0]]);
  assert.equal(decodeWorkspace(encodeWorkspace(state), withRoutes).heldRoutes.size, 0);
  assert.throws(() => decodeWorkspace(encodeWorkspace({...state, heldRoutes: new Set(['ecology-nosuchkind'])}), withRoutes));
});

import {emptyProgress,validateProgress,suggestNext} from './guide.mjs';
test('returning users retain their place and receive the next action for their saved plan',()=>{
  const map=emptyPersonalMap();map.nodes.push({id:'planned',parent:'root',title:'Try sound',source:'event',note:'',reason:'',inquiry:{status:'planned',plan:'Make one scene'}});
  const progress={lastNode:'planned',guideSeen:true,recent:[{title:'Try sound',action:'recorded',at:'2026-09-12T03:00:00.000Z'}]};
  const restored=decodeWorkspace(encodeWorkspace({...state,personalMap:map,progress}),catalog);
  assert.deepEqual(restored.progress,progress);
  assert.equal(suggestNext(restored.personalMap,restored.progress.lastNode,catalog.items).action,'write');
  assert.equal(suggestNext(restored.personalMap,restored.progress.lastNode,catalog.items).reason,'Make one scene');
  assert.equal(validateProgress({...progress,lastNode:'removed'},map).lastNode,'root');
  assert.deepEqual(validateProgress(undefined,map),emptyProgress());
  assert.throws(()=>validateProgress({...progress,recent:[{title:'Invalid',action:'unknown',at:'bad'}]},map));
});
test('a comparison contains only research inside the selected question',()=>{
  const map=emptyPersonalMap();map.nodes.push({id:'q',parent:'root',title:'Question',source:null,note:'',reason:''},{id:'a',parent:'q',title:'A',source:'a',note:'',reason:''},{id:'b',parent:'root',title:'B',source:'b',note:'',reason:''});
  const items={a:{domain:'science'},b:{domain:'science'}};
  assert.deepEqual(inquiryCandidates(map,'q',items).map(node=>node.id),['a']);
});

import {layoutJourney,renderJourney} from './journey.mjs';
test('radial journey separates cards and spreads sibling branches around the root',()=>{
  const nodes=[{id:'root',parent:null},...Array.from({length:12},(_,i)=>({id:`n${i}`,parent:'root'}))];
  const placed=layoutJourney(nodes),root=placed[0];
  assert.ok(placed.some(node=>node.x<root.x) && placed.some(node=>node.x>root.x));
  assert.ok(placed.some(node=>node.y<root.y) && placed.some(node=>node.y>root.y));
  for(let i=0;i<placed.length;i++) for(let j=i+1;j<placed.length;j++) assert.ok(Math.abs(placed[i].x-placed[j].x)>=189.9 || Math.abs(placed[i].y-placed[j].y)>=99.9);
  assert.deepEqual(layoutJourney([]),[]);
});
test('view history survives persistence and safely renders known sources only',()=>{
  const progress={...emptyProgress(),visited:['event','domain']};
  const restored=decodeWorkspace(encodeWorkspace({...state,progress}),catalog);
  assert.deepEqual(restored.progress.visited,progress.visited);
  assert.throws(()=>validateProgress({...progress,visited:['<script>']},emptyPersonalMap()));
  const html=renderJourney(emptyPersonalMap(),{...progress,visited:['unknown']},catalog.items,'history');
  assert.ok(html.includes('まだ見た情報はありません'));
  assert.ok(!html.includes('data-revisit="unknown"'));
});

import {directions,directionContext,addDirectionActivity,renderDirections} from './directions.mjs';
import {validateCapture,captureBookmark} from './capture.mjs';
test('interest directions connect graded activity ideas to editable records without duplicating branches',()=>{
  for(const topic of Object.keys(directions)) {
    const started=startInquiry(emptyPersonalMap(),topic,{[topic]:{root:'Interest',ids:[]}},catalog.items,catalog.items);
    assert.equal(started.map.nodes.length,5);
    assert.equal(directionContext(started.map,started.selected).topic,topic);
    for(const group of directions[topic]) {
      const parent=started.map.nodes.find(node=>node.title===group[2]).id;
      for(let index=0;index<3;index++) {
        const activity=addDirectionActivity(started.map,parent,topic,group[0],index,catalog.items);
        const node=activity.map.nodes.find(node=>node.id===activity.selected);
        assert.equal(node.note,group[5][index][1]);
        assert.equal(node.parent,parent);
        assert.equal(directionContext(activity.map,node.id).group[0],group[0]);
        const again=addDirectionActivity(activity.map,node.id,topic,group[0],index,catalog.items);
        assert.equal(again.added,0);
      }
    }
    assert.ok(renderDirections(started.map,started.map.nodes.find(node=>node.id===started.selected)).includes('まずは、楽しみ方'));
  }
});
test('captured sources require reviewable safe URLs and preserve provenance',()=>{
  const reference=validateCapture('A page','https://example.com/path?a=1');
  assert.equal(reference.url,'https://example.com/path?a=1');
  assert.equal(reference.by,'自分で追加');
  assert.throws(()=>validateCapture('Bad','javascript:alert(1)'));
  assert.throws(()=>validateCapture('Bad','https://user:pass@example.com/'));
  assert.throws(()=>validateCapture('','https://example.com'));
  assert.ok(captureBookmark('http://127.0.0.1:4317').includes('document.title.slice(0,80)'));
});

import {readFile} from 'node:fs/promises';
import {validateKnowledge} from './scripts/knowledge.mjs';
import {attachConcept,conceptForNode} from './knowledge-ui.mjs';
test('knowledge data rejects broken links, cycles, duplicates and invalid publication dates',async()=>{
  const data=JSON.parse(await readFile(new URL('./data/knowledge.json',import.meta.url),'utf8'));
  assert.equal(validateKnowledge(data),data);
  const missing=structuredClone(data);missing.resources[0].conceptIds=['missing'];assert.throws(()=>validateKnowledge(missing));
  const cycle=structuredClone(data);cycle.concepts[0].broader=['marine-life'];assert.throws(()=>validateKnowledge(cycle));
  const duplicate=structuredClone(data);duplicate.resources.push(duplicate.resources[0]);assert.throws(()=>validateKnowledge(duplicate));
  const future=structuredClone(data);future.resources[0].checkedOn='2999-01-01';assert.throws(()=>validateKnowledge(future));
});
test('cross-field exploration retains valid short IDs through a deep map and reuses existing concepts',()=>{
  let map=emptyPersonalMap(),parent='root';
  for(const id of ['biology','marine-life','fieldwork','forest-life','freshwater-life']) {
    const result=attachConcept(map,parent,id,catalog.items);map=result.map;parent=result.selected;
    assert.ok(parent.length<=80);assert.equal(conceptForNode(map,parent).id,id);
  }
  const again=attachConcept(map,parent,'biology',catalog.items);assert.equal(again.added,0);
  assert.equal(again.map.nodes.length,6);
});
test('capture bookmark passes source details in a URL fragment rather than the server query',()=>{
  const bookmark=captureBookmark('https://demo.example');
  assert.ok(bookmark.includes("u.hash='personal?'+p.toString()"));
  assert.ok(!bookmark.includes('u.searchParams'));
});
