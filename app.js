const DEFAULT_RULES = [
  { name: 'ApplyOS', keywords: ['applyos', 'job platform', 'jobsrepository', 'milestone', 'next.js jobs'] },
  { name: 'IT-HomeLab', keywords: ['home lab', 'homelab', 'hyper-v', 'active directory', 'dc01', 'basilroot.local', 'baslx0.local', 'windows server'] },
  { name: 'Python Learning', keywords: ['python', 'class', 'method', 'function', 'dictionary', 'list', 'flask'] },
  { name: 'CompTIA A+', keywords: ['comptia', 'a+', '220-1201', 'port', 'wifi', '802.11', 'laptop hardware'] },
  { name: 'Job Search', keywords: ['job', 'وظيف', 'linkedin', 'salary', 'راتب', 'application', 'interview', 'cv', 'resume'] },
  { name: 'Personal Brand', keywords: ['brand', 'براند', 'logo', 'banner', 'wallpaper', 'baslx0', 'basil albarazi'] },
];

const state = {
  raw: [],
  conversations: [],
  analyzed: [],
  rules: JSON.parse(localStorage.getItem('chatOrganizerRules') || 'null') || DEFAULT_RULES,
  selected: new Set(),
};

const $ = (id) => document.getElementById(id);
const toast = (message) => {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
};

function normalizeText(value = '') {
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
    id: conv.id || conv.conversation_id || `local-${index}`,
    title: conv.title || 'Untitled conversation',
    createTime: conv.create_time || conv.createTime || null,
    updateTime: conv.update_time || conv.updateTime || null,
    text: extractConversationText(conv),
    raw: conv,
  }));
}

function scoreProject(conv, rule) {
  const title = normalizeText(conv.title);
  const body = normalizeText(conv.text).slice(0, 120000);
  let score = 0;
  const matched = [];
  for (const keywordRaw of rule.keywords) {
    const keyword = normalizeText(keywordRaw);
    if (!keyword) continue;
    const inTitle = title.includes(keyword);
    const inBody = body.includes(keyword);
    if (inTitle) score += 4;
    if (inBody) score += 1;
    if (inTitle || inBody) matched.push(keywordRaw);
  }
  return { score, matched };
}

function tokenSet(text) {
  return new Set(normalizeText(text).split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 4));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function findDuplicateGroups(conversations) {
  const groups = [];
  const used = new Set();
  const fingerprints = conversations.map(c => ({ id: c.id, tokens: tokenSet(`${c.title} ${c.text.slice(0, 3500)}`) }));
  for (let i = 0; i < fingerprints.length; i++) {
    if (used.has(fingerprints[i].id)) continue;
    const group = [fingerprints[i].id];
    for (let j = i + 1; j < fingerprints.length; j++) {
      if (used.has(fingerprints[j].id)) continue;
      const sim = jaccard(fingerprints[i].tokens, fingerprints[j].tokens);
      if (sim >= 0.72) { group.push(fingerprints[j].id); used.add(fingerprints[j].id); }
    }
    if (group.length > 1) { groups.push(group); group.forEach(id => used.add(id)); }
  }
  return groups;
}

function analyze() {
  if (!state.conversations.length) return;
  const duplicateGroups = findDuplicateGroups(state.conversations);
  const duplicateIds = new Set(duplicateGroups.flat());
  const now = Date.now() / 1000;

  state.analyzed = state.conversations.map(conv => {
    const scores = state.rules.map(rule => ({ rule, ...scoreProject(conv, rule) })).sort((a,b) => b.score - a.score);
    const best = scores[0];
    const second = scores[1];
    let project = best?.score > 0 ? best.rule.name : 'Unclassified';
    let confidence = best?.score > 0 ? Math.min(0.99, 0.48 + best.score * 0.07 - (second?.score || 0) * 0.025) : 0.25;
    if (best && second && best.score === second.score && best.score > 0) confidence = Math.min(confidence, 0.58);

    const ts = conv.updateTime || conv.createTime || now;
    const ageDays = Math.max(0, (now - Number(ts || now)) / 86400);
    const sparse = normalizeText(conv.text).length < 130;
    const old = ageDays > 365;
    const duplicate = duplicateIds.has(conv.id);

    let action = 'keep';
    let reason = 'No strong organization change suggested.';
    if (project !== 'Unclassified' && confidence >= 0.62) {
      action = 'move';
      reason = `Matched ${best.matched.slice(0,4).join(', ') || 'project keywords'}.`;
    }
    if ((old && sparse) || (duplicate && sparse)) {
      action = 'archive';
      reason = old && sparse ? 'Old conversation with very little content.' : 'Possible duplicate with very little unique content.';
    }
    if (project === 'Unclassified' || confidence < 0.52) {
      action = 'review';
      reason = 'Low-confidence classification; manual review recommended.';
    }

    return { ...conv, project, confidence, action, reason, duplicate, ageDays: Math.round(ageDays), matched: best?.matched || [] };
  });

  state.selected.clear();
  renderAll();
  toast(`Analyzed ${state.analyzed.length} conversations`);
}

function formatDate(ts) {
  if (!ts) return 'Unknown date';
  const d = new Date(Number(ts) * 1000);
  return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString();
}

function renderStats() {
  $('stat-total').textContent = state.conversations.length;
  const projects = new Set(state.analyzed.filter(x => x.project !== 'Unclassified').map(x => x.project));
  $('stat-projects').textContent = projects.size;
  $('stat-duplicates').textContent = state.analyzed.filter(x => x.duplicate).length;
  $('stat-archive').textContent = state.analyzed.filter(x => x.action === 'archive').length;
}

function renderBars() {
  const el = $('project-bars');
  if (!state.analyzed.length) { el.className='project-bars empty-state'; el.textContent='Import an export and run analysis to begin.'; return; }
  const counts = {};
  state.analyzed.forEach(x => counts[x.project] = (counts[x.project] || 0) + 1);
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const max = Math.max(...entries.map(x => x[1]), 1);
  el.className = 'project-bars';
  el.innerHTML = entries.map(([name,count]) => `
    <div class="project-row">
      <div class="project-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,count/max*100)}%"></div></div>
      <strong>${count}</strong>
    </div>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function renderPreview() {
  const body = $('preview-body');
  if (!state.analyzed.length) { body.innerHTML='<tr><td colspan="4" class="empty-cell">No analysis yet.</td></tr>'; return; }
  const q = normalizeText($('search-input').value);
  const action = $('action-filter').value;
  const rows = state.analyzed.filter(x => (!q || normalizeText(`${x.title} ${x.project}`).includes(q)) && (action==='all' || x.action===action)).slice(0,120);
  body.innerHTML = rows.length ? rows.map(x => `
    <tr>
      <td class="title-cell"><strong title="${escapeHtml(x.title)}">${escapeHtml(x.title)}</strong><small>${formatDate(x.updateTime || x.createTime)}${x.duplicate ? ' · possible duplicate' : ''}</small></td>
      <td>${escapeHtml(x.project)}</td>
      <td><span class="badge ${x.action}">${x.action}</span></td>
      <td><div class="confidence"><div class="confidence-track"><div class="confidence-fill" style="width:${Math.round(x.confidence*100)}%"></div></div><span>${Math.round(x.confidence*100)}%</span></div></td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty-cell">No conversations match this filter.</td></tr>';
}

function ruleProjectOptions(selected) {
  return [...state.rules.map(r => r.name), 'Unclassified'].map(name => `<option ${name===selected?'selected':''}>${escapeHtml(name)}</option>`).join('');
}

function renderReview() {
  const body = $('review-body');
  $('selected-count').textContent = `${state.selected.size} selected`;
  $('export-plan').disabled = !state.analyzed.length;
  $('export-csv').disabled = !state.analyzed.length;
  if (!state.analyzed.length) { body.innerHTML='<tr><td colspan="5" class="empty-cell">Analyze conversations first.</td></tr>'; return; }
  body.innerHTML = state.analyzed.map(x => `
    <tr data-id="${escapeHtml(x.id)}">
      <td><input class="row-select" type="checkbox" ${state.selected.has(x.id)?'checked':''} /></td>
      <td class="title-cell"><strong title="${escapeHtml(x.title)}">${escapeHtml(x.title)}</strong><small>${formatDate(x.updateTime || x.createTime)}</small></td>
      <td><select class="select project-select">${ruleProjectOptions(x.project)}</select></td>
      <td><select class="select action-select"><option value="move" ${x.action==='move'?'selected':''}>Move</option><option value="keep" ${x.action==='keep'?'selected':''}>Keep</option><option value="archive" ${x.action==='archive'?'selected':''}>Archive</option><option value="review" ${x.action==='review'?'selected':''}>Review</option></select></td>
      <td>${escapeHtml(x.reason)}</td>
    </tr>`).join('');

  body.querySelectorAll('tr[data-id]').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.row-select').addEventListener('change', e => { e.target.checked ? state.selected.add(id) : state.selected.delete(id); renderSelectedCount(); });
    row.querySelector('.action-select').addEventListener('change', e => { const item=state.analyzed.find(x=>x.id===id); if(item)item.action=e.target.value; renderPreview(); renderStats(); });
    row.querySelector('.project-select').addEventListener('change', e => { const item=state.analyzed.find(x=>x.id===id); if(item)item.project=e.target.value; renderPreview(); renderBars(); renderStats(); });
  });
}

function renderSelectedCount() { $('selected-count').textContent = `${state.selected.size} selected`; }

function renderRules() {
  const list = $('rules-list');
  list.innerHTML = state.rules.map((rule,index) => `
    <div class="rule-card" data-index="${index}">
      <input class="input rule-name" value="${escapeHtml(rule.name)}" aria-label="Project name" />
      <div>
        <div class="rule-keywords">${rule.keywords.map((kw,kidx)=>`<span class="keyword">${escapeHtml(kw)} <button type="button" data-keyword="${kidx}" aria-label="Remove keyword">×</button></span>`).join('')}</div>
        <input class="input new-keyword" placeholder="Type a keyword and press Enter" style="margin-top:10px; width:100%;" />
      </div>
      <div class="rule-actions"><button type="button" class="icon-button delete-rule" title="Delete project">Delete</button></div>
    </div>`).join('');

  list.querySelectorAll('.rule-card').forEach(card => {
    const index = Number(card.dataset.index);
    card.querySelector('.rule-name').addEventListener('change', e => { state.rules[index].name=e.target.value.trim() || `Project ${index+1}`; saveRules(); renderAll(); });
    card.querySelector('.new-keyword').addEventListener('keydown', e => {
      if (e.key==='Enter' && e.target.value.trim()) { state.rules[index].keywords.push(e.target.value.trim()); e.target.value=''; saveRules(); renderRules(); }
    });
    card.querySelectorAll('.keyword button').forEach(btn => btn.addEventListener('click', () => { state.rules[index].keywords.splice(Number(btn.dataset.keyword),1); saveRules(); renderRules(); }));
    card.querySelector('.delete-rule').addEventListener('click', () => { state.rules.splice(index,1); saveRules(); renderRules(); });
  });
}

function saveRules() { localStorage.setItem('chatOrganizerRules', JSON.stringify(state.rules)); }

function renderAll() { renderStats(); renderBars(); renderPreview(); renderReview(); renderRules(); }

async function loadFile(file) {
  const text = await file.text();
  const json = JSON.parse(text);
  state.raw = json;
  state.conversations = parseExport(json);
  state.analyzed = [];
  $('analyze-button').disabled = !state.conversations.length;
  renderAll();
  toast(`Loaded ${state.conversations.length} conversations`);
}

function loadSample() {
  const now = Date.now()/1000;
  state.conversations = [
    {id:'1',title:'ApplyOS Milestone 1 review',createTime:now-86400*9,updateTime:now-86400*7,text:'Next.js jobs repository milestone application platform optimistic concurrency'},
    {id:'2',title:'Hyper-V Home Lab setup',createTime:now-86400*5,updateTime:now-86400*4,text:'DC01 Windows Server Active Directory home lab Hyper-V network'},
    {id:'3',title:'Python classes checkpoint',createTime:now-86400*2,updateTime:now-86400,text:'Python class method self attribute parameter list dictionary'},
    {id:'4',title:'Old quick question',createTime:now-86400*900,updateTime:now-86400*900,text:'ok'},
    {id:'5',title:'CompTIA A+ wireless ports',createTime:now-86400*6,updateTime:now-86400*6,text:'220-1201 802.11 wifi ports DNS DHCP'},
    {id:'6',title:'Brand banner ideas',createTime:now-86400*3,updateTime:now-86400*3,text:'Baslx0 personal brand logo banner wallpaper dark theme'},
    {id:'7',title:'Random note',createTime:now-86400*1,updateTime:now-86400*1,text:'something unrelated and short'},
  ];
  state.analyzed=[];
  $('analyze-button').disabled=false;
  renderAll();
  toast('Sample loaded');
}

function planPayload() {
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    safety: { destructive_actions_require_confirmation: true, automatic_delete: false },
    summary: {
      conversations: state.analyzed.length,
      move: state.analyzed.filter(x=>x.action==='move').length,
      archive: state.analyzed.filter(x=>x.action==='archive').length,
      keep: state.analyzed.filter(x=>x.action==='keep').length,
      review: state.analyzed.filter(x=>x.action==='review').length,
    },
    actions: state.analyzed.map(x => ({ id:x.id, title:x.title, action:x.action, project:x.project, confidence:Number(x.confidence.toFixed(3)), reason:x.reason })),
  };
}

function download(name, content, type='application/json') {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportCSV() {
  const rows = [['id','title','action','project','confidence','reason'], ...state.analyzed.map(x=>[x.id,x.title,x.action,x.project,x.confidence.toFixed(3),x.reason])];
  const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  download('chat-organizer-plan.csv', csv, 'text/csv');
}

function setView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  $(`view-${name}`).classList.add('active');
  $('page-title').textContent = ({overview:'Overview',rules:'Project rules',review:'Review plan',about:'About'})[name] || name;
}

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
$('theme-toggle').addEventListener('click',()=>{ const html=document.documentElement; html.dataset.theme=html.dataset.theme==='dark'?'light':'dark'; });
$('load-sample').addEventListener('click',loadSample);
$('file-input').addEventListener('change',e=>e.target.files[0] && loadFile(e.target.files[0]).catch(err=>toast(err.message)));
$('analyze-button').addEventListener('click',analyze);
$('search-input').addEventListener('input',renderPreview);
$('action-filter').addEventListener('change',renderPreview);
$('add-rule').addEventListener('click',()=>{ state.rules.push({name:`Project ${state.rules.length+1}`,keywords:[]}); saveRules(); renderRules(); });
$('export-plan').addEventListener('click',()=>download('chat-organizer-plan.json',JSON.stringify(planPayload(),null,2)));
$('export-csv').addEventListener('click',exportCSV);
$('select-all').addEventListener('change',e=>{ state.selected.clear(); if(e.target.checked)state.analyzed.forEach(x=>state.selected.add(x.id)); renderReview(); });
document.querySelectorAll('.bulk-action').forEach(btn=>btn.addEventListener('click',()=>{ if(!state.selected.size)return toast('Select conversations first'); state.analyzed.forEach(x=>{if(state.selected.has(x.id))x.action=btn.dataset.action}); renderAll(); toast(`Updated ${state.selected.size} conversations`); }));

const dz=$('drop-zone');
['dragenter','dragover'].forEach(evt=>dz.addEventListener(evt,e=>{e.preventDefault();dz.classList.add('dragover')}));
['dragleave','drop'].forEach(evt=>dz.addEventListener(evt,e=>{e.preventDefault();dz.classList.remove('dragover')}));
dz.addEventListener('drop',e=>{ const file=e.dataTransfer.files[0]; if(file)loadFile(file).catch(err=>toast(err.message)); });
dz.addEventListener('click',()=>$('file-input').click());
dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file-input').click();}});

renderAll();
