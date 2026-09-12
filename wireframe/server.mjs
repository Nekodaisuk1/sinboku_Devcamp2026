import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

// 配信するファイルは許可リストで固定する。ディレクトリを丸ごと公開しない。
// Build 19 で保護者共有のサーバー実装は削除した（archive/ に退避）。
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/routes.css', ['routes.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/timeline.mjs', ['timeline.mjs', 'text/javascript; charset=utf-8']],
  ['/verbs.mjs', ['verbs.mjs', 'text/javascript; charset=utf-8']],
  ['/log.mjs', ['log.mjs', 'text/javascript; charset=utf-8']],
  ['/store.mjs', ['store.mjs', 'text/javascript; charset=utf-8']],
  ['/field.mjs', ['field.mjs', 'text/javascript; charset=utf-8']],
  ['/field-ui.mjs', ['field-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/catalog.mjs', ['catalog.mjs', 'text/javascript; charset=utf-8']],
  ['/routes.mjs', ['routes.mjs', 'text/javascript; charset=utf-8']],
  ['/routes-ui.mjs', ['routes-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/knowledge-data.mjs', ['knowledge-data.mjs', 'text/javascript; charset=utf-8']]
]);

const server = createServer(async (request, response) => {
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const path = new URL(request.url, 'http://localhost').pathname;
  const entry = files.get(path);
  if (!entry) {response.writeHead(404); response.end('Not found'); return;}
  try {
    const content = await readFile(new URL(entry[0], import.meta.url));
    response.writeHead(200, {'Content-Type': entry[1], 'Cache-Control': 'no-store'});
    response.end(content);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end('Unable to read the requested file');
  }
});
server.listen(4317, '127.0.0.1', () => console.log('シンボク Build 23: http://127.0.0.1:4317'));
server.on('error', error => {console.error(error); process.exitCode = 1;});
