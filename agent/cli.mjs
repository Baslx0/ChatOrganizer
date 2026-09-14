#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

function usage(exitCode = 0) {
  console.log(`Chat Organizer agent CLI

Usage:
  node agent/cli.mjs inventory --export <conversations.json> [--json]
  node agent/cli.mjs search --export <conversations.json> --query <text> [--limit 20] [--json]
  node agent/cli.mjs read --export <conversations.json> --id <conversation-id> [--max-chars 12000] [--json]
  node agent/cli.mjs validate-plan --plan <plan.json> [--json]
  node agent/cli.mjs summarize-plan --plan <plan.json> [--json]

The CLI is read-only with respect to ChatGPT. It never performs browser actions.`);
  process.exit(exitCode);
}

function getArg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalize(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractConversationText(conv) {
  const parts = [];
  if (conv.title) parts.push(conv.title);
  const mapping = conv.mapping || {};
  for (const node of Object.values(mapping)) {
    const msg = node?.message;
    const content = msg?.content;
    if (!content) continue;
    if (Array.isArray(content.parts)) {
      for (const part of content.parts) if (typeof part === 'string') parts.push(part);
    }
    if (typeof content.text === 'string') parts.push(content.text);
  }
  return parts.join('\n');
}

function parseExport(json) {
  const arr = Array.isArray(json) ? json : (json.conversations || json.items || []);
  if (!Array.isArray(arr)) throw new Error('Unsupported export shape. Expected an array of conversations.');
  return arr.map((conv, index) => ({
    id: String(conv.id || conv.conversation_id || `local-${index}`),
    title: conv.title || 'Untitled conversation',
    create_time: conv.create_time || conv.createTime || null,
    update_time: conv.update_time || conv.updateTime || null,
    text: extractConversationText(conv),
  }));
}

async function loadExport(path) {
  if (!path) throw new Error('--export is required');
  return parseExport(JSON.parse(await fs.readFile(path, 'utf8')));
}

async function loadPlan(path) {
  if (!path) throw new Error('--plan is required');
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

function tsToIso(ts) {
  if (!ts) return null;
  const n = Number(ts);
  const d = new Date(n > 1e12 ? n : n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function tokenize(text) {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 2);
}

function lexicalScore(conv, query) {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const title = normalize(conv.title);
  const body = normalize(conv.text);
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (body.includes(term)) score += 1;
  }
  if (normalize(`${conv.title} ${conv.text}`).includes(normalize(query))) score += 12;
  return score;
}

function preview(text, max = 360) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, max);
}

function emit(data, jsonMode, humanFormatter) {
  if (jsonMode) console.log(JSON.stringify(data, null, 2));
  else humanFormatter(data);
}

function validatePlan(plan) {
  const errors = [];
  const warnings = [];
  if (!plan || typeof plan !== 'object') errors.push('Plan must be a JSON object.');
  if (!Array.isArray(plan?.actions)) errors.push('actions must be an array.');
  const allowed = new Set(['move', 'keep', 'archive', 'review']);
  const ids = new Set();
  for (const [index, action] of (plan?.actions || []).entries()) {
    const p = `actions[${index}]`;
    if (!action?.id) errors.push(`${p}.id is required.`);
    else if (ids.has(String(action.id))) errors.push(`${p}.id is duplicated: ${action.id}`);
    else ids.add(String(action.id));
    if (!allowed.has(action?.action)) errors.push(`${p}.action must be one of move|keep|archive|review.`);
    if (action?.action === 'move' && (!action.project || action.project === 'Unclassified')) errors.push(`${p}.project is required for move.`);
    if (action?.confidence != null && (Number(action.confidence) < 0 || Number(action.confidence) > 1)) errors.push(`${p}.confidence must be 0..1.`);
    if (action?.action === 'archive' && Number(action?.confidence ?? 0) < 0.8) warnings.push(`${p}: archive confidence is below 0.8; manual review recommended.`);
  }
  if (plan?.safety?.automatic_delete !== false) warnings.push('safety.automatic_delete should be false.');
  return { valid: errors.length === 0, errors, warnings, action_count: plan?.actions?.length || 0 };
}

function summarizePlan(plan) {
  const counts = {};
  const projects = {};
  let lowConfidence = 0;
  for (const item of plan.actions || []) {
    counts[item.action] = (counts[item.action] || 0) + 1;
    if (item.action === 'move') projects[item.project || 'Unspecified'] = (projects[item.project || 'Unspecified'] || 0) + 1;
    if (Number(item.confidence ?? 0) < 0.6) lowConfidence++;
  }
  return {
    total: plan.actions?.length || 0,
    actions: counts,
    move_targets: Object.entries(projects).sort((a,b) => b[1]-a[1]).map(([project,count]) => ({ project, count })),
    low_confidence: lowConfidence,
    safety: plan.safety || null,
  };
}

const [command] = process.argv.slice(2);
if (!command || ['-h', '--help', 'help'].includes(command)) usage(0);
const jsonMode = hasFlag('--json');

try {
  if (command === 'inventory') {
    const conversations = await loadExport(getArg('--export'));
    const sorted = [...conversations].sort((a,b) => Number(b.update_time || b.create_time || 0) - Number(a.update_time || a.create_time || 0));
    const data = {
      conversation_count: conversations.length,
      oldest: tsToIso(Math.min(...conversations.map(c => Number(c.create_time || Infinity)).filter(Number.isFinite))),
      newest: tsToIso(Math.max(...conversations.map(c => Number(c.update_time || c.create_time || 0)).filter(Number.isFinite))),
      conversations: sorted.map(c => ({
        id: c.id,
        title: c.title,
        created_at: tsToIso(c.create_time),
        updated_at: tsToIso(c.update_time),
        character_count: c.text.length,
      })),
    };
    emit(data, jsonMode, d => {
      console.log(`Conversations: ${d.conversation_count}`);
      console.log(`Range: ${d.oldest || 'unknown'} -> ${d.newest || 'unknown'}\n`);
      for (const c of d.conversations) console.log(`${c.id}\t${c.updated_at || c.created_at || ''}\t${c.character_count}\t${c.title}`);
    });
  } else if (command === 'search') {
    const conversations = await loadExport(getArg('--export'));
    const query = getArg('--query');
    if (!query) throw new Error('--query is required');
    const limit = Math.max(1, Math.min(100, Number(getArg('--limit', '20')) || 20));
    const hits = conversations.map(c => ({ ...c, score: lexicalScore(c, query) }))
      .filter(c => c.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0, limit)
      .map(c => ({ id: c.id, title: c.title, score: c.score, updated_at: tsToIso(c.update_time || c.create_time), excerpt: preview(c.text) }));
    const data = { query, count: hits.length, hits };
    emit(data, jsonMode, d => {
      console.log(`Query: ${d.query} (${d.count} hits)\n`);
      for (const h of d.hits) console.log(`[${h.score}] ${h.id} — ${h.title}\n${h.excerpt}\n`);
    });
  } else if (command === 'read') {
    const conversations = await loadExport(getArg('--export'));
    const id = getArg('--id');
    if (!id) throw new Error('--id is required');
    const maxChars = Math.max(1000, Math.min(100000, Number(getArg('--max-chars', '12000')) || 12000));
    const conv = conversations.find(c => c.id === id);
    if (!conv) throw new Error(`Conversation not found: ${id}`);
    const data = {
      id: conv.id,
      title: conv.title,
      created_at: tsToIso(conv.create_time),
      updated_at: tsToIso(conv.update_time),
      truncated: conv.text.length > maxChars,
      text: conv.text.slice(0, maxChars),
    };
    emit(data, jsonMode, d => console.log(`${d.title}\nID: ${d.id}\nUpdated: ${d.updated_at || 'unknown'}\nTruncated: ${d.truncated}\n\n${d.text}`));
  } else if (command === 'validate-plan') {
    const result = validatePlan(await loadPlan(getArg('--plan')));
    emit(result, jsonMode, d => {
      console.log(d.valid ? 'VALID' : 'INVALID');
      console.log(`Actions: ${d.action_count}`);
      for (const e of d.errors) console.log(`ERROR: ${e}`);
      for (const w of d.warnings) console.log(`WARN: ${w}`);
    });
    if (!result.valid) process.exitCode = 2;
  } else if (command === 'summarize-plan') {
    const result = summarizePlan(await loadPlan(getArg('--plan'));
    emit(result, jsonMode, d => {
      console.log(`Total: ${d.total}`);
      console.log(`Actions: ${JSON.stringify(d.actions)}`);
      console.log(`Low confidence: ${d.low_confidence}`);
      if (d.move_targets.length) {
        console.log('Move targets:');
        for (const t of d.move_targets) console.log(`  ${t.project}: ${t.count}`);
      }
    });
  } else {
    console.error(`Unknown command: ${command}`);
    usage(1);
  }
} catch (error) {
  if (jsonMode) console.log(JSON.stringify({ error: error.message }, null, 2));
  else console.error(`Error: ${error.message}`);
  process.exit(1);
}
