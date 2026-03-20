/**
 * NyayaAI API Client
 * All calls to FastAPI backend — BNS/BNSS/BSA compliant
 */
const API_BASE = '/api/v1';

class NyayaAPI {
  constructor() {
    this.token = localStorage.getItem('nyaya_token') || null;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async _req(method, path, body = null) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    // Log legal framework header
    const lf = res.headers.get('X-Legal-Framework');
    if (lf) console.debug(`[NyayaAI] Legal Framework: ${lf}`);
    return data;
  }

  // ── AUTH ──
  async register(email, password, name, college) {
    const data = await this._req('POST', '/auth/register', { email, password, name, college });
    this.token = data.access_token;
    localStorage.setItem('nyaya_token', this.token);
    localStorage.setItem('nyaya_user', JSON.stringify(data.user));
    return data;
  }

  async login(email, password) {
    const data = await this._req('POST', '/auth/login', { email, password });
    this.token = data.access_token;
    localStorage.setItem('nyaya_token', this.token);
    localStorage.setItem('nyaya_user', JSON.stringify(data.user));
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('nyaya_token');
    localStorage.removeItem('nyaya_user');
  }

  getUser() {
    const u = localStorage.getItem('nyaya_user');
    return u ? JSON.parse(u) : null;
  }

  // ── CASES ──
  async generateCase(caseType, courtLevel, complexity, role, difficulty, customNotes = '') {
    return this._req('POST', '/cases/generate', {
      case_type: caseType, court_level: courtLevel,
      complexity, role, difficulty, custom_notes: customNotes
    });
  }

  async getLawMappings() {
    return this._req('GET', '/cases/law-mappings');
  }

  async getSession(sessionId) {
    return this._req('GET', `/cases/session/${sessionId}`);
  }

  // ── COURTROOM ──
  async argue(sessionId, content, argumentType = 'argue', witnessName = null) {
    return this._req('POST', '/courtroom/argue', {
      session_id: sessionId, content, argument_type: argumentType,
      witness_name: witnessName
    });
  }

  async checkArgument(sessionId, partialText, currentPhase = 'main') {
    return this._req('POST', '/courtroom/check-argument', {
      session_id: sessionId, partial_text: partialText, current_phase: currentPhase
    });
  }

  async respondToBenchQuery(queryId, responseText) {
    return this._req('POST', '/courtroom/respond-bench-query', {
      query_id: queryId, response_text: responseText
    });
  }

  async examineWitness(sessionId, witnessName, examinationType = 'direct') {
    return this._req('POST', '/courtroom/witness', {
      session_id: sessionId, witness_name: witnessName, examination_type: examinationType
    });
  }

  async raiseObjection(sessionId, objectionType, context = '') {
    return this._req('POST', '/courtroom/objection', {
      session_id: sessionId, objection_type: objectionType, context
    });
  }

  async concludeSession(sessionId) {
    return this._req('POST', '/courtroom/conclude', { session_id: sessionId });
  }

  async getHint(sessionId) {
    return this._req('GET', `/courtroom/hint/${sessionId}`);
  }

  // ── EVALUATION ──
  async generateEvaluation(sessionId) {
    return this._req('POST', `/evaluation/generate?session_id=${sessionId}`);
  }

  async getEvaluation(sessionId) {
    return this._req('GET', `/evaluation/${sessionId}`);
  }

  async getSkillRadar(userId) {
    return this._req('GET', `/evaluation/user/${userId}/skill-radar`);
  }

  // ── EVIDENCE ──
  async getEvidence(sessionId) {
    return this._req('GET', `/evidence/session/${sessionId}`);
  }

  // ── LEADERBOARD ──
  async getLeaderboard(limit = 20) {
    return this._req('GET', `/leaderboard/?limit=${limit}`);
  }

  // ── UTILS ──
  formatLawCitation(code, section, title) {
    return `${code} Section ${section} — ${title}`;
  }

  getLawBadgeColor(code) {
    return { BNS: '#C9A84C', BNSS: '#4A7AB0', BSA: '#4A9A6A' }[code] || '#8A8070';
  }
}

const api = new NyayaAPI();
