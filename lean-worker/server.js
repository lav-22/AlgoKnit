import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 3001);
const MAX_SOURCE_BYTES = Number(process.env.MAX_SOURCE_BYTES || 20000);
const DEFAULT_TIMEOUT_MS = Number(process.env.LEAN_TIMEOUT_MS || 10000);
const FORBIDDEN = /\b(sorry|admit|axiom|unsafe|run_tac|#eval|#check|IO|System)\b/;
const IMPORT = /^\s*import\s+([^\s]+)\s*$/gm;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > MAX_SOURCE_BYTES * 2) throw new Error('REQUEST_TOO_LARGE');
  }
  return JSON.parse(text || '{}');
}

function validateSource(source) {
  if (typeof source !== 'string' || !source.trim()) return 'Lean source is required';
  if (Buffer.byteLength(source) > MAX_SOURCE_BYTES) return 'Lean source exceeds the size limit';
  if (FORBIDDEN.test(source)) return 'Lean source contains a forbidden placeholder or declaration';
  for (const match of source.matchAll(IMPORT)) if (!match[1].startsWith('Mathlib')) return `Import is not allowed: ${match[1]}`;
  return null;
}

function diagnostics(stderr) {
  return stderr.split('\n').filter(Boolean).slice(0, 30).map(line => {
    const location = line.match(/:(\d+):(\d+):\s*(.*)$/);
    return { severity: 'error', line: location ? Number(location[1]) : undefined, column: location ? Number(location[2]) : undefined, message: (location?.[3] || line).slice(0, 1000) };
  });
}

async function compile(source, timeoutMs) {
  const dir = await mkdtemp(join(tmpdir(), 'parsons-lean-'));
  const file = join(dir, 'Puzzle.lean');
  await writeFile(file, source, { mode: 0o600 });
  const started = Date.now();
  try {
    return await new Promise(resolve => {
      const child = spawn('lake', ['env', 'lean', file], { cwd: new URL('.', import.meta.url).pathname, shell: false, env: { PATH: process.env.PATH } });
      let stdout = '', stderr = '', timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, Math.min(Math.max(timeoutMs, 1000), 30000));
      child.stdout.on('data', d => { stdout = (stdout + d).slice(-20000); });
      child.stderr.on('data', d => { stderr = (stderr + d).slice(-20000); });
      child.on('error', error => { clearTimeout(timer); resolve({ status: 'infrastructure_error', valid: false, diagnostics: [{ severity: 'error', message: error.message }], durationMs: Date.now()-started }); });
      child.on('close', code => {
        clearTimeout(timer);
        if (timedOut) return resolve({ status: 'timeout', valid: false, diagnostics: [], durationMs: Date.now()-started });
        const valid = code === 0;
        resolve({ status: valid ? 'verified' : 'rejected', valid, diagnostics: valid ? [] : diagnostics(stderr || stdout), durationMs: Date.now()-started, leanVersion: '4.32.0', mathlibVersion: 'v4.32.0', policyChecks: { noSorry: true, noAdmit: true, noUnsolvedGoals: valid, allowedImports: true } });
      });
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', leanVersion: '4.32.0', mathlibVersion: 'v4.32.0' });
  if (req.method !== 'POST' || req.url !== '/verify') return json(res, 404, { error: 'NOT_FOUND' });
  try {
    const body = await readJson(req); const error = validateSource(body.source);
    if (error) return json(res, 422, { status: 'rejected', valid: false, diagnostics: [{ severity: 'error', message: error }] });
    const result = await compile(body.source, Number(body.timeoutMs || DEFAULT_TIMEOUT_MS));
    return json(res, result.status === 'infrastructure_error' ? 503 : 200, result);
  } catch (error) {
    return json(res, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { status: 'rejected', valid: false, diagnostics: [{ severity: 'error', message: 'Invalid verification request' }] });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Lean worker listening on http://127.0.0.1:${PORT}`));
