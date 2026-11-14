#!/usr/bin/env node
// Supply-chain guard: fails when tracked source files contain the signatures of the
// obfuscated loader that was injected into this repository twice (2026-09-12, 2026-10-06),
// or the generic tells of hidden build-time code (whitespace-padded overlong lines,
// npm scripts that execute unknown files). Runs before `npm ci` in CI, so it needs no deps.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_LINE_LENGTH = 1000;
const LONG_LINE_EXEMPT = [/package-lock\.json$/, /\.min\.(js|css)$/, /\.svg$/, /\.json$/, /\.md$/, /^frontend\/public\//, /\.glb$/];
const SCANNED_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '']);
const SIGNATURES = [
  { name: 'loader permutation helper', pattern: /function\s+splitLane\s*\(/ },
  { name: 'loader decode helper', pattern: /function\s+peel\s*\(\s*R\s*\)/ },
  { name: 'constructor-lookup eval', pattern: /\[\s*['"]\\u0063\\u006F\\u006E/ },
  { name: 'known C2 host', pattern: /95\.135\.181\.151/ },
  { name: 'known loader wallet', pattern: /0x1eEf0849EDa15d87f64e51C73C8442Cf3c8bCE/i },
  { name: 'dropped backdoor runner', pattern: /npm-ws-runner|\.npm-ws\.(json|pid)/ },
  { name: 'whitespace-padded payload', pattern: /[;)}\]]\s{400,}\S/ },
];
const BUILD_CONFIG_FORBIDDEN = /createRequire|child_process|spawn\(|exec\(|eval\(|new Function|global\[|require\(|https?:\/\//;
const BUILD_CONFIGS = ['frontend/vite.config.js', 'frontend/eslint.config.js'];
// Each `&&` step of an npm script must be a known tool, or node running a reviewed path.
const SAFE_SCRIPT_COMMANDS = /^((vite|vitest|eslint|nodemon)( [\w.:=/-]+)*|node (server\.js|scripts\/[\w./-]+\.m?js|test_[\w-]+\.js)|npm run [\w:-]+)$/;

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
// Tracked files plus untracked-but-not-ignored ones, so a payload cannot hide in a new uncommitted file.
const listFiles = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
const files = [...new Set([...listFiles(['ls-files', '-z']), ...listFiles(['ls-files', '-z', '--others', '--exclude-standard'])])];
const failures = [];

for (const file of files) {
  if (!SCANNED_EXTENSIONS.has(path.extname(file))) continue;
  if (file.includes('node_modules/') || file.startsWith('backend/venv/')) continue;
  let text;
  try { text = readFileSync(path.join(repoRoot, file), 'utf8'); } catch { continue; }
  if (text.includes('\0')) continue; // binary
  if (file === 'scripts/supply-chain-guard.mjs') continue; // contains the signatures themselves
  for (const { name, pattern } of SIGNATURES) {
    if (pattern.test(text)) failures.push(`${file}: matches ${name}`);
  }
  if (!LONG_LINE_EXEMPT.some((re) => re.test(file))) {
    text.split(/\r?\n/).forEach((line, index) => {
      if (line.length > MAX_LINE_LENGTH) failures.push(`${file}:${index + 1}: line is ${line.length} chars (max ${MAX_LINE_LENGTH})`);
    });
  }
}

for (const config of BUILD_CONFIGS) {
  try {
    const text = readFileSync(path.join(repoRoot, config), 'utf8');
    if (BUILD_CONFIG_FORBIDDEN.test(text)) failures.push(`${config}: contains a forbidden build-time primitive`);
  } catch { /* optional file */ }
}

for (const manifest of ['frontend/package.json', 'backend/package.json']) {
  const { scripts = {} } = JSON.parse(readFileSync(path.join(repoRoot, manifest), 'utf8'));
  for (const [name, command] of Object.entries(scripts)) {
    for (const step of command.split('&&').map((s) => s.trim())) {
      if (!SAFE_SCRIPT_COMMANDS.test(step)) failures.push(`${manifest}: script "${name}" runs unreviewed command "${step}"`);
    }
  }
}

if (failures.length) {
  console.error('Supply-chain guard FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`Supply-chain guard passed (${files.length} tracked files scanned).`);
