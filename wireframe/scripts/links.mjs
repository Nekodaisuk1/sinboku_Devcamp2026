// Build 24 担当C: 公開前に人が手で回す、掲載URLの生死を確かめる整備用スクリプト。
// アプリ本体（app.js など）は通信しない方針なので、これは配信物には含めず、
// `node scripts/links.mjs` で人が手元から叩くだけのツールとして置く。
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const CONCURRENCY=4;          // 相手サーバーに負荷をかけないよう、同時に投げるのは4本まで
const TIMEOUT_MS=15000;       // 1リクエストあたりの上限。応答が無いサイトに引きずられて全体が止まらないように
const USER_AGENT='wireframe-knowledge-link-checker/1.0 (maintenance script; run manually before publishing, not part of the deployed app)';

// HEADが2xxで返ってこなかったときは、GETで1回だけ撮り直す。
// 405/501（HEADという方法自体の拒否）だけを撮り直す作りにしていたが、実際に確認したところ
// ikilog.biodic.go.jp と www.tuat.ac.jp は HEAD に 500 を返してGETには 200 を返す。
// HEADの失敗だけで「リンクが切れている」と報告すると、生きているページを死んだことにしてしまう。
// 撮り直しは1回きり（連打しない）。GETでも失敗したら、そのまま報告する。
const RETRY_WITH_GET=status=>status<200 || status>=300;

const STATE_LABELS={
  ok:'OK',
  redirect:'リダイレクト',
  notfound:'見つかりません',
  servererror:'サーバーの問題',
  timeout:'時間切れ',
  networkerror:'つながりません',
};

// 東アジアの文字幅の厳密な判定ではないが、日本語の状態名と英数字のURLを
// 同じ表に並べたときにそれなりに列が揃うように、全角相当の文字を2幅として数える。
function displayWidth(value) {
  let width=0;
  for (const ch of value) {
    const code=ch.codePointAt(0);
    const isWide=(code>=0x1100 && code<=0x115F) || (code>=0x2E80 && code<=0xA4CF) || (code>=0xAC00 && code<=0xD7A3) || (code>=0xF900 && code<=0xFAFF) || (code>=0xFF00 && code<=0xFF60) || (code>=0xFFE0 && code<=0xFFE6) || (code>=0x20000 && code<=0x3FFFD);
    width+=isWide?2:1;
  }
  return width;
}
function padDisplay(value,width) {
  return value+' '.repeat(Math.max(0,width-displayWidth(value)));
}

async function loadPublishedResources() {
  const raw=await readFile(new URL('../data/knowledge.json',import.meta.url),'utf8');
  const data=JSON.parse(raw);
  if (!Array.isArray(data.resources)) throw new Error('links: data/knowledge.json is missing a resources array');
  return data.resources.filter(resource=>resource.reviewStatus==='published');
}

// 1本のURLをHEAD→（拒まれたら）GETで確認する。結果は握りつぶさず、必ず何らかのstateにして返す。
async function checkUrl(url) {
  const attempt=async method=>{
    const res=await fetch(url,{
      method,
      redirect:'follow',
      signal:AbortSignal.timeout(TIMEOUT_MS),
      headers:{'User-Agent':USER_AGENT},
    });
    // 中身を読み切る必要は無い（GETでも本文は見ない）。接続を持ったままにしないよう明示的に閉じる。
    if (res.body) { try { await res.body.cancel(); } catch { /* 既に閉じている・空ボディなどは無視してよい */ } }
    return res;
  };

  let res;
  let headStatus=null;
  try {
    res=await attempt('HEAD');
    if (RETRY_WITH_GET(res.status)) {
      headStatus=res.status;
      res=await attempt('GET');
    }
  } catch (err) {
    // AbortSignal.timeout による中断はTimeoutError（環境によってはAbortError）としてここに来る。
    if (err.name==='TimeoutError' || err.name==='AbortError') {
      return {state:'timeout',finalUrl:null,detail:`${TIMEOUT_MS/1000}秒応答なし`};
    }
    // DNS解決不可・接続拒否・TLSエラーなど。こちらの回線都合の可能性もあるので、原因は出すが致命扱いにはしない。
    return {state:'networkerror',finalUrl:null,detail:err.cause?.message ?? err.message};
  }

  const finalUrl=(res.url && res.url!==url) ? res.url : null;
  // HEADとGETで結果が食い違ったことは残す。相手のサーバーの癖であって、こちらの記録の誤りではない。
  const headNote=headStatus===null ? null : `HEADは HTTP ${headStatus} を返したが、GETでは届いた`;
  if (res.status>=200 && res.status<300) {
    return finalUrl ? {state:'redirect',finalUrl,detail:headNote} : {state:'ok',finalUrl:null,detail:headNote};
  }
  if (res.status>=400 && res.status<500) return {state:'notfound',finalUrl,detail:`HTTP ${res.status}`};
  if (res.status>=500) return {state:'servererror',finalUrl,detail:`HTTP ${res.status}`};
  // fetchはデフォルトでリダイレクトを追うので3xxが残ることは通常無いはずだが、
  // 想定外のステータスを黙って無視せず、そう報告する。
  return {state:'servererror',finalUrl,detail:`想定外の応答 HTTP ${res.status}`};
}

// concurrency本までの並列実行。ライブラリを足さず、自前の小さなワーカープールで済ませる。
async function runPool(items,worker,limit) {
  const results=new Array(items.length);
  let next=0;
  async function run() {
    while (true) {
      const index=next++;
      if (index>=items.length) return;
      results[index]=await worker(items[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  return results;
}

function stateText(result) {
  const label=STATE_LABELS[result.state];
  return result.detail ? `${label} (${result.detail})` : label;
}
function urlText(result) {
  return result.finalUrl ? `${result.url} → ${result.finalUrl}` : result.url;
}

function printTable(rows,title) {
  if (title) console.log(title);
  if (!rows.length) { console.log('(該当なし)'); return; }
  const widths={
    id:Math.max(displayWidth('id'),...rows.map(r=>displayWidth(r.id))),
    state:Math.max(displayWidth('状態'),...rows.map(r=>displayWidth(stateText(r)))),
  };
  const line=(id,state,url)=>console.log(`${padDisplay(id,widths.id)}  ${padDisplay(state,widths.state)}  ${url}`);
  line('id','状態','url');
  console.log('-'.repeat(widths.id+widths.state+4+8));
  for (const r of rows) line(r.id,stateText(r),urlText(r));
}

function toJsonRow(r) {
  return {id:r.id,url:r.url,state:r.state,label:STATE_LABELS[r.state],finalUrl:r.finalUrl,detail:r.detail};
}

async function main() {
  const jsonMode=process.argv.includes('--json');
  const resources=await loadPublishedResources();

  const results=await runPool(resources,async resource=>{
    const outcome=await checkUrl(resource.url);
    return {id:resource.id,url:resource.url,...outcome};
  },CONCURRENCY);

  // OK以外は「何かしら人が見ておいた方がよいもの」としてまとめて報告する（リダイレクトも含む）。
  const problems=results.filter(r=>r.state!=='ok');

  if (jsonMode) {
    console.log(JSON.stringify({
      checkedAt:new Date().toISOString(),
      total:results.length,
      results:results.map(toJsonRow),
      problems:problems.map(toJsonRow),
    },null,2));
  } else {
    printTable(results,`published な resource ${results.length}件を確認しました。`);
    console.log('');
    printTable(problems,`問題があるもの: ${problems.length}件`);
  }

  // 4xx/5xxが1件でもあれば失敗として終了コード1。時間切れ・接続不可はこちらの回線の問題かもしれないので、
  // 終了コードは変えない（人がログを見て判断する）。
  const hasHttpError=results.some(r=>r.state==='notfound' || r.state==='servererror');
  process.exit(hasHttpError?1:0);
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  // ここでの失敗（knowledge.jsonが読めない・壊れている等）は握りつぶさず、
  // エラーを出したうえで異常終了させる。
  main().catch(err=>{console.error(err);process.exit(1);});
}
