import { useState } from 'react'
import type React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'

interface Props {
  gavelStrike: boolean
  judgeStatus: string
  judgeQuote: string
  judgeThinking?: boolean
  onAvatarClick?: (side: 'player' | 'opposing') => void
}

export default function CourtScene({ gavelStrike, judgeStatus, judgeQuote, judgeThinking, onAvatarClick }: Props) {
  const { caseData, role, activeWitness } = useSession(useShallow(s => ({ caseData: s.caseData, role: s.role, activeWitness: s.activeWitness })))
  const user = useSession(s => s.user)
  const [hovered, setHovered] = useState<'player' | 'opposing' | null>(null)

  const myName = user ? `Adv. ${user.name}` : 'Adv. [You]'
  const oppName = role === 'defence' ? 'Adv. Priya Sharma' : 'Adv. Rajan Mehta'
  const court = caseData?.court || 'Sessions Court of India'
  const myRole = role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'
  const oppRole = role === 'defence' ? 'Public Prosecutor' : 'Defence Counsel'
  const myColor = role === 'defence' ? '#4A7AB0' : '#C05050'
  const oppColor = role === 'defence' ? '#C05050' : '#4A7AB0'

  // Place courtroom-bg.jpg in nyayaai/nyaya-ui/public/ to activate photo background
  // Falls back to dark gradient automatically if image is missing
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url('/courtroom-bg.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#0A0F1E',
  }

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', userSelect: 'none', minHeight: 280, ...bgStyle }}>

      {/* Dark overlay so UI elements stay readable over the photo */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,6,14,0.62)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Subtle gold vignette at top */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(201,168,76,.06) 0%, transparent 70%)' }} />

      {/* Floor */}
      {/* Removed — real courtroom photo provides the floor */}

      {/* Columns */}
      {/* Removed — real courtroom photo provides the columns */}

      {/* Court seal */}
      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, zIndex: 10,
          border: '2px solid rgba(201,168,76,.3)', background: 'radial-gradient(circle, rgba(201,168,76,.15) 0%, rgba(10,15,30,.85) 100%)',
          boxShadow: '0 0 24px rgba(201,168,76,.18)' }}>
        ⚖
      </motion.div>

      {/* Judge bench */}
      <div style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', width: 288, zIndex: 10 }}>
        <motion.div
          animate={judgeThinking
            ? { boxShadow: ['0 0 12px rgba(201,168,76,.2)', '0 0 40px rgba(201,168,76,.55)', '0 0 12px rgba(201,168,76,.2)'] }
            : { boxShadow: '0 4px 24px rgba(0,0,0,.6)' }}
          transition={{ duration: 1.4, repeat: judgeThinking ? Infinity : 0 }}
          style={{ borderRadius: '6px 6px 0 0', padding: '10px 16px', textAlign: 'center',
            background: 'linear-gradient(180deg,#3D1F0A,#2A1206)',
            border: '1px solid rgba(201,168,76,.35)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', marginBottom: 3, color: 'rgba(201,168,76,.45)', fontFamily: 'Space Grotesk, sans-serif' }}>{court}</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, fontWeight: 600, color: '#C9A84C' }}>Hon. Justice R.K. Krishnamurthy</div>
          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8A8070', marginTop: 2 }}>
            {judgeThinking && <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />}
            Presiding Judge
          </div>
        </motion.div>
        <div style={{ height: 24, borderRadius: '0 0 4px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg,#2A1206,#1A0A00)', border: '1px solid rgba(201,168,76,.18)', borderTop: 'none' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(201,168,76,.35)', fontFamily: 'Space Grotesk, sans-serif' }}>SATYAMEVA JAYATE</span>
        </div>
      </div>

      {/* Gavel */}
      <motion.div style={{ position: 'absolute', fontSize: 22, zIndex: 20, top: 70, right: 'calc(50% - 180px)', transformOrigin: 'bottom right', cursor: 'default' }}
        animate={gavelStrike ? { rotate: [0, -42, 8, 0] } : { rotate: 0 }}
        transition={{ duration: .38, ease: [.16,1,.3,1] }}>
        🔨
      </motion.div>

      {/* Judge speech bubble */}
      <AnimatePresence mode="wait">
        <motion.div key={judgeQuote}
          initial={{ opacity: 0, scale: .93, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95 }}
          transition={{ duration: .3, ease: [.16,1,.3,1] }}
          style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 10, maxWidth: 300, textAlign: 'center', top: 172 }}>
          <div style={{ position: 'relative', display: 'inline-block', padding: '10px 16px', borderRadius: 12, fontFamily: 'Cormorant Garamond, serif', fontSize: 13, fontStyle: 'italic', lineHeight: 1.5,
            background: 'rgba(61,31,10,.92)', border: '1px solid rgba(201,168,76,.28)', color: 'rgba(201,168,76,.8)',
            boxShadow: '0 6px 24px rgba(0,0,0,.5)' }}>
            {judgeQuote}
            <span style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
              borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '8px solid rgba(61,31,10,.92)' }} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#8A8070' }}>
            <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9A6A', display: 'inline-block' }} />
            {judgeStatus}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Player avatar */}
      <Avatar name={myName} role={myRole} color={myColor} emoji="👨‍⚖️" side="left" hovered={hovered === 'player'}
        onHover={v => setHovered(v ? 'player' : null)} onClick={() => onAvatarClick?.('player')} tooltip="Click to Argue" />

      {/* Opposing avatar */}
      <Avatar name={oppName} role={oppRole} color={oppColor} emoji="👩‍⚖️" side="right" hovered={hovered === 'opposing'}
        onHover={v => setHovered(v ? 'opposing' : null)} onClick={() => onAvatarClick?.('opposing')} tooltip="Opposing Counsel" />

      {/* Witness */}
      <AnimatePresence>
        {activeWitness && (
          <motion.div initial={{ opacity: 0, scale: .85, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .85 }}
            style={{ position: 'absolute', zIndex: 10, bottom: '40%', left: '50%', transform: 'translateX(-50%)', width: 112, textAlign: 'center', borderRadius: 6, padding: '8px 8px',
              background: 'linear-gradient(180deg,#1A1A2E,#0D0D1E)', border: '1px solid rgba(74,122,176,.4)' }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🧑</div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(74,122,176,.7)', fontFamily: 'Space Grotesk, sans-serif' }}>WITNESS</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7AB0D8', marginTop: 2 }}>{activeWitness}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery silhouettes removed — real photo provides audience context */}
    </div>
  )
}

function Avatar({ name, role, color, emoji, side, hovered, onHover, onClick, tooltip }: {
  name: string; role: string; color: string; emoji: string; side: 'left' | 'right'
  hovered: boolean; onHover: (v: boolean) => void; onClick: () => void; tooltip: string
}) {
  return (
    <div style={{ position: 'absolute', zIndex: 20, bottom: '40%', [side === 'left' ? 'left' : 'right']: '18%' }}>
      <motion.div whileHover={{ scale: 1.07 }} whileTap={{ scale: .95 }} onClick={onClick}
        onHoverStart={() => onHover(true)} onHoverEnd={() => onHover(false)}
        style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              style={{ position: 'absolute', bottom: '100%', marginBottom: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, zIndex: 30, background: color, color: '#fff', boxShadow: `0 4px 16px ${color}55` }}>
              {tooltip}
              <span style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${color}` }} />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          background: `radial-gradient(circle, ${color}33 0%, ${color}11 100%)`,
          border: `2px solid ${color}88`,
          boxShadow: hovered ? `0 0 28px ${color}55` : 'none',
          transition: 'box-shadow .25s' }}>
          {emoji}
          <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${color}` }}
            animate={{ scale: [1, 1.18, 1], opacity: [.5, 0, .5] }}
            transition={{ duration: 2.2, repeat: Infinity }} />
        </div>

        <div style={{ marginTop: 8, textAlign: 'center', padding: '5px 10px', borderRadius: 6, background: 'rgba(10,15,30,.88)', border: `1px solid ${color}44` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E8E0D0', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 10, color: color, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>{role}</div>
        </div>
      </motion.div>
    </div>
  )
}

