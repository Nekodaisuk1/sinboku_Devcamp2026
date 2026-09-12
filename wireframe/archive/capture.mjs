export function validateCapture(title,url) {
  const parsed=new URL(url);
  if(!['https:','http:'].includes(parsed.protocol) || parsed.username || parsed.password || url.length>2048) throw new Error('http / https のページURLを入力してください。');
  if(typeof title!=='string' || !title.trim() || title.length>80) throw new Error('情報の名前を80文字以内で入力してください。');
  return {title:title.trim(),url:parsed.href,photo:'',by:'自分で追加',tags:[]};
}
export function captureBookmark(origin) {
  // Only a title and URL are transferred; page text, cookies and form values are never read.
  return `javascript:(()=>{const u=new URL(${JSON.stringify(origin+'/')});const p=new URLSearchParams();p.set('captureUrl',location.href);p.set('captureTitle',document.title.slice(0,80));u.hash='personal?'+p.toString();window.open(u.href,'_blank','noopener');})()`;
}
