import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'

interface Props { transparent?: boolean }

export default function Navbar({ transparent }: Props) {
  const nav = useNavigate()
  const loc = useLocation()
  const { user, logout, theme, toggleTheme } = useSession(
    useShallow(s => ({ user: s.user, logout: s.logout, theme: s.theme, toggleTheme: s.toggleTheme }))
  )

  const isLight = theme === 'light'

  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .5, ease: [.16,1,.3,1] }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 48px', position: 'relative', zIndex: 50,
        background: transparent ? 'transparent' : 'var(--nav-bg)',
        borderBottom: transparent ? 'none' : '1px solid var(--nav-border)',
        backdropFilter: transparent ? 'none' : 'blur(20px)',
        WebkitBackdropFilter: transparent ? 'none' : 'blur(20px)',
        transition: 'background .3s, border-color .3s',
      }}>

      {/* Logo */}
      <motion.button onClick={() => nav('/dashboard')} whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <motion.span animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px rgba(201,168,76,.5))' }}>⚖</motion.span>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.04em' }}>
          Nyaya<span style={{ color: '#C9A84C' }}>AI</span>
        </span>
      </motion.button>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)' }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontSize: 14, color: '#C9A84C', fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>{user.name}</span>
          </motion.div>
        )}
        <NavBtn active={loc.pathname === '/leaderboard'} onClick={() => nav('/leaderboard')}>🏆 Board</NavBtn>
        <NavBtn active={loc.pathname === '/ethics'} onClick={() => nav('/ethics')}>Ethics</NavBtn>
        <NavBtn active={loc.pathname === '/present'} onClick={() => nav('/present')}>📊 Present</NavBtn>

        {/* Theme toggle */}
        <motion.button onClick={toggleTheme} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer',
            border: '1px solid var(--border-mid)', background: 'var(--surface)', color: 'var(--text-primary)', transition: 'all .2s' }}>
          {isLight ? '🌙' : '☀️'}
        </motion.button>

        <NavBtn onClick={() => { logout(); nav('/') }}>Logout</NavBtn>
      </div>
    </motion.nav>
  )
}

function NavBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <motion.button onClick={onClick} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
      style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8,
        border: `1px solid ${active ? 'rgba(201,168,76,.4)' : 'var(--border-mid)'}`,
        background: active ? 'rgba(201,168,76,.1)' : 'transparent',
        color: active ? '#C9A84C' : 'var(--text-secondary)',
        cursor: 'pointer', transition: 'color .2s, background .2s, border-color .2s' }}>
      {children}
    </motion.button>
  )
}
