const status = document.querySelector('#status');
const guest = document.querySelector('#guest');
const member = document.querySelector('#member');
const form = document.querySelector('#sign-in-form');
const note = document.querySelector('#form-note');
const sessionKey = 'shimboku.cloud.session';

let runtime;
try {
  runtime = (await (await fetch('/api/v1/config')).json()).data;
} catch {
  runtime = {configured: false};
}

function sessionFromLocation() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const token = hash.get('access_token');
  if (token) {
    sessionStorage.setItem(sessionKey, token);
    history.replaceState(null, '', location.pathname);
  }
  return sessionStorage.getItem(sessionKey);
}

async function render() {
  const token = sessionFromLocation();
  if (!runtime.configured) {
    status.textContent = '認証の設定待ちです。端末だけで地図を試せます。';
    guest.hidden = false;
    form.hidden = true;
    return;
  }
  if (!token) {
    status.textContent = '地図を端末で試すか、ログインして同期を始めます。';
    guest.hidden = false;
    return;
  }
  const response = await fetch('/api/v1/me', {headers: {Authorization: `Bearer ${token}`}});
  if (!response.ok) {
    sessionStorage.removeItem(sessionKey);
    status.textContent = 'セッションが切れました。もう一度ログインしてください。';
    guest.hidden = false;
    return;
  }
  const {data} = await response.json();
  status.textContent = 'ログイン済みです。';
  document.querySelector('#member-title').textContent = `${data.email ?? 'あなた'} の地図`;
  member.hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  note.textContent = '';
  const email = new FormData(form).get('email');
  const response = await fetch(`${runtime.url}/auth/v1/otp`, {
    method: 'POST',
    headers: {apikey: runtime.anonKey, 'Content-Type': 'application/json'},
    body: JSON.stringify({email, create_user: true, options: {emailRedirectTo: `${location.origin}/`}})
  });
  note.textContent = response.ok ? 'ログインリンクを送りました。メールから戻ると同期が始まります。' : 'リンクを送れませんでした。メール設定を確認してください。';
});

document.querySelector('#sign-out').addEventListener('click', () => {
  sessionStorage.removeItem(sessionKey);
  location.reload();
});

render();
