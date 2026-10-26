import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

export const repositoryRoot = path.resolve(import.meta.dirname, '../..');
export const baselineFile = path.join(repositoryRoot, 'legacy/F35B_Offline_Open_World_Simulator_Advanced_Physics_Overhaul.html');
export async function appSource(file = baselineFile) {
  const text = await readFile(file, 'utf8');
  if (!file.endsWith('.html')) return text;
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1];
}
export function section(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error(`Missing source boundary: ${start} → ${end}`);
  return source.slice(first, last);
}
export function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  let level = 0, quote = null, comment = null, escaped = false;
  const open = source.indexOf('{', start);
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = null; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = null; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') level++;
    if (c === '}' && --level === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}
export async function physicsMath(file) {
  const source = await appSource(file);
  const names = ['atmos', 'interp', 'mulberry32', 'makeNoise', 'ctrlEff', 'waveDrag', 'fuelDistribution', 'massProperties', 'yawSurfaceTarget'];
  const declarations = [
    section(source, 'const TAU=', 'const $='),
    section(source, 'const AERO=', 'function ctrlEff'),
    section(source, 'const S_REF=', '/* Generic automatic tank'),
    section(source, 'const ELEV_MAX=', 'function surfaceRate'),
    'const S={coord:true};',
  ];
  const context = vm.createContext({ Math, Float32Array, Uint8Array });
  vm.runInContext(declarations.join('\n') + '\n' + names.map(n => extractFunction(source, n)).join('\n') + '\nthis.math={' + names.join(',') + ',AERO,MAX_FUEL,DRY,VERTT,IX,IY,IZ};', context, { timeout: 2000 });
  return context.math;
}
