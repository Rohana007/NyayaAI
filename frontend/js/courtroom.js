/**
 * Courtroom simulation logic
 * Handles arguments, bench queries, witness examination, objections, scoring
 */

// ── STATE ──
let SESSION_ID = null;
let CASE_DATA = null;
let ROLE = 'defence';
let DIFFICULTY = 'medium';
let round = 1;
const MAX_ROUNDS = 6;
let argMode = 'argue';
let scores = { logic: 0, clarity: 0, proc: 0, cite: 0, reb: 0 };
let sessionSeconds = 0;
let timerInterval = null;
let activeWitness = null;
let objectionHistory = [];
let benchQueryCount = 0;
let sessionLog = [];

// ── LIVE MONITOR ──
class LiveMonitor {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.interval = null;
    this.lastText = '';
    this.active = false;
  }
  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this._check(), 3000);
    this.active = true;
  }
  stop() {
    clearInterval(this.interval);
    this.interval = null;
    this.active = false;
  }
  async _check() {
    const text = document.getElementById('argInput')?.value || '';
    if (text.length < 80 || text === this.lastText) return;
    this.lastText = text;
    try {
      const result = await api.checkArgument(this.sessionId, text, argMode);
      if (result.interrupt) {
        this.stop();
        benchQueryHandler.show(result.bench_query, result.query_id);
      }
    } catch (e) { /* silent fail */ }
  }
}

// ── BENCH QUERY HANDLER ──
class BenchQueryHandler {
  constructor() {
    this.activeQueryId = null;
  }
  show(queryText, queryId) {
    this.activeQueryId = queryId;
    benchQueryCount++;
    document.getElementById('benchQueryText').textContent = queryText;
    document.getElementById('benchModal').classList.add('show');
    document.getElementById('argInput').disabled = true;
    document.getElementById('argInput').classList.add('locked');
    document.getElementById('submitBtn').disabled = true;
    updateJudgeStatus('Bench Query Pending');
    updateJudgeQuote(`"${queryText.substring(0, 90)}…"`);
    strikeGavel();
    addToTranscript('bench', queryText, null, '⚠ Bench Query');
  }
  async submit() {
    const resp = document.getElementById('benchResponse').value.trim();
    if (!resp) return;
    try {
      const result = await api.respondToBenchQuery(this.activeQueryId, resp);
      document.getElementById('benchModal').classList.remove('show');
      document.getElementById('benchResponse').value = '';
      document.getElementById('argInput').disabled = false;
      document.getElementById('argInput').classList.remove('locked');
      document.getElementById('submitBtn').disabled = false;
      addToTranscript('judge', result.judge_acknowledgment);
      updateJudgeStatus('Presiding');
      updateJudgeQuote(`"${result.judge_acknowledgment}"`);
      this.activeQueryId = null;
      liveMonitor.start();
    } catch (e) {
      alert('Failed to submit response: ' + e.message);
    }
  }
}

let liveMonitor = null;
const benchQueryHandler = new BenchQueryHandler();

// ── INIT ──
async function initCourtroom(sessionId, caseData, role, difficulty) {
  SESSION_ID = sessionId;
  CASE_DATA = caseData;
  ROLE = role;
  DIFFICULTY = difficulty;

  liveMonitor = new LiveMonitor(sessionId);

  // Update UI with case data
  document.getElementById('caseTitle').textContent = caseData.case_title || 'Case';
  document.getElementById('caseCharges').textContent =
    caseData.charges?.map(c => c.section).join(' · ') || '';
  document.getElementById('courtName').textContent = caseData.court || '';

  // Role label already set by boot — just keep in sync
  document.getElementById('roleLabel').textContent = role.toUpperCase();

  // Populate witnesses
  populateWitnesses(caseData.key_witnesses || []);

  // Populate evidence
  populateEvidence(caseData.evidence_items || []);

  // Populate relevant law chips
  populateLawChips(caseData.relevant_laws || caseData.legal_sections || []);

  startTimer();
  addToTranscript('system', `This court is now in session. Case: ${caseData.case_title}. All parties please be seated.`);
  addToTranscript('judge', `The matter before this court is ${caseData.case_title}. ${role === 'defence' ? 'Defence' : 'Prosecution'} counsel, you may proceed with your opening statement.`);

  // Easy mode: show hint button
  if (difficulty === 'easy') {
    document.getElementById('hintBtn')?.classList.remove('hidden');
  }
}

// ── TIMER ──
function startTimer() {
  timerInterval = setInterval(() => {
    sessionSeconds++;
    const m = String(Math.floor(sessionSeconds / 60)).padStart(2, '0');
    const s = String(sessionSeconds % 60).padStart(2, '0');
    const el = document.getElementById('timer');
    if (el) el.textContent = `${m}:${s}`;

    // Difficulty escalation after 10 minutes
    if (sessionSeconds === 600 && DIFFICULTY !== 'hard') {
      addToTranscript('system', 'The Court notes that 10 minutes have elapsed. Proceedings will now be conducted with greater strictness.');
    }
  }, 1000);
}

// ── SUBMIT ARGUMENT ──
async function submitArgument() {
  const input = document.getElementById('argInput');
  const text = input.value.trim();
  if (!text || !SESSION_ID) return;
  if (round > MAX_ROUNDS) { concludeSession(); return; }

  liveMonitor.stop();
  document.getElementById('submitBtn').disabled = true;
  updateJudgeStatus('Deliberating…');

  const modeLabels = { argue: 'Argument', rebuttal: 'Rebuttal', motion: 'Motion', cite: 'Citation', examine: 'Examination' };
  addToTranscript('student', text, null, modeLabels[argMode] || 'Argument');
  sessionLog.push({ speaker: 'student', content: text, type: argMode, round });
  input.value = '';

  showTyping();
  try {
    const result = await api.argue(SESSION_ID, text, argMode, activeWitness);
    removeTyping();

    // Opposing counsel
    addToTranscript('opposing', result.opposing_response, null,
      ROLE === 'defence' ? 'Public Prosecutor' : 'Defence Counsel');

    // Judge response
    if (result.judge_response) {
      setTimeout(() => {
        addToTranscript('judge', result.judge_response);
        updateJudgeQuote(`"${result.judge_response.substring(0, 100)}…"`);
      }, 600);
    }

    // Bench query from judge
    if (result.bench_query?.triggered) {
      setTimeout(() => {
        benchQueryHandler.show(result.bench_query.query, result.bench_query.query_id);
      }, 1200);
    }

    // Update scores
    updateScores(result.scores_update);

    // Add cited laws to panel
    if (result.cited_laws?.length) {
      updateLawChips(result.cited_laws);
    }

    round++;
    document.getElementById('roundLabel').textContent = `Round ${Math.min(round, MAX_ROUNDS)} / ${MAX_ROUNDS}`;
    document.getElementById('submitBtn').disabled = false;
    updateJudgeStatus('Presiding');

    if (!result.bench_query?.triggered) {
      liveMonitor.start();
    }

    if (round > MAX_ROUNDS) {
      setTimeout(concludeSession, 1500);
    }
  } catch (e) {
    removeTyping();
    document.getElementById('submitBtn').disabled = false;
    updateJudgeStatus('Presiding');
    addToTranscript('system', `Error: ${e.message}`);
    liveMonitor.start();
  }
}

// ── WITNESS EXAMINATION ──
async function examineWitness(witnessName, examType = 'direct') {
  const input = document.getElementById('argInput');
  const question = input.value.trim();
  if (!question || !SESSION_ID) return;

  activeWitness = witnessName;
  input.value = '';
  addToTranscript('student', question, null, `${examType.charAt(0).toUpperCase() + examType.slice(1)} Examination`);
  showTyping();

  try {
    const result = await api.examineWitness(SESSION_ID, witnessName, examType);
    removeTyping();
    const demeanorMap = {
      calm: '(calm)', nervous: '(nervous)', evasive: '(evasive)',
      hostile: '(hostile)', cooperative: '(cooperative)'
    };
    addToTranscript('witness',
      `${result.answer} ${demeanorMap[result.demeanor] || ''}`,
      result.can_be_impeached ? '⚠ This witness may be impeached on this point.' : null,
      witnessName
    );
    if (result.can_be_impeached) {
      addToTranscript('system', `Impeachment opportunity detected for ${witnessName}.`);
    }
  } catch (e) {
    removeTyping();
    addToTranscript('system', `Witness examination failed: ${e.message}`);
  }
}

// ── OBJECTION ──
async function raiseObjection(type) {
  document.getElementById('objPicker')?.classList.remove('show');
  if (!SESSION_ID) return;

  const context = document.getElementById('argInput')?.value || '';
  showObjOverlay(type, '…');

  try {
    const result = await api.raiseObjection(SESSION_ID, type, context);
    updateObjOverlay(type, result.ruling, result.judge_reasoning);
    objectionHistory.push({ type, ruling: result.ruling, reasoning: result.judge_reasoning });
    addToTranscript('bench',
      `⚡ Objection: ${type} — ${result.ruling}`,
      `${result.judge_reasoning}${result.bsa_section ? ` [${result.bsa_section}]` : ''}`,
      '⚠ Objection'
    );
    strikeGavel();
    updateJudgeStatus('Ruling on objection');
    setTimeout(() => updateJudgeStatus('Presiding'), 2000);

    // Score impact
    if (result.ruling === 'Sustained') {
      scores.proc = Math.min(100, scores.proc + result.score_impact);
      updateScoreBar('proc', scores.proc);
    }
  } catch (e) {
    // Fallback random ruling
    const ruling = Math.random() > 0.5 ? 'Sustained' : 'Overruled';
    updateObjOverlay(type, ruling, '');
  }
  setTimeout(() => document.getElementById('objOverlay')?.classList.remove('show'), 2500);
}

// ── CONCLUDE ──
async function concludeSession() {
  if (!SESSION_ID) return;
  clearInterval(timerInterval);
  liveMonitor.stop();
  addToTranscript('system', 'Session concluded. Generating evaluation…');
  updateJudgeStatus('Delivering Verdict');

  try {
    await api.concludeSession(SESSION_ID);
    const evaluation = await api.generateEvaluation(SESSION_ID);
    displayVerdict(evaluation);
    // Store for evaluation page
    localStorage.setItem('nyaya_evaluation', JSON.stringify(evaluation));
    localStorage.setItem('nyaya_session_id', SESSION_ID);
  } catch (e) {
    addToTranscript('system', `Evaluation error: ${e.message}`);
  }
}

// ── HINT (Easy mode) ──
async function getHint() {
  if (!SESSION_ID) return;
  try {
    const result = await api.getHint(SESSION_ID);
    addToTranscript('system', `💡 Hint: ${result.hint}`);
  } catch (e) {
    addToTranscript('system', 'Hints are only available in Easy mode.');
  }
}

// ── UI HELPERS ──
function addToTranscript(type, text, subtext = null, label = null) {
  const t = document.getElementById('transcript');
  if (!t) return;
  const div = document.createElement('div');
  const typeMap = {
    system: 'msg-system', student: 'msg-student', judge: 'msg-judge',
    opposing: 'msg-opposing', bench: 'msg-bench', witness: 'msg-witness'
  };
  div.className = 'msg ' + (typeMap[type] || 'msg-system');

  const defaultLabels = {
    student: ROLE === 'defence' ? 'Defence Counsel' : 'Public Prosecutor',
    judge: 'Hon. Justice R.K. Krishnamurthy',
    opposing: ROLE === 'defence' ? 'Public Prosecutor' : 'Defence Counsel',
    bench: '⚠ Bench Query', witness: activeWitness || 'Witness'
  };
  const displayLabel = label || defaultLabels[type];

  let html = '';
  if (displayLabel && type !== 'system') {
    html += `<div class="msg-label">${displayLabel}</div>`;
  }
  html += `<div>${text}</div>`;
  if (subtext) html += `<div class="msg-citation">${subtext}</div>`;
  div.innerHTML = html;
  t.appendChild(div);
  t.scrollTop = t.scrollHeight;
}

function showTyping() {
  const t = document.getElementById('transcript');
  if (!t) return;
  const div = document.createElement('div');
  div.className = 'typing-indicator'; div.id = 'typingIndicator';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  t.appendChild(div); t.scrollTop = t.scrollHeight;
}
function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

function updateJudgeStatus(s) {
  const el = document.getElementById('judgeStatus');
  if (el) el.textContent = s;
}
function updateJudgeQuote(q) {
  const el = document.getElementById('judgeQuote');
  if (el) el.textContent = q;
}

function strikeGavel() {
  const g = document.getElementById('gavel');
  if (!g) return;
  g.classList.remove('strike');
  void g.offsetWidth;
  g.classList.add('strike');
  setTimeout(() => g.classList.remove('strike'), 400);
}

function updateScores(delta) {
  if (!delta) return;
  const map = { logic: 'logic', clarity: 'clarity', proc: 'proc', cite: 'cite', reb: 'reb' };
  Object.entries(map).forEach(([key, barKey]) => {
    if (delta[key] !== undefined) {
      scores[key] = Math.max(0, Math.min(100, (scores[key] || 40) + delta[key]));
      updateScoreBar(barKey, scores[key]);
    }
  });
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);
  const el = document.getElementById('overallScore');
  if (el) el.textContent = overall;
}

function updateScoreBar(key, val) {
  const bar = document.getElementById('bar-' + key);
  const valEl = document.getElementById('val-' + key);
  if (bar) bar.style.width = val + '%';
  if (valEl) valEl.textContent = val;
}

function showObjOverlay(type, ruling) {
  document.getElementById('objTypeLabel').textContent = type;
  document.getElementById('objRuling').textContent = ruling;
  document.getElementById('objOverlay')?.classList.add('show');
}
function updateObjOverlay(type, ruling, reasoning) {
  document.getElementById('objTypeLabel').textContent = type;
  const rulingEl = document.getElementById('objRuling');
  if (rulingEl) {
    rulingEl.textContent = ruling;
    rulingEl.className = 'obj-ruling ' + (ruling === 'Sustained' ? 'ruling-sustained' : 'ruling-overruled');
  }
}

function populateWitnesses(witnesses) {
  const sel = document.getElementById('witnessList');
  if (!sel) return;
  sel.innerHTML = witnesses.map(w =>
    `<option value="${w.name}">${w.name} (${w.role})</option>`
  ).join('');
}

function populateEvidence(items) {
  const pane = document.getElementById('evidencePane');
  if (!pane) return;
  pane.innerHTML = items.map(item => `
    <div class="ev-item" onclick="citeEvidence('${item.title}')">
      <span class="ev-icon">${evidenceIcon(item.type)}</span>
      <div class="ev-info">
        <div class="ev-title">${item.title}</div>
        <div class="ev-meta">${item.type}</div>
      </div>
      <span class="ev-tag tag-${item.admissibility}">${item.admissibility}</span>
    </div>
  `).join('');
}

function evidenceIcon(type) {
  return { fir: '📄', forensic: '🔬', cctv: '📹', witness: '👤', medical: '🏥', cdr: '📞' }[type] || '📋';
}

function populateLawChips(laws) {
  const wrap = document.getElementById('lawChips');
  if (!wrap) return;
  wrap.innerHTML = laws.slice(0, 6).map(l => {
    const code = l.code || l.code;
    const color = api.getLawBadgeColor(code);
    const ref = l.bare_act_reference || `${code} §${l.section}`;
    return `<span class="law-chip" style="border-color:${color}40;color:${color}" 
      title="${l.title || ''}" onclick="insertLawRef('${ref}')">${ref}</span>`;
  }).join('');
}

function updateLawChips(laws) {
  populateLawChips(laws);
}

function citeEvidence(title) {
  const input = document.getElementById('argInput');
  if (!input) return;
  const cite = `[Per ${title}]`;
  const pos = input.selectionStart;
  input.value = input.value.slice(0, pos) + ' ' + cite + ' ' + input.value.slice(pos);
  input.focus();
}

function insertLawRef(ref) {
  const input = document.getElementById('argInput');
  if (!input) return;
  const pos = input.selectionStart;
  input.value = input.value.slice(0, pos) + ` [${ref}] ` + input.value.slice(pos);
  input.focus();
}

function displayVerdict(evaluation) {
  const overall = evaluation.overall_score;
  const verdict = evaluation.verdict;
  const grade = evaluation.grade;
  addToTranscript('judge',
    `"This Court delivers its verdict: ${verdict}. Overall performance grade: ${grade}. The session is concluded."`,
    `Score: ${overall}/100 · Bench Queries: ${evaluation.bench_queries_faced}`
  );
  strikeGavel();
  updateJudgeStatus('Verdict Delivered');

  // Show evaluation link
  const evalBtn = document.getElementById('evalBtn');
  if (evalBtn) evalBtn.classList.remove('hidden');
}

function setArgMode(el, mode) {
  document.querySelectorAll('.amode').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  argMode = mode;
  const placeholders = {
    argue: 'Submit your argument to the court…',
    rebuttal: 'Counter the opposing counsel\'s argument…',
    motion: 'File a procedural motion…',
    cite: 'Cite a precedent or statute (BNS/BNSS/BSA)…',
    examine: `Ask your question to ${activeWitness || 'the witness'}…`
  };
  const input = document.getElementById('argInput');
  if (input) input.placeholder = placeholders[mode] || 'Submit your argument…';
  if (mode === 'examine' && liveMonitor) liveMonitor.stop();
  else if (liveMonitor) liveMonitor.start();
}

function handleKey(e) {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); submitArgument(); }
}

function onArgInput() {
  if (liveMonitor && !liveMonitor.active && argMode !== 'examine') {
    liveMonitor.start();
  }
}

function switchTab(name) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector(`.ptab[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById('tab-' + name)?.classList.add('active');
}

function toggleObjPicker() {
  document.getElementById('objPicker')?.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const picker = document.getElementById('objPicker');
  if (picker && !e.target.closest('#objPicker') && !e.target.closest('.btn-obj') && !e.target.closest('.action-btn-obj')) {
    picker.classList.remove('show');
  }
});

// ── VOICE CONTROLS ──
let ttsEnabled = false;

function toggleVoice() {
  voice.toggle('argInput');
}

function setVoiceLang(val) {
  voice.setLang(val);
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('ttsBtn');
  if (btn) {
    btn.classList.toggle('tts-on', ttsEnabled);
    btn.title = ttsEnabled ? 'Judge voice ON — click to mute' : 'Toggle judge voice readout';
  }
  if (!ttsEnabled) voice.stopSpeaking();
}

// Patch addToTranscript to speak judge/opposing lines when TTS is on
const _origAddToTranscript = addToTranscript;
// Override after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Patch submitArgument to auto-stop voice while waiting for response
  const _origSubmit = window.submitArgument;
  window.submitArgument = async function() {
    if (voice.isListening) voice.stop();
    await _origSubmit();
  };
});

// Speak judge responses via TTS when enabled
function speakIfEnabled(type, text) {
  if (!ttsEnabled) return;
  if (type === 'judge' || type === 'opposing') {
    voice.speak(text);
  }
}

// Monkey-patch addToTranscript to hook TTS
const __origAdd = addToTranscript;
window.addToTranscript = function(type, text, subtext, label) {
  __origAdd(type, text, subtext, label);
  speakIfEnabled(type, text);
};

function updateCharCount() {
  const input = document.getElementById('argInput');
  const el = document.getElementById('charCount');
  if (input && el) el.textContent = `${input.value.length} / 1000`;
}
