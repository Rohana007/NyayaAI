import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import PreTrial from './pages/PreTrial'
import Courtroom from './pages/Courtroom'
import ClosingArgument from './pages/ClosingArgument'
import Evaluation from './pages/Evaluation'
import EvidenceBoard from './pages/EvidenceBoard'
import Leaderboard from './pages/Leaderboard'
import Demo from './pages/Demo'
import Ethics from './pages/Ethics'
import Present from './pages/Present'
import { useSession } from './store/session'
import ParticleBackground from './components/ParticleBackground'

// Apply persisted theme before first render
const persistedRaw = localStorage.getItem('nyaya-session')
if (persistedRaw) {
  try {
    const persisted = JSON.parse(persistedRaw)
    const theme = persisted?.state?.theme || 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  } catch { document.documentElement.setAttribute('data-theme', 'dark') }
} else {
  document.documentElement.setAttribute('data-theme', 'dark')
}

// Error boundary to catch runtime crashes and show them instead of blank screen
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ background: '#0A0F1E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 32 }}>⚖</div>
        <div style={{ color: '#E07070', fontFamily: 'monospace', fontSize: 14, maxWidth: 600, textAlign: 'center' }}>{this.state.error}</div>
        <button onClick={() => { localStorage.removeItem('nyaya-session'); window.location.reload() }}
          style={{ marginTop: 8, padding: '10px 24px', background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.4)', color: '#C9A84C', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
          Clear Cache & Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSession(s => s.token)
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireSession({ children }: { children: React.ReactNode }) {
  const sessionId = useSession(s => s.sessionId)
  if (!sessionId) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ParticleBackground />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/pretrial" element={<RequireAuth><RequireSession><PreTrial /></RequireSession></RequireAuth>} />
          <Route path="/courtroom" element={<RequireAuth><RequireSession><Courtroom /></RequireSession></RequireAuth>} />
          <Route path="/closing" element={<RequireAuth><RequireSession><ClosingArgument /></RequireSession></RequireAuth>} />
          <Route path="/evidence" element={<RequireAuth><RequireSession><EvidenceBoard /></RequireSession></RequireAuth>} />
          <Route path="/evaluation" element={<RequireAuth><RequireSession><Evaluation /></RequireSession></RequireAuth>} />
          <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/ethics" element={<Ethics />} />
          <Route path="/present" element={<Present />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
