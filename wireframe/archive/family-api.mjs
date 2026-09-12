import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {extraDomains,liveOpportunities} from './catalog.mjs';
import {validateRecommendation} from './workspace.mjs';

const domainNames={ecology:'生態学',environment:'環境科学',engineering:'海洋工学',information:'情報科学',design:'デザイン',...Object.fromEntries(Object.entries(extraDomains).map(([id,item])=>[id,item.name]))};
const catalog={...Object.fromEntries(Object.entries(domainNames).map(([id,name])=>[id,{id,name,domain:id}])),...Object.fromEntries(Object.entries(liveOpportunities).map(([id,item])=>[id,{id,name:item.name,domain:item.domain}]))};
const token=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fault=(status,message)=>Object.assign(new Error(message),{status});
const day=86400000;

export async function createFamilyApi({directory,origin,now=Date.now}) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const path=join(directory,'families.json');
  let store={version:1,families:{}};
  try {
    const loaded=JSON.parse(await readFile(path,'utf8'));
    if(loaded.version!==1 || !loaded.families || typeof loaded.families!=='object') throw new Error('Invalid family store');
    store=loaded;
  } catch(error) {if(error.code!=='ENOENT') throw error;}
  let queue=Promise.resolve();
  const cookie=(name,value)=>`${name}=${value}; Path=/api/family; HttpOnly; SameSite=Strict; Max-Age=2592000${origin.startsWith('https:')?'; Secure':''}`;
  const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(part=>part.trim().split('=')).filter(part=>part.length===2));
  const authenticate=(req,role,data)=>{
    const raw=cookies(req)[`shimboku_${role}`];
    if(!raw || !/^[\w-]{43}$/.test(raw)) throw fault(401,'共有スペースへの接続が必要です。');
    const digest=hash(raw);
    const family=Object.values(data.families).find(item=>item[`${role}Hash`]===digest && item.expiresAt>now());
    if(!family) throw fault(401,'接続が解除されたか、有効期限が切れています。');
    return family;
  };
  const ownerView=family=>({ids:family.ids,connected:!!family.viewerHash,joinedAt:family.joinedAt||null,recommendations:family.recommendations,expiresAt:family.expiresAt});
  const viewerView=family=>({candidates:family.ids.map(id=>catalog[id]),domains:domainNames,expiresAt:family.expiresAt});
  async function body(req) {
    if(!(req.headers['content-type']||'').startsWith('application/json')) throw fault(415,'JSON形式で送信してください。');
    let length=0;const chunks=[];
    for await(const chunk of req) {length+=chunk.length;if(length>900000) throw fault(413,'添付データが大きすぎます。');chunks.push(chunk);}
    try {return JSON.parse(Buffer.concat(chunks).toString());} catch {throw fault(400,'入力を読み取れませんでした。');}
  }
  async function dispatch(req,data,payload,route) {
    const method=req.method;
    if(route==='/create' && method==='POST') {
      let existing;
      try {existing=authenticate(req,'owner',data);} catch(error) {if(error.status!==401) throw error;}
      if(existing) return {body:ownerView(existing)};
      for(const [id,family] of Object.entries(data.families)) if(family.expiresAt<=now()) delete data.families[id];
      if(Object.keys(data.families).length>=100) throw fault(429,'この試作サーバーの共有数上限に達しました。');
      const secret=token(),id=token();
      const family={ownerHash:hash(secret),viewerHash:null,expiresAt:now()+30*day,ids:[],recommendations:[]};
      data.families[id]=family;
      return {body:ownerView(family),cookie:cookie('shimboku_owner',secret)};
    }
    if(route==='/join' && method==='POST') {
      if(typeof payload.token!=='string' || !/^[\w-]{43}$/.test(payload.token)) throw fault(400,'招待リンクが正しくありません。');
      const digest=hash(payload.token);
      const family=Object.values(data.families).find(item=>item.inviteHash===digest && item.inviteExpires>now() && item.expiresAt>now());
      if(!family) throw fault(410,'招待は使用済み、期限切れ、または取り消されています。本人に新しい招待をお願いしてください。');
      const secret=token();family.viewerHash=hash(secret);family.joinedAt=now();delete family.inviteHash;delete family.inviteExpires;
      return {body:viewerView(family),cookie:cookie('shimboku_viewer',secret)};
    }
    const isViewer=['/viewer','/recommendations'].includes(route);
    const family=authenticate(req,isViewer?'viewer':'owner',data);
    if(route==='/space' && method==='DELETE') {
      const id=Object.keys(data.families).find(id=>data.families[id]===family);
      delete data.families[id];return {body:{deleted:true},cookie:'shimboku_owner=; Path=/api/family; HttpOnly; SameSite=Strict; Max-Age=0'};
    }
    if(route==='/owner' && method==='GET') return {body:ownerView(family)};
    if(route==='/viewer' && method==='GET') return {body:viewerView(family)};
    if(route==='/candidates' && method==='PUT') {
      if(!Array.isArray(payload.ids) || payload.ids.length>50 || !payload.ids.every(id=>typeof id==='string' && Object.hasOwn(catalog,id))) throw fault(400,'共有する候補を確認してください。旧モックの架空例は共有できません。');
      family.ids=[...new Set(payload.ids)];return {body:ownerView(family)};
    }
    if(route==='/invite' && method==='POST') {
      const secret=token();family.inviteHash=hash(secret);family.inviteExpires=Math.min(family.expiresAt,now()+day);
      return {body:{url:`${origin}/family#invite=${secret}`,expiresAt:family.inviteExpires}};
    }
    if(route==='/access' && method==='DELETE') {
      family.viewerHash=null;delete family.joinedAt;delete family.inviteHash;delete family.inviteExpires;family.ids=[];
      return {body:ownerView(family)};
    }
    if(route==='/recommendations' && method==='POST') {
      if(typeof payload.requestId!=='string' || !/^[\w-]{36}$/.test(payload.requestId)) throw fault(400,'送信番号を確認してください。');
      if(family.recommendations.some(item=>item.requestId===payload.requestId)) return {body:{received:true}};
      if(family.recommendations.length>=20) throw fault(409,'おすすめは20件までです。');
      if(!family.ids.includes(payload.target)) throw fault(409,'この候補は現在共有されていません。表示を更新してください。');
      let recommendation;
      try {recommendation=validateRecommendation({...payload,id:randomUUID(),status:'new'},domainNames);} catch(error) {throw fault(400,error.message);}
      if(!recommendation.tags.includes(catalog[payload.target].domain)) throw fault(400,'関連する候補の領域タグを含めてください。');
      family.recommendations.unshift({...recommendation,requestId:payload.requestId,createdAt:now()});
      return {body:{received:true}};
    }
    throw fault(404,'操作が見つかりません。');
  }
  return async function handle(req,res) {
    const pathname=new URL(req.url,origin).pathname;
    if(!pathname.startsWith('/api/family/')) return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(req.headers.host!==new URL(origin).host) throw fault(403,'接続先が一致しません。');
      if(req.method!=='GET' && req.headers.origin!==origin) throw fault(403,'このサイトから操作してください。');
      if(req.headers.origin && req.headers.origin!==origin) throw fault(403,'別のサイトからは操作できません。');
      const payload=req.method==='GET'?null:await body(req);
      const run=async()=>{
        const next=structuredClone(store);
        const result=await dispatch(req,next,payload,pathname.slice('/api/family'.length));
        if(req.method!=='GET') {
          const temporary=path+'.tmp';
          await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,path);store=next;
        }
        return result;
      };
      const operation=queue.then(run);queue=operation.then(()=>undefined,error=>{if(!error.status) console.error('Family transaction failed:',error.code||error.name);});
      const result=await operation;
      if(result.cookie) res.setHeader('Set-Cookie',result.cookie);
      res.writeHead(200);res.end(JSON.stringify(result.body));
    } catch(error) {
      if(!error.status) console.error('Family API failed:',error.code||error.name);
      res.writeHead(error.status||500);res.end(JSON.stringify({error:error.status?error.message:'保存できませんでした。操作は確定していません。もう一度試してください。'}));
    }
    return true;
  };
}
