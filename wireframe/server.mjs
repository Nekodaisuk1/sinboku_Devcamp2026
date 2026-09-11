import {createFamilyApi} from './family-api.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const familyApi=await createFamilyApi({directory:new URL('./.data/',import.meta.url).pathname,origin:'http://127.0.0.1:4317'});

const files = new Map([
  ['/knowledge-data.mjs', ['knowledge-data.mjs', 'text/javascript; charset=utf-8']],
  ['/knowledge-ui.mjs', ['knowledge-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/room.css', ['room.css', 'text/css; charset=utf-8']],
  ['/capture.mjs', ['capture.mjs', 'text/javascript; charset=utf-8']],
  ['/directions.mjs', ['directions.mjs', 'text/javascript; charset=utf-8']],
  ['/journey.mjs', ['journey.mjs', 'text/javascript; charset=utf-8']],
  ['/journey.css', ['journey.css', 'text/css; charset=utf-8']],
  ['/guide.mjs', ['guide.mjs', 'text/javascript; charset=utf-8']],
  ['/inquiry.mjs', ['inquiry.mjs', 'text/javascript; charset=utf-8']],
  ['/inquiry-ui.mjs', ['inquiry-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/studio.mjs', ['studio.mjs', 'text/javascript; charset=utf-8']],
  ['/studio.css', ['studio.css', 'text/css; charset=utf-8']],
  ['/routes.css', ['routes.css', 'text/css; charset=utf-8']],
  ['/routes.mjs', ['routes.mjs', 'text/javascript; charset=utf-8']],
  ['/routes-ui.mjs', ['routes-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/family', ['family.html', 'text/html; charset=utf-8']],
  ['/family.js', ['family.js', 'text/javascript; charset=utf-8']],
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/catalog.mjs', ['catalog.mjs', 'text/javascript; charset=utf-8']],
  ['/geometry.mjs', ['geometry.mjs', 'text/javascript; charset=utf-8']],
  ['/personal-map.mjs', ['personal-map.mjs', 'text/javascript; charset=utf-8']],
  ['/workspace.mjs', ['workspace.mjs', 'text/javascript; charset=utf-8']],
]);

const server = createServer(async (request, response) => {
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(await familyApi(request,response)) return;
  const path = new URL(request.url, 'http://localhost').pathname;
  const entry = files.get(path);
  if (!entry) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const content = await readFile(new URL(entry[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    response.end(content);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end('Unable to read the requested file');
  }
});
server.listen(4317, '127.0.0.1', () => console.log('Wireframe: http://127.0.0.1:4317'));
server.on('error', (error) => { console.error(error); process.exitCode = 1; });
