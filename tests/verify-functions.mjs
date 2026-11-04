import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';
import { unzipSync, strFromU8 } from 'fflate';

const output = 'test-results/functions';
await mkdir(output, { recursive: true });
const functions = await zipFunctions('netlify/functions', output, {
  basePath: process.cwd(),
  config: {
    '*': { nodeBundler: 'esbuild', nodeVersion: '24' },
    'voice-token': { includedFiles: ['docs/formlane-guide.md'] },
  },
});
assert.equal(functions.length, 13);
for (const tool of ['styler', 'border']) {
  assert.equal(functions.find(fn => fn.name === `${tool}-background`).invocationMode, 'background');
  assert.equal(functions.find(fn => fn.name === `${tool}-cleanup`).schedule, '0 * * * *');
}
const paths = functions.flatMap(fn => fn.routes?.map(route => route.literal) ?? []);
for (const path of ['health', 'assistant', 'voice-token', 'import-style', 'import-content', 'styler/generate', 'styler/generation-status', 'border/generate', 'border/generation-status']) {
  assert.ok(paths.includes(`/api/${path}`), `Missing route: ${path}`);
}
const voice = functions.find(fn => fn.name === 'voice-token');
const files = unzipSync(await readFile(voice.path));
const guide = Object.keys(files).find(name => name.endsWith('docs/formlane-guide.md'));
assert.ok(guide, 'Voice guide missing from deployment archive');
assert.equal(strFromU8(files[guide]), await readFile('docs/formlane-guide.md', 'utf8'));
console.log('Verified 13 packaged functions, 9 API routes, background workers, cleanup schedules and bundled voice guide.');
