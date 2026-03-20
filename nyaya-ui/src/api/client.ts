const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api/v1'

function getToken() { return localStorage.getItem('nyaya_token') }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Guard against empty or non-JSON responses
  const text = await res.text()
  if (!text || text.trim() === '') {
    if (!res.ok) throw new Error(`Server error ${res.status}: empty response`)
    return {} as T
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    // Backend returned non-JSON (HTML error page, etc.)
    throw new Error(`Server error ${res.status}: ${text.substring(0, 200)}`)
  }

  if (!res.ok) {
    const detail = (data as { detail?: string })?.detail
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return data as T
}

// ── Types ──
export interface User { id: string; name: string; email: string; college?: string }
export interface AuthResponse { access_token: string; user: User }

export interface Charge { section: string; description: string; full_text?: string }
export interface Witness { name: string; role: string; testimony_summary: string }
export interface LegalSection { code: string; section: string; title: string }
export interface EvidenceItem {
  id?: string; title: string; type: string; admissibility: string; content?: string
}
export interface CaseData {
  session_id: string
  case_title: string
  case_type: string
  court: string
  year: string
  difficulty: string
  background: string
  charges: Charge[]
  facts: string[]
  prosecution_brief: string
  defense_brief: string
  key_witnesses: Witness[]
  legal_sections: LegalSection[]
  evidence_items: EvidenceItem[]
  estimated_duration: string
  learning_objectives: string[]
  // 15A: landmark case grounding
  based_on?: string
  // 15C: judge archetype
  judge_archetype?: string
  judge_archetype_description?: string
}

export interface TacticalChoice {
  id: string
  label: string
  hint: string
  type: 'aggressive' | 'defensive' | 'procedural' | 'emotional_appeal'
}

export interface TacticalChoices {
  decision_prompt: string
  choices: TacticalChoice[]
}

export interface CasePredictor {
  win_probability: number
  momentum: 'rising' | 'stable' | 'declining'
  momentum_reason: string
  judge_sentiment: 'favorable' | 'neutral' | 'skeptical' | 'hostile'
  tip: string
}

export interface ArgueResponse {
  argument_id: string
  opposing_response: string
  judge_response?: string
  objection?: { type: string; ruling: string; reasoning: string } | null
  bench_query?: { triggered: boolean; query: string; query_id: string }
  cited_laws: { code: string; section: string; title?: string }[]
  scores_update: Record<string, number>
  proceeding: string
  tactical_choices?: TacticalChoices | null
  case_predictor?: CasePredictor | null
}

export interface EvaluationData {
  session_id: string
  scores: Record<string, number>
  overall_score: number
  grade: string
  verdict: string
  verdict_reasoning: string
  feedback_points: { type: string; point: string; legal_basis: string }[]
  next_steps: string[]
  improvement_tips?: string[]
  badge?: string
  bench_queries_faced: number
  bias_audit: { passed: boolean; note: string }
}

// ── Auth ──
export const authApi = {
  register: (email: string, password: string, name: string, college?: string) =>
    req<AuthResponse>('POST', '/auth/register', { email, password, name, college }),
  login: (email: string, password: string) =>
    req<AuthResponse>('POST', '/auth/login', { email, password }),
}

// ── Cases ──
export const casesApi = {
  generate: (p: {
    case_type: string; court_level: string; complexity: string
    role: string; difficulty: string; custom_notes?: string
  }) => req<CaseData>('POST', '/cases/generate', p),
  history: (user_id: string) =>
    req<{ sessions: { session_id: string; case_title: string; case_type: string; role: string; difficulty: string; status: string; score: number | null; grade: string | null; verdict: string | null; bench_queries: number; created_at: string | null }[] }>('GET', `/cases/history/${user_id}`),
}

// ── Courtroom ──
export const courtroomApi = {
  argue: (session_id: string, content: string, argument_type = 'argue', witness_name?: string) =>
    req<ArgueResponse>('POST', '/courtroom/argue', { session_id, content, argument_type, witness_name }),
  checkArgument: (session_id: string, partial_text: string, current_phase = 'main') =>
    req<{ interrupt: boolean; bench_query?: string; query_id?: string }>('POST', '/courtroom/check-argument', { session_id, partial_text, current_phase }),
  respondBenchQuery: (query_id: string, response_text: string) =>
    req<{ judge_acknowledgment: string; can_continue: boolean }>('POST', '/courtroom/respond-bench-query', { query_id, response_text }),
  examineWitness: (session_id: string, witness_name: string, examination_type = 'direct') =>
    req<{ witness_name: string; answer: string; demeanor: string; can_be_impeached: boolean }>('POST', '/courtroom/witness', { session_id, witness_name, examination_type }),
  raiseObjection: (session_id: string, objection_type: string, context = '') =>
    req<{ ruling: string; judge_reasoning: string; bsa_section?: string; score_impact: number }>('POST', '/courtroom/objection', { session_id, objection_type, context }),
  conclude: (session_id: string) =>
    req<{ status: string }>('POST', '/courtroom/conclude', { session_id }),
  getHint: (session_id: string) =>
    req<{ hint: string }>('GET', `/courtroom/hint/${session_id}`),
  suggestArguments: (session_id: string, mode: string = 'argue') =>
    req<{ options: { label: string; text: string; type: string }[] }>('GET', `/courtroom/suggest-arguments/${session_id}?mode=${mode}`),
  submitClosing: (session_id: string, closing_text: string) =>
    req<{
      opposing_closing: string; judge_verdict_speech: string; verdict: string
      verdict_reasoning: string; key_finding: string; sentence_or_order: string
      grade: string; overall_score: number
    }>('POST', '/courtroom/closing', { session_id, closing_text }),
  getDemoScript: (case_type = 'murder') =>
    req<{ case_title: string; case_summary: string; turns: DemoTurn[] }>('GET', `/courtroom/demo-script?case_type=${case_type}`),
  // 15E: opening tactical cards (before first argument)
  getOpeningCards: (session_id: string) =>
    req<TacticalChoices>('GET', `/courtroom/opening-cards/${session_id}`),
}

// ── Evaluation ──
export const evaluationApi = {
  generate: (session_id: string) =>
    req<EvaluationData>('POST', `/evaluation/generate?session_id=${session_id}`),
  get: (session_id: string) =>
    req<EvaluationData>('GET', `/evaluation/${session_id}`),
  skillRadar: (user_id: string) =>
    req<{ sessions_count: number; avg_scores: Record<string, number>; bench_queries_avg: number }>('GET', `/evaluation/user/${user_id}/skill-radar`),
}

export interface DemoTurn {
  speaker: 'system' | 'judge' | 'prosecution' | 'defence' | 'objection' | 'verdict'
  text: string
  delay: number
  ruling?: string
  verdict?: string
}

// ── Leaderboard ──
export const leaderboardApi = {
  get: (limit = 20) => req<{ entries: unknown[] }>('GET', `/leaderboard/?limit=${limit}`),
}

// ── Demeanor ──
export interface DemeanorResult {
  demeanor: 'confident' | 'nervous' | 'uncertain' | 'unknown'
  score: number
  stress_level: number
  feedback: string
  source: 'gemini' | 'faceapi_fallback'
}

export const demeanorApi = {
  analyze: (image_b64: string, context = '') =>
    req<DemeanorResult>('POST', '/demeanor', { image_b64, context }),
}

export const LAW_BADGE_COLOR: Record<string, string> = {
  BNS: '#C9A84C', BNSS: '#4A7AB0', BSA: '#4A9A6A',
}
