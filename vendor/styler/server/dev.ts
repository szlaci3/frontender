import { existsSync } from 'node:fs';
import { generationApi } from './generation-api.ts';
import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.STYLER_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('STYLER_PORT must be an integer between 1024 and 65535.');
}

// Loading server credentials never starts a provider request. Explicit POST only.
const server = createServer((request, response) => {
  if (request.url?.split('?')[0] === '/api/health') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ status: 'ok', service: 'styler-local' }));
    return;
  }
  if (request.url?.split('?')[0] === '/api/generate') { void generationApi(request, response); return; }
  if (request.url?.startsWith('/api/')) {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Endpoint not available.' }));
    return;
  }
  vite.middlewares(request, response);
});

const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { server } },
  appType: 'spa',
});

server.on('error', error => {
  console.error(`Local server could not start: ${error.message}`);
  void vite.close().finally(() => { process.exitCode = 1; });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Styler local: http://127.0.0.1:${port}`);
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.close();
  await vite.close();
}
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });
