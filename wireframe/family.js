export async function familyRequest(path,method='GET',payload) {
  const response=await fetch(`/api/family${path}`,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(payload||{})})});
  const data=await response.json();
  if(!response.ok) throw Object.assign(new Error(data.error||'通信に失敗しました。'),{status:response.status});
  return data;
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function photoFromFile(file) {
  if(!file?.size) return '';
  if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024) throw new Error('JPEG・PNG・WebPの5MB以下の写真を選んでください。');
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.7);
  } finally {bitmap.close();}
}
if(location.pathname==='/family') {
  let snapshot,requestId=crypto.randomUUID();
  const status=document.getElementById('family-state'),view=document.getElementById('family-view');
  const render=()=>{
    view.innerHTML=`<section class="shared-family-candidates"><h2>共有されている「気になる」 <small>${snapshot.candidates.length}件</small></h2><div class="shared-candidates">${snapshot.candidates.map(item=>`<span>${escape(item.name)}</span>`).join('') || '<p>いま共有されている候補はありません。</p>'}</div><button class="secondary" id="refresh-family">最新の共有内容を見る ↻</button></section>${snapshot.candidates.length?`<form id="remote-recommendation"><h2>おすすめを添える</h2><p class="subtle">申し込みなどを進める前に、本人と相談してください。</p><label>関連する候補<select name="target">${snapshot.candidates.map(item=>`<option value="${item.id}">${escape(item.name)}</option>`).join('')}</select></label><label>見出し<input name="title" required maxlength="100" placeholder="例：気軽に参加できそうな観察会"></label><label>種類<select name="kind">${['イベント','進学','部活動','学外活動','読みもの'].map(kind=>`<option>${kind}</option>`).join('')}</select></label><label>URL<input name="url" type="url" maxlength="2048" placeholder="https://…"></label><label>写真（5MBまで）<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="subtle">URLか写真を1つ以上添えてください。写真は縮小してサーバーに保存されます。</p><fieldset><legend>追加の領域タグ（候補の領域は自動で付きます）</legend>${Object.entries(snapshot.domains).map(([id,name])=>`<label class="tag-choice"><input type="checkbox" name="tags" value="${id}">${escape(name)}</label>`).join('')}</fieldset><label>ひとこと<textarea name="message" maxlength="600" placeholder="興味があったら、見てみない？"></textarea></label><p id="send-feedback" role="status"></p><button type="submit" class="primary block">本人におすすめを送る →</button></form>`:''}<p class="source-caption">接続は最大30日間。本人が解除すると閲覧と投稿ができなくなります。本人の既読や採否は表示しません。</p>`;
  };
  const refresh=async()=>{
    try {snapshot=await familyRequest('/viewer');status.textContent='共有内容を読み込みました。';render();}
    catch(error) {status.textContent=error.message;if(error.status===401) view.innerHTML='<p>招待リンクから接続してください。</p>';else if(!snapshot) view.innerHTML='<button class="secondary" id="refresh-family">再読み込み</button>';}
  };
  const invitation=new URLSearchParams(location.hash.slice(1)).get('invite');
  if(invitation) {
    history.replaceState(null,'','/family');
    status.textContent='本人からの招待を受け取りました。';
    view.innerHTML='<p>このブラウザを共有相手として接続します。招待は1回限り有効です。</p><button class="primary" id="join-family">招待を受け取って開く →</button>';
    document.getElementById('join-family').addEventListener('click',async event=>{
      event.target.disabled=true;
      try {snapshot=await familyRequest('/join','POST',{token:invitation});status.textContent='共有スペースに接続しました。';render();}
      catch(error) {status.textContent=error.message;event.target.disabled=false;}
    });
  } else refresh();
  document.addEventListener('click',event=>{if(event.target.closest('#refresh-family')) refresh();});
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='remote-recommendation') return;
    event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),feedback=document.getElementById('send-feedback');button.disabled=true;
    try {
      const data=new FormData(form),target=snapshot.candidates.find(item=>item.id===data.get('target'));
      const payload={requestId,target:target.id,title:data.get('title'),kind:data.get('kind'),url:data.get('url').trim(),message:data.get('message'),photo:await photoFromFile(data.get('photo')),tags:[...new Set([target.domain,...data.getAll('tags')])]};
      await familyRequest('/recommendations','POST',payload);form.reset();requestId=crypto.randomUUID();feedback.textContent='おすすめを送りました。本人が確認して、残すかどうか選べます。';
    } catch(error) {feedback.textContent=error.message;if(error.status===401) {view.innerHTML='';status.textContent=error.message;}}
    finally {button.disabled=false;}
  });
}
