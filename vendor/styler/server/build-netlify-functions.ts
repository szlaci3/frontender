import { mkdir, readFile } from 'node:fs/promises';
import { zipFunctions } from '@netlify/zip-it-and-ship-it';

await mkdir('.netlify/functions-verify', { recursive: true });
const functions = await zipFunctions('netlify/functions', '.netlify/functions-verify', {
  basePath: process.cwd(), config: { '*': { nodeBundler: 'esbuild', nodeVersion: '24' } },
});
for (const fn of functions) console.log(`${fn.name}: bundled (${fn.runtime})`);
if (functions.length !== 4) throw new Error('Expected four Netlify functions.');
const manifest = JSON.parse(await readFile('.netlify/functions-verify/manifest.json', 'utf8'));
const worker = manifest.functions.find((fn: { name: string }) => fn.name === 'generate-background');
const cleanup = manifest.functions.find((fn: { name: string }) => fn.name === 'generation-cleanup');
const paths = manifest.functions.flatMap((fn: { routes?: { literal: string }[] }) => fn.routes?.map(route => route.literal) ?? []);
if (worker?.invocationMode !== 'background' || cleanup?.schedule !== '0 * * * *'
  || !['/api/generate', '/api/health', '/api/generation-status'].every(path => paths.includes(path))) {
  throw new Error('Netlify routes, background mode or cleanup schedule did not compile.');
}
console.log('Verified background invocation, API routes and hourly cleanup schedule.');
