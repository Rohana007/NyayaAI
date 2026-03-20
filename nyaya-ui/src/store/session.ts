import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CaseData, User } from '../api/client'

export type ArgMode = 'argue' | 'rebuttal' | 'motion' | 'cite' | 'examine' | 'direct_rebuttal'

export interface TranscriptMsg {
  id: string
  type: 'system' | 'student' | 'judge' | 'opposing' | 'bench' | 'witness' | 'confrontation'
  label?: string
  text: string
  subtext?: string
  ts: number
}

interface Scores { logic: number; clarity: number; proc: number; cite: number; reb: number }

// 15B: phase names
export const ROUND_PHASES: Record<number, string> = {
  1: 'Opening Statements',
  2: 'Evidence Examination',
  3: 'Witness Examination',
  4: 'Rebuttals',
  5: 'Closing Arguments',
}
export const MAX_ROUNDS = 5

interface SessionState {
  // Auth
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void

  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void

  // Case / session
  sessionId: string | null
  caseData: CaseData | null
  role: string
  difficulty: string
  setSession: (sessionId: string, caseData: CaseData, role: string, difficulty: string) => void
  clearSession: () => void

  // Courtroom runtime (not persisted)
  transcript: TranscriptMsg[]
  addMsg: (msg: Omit<TranscriptMsg, 'id' | 'ts'>) => void
  scores: Scores
  updateScores: (delta: Partial<Scores>) => void
  round: number
  nextRound: () => void
  argMode: ArgMode
  setArgMode: (m: ArgMode) => void
  activeWitness: string | null
  setActiveWitness: (w: string | null) => void
  benchQueryCount: number
  incBenchQuery: () => void
  objectionCount: number
  incObjection: () => void
  sessionSeconds: number
  tickTimer: () => void
  resetRuntime: () => void
}

const defaultScores: Scores = { logic: 0, clarity: 0, proc: 0, cite: 0, reb: 0 }

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null, token: null,
      setAuth: (user, token) => {
        localStorage.setItem('nyaya_token', token)
        set({ user, token })
      },
      logout: () => {
        localStorage.removeItem('nyaya_token')
        set({ user: null, token: null, sessionId: null, caseData: null })
      },

      theme: 'dark' as 'dark' | 'light',
      toggleTheme: () => set(s => {
        const next = s.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        return { theme: next }
      }),

      sessionId: null, caseData: null, role: 'defence', difficulty: 'medium',
      setSession: (sessionId, caseData, role, difficulty) =>
        set({ sessionId, caseData, role, difficulty }),
      clearSession: () => set({ sessionId: null, caseData: null }),

      // Runtime (reset on new session)
      transcript: [], scores: { ...defaultScores },
      round: 1, argMode: 'argue', activeWitness: null,
      benchQueryCount: 0, objectionCount: 0, sessionSeconds: 0,

      addMsg: (msg) => set(s => ({
        transcript: [...s.transcript, { ...msg, id: crypto.randomUUID(), ts: Date.now() }]
      })),
      updateScores: (delta) => set(s => {
        const next = { ...s.scores }
        for (const k of Object.keys(delta) as (keyof Scores)[]) {
          if (delta[k] !== undefined)
            next[k] = Math.max(0, Math.min(100, (s.scores[k] ?? 0) + (delta[k] ?? 0)))
        }
        return { scores: next }
      }),
      nextRound: () => set(s => ({ round: s.round + 1 })),
      setArgMode: (argMode) => set({ argMode }),
      setActiveWitness: (activeWitness) => set({ activeWitness }),
      incBenchQuery: () => set(s => ({ benchQueryCount: s.benchQueryCount + 1 })),
      incObjection: () => set(s => ({ objectionCount: s.objectionCount + 1 })),
      tickTimer: () => set(s => ({ sessionSeconds: s.sessionSeconds + 1 })),
      resetRuntime: () => set({
        transcript: [], scores: { ...defaultScores },
        round: 1, argMode: 'argue', activeWitness: null,
        benchQueryCount: 0, objectionCount: 0, sessionSeconds: 0,
      }),
    }),
    {
      name: 'nyaya-session',
      version: 2,
      migrate: () => ({
        user: null, token: null, sessionId: null, caseData: null, role: 'defence', difficulty: 'medium'
      }),
      partialize: (s) => ({ user: s.user, token: s.token, sessionId: s.sessionId, caseData: s.caseData, role: s.role, difficulty: s.difficulty, theme: s.theme }),
    }
  )
)
