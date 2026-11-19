/**
 * RythuVaani API connectivity check (no dependencies).
 *
 * Reads mobile/.env directly, then tests the AI provider selected by
 * EXPO_PUBLIC_AI_PROVIDER plus Sarvam voice. Unconfigured optional keys
 * are reported as SKIPPED — not as failures.
 *
 * Run: node test-apis.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/* ── tiny .env parser ──────────────────────────────────────────────────── */

function loadEnv(file = resolve(process.cwd(), '.env')) {
  const env = {};
  if (!existsSync(file)) return env;

  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();

    // strip trailing comments outside quotes, then quotes
    if (!/^["']/.test(value)) value = value.replace(/\s+#.*$/, '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const get = (k) => (process.env[k] || env[k] || '').trim();

const PROVIDER = (get('EXPO_PUBLIC_AI_PROVIDER') || 'openrouter').toLowerCase();
const OPENROUTER_KEY = get('EXPO_PUBLIC_OPENROUTER_API_KEY');
const OPENROUTER_MODEL = get('EXPO_PUBLIC_OPENROUTER_MODEL') || 'openrouter/auto';
const GEMINI_KEY = get('EXPO_PUBLIC_GEMINI_API_KEY');
const GEMINI_MODEL = get('EXPO_PUBLIC_GEMINI_MODEL') || 'gemini-3.8-flash';
const FREELLM_BASE_URL = (get('EXPO_PUBLIC_FREELLM_BASE_URL') || '').replace(/\/+$/, '');
const FREELLM_KEY = get('EXPO_PUBLIC_FREELLM_API_KEY');
const FREELLM_MODEL = get('EXPO_PUBLIC_FREELLM_MODEL') || 'auto';
const SARVAM_KEY = get('EXPO_PUBLIC_SARVAM_API_KEY');

const line = '='.repeat(62);
console.log(line);
console.log('🔧 RythuVaani API connectivity check');
console.log(line);
console.log(`\nAI provider (.env): ${PROVIDER}`);
console.log(`.env file: ${resolve(process.cwd(), '.env')}`);

const results = [];
const add = (name, status, detail) => {
  results.push({ name, status, detail });
};
const mask = (k) => (k ? `${k.slice(0, 10)}…${k.slice(-4)}` : '(none)');

/* ── AI provider ───────────────────────────────────────────────────────── */

async function testOpenRouter() {
  if (!OPENROUTER_KEY) {
    add('OpenRouter', 'SKIPPED', 'EXPO_PUBLIC_OPENROUTER_API_KEY is not set');
    return;
  }
  console.log(`\n📍 OpenRouter key: ${mask(OPENROUTER_KEY)}`);
  console.log(`   Model: ${OPENROUTER_MODEL}`);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://rythuvaani.app',
        'X-Title': 'RythuVaani',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        max_tokens: 8,
      }),
    });

    const body = await res.text();
    if (res.ok) {
      let used = OPENROUTER_MODEL;
      try {
        used = JSON.parse(body)?.model || used;
      } catch {}
      return add('OpenRouter', 'OK', `CONNECTED (answered with ${used})`);
    }

    if (res.status === 401 || res.status === 403) {
      return add('OpenRouter', 'FAIL', `auth failed (HTTP ${res.status}) — key is invalid or revoked`);
    }
    if (res.status === 402) {
      return add('OpenRouter', 'FAIL', `out of credits (HTTP 402) — top up at https://openrouter.ai/credits`);
    }
    if (res.status === 404) {
      return add(
        'OpenRouter',
        'FAIL',
        `model "${OPENROUTER_MODEL}" is retired. Set EXPO_PUBLIC_OPENROUTER_MODEL=openrouter/auto in .env`,
      );
    }
    add('OpenRouter', 'FAIL', `HTTP ${res.status}: ${body.slice(0, 180)}`);
  } catch (e) {
    add('OpenRouter', 'FAIL', `network error: ${e?.message || String(e)}`);
  }
}

async function testGemini() {
  if (!GEMINI_KEY) {
    add('Gemini', 'SKIPPED', 'EXPO_PUBLIC_GEMINI_API_KEY is not set');
    return;
  }
  console.log(`\n📍 Gemini key: ${mask(GEMINI_KEY)}`);
  console.log(`   Model: ${GEMINI_MODEL}`);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say: OK' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 },
        }),
      },
    );
    const body = await res.text();
    if (res.ok) return add('Gemini', 'OK', 'CONNECTED');
    if (res.status === 401 || res.status === 403) {
      return add('Gemini', 'FAIL', `auth failed (HTTP ${res.status}) — key invalid/revoked`);
    }
    if (res.status === 404) {
      return add('Gemini', 'FAIL', `model "${GEMINI_MODEL}" not available — set EXPO_PUBLIC_GEMINI_MODEL`);
    }
    if (res.status === 503) {
      return add('Gemini', 'WARN', 'model overloaded (HTTP 503) — key is valid, retry later');
    }
    add('Gemini', 'FAIL', `HTTP ${res.status}: ${body.slice(0, 180)}`);
  } catch (e) {
    add('Gemini', 'FAIL', `network error: ${e?.message || String(e)}`);
  }
}

async function testFreeLlm() {
  if (!FREELLM_BASE_URL) {
    add('FreeLLMAPI', 'SKIPPED', 'EXPO_PUBLIC_FREELLM_BASE_URL is not set');
    return;
  }
  console.log(`\n📍 FreeLLMAPI: ${FREELLM_BASE_URL}`);
  console.log(`   Model: ${FREELLM_MODEL}`);

  try {
    const res = await fetch(`${FREELLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FREELLM_KEY}`,
      },
      body: JSON.stringify({
        model: FREELLM_MODEL,
        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        max_tokens: 8,
      }),
    });
    const body = await res.text();
    if (res.ok) return add('FreeLLMAPI', 'OK', 'CONNECTED (router picked a live model)');
    if (res.status === 401 || res.status === 403) {
      return add('FreeLLMAPI', 'FAIL', `auth failed (HTTP ${res.status}) — check the unified key`);
    }
    add('FreeLLMAPI', 'FAIL', `HTTP ${res.status}: ${body.slice(0, 180)}`);
  } catch (e) {
    add(
      'FreeLLMAPI',
      'FAIL',
      `cannot reach ${FREELLM_BASE_URL} — is the gateway running and on the same Wi-Fi? (${e?.message || e})`,
    );
  }
}

/* ── Sarvam voice ──────────────────────────────────────────────────────── */

async function testSarvam() {
  if (!SARVAM_KEY) {
    add('Sarvam', 'SKIPPED', 'EXPO_PUBLIC_SARVAM_API_KEY is not set');
    return;
  }
  console.log(`\n📍 Sarvam key: ${mask(SARVAM_KEY)}`);

  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'test',
        language_code: 'en-IN',
        model: 'bulbul:v3',
      }),
    });
    const body = await res.text();
    if (res.ok) return add('Sarvam', 'OK', 'CONNECTED (Bulbul TTS)');
    if (res.status === 401 || res.status === 403) {
      return add('Sarvam', 'FAIL', `auth failed (HTTP ${res.status}) — key invalid/revoked`);
    }
    add('Sarvam', 'FAIL', `HTTP ${res.status}: ${body.slice(0, 180)}`);
  } catch (e) {
    add('Sarvam', 'FAIL', `network error: ${e?.message || String(e)}`);
  }
}

/* ── run ───────────────────────────────────────────────────────────────── */

if (PROVIDER === 'openrouter') {
  await testOpenRouter();
} else if (PROVIDER === 'gemini') {
  await testGemini();
} else if (PROVIDER === 'freellm') {
  await testFreeLlm();
} else {
  console.log(`\n⚠️  Provider "${PROVIDER}" has no CLI check — testing OpenRouter instead.`);
  await testOpenRouter();
}

await testSarvam();

console.log('\n' + line);
console.log('📊 Results');
console.log(line);
for (const r of results) {
  const icon = r.status === 'OK' ? '✅' : r.status === 'WARN' ? '⚠️ ' : r.status === 'SKIPPED' ? '⏭️ ' : '❌';
  console.log(`${icon} ${r.name}: ${r.status} — ${r.detail}`);
}

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n' + line);
if (failed.length === 0) {
  console.log('✅ All configured services are reachable. Run: npx expo start -c');
} else {
  console.log('❌ Some services failed — fix the entries marked FAIL above.');
  console.log('   Note: the app still works offline via the ANGRAU knowledge base.');
}
console.log(line);
