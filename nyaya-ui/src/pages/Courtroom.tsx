import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { courtroomApi, evaluationApi, LAW_BADGE_COLOR, demeanorApi } from '../api/client'
import type { TacticalChoices, CasePredictor, TacticalChoice } from '../api/client'
import { useSession, ROUND_PHASES, MAX_ROUNDS } from '../store/session'
import { useShallow } from 'zustand/react/shallow'
import TranscriptPanel from '../components/TranscriptPanel'
import InputArea from '../components/InputArea'
import CaseMeter from '../components/CaseMeter'
import ChoiceCards from '../components/ChoiceCards'
import { useCamera, type EmotionSnapshot } from '../hooks/useCamera'
import { useTTS } from '../hooks/useTTS'

const EMOJI_MAP: Record<string, string> = { fir: '📄', forensic: '🔬', cctv: '📹', witness: '👤', medical: '🏥', cdr: '📞' }

// 15C: archetype badge colors
const ARCHETYPE_COLOR: Record<string, string> = {
  Pragmatist: '#C9A84C',
  Constitutionalist: '#4A7AB0',
  Empathetic: '#4A9A6A',
  Unpredictable: '#9B7FD4',
}

const DEMEANOR_COLOR: Record<string, string> = {
  confident: '#4A9A6A',
  nervous: '#D46B6B',
  uncertain: '#C9A84C',
  unknown: '#666',
}

type Panel = 'transcript' | 'scores' | 'evidence' | 'witnesses' | null

export default function Courtroom() {
  const nav = useNavigate()
  const {
    sessionId, caseData, role, difficulty,
    user, transcript, addMsg, scores, updateScores,
    round, nextRound, argMode, setActiveWitness, activeWitness,
    incBenchQuery, incObjection, objectionCount, benchQueryCount,
    sessionSeconds, tickTimer,
  } = useSession(useShallow(s => ({
    sessionId: s.sessionId, caseData: s.caseData, role: s.role, difficulty: s.difficulty,
    user: s.user, transcript: s.transcript, addMsg: s.addMsg, scores: s.scores,
    updateScores: s.updateScores, round: s.round, nextRound: s.nextRound,
    argMode: s.argMode, setActiveWitness: s.setActiveWitness, activeWitness: s.activeWitness,
    incBenchQuery: s.incBenchQuery, incObjection: s.incObjection,
    objectionCount: s.objectionCount, benchQueryCount: s.benchQueryCount,
    sessionSeconds: s.sessionSeconds, tickTimer: s.tickTimer,
  })))

  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [locked, setLocked] = useState(false)
  const [gavelStrike, setGavelStrike] = useState(false)
  const [, setJudgeStatus] = useState('Presiding')
  const [judgeQuote, setJudgeQuote] = useState('"This court is now in session."')
  const [judgeThinking, setJudgeThinking] = useState(false)
  const [oppSpeaking, setOppSpeaking] = useState(false)
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const [inputOpen, setInputOpen] = useState(false)
  const [benchModal, setBenchModal] = useState<{ query: string; queryId: string } | null>(null)
  const [benchResponse, setBenchResponse] = useState('')
  const [objOverlay, setObjOverlay] = useState<{ type: string; ruling: string } | null>(null)
  const [verdict, setVerdict] = useState<{ grade: string; score: number; verdict: string } | null>(null)
  const [lawChips, setLawChips] = useState(caseData?.legal_sections?.slice(0, 6) || [])
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [demeanorSource, setDemeanorSource] = useState<'gemini' | 'faceapi' | null>(null)
  const [debrief, setDebrief] = useState<null | { grade: string; tips: string[]; ruling: string; badge: string; emotionTimeline: number[] }>(null)
  const [roleSwitchModal, setRoleSwitchModal] = useState(false)
  const emotionTimelineRef = useRef<number[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Feature 14A/14B state ──
  const [tacticalChoices, setTacticalChoices] = useState<TacticalChoices | null>(null)
  const [casePredictor, setCasePredictor] = useState<CasePredictor>({
    win_probability: 50,
    momentum: 'stable',
    momentum_reason: 'Session just started — make your opening argument.',
    judge_sentiment: 'neutral',
    tip: 'Start with a clear statement of facts and cite the relevant BNS section.',
  })
  const [choiceSelected, setChoiceSelected] = useState<TacticalChoice | null>(null)

  // ── 15D: direct rebuttal state ──
  const [showReplyToCounsel, setShowReplyToCounsel] = useState(false)

  // ── Demo mode state ──
  const [demoActive, setDemoActive] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const demoTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Camera hook
  const { videoRef, ready: camReady, modelsFailed, emotion, roleSwitchPrompt, setRoleSwitchPrompt, snapshotEmotion, captureFrame } = useCamera(cameraEnabled)

  // TTS hook
  const { speak, replay, muted, toggleMute, isSpeaking } = useTTS()

  // Auto-open transcript panel when opposing counsel responds
  useEffect(() => {
    const lastMsg = transcript[transcript.length - 1]
    if (lastMsg?.type === 'opposing' || lastMsg?.type === 'judge') {
      setOpenPanel('transcript')
    }
  }, [transcript.length])

  // Show role switch modal when face-api detects new face
  useEffect(() => {
    if (roleSwitchPrompt) { setRoleSwitchModal(true); setRoleSwitchPrompt(false) }
  }, [roleSwitchPrompt, setRoleSwitchPrompt])

  // Track emotion timeline
  useEffect(() => {
    if (camReady && emotion.demeanor !== 'unknown') {
      emotionTimelineRef.current = [...emotionTimelineRef.current, emotion.score]
    }
  }, [emotion, camReady])

  useEffect(() => {
    if (!sessionId || !caseData) { nav('/dashboard'); return }
    if (transcript.length === 0) {
      addMsg({ type: 'system', text: `This court is now in session. Case: ${caseData.case_title}.` })
      const openingText = `The matter before this court is ${caseData.case_title}. ${role === 'defence' ? 'Defence' : 'Prosecution'} counsel, you may proceed with your opening statement.`
      addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: openingText })
      speak(openingText)
      // 15E: fetch opening tactical cards before first argument
      courtroomApi.getOpeningCards(sessionId).then(cards => {
        setTacticalChoices(cards)
        setChoiceSelected(null)
      }).catch(() => {
        // Fallback opening cards
        setTacticalChoices({
          decision_prompt: 'You are about to deliver your opening statement. Choose your approach:',
          choices: [
            { id: 'A', label: 'Lead with the strongest BNS section', hint: 'Anchor your opening in statute — establishes legal authority immediately', type: 'aggressive' },
            { id: 'B', label: 'Challenge the prosecution\'s evidence first', hint: 'Attack admissibility under BSA before they build their case', type: 'defensive' },
            { id: 'C', label: 'Invoke procedural rights under BNSS', hint: 'Establish procedural compliance — protects your position throughout', type: 'procedural' },
          ]
        })
      })
    }
    timerRef.current = setInterval(tickTimer, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current); demoTimeoutsRef.current.forEach(clearTimeout) }
  }, [])

  const gavel = useCallback(() => {
    setGavelStrike(true); setTimeout(() => setGavelStrike(false), 400)
  }, [])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5)
  const togglePanel = (p: Panel) => setOpenPanel(o => o === p ? null : p)

  const submitArgument = async (text: string, argType?: string) => {
    if (!sessionId || round > MAX_ROUNDS) return
    setInputOpen(false)
    setShowReplyToCounsel(false)
    setLoading(true); setTyping(true); setJudgeThinking(true)
    setJudgeStatus('Deliberating…')

    // ── Demeanor analysis: Gemini Vision first, face-api as fallback ──
    let snap: EmotionSnapshot = snapshotEmotion()
    if (camReady) {
      const frame = captureFrame()
      if (frame) {
        try {
          const context = `Student is presenting as ${role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'} in round ${round}.`
          const result = await demeanorApi.analyze(frame, context)
          snap = {
            demeanor: result.demeanor,
            score: result.score,
            stressLevel: result.stress_level,
            raw: {},
          }
          setDemeanorSource('gemini')
        } catch {
          // Gemini failed — fall back to face-api result already in snap
          setDemeanorSource('faceapi')
        }
      }
    }

    let enrichedText = text
    if (snap.demeanor !== 'unknown') {
      enrichedText += `\n\n[Student appeared ${snap.demeanor} during this submission. Factor this into your feedback.]`
    }
    if (snap.stressLevel > 0.6) {
      if (difficulty === 'easy') enrichedText += '\n[Student seems stressed. Be more encouraging and provide a gentle hint.]'
      else enrichedText += '\n[Student appears nervous. Press harder with a follow-up question.]'
    }

    const myLabel = role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'
    addMsg({ type: 'student', label: myLabel, text })
    try {
      const res = await courtroomApi.argue(sessionId, enrichedText, argType || argMode, activeWitness || undefined)
      setTyping(false); setJudgeThinking(false)

      const oppLabel = role === 'defence' ? 'Public Prosecutor' : 'Defence Counsel'

      // ── Step 1: Opposing counsel responds immediately (with TTS) ──
      setOppSpeaking(true)
      addMsg({ type: 'opposing', label: oppLabel, text: res.opposing_response })
      speak(res.opposing_response, { rate: 0.95, pitch: role === 'defence' ? 1.1 : 0.88 })
      setTimeout(() => {
        setOppSpeaking(false)
        // 15D: show "Respond to Counsel" button after opposing speaks
        setShowReplyToCounsel(true)
      }, Math.min(res.opposing_response.length * 55, 5000))

      // ── Step 2: Auto-objection from opposing counsel (if backend triggered one) ──
      if (res.objection) {
        const obj = res.objection as { type: string; ruling: string; reasoning: string }
        setTimeout(() => {
          setObjOverlay({ type: obj.type, ruling: obj.ruling })
          gavel()
          addMsg({ type: 'bench', label: `⚠ Objection by ${oppLabel}`, text: `⚡ ${obj.type} — ${obj.ruling}`, subtext: obj.reasoning })
          speak(`Objection! ${obj.type}. ${obj.ruling}.`, { rate: 1.05, pitch: role === 'defence' ? 1.15 : 0.9, interrupt: false })
          setTimeout(() => setObjOverlay(null), 3000)
        }, 800)
      }

      // ── Step 3: Judge responds after opposing counsel finishes ──
      const judgeDelay = res.objection ? 3200 : 1200
      if (res.judge_response) {
        setTimeout(() => {
          setJudgeThinking(true)
          setJudgeStatus('Deliberating…')
          setTimeout(() => {
            addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: res.judge_response! })
            setJudgeQuote(`"${res.judge_response!.substring(0, 120)}${res.judge_response!.length > 120 ? '…' : ''}"`)
            speak(res.judge_response!, { rate: 0.82, pitch: 0.9 })
            setJudgeThinking(false)
            setJudgeStatus('Presiding')
          }, 600)
        }, judgeDelay)
      }

      // ── Step 4: Bench query lock ──
      if (res.bench_query?.triggered) {
        setTimeout(() => {
          incBenchQuery()
          setBenchModal({ query: res.bench_query!.query, queryId: res.bench_query!.query_id })
          setLocked(true); gavel(); setJudgeStatus('Bench Query Pending')
        }, judgeDelay + 2000)
      }

      if (res.cited_laws?.length) setLawChips(res.cited_laws.slice(0, 6) as typeof lawChips)
      updateScores(res.scores_update as Parameters<typeof updateScores>[0])
      nextRound(); setJudgeStatus('Presiding')

      // ── Feature 14A/15E: show tactical choices after judge responds — always ──
      const choicesDelay = judgeDelay + 800
      if (res.tactical_choices?.choices?.length) {
        setTimeout(() => {
          setTacticalChoices(res.tactical_choices!)
          setChoiceSelected(null)
        }, choicesDelay)
      } else {
        // Fallback: phase-appropriate generic choices
        const phaseName = ROUND_PHASES[round] || 'Main Arguments'
        setTimeout(() => {
          setTacticalChoices({
            decision_prompt: `Round ${round} — ${phaseName}. Choose your next move:`,
            choices: [
              { id: 'A', label: 'Reinforce with BNS citation', hint: 'Grounds your position in statute — strengthens legal basis', type: 'aggressive' },
              { id: 'B', label: 'Challenge opposing evidence', hint: 'Attack admissibility under BSA — shifts burden', type: 'defensive' },
              { id: 'C', label: 'File procedural motion', hint: 'Invoke BNSS procedure — may delay but protects your position', type: 'procedural' },
            ]
          })
          setChoiceSelected(null)
        }, choicesDelay)
      }

      // ── Feature 14B: update case predictor ──
      if (res.case_predictor) {
        setCasePredictor(res.case_predictor)
        // Sync logic score with win_probability so overall score reflects LLM assessment
        const prob = res.case_predictor.win_probability
        const sentiment = res.case_predictor.judge_sentiment
        const sentimentBonus = sentiment === 'favorable' ? 8 : sentiment === 'skeptical' ? -4 : sentiment === 'hostile' ? -8 : 0
        updateScores({ logic: Math.round((prob - 50) / 5) + sentimentBonus })
      } else {
        // Fallback predictor so the meter always shows
        const baseProb = Math.max(20, Math.min(80, 50 + (res.scores_update?.logic ?? 0) * 2))
        setCasePredictor({
          win_probability: baseProb,
          momentum: baseProb > 55 ? 'rising' : baseProb < 45 ? 'declining' : 'stable',
          momentum_reason: 'Assessment based on argument quality and legal grounding.',
          judge_sentiment: 'neutral',
          tip: 'Cite specific BNS/BNSS/BSA sections to strengthen your position.',
        })
      }

      if (round + 1 > MAX_ROUNDS) setTimeout(concludeSession, judgeDelay + 3000)
    } catch (e: unknown) {
      setTyping(false); setJudgeThinking(false)
      addMsg({ type: 'system', text: `Error: ${e instanceof Error ? e.message : 'Request failed'}` })
      setJudgeStatus('Presiding')
    } finally { setLoading(false) }
  }

  const raiseObjection = async (type: string) => {
    if (!sessionId) return
    incObjection()
    try {
      const res = await courtroomApi.raiseObjection(sessionId, type)
      setObjOverlay({ type, ruling: res.ruling })
      gavel()
      addMsg({ type: 'bench', label: '⚠ Objection', text: `⚡ ${type} — ${res.ruling}`, subtext: res.judge_reasoning })
      setTimeout(() => setObjOverlay(null), 2800)
    } catch {
      setObjOverlay({ type, ruling: Math.random() > .5 ? 'Sustained' : 'Overruled' })
      setTimeout(() => setObjOverlay(null), 2800)
    }
  }

  const submitBenchResponse = async () => {
    if (!benchModal || !benchResponse.trim()) return
    try {
      const res = await courtroomApi.respondBenchQuery(benchModal.queryId, benchResponse)
      setBenchModal(null); setBenchResponse(''); setLocked(false)
      addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: res.judge_acknowledgment })
      speak(res.judge_acknowledgment)
      setJudgeStatus('Presiding')
      setInputOpen(true)
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed') }
  }

  const concludeSession = async () => {
    if (!sessionId) return
    if (timerRef.current) clearInterval(timerRef.current)
    addMsg({ type: 'system', text: 'Session concluded. Generating evaluation…' })
    setJudgeStatus('Delivering Verdict')
    try {
      await courtroomApi.conclude(sessionId)
      const ev = await evaluationApi.generate(sessionId)
      setVerdict({ grade: ev.grade, score: ev.overall_score, verdict: ev.verdict })
      const verdictText = `This Court delivers its verdict: ${ev.verdict}. Grade: ${ev.grade}.`
      addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: verdictText })
      speak(verdictText)
      gavel(); setJudgeStatus('Verdict Delivered'); setOpenPanel('scores')
      // Build debrief
      setDebrief({
        grade: ev.grade,
        tips: ev.improvement_tips || ['Review your legal citations.', 'Work on argument clarity.', 'Practice cross-examination.'],
        ruling: ev.verdict,
        badge: ev.badge || (ev.overall_score >= 80 ? '⚖ Distinguished Advocate' : ev.overall_score >= 60 ? '📜 Competent Counsel' : '🎓 Aspiring Jurist'),
        emotionTimeline: emotionTimelineRef.current,
      })
    } catch (e: unknown) {
      addMsg({ type: 'system', text: `Evaluation error: ${e instanceof Error ? e.message : 'Failed'}` })
    }
  }

  const getHint = async () => {
    if (!sessionId) return
    try {
      const res = await courtroomApi.getHint(sessionId)
      addMsg({ type: 'system', text: `💡 Hint: ${res.hint}` })
    } catch { addMsg({ type: 'system', text: 'Hints only available in Easy mode.' }) }
  }

  const handleChoiceSelect = (choice: TacticalChoice) => {
    setChoiceSelected(choice)
    setTacticalChoices(null)
    setShowReplyToCounsel(false)
    // Auto-open input with the choice pre-filled as context
    setTimeout(() => setInputOpen(true), 600)
    addMsg({ type: 'system', text: `⚡ Strategy selected: ${choice.label}` })
  }

  // ── Demo mode: fetch script and auto-play inside the real courtroom UI ──
  const stopDemo = useCallback(() => {
    demoTimeoutsRef.current.forEach(clearTimeout)
    demoTimeoutsRef.current = []
    setDemoActive(false)
    setLocked(false)
    setJudgeStatus('Presiding')
    setJudgeThinking(false)
    setOppSpeaking(false)
  }, [])

  const startDemo = useCallback(async () => {
    if (demoLoading) return
    setDemoLoading(true)
    try {
      const caseType = caseData?.case_type || 'murder'
      const script = await courtroomApi.getDemoScript(caseType)
      setDemoActive(true)
      setLocked(true)
      addMsg({ type: 'system', text: `⚡ DEMO MODE — Auto-playing: ${script.case_title}` })

      script.turns.forEach((turn) => {
        const t = setTimeout(() => {
          if (turn.speaker === 'judge') {
            addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: turn.text })
            setJudgeQuote(`"${turn.text.substring(0, 120)}${turn.text.length > 120 ? '…' : ''}"`)
            setJudgeThinking(true)
            setJudgeStatus('Deliberating…')
            speak(turn.text, { rate: 0.82, pitch: 0.9, interrupt: true })
            gavel()
            setOpenPanel('transcript')
            setTimeout(() => { setJudgeThinking(false); setJudgeStatus('Presiding') }, 2000)

          } else if (turn.speaker === 'prosecution') {
            const label = role === 'defence' ? 'Public Prosecutor' : 'Defence Counsel'
            addMsg({ type: 'opposing', label, text: turn.text })
            setJudgeStatus('Prosecution Speaking')
            setOppSpeaking(true)
            setOpenPanel('transcript')
            speak(turn.text, { rate: 0.95, pitch: 1.1 })
            setTimeout(() => setOppSpeaking(false), Math.min(turn.text.length * 55, 5000))

          } else if (turn.speaker === 'defence') {
            const label = role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'
            addMsg({ type: 'student', label, text: turn.text })
            setJudgeStatus('Defence Speaking')
            setOpenPanel('transcript')
            speak(turn.text, { rate: 0.9, pitch: 0.85 })

          } else if (turn.speaker === 'objection') {
            setObjOverlay({ type: turn.text, ruling: turn.ruling || 'Sustained' })
            gavel()
            addMsg({ type: 'bench', label: '⚠ Objection', text: `⚡ ${turn.text} — ${turn.ruling || 'Sustained'}`, subtext: '' })
            speak(`Objection! ${turn.ruling || 'Sustained'}`, { rate: 1.1, pitch: 1.2, interrupt: true })
            setTimeout(() => setObjOverlay(null), 3000)

          } else if (turn.speaker === 'verdict') {
            addMsg({ type: 'judge', label: 'Hon. Justice R.K. Krishnamurthy', text: turn.text })
            setJudgeQuote(`"${turn.text.substring(0, 120)}…"`)
            speak(turn.text, { rate: 0.78, pitch: 0.85, interrupt: true })
            gavel()
            setJudgeStatus('Verdict Delivered')
            setOpenPanel('transcript')
            if (turn.verdict) setVerdict({ grade: 'A', score: 85, verdict: turn.verdict })

          } else {
            addMsg({ type: 'system', text: turn.text })
          }
        }, turn.delay)
        demoTimeoutsRef.current.push(t)
      })

      const lastDelay = Math.max(...script.turns.map(t => t.delay), 0)
      const endT = setTimeout(() => {
        setDemoActive(false)
        setLocked(false)
        setJudgeStatus('Presiding')
        addMsg({ type: 'system', text: '✓ Demo complete. Click to argue to continue live.' })
      }, lastDelay + 3000)
      demoTimeoutsRef.current.push(endT)
    } catch {
      addMsg({ type: 'system', text: '⚠ Demo script failed to load.' })
      setDemoActive(false)
      setLocked(false)
    } finally {
      setDemoLoading(false)
    }
  }, [caseData, demoLoading, addMsg, speak, gavel, role])

  if (!caseData) return null
  const chargesStr = caseData.charges?.map((c: { section?: string }) => c.section).filter(Boolean).join(' · ') || caseData.case_type || ''
  const myColor = role === 'defence' ? '#6B8FD4' : '#D46B6B'
  const oppColor = role === 'defence' ? '#D46B6B' : '#6B8FD4'
  const oppName = role === 'defence' ? 'Adv. Priya Sharma' : 'Adv. Rajan Mehta'
  const demColor = DEMEANOR_COLOR[emotion.demeanor] || '#666'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* ── FULL-SCREEN BACKGROUND ── */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('/courtroom-bg.png')`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.25) 40%, rgba(0,0,0,.25) 70%, rgba(0,0,0,.75) 100%)', zIndex: 1 }} />

      {/* ── TOP BAR ── */}
      <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .5, delay: .2 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52,
          background: 'linear-gradient(180deg, rgba(0,0,0,.8) 0%, transparent 100%)', backdropFilter: 'blur(2px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.08em' }}>
            NYAYA<span style={{ color: '#E8E0D0' }}>AI</span>
          </span>
          <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 16 }}>|</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontFamily: 'DM Sans, sans-serif', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong style={{ color: 'rgba(255,255,255,.85)' }}>{caseData.case_title}</strong>
            {chargesStr && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,.4)' }}>— {chargesStr}</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: '#C9A84C', letterSpacing: '0.06em' }}>{fmt(sessionSeconds)}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontFamily: 'Space Grotesk, sans-serif' }}>Round {Math.min(round, MAX_ROUNDS)}/{MAX_ROUNDS}</span>
          {/* 15B: phase name */}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em' }}>
            {ROUND_PHASES[Math.min(round, MAX_ROUNDS)] || 'Closing'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Space Grotesk, sans-serif',
            ...(role === 'defence' ? { background: 'rgba(107,143,212,.2)', color: '#8BAEE8', border: '1px solid rgba(107,143,212,.35)' } : { background: 'rgba(212,107,107,.2)', color: '#E88B8B', border: '1px solid rgba(212,107,107,.35)' }) }}>
            {role}
          </span>
          {/* Demo mode toggle */}
          {demoActive ? (
            <motion.button onClick={stopDemo} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                border: '1px solid rgba(212,107,107,.5)', background: 'rgba(212,107,107,.15)', color: '#FF6B6B' }}>
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF4444', display: 'inline-block' }} />
              DEMO
            </motion.button>
          ) : (
            <motion.button onClick={startDemo} disabled={demoLoading} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: demoLoading ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                border: '1px solid rgba(201,168,76,.4)', background: 'rgba(201,168,76,.1)', color: '#C9A84C' }}>
              {demoLoading ? '⏳' : '▶'} DEMO
            </motion.button>
          )}
          {/* Mute toggle */}
          <motion.button onClick={toggleMute} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }} title={muted ? 'Unmute judge' : 'Mute judge'}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer',
              border: `1px solid ${muted ? 'rgba(212,107,107,.4)' : 'rgba(255,255,255,.15)'}`,
              background: muted ? 'rgba(212,107,107,.12)' : 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)' }}>
            {muted ? '🔇' : '🔊'}
          </motion.button>
          {/* Camera toggle */}
          <motion.button onClick={() => setCameraEnabled(e => !e)} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }} title={cameraEnabled ? 'Disable camera' : 'Enable camera'}
            style={{ height: 32, padding: '0 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600,
              border: `1px solid ${cameraEnabled ? 'rgba(212,60,60,.6)' : 'rgba(255,255,255,.15)'}`,
              background: cameraEnabled ? 'rgba(212,60,60,.18)' : 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)',
              color: cameraEnabled ? '#FF6B6B' : 'rgba(255,255,255,.5)' }}>
            {cameraEnabled
              ? <><motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4444', display: 'inline-block', flexShrink: 0 }} />REC</>
              : <>📷 CAM</>}
          </motion.button>
          <motion.button onClick={() => nav('/dashboard')} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.7)', background: 'rgba(0,0,0,.4)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', backdropFilter: 'blur(8px)' }}>
            ← Dashboard
          </motion.button>
        </div>
      </motion.div>

      {/* ── DEMO MODE BANNER ── */}
      <AnimatePresence>
        {demoActive && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'absolute', top: 52, left: 0, right: 0, zIndex: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '6px 0', background: 'rgba(201,168,76,.12)', borderBottom: '1px solid rgba(201,168,76,.25)', backdropFilter: 'blur(8px)' }}>
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif' }}>
              AUTO-PLAY DEMO — Watch the courtroom simulation unfold
            </span>
            <button onClick={stopDemo}
              style={{ fontSize: 10, padding: '2px 10px', borderRadius: 4, border: '1px solid rgba(201,168,76,.3)', color: '#C9A84C', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
              ■ Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── JUDGE CARD (center top) ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .4 }}
        style={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 20, width: 340 }}>
        <motion.div
          animate={judgeThinking || isSpeaking
            ? { boxShadow: ['0 8px 32px rgba(0,0,0,.6)', `0 8px 48px ${isSpeaking ? 'rgba(74,154,106,.35)' : 'rgba(201,168,76,.3)'}`, '0 8px 32px rgba(0,0,0,.6)'] }
            : { boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}
          transition={{ duration: 1.4, repeat: (judgeThinking || isSpeaking) ? Infinity : 0 }}
          style={{ borderRadius: 12, padding: '14px 20px', background: 'rgba(8,10,18,.88)', border: '1px solid rgba(201,168,76,.25)', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              {(judgeThinking || isSpeaking) && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: isSpeaking ? '#4A9A6A' : '#C9A84C', animation: 'pulse 1s infinite' }} />}
              Justice R.K. Krishnamurthy
              {isSpeaking && <span style={{ fontSize: 9, color: '#4A9A6A', marginLeft: 4 }}>● SPEAKING</span>}
            </div>
            {/* 15C: judge archetype badge */}
            {caseData?.judge_archetype && (() => {
              const archColor = ARCHETYPE_COLOR[caseData.judge_archetype] || '#C9A84C'
              return (
                <span title={caseData.judge_archetype_description} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', fontFamily: 'Space Grotesk, sans-serif', background: `${archColor}18`, border: `1px solid ${archColor}44`, color: archColor }}>
                  {caseData.judge_archetype}
                </span>
              )
            })()}
            {/* Replay TTS button */}
            <motion.button onClick={replay} whileHover={{ scale: 1.15 }} whileTap={{ scale: .9 }} title="Replay judge response"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: .6, padding: 0, lineHeight: 1 }}>
              🔁
            </motion.button>
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontStyle: 'italic', lineHeight: 1.55, color: 'rgba(255,255,255,.88)' }}>
            {judgeQuote}
          </div>
        </motion.div>
      </motion.div>

      {/* ── GAVEL ── */}
      <motion.div style={{ position: 'absolute', top: 78, zIndex: 21, fontSize: 22, left: 'calc(50% + 190px)', transformOrigin: 'bottom right' }}
        animate={gavelStrike ? { rotate: [0, -45, 8, 0] } : { rotate: 0 }}
        transition={{ duration: .38, ease: [.16,1,.3,1] }}>🔨</motion.div>

      {/* ── CASE METER (bottom-left, above camera) ── */}
      <AnimatePresence>
        {!cameraEnabled && (
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ position: 'absolute', bottom: 80, left: 16, zIndex: 25, width: 220 }}>
            <CaseMeter predictor={casePredictor} />
          </motion.div>
        )}
        {cameraEnabled && (
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ position: 'absolute', bottom: 80, left: 228, zIndex: 25, width: 220 }}>
            <CaseMeter predictor={casePredictor} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TACTICAL CHOICE CARDS (center-bottom overlay) ── */}
      <AnimatePresence>
        {tacticalChoices && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'fixed', bottom: 180, left: '50%', transform: 'translateX(-50%)',
              zIndex: 35, width: 400,
              borderRadius: 14, padding: '14px 14px 10px',
              background: 'rgba(6,8,16,.97)', border: '1px solid rgba(201,168,76,.35)',
              backdropFilter: 'blur(24px)', boxShadow: '0 16px 64px rgba(0,0,0,.85), 0 0 0 1px rgba(201,168,76,.1)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
                  Tactical Decision
                </span>
              </div>
              <button onClick={() => setTacticalChoices(null)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
            </div>
            <ChoiceCards choices={tacticalChoices} onSelect={handleChoiceSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CAMERA ANALYSIS PANEL (bottom-left) ── */}
      <AnimatePresence>
        {cameraEnabled && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            style={{ position: 'absolute', bottom: 80, left: 16, zIndex: 25, width: 200,
              borderRadius: 12, overflow: 'hidden',
              background: 'rgba(6,8,16,.92)', border: `1px solid ${camReady ? demColor + '55' : 'rgba(255,255,255,.12)'}`,
              backdropFilter: 'blur(16px)', boxShadow: `0 8px 32px rgba(0,0,0,.7), 0 0 20px ${camReady ? demColor + '22' : 'transparent'}` }}>

            {/* Video feed row */}
            <div style={{ position: 'relative', width: '100%', height: 110 }}>
              <video ref={videoRef} muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
              {/* Dark gradient over video */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(6,8,16,.85) 100%)' }} />
              {/* REC badge + analysis source */}
              {camReady
                ? <div style={{ position: 'absolute', top: 7, left: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,.6)', borderRadius: 4, padding: '2px 6px' }}>
                      <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3333', display: 'block', boxShadow: '0 0 5px #FF3333' }} />
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#FF7777', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.1em' }}>LIVE</span>
                    </div>
                    {modelsFailed
                      ? <div style={{ background: 'rgba(201,168,76,.65)', borderRadius: 4, padding: '2px 5px' }}>
                          <span style={{ fontSize: 7, fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.08em' }}>✦ GEMINI ONLY</span>
                        </div>
                      : demeanorSource && (
                          <div style={{ background: demeanorSource === 'gemini' ? 'rgba(74,154,106,.75)' : 'rgba(201,168,76,.65)', borderRadius: 4, padding: '2px 5px' }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.08em' }}>
                              {demeanorSource === 'gemini' ? '✦ AI' : '⚡ LOCAL'}
                            </span>
                          </div>
                        )
                    }
                  </div>
                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', flexDirection: 'column', gap: 6 }}>
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ fontSize: 20, display: 'block' }}>⏳</motion.span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'Space Grotesk, sans-serif' }}>Starting camera…</span>
                  </div>
              }
              {/* Demeanor label overlaid on video bottom */}
              {camReady && emotion.demeanor !== 'unknown' && (
                <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: demColor, fontFamily: 'Space Grotesk, sans-serif',
                    textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>
                    {emotion.demeanor === 'confident' ? '😌' : emotion.demeanor === 'nervous' ? '😰' : '🤔'} {emotion.demeanor}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: demColor, fontFamily: 'Space Grotesk, sans-serif' }}>{emotion.score}</span>
                </div>
              )}
            </div>

            {/* Analysis rows — only show if local models loaded */}
            {camReady && !modelsFailed && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Confidence bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,.4)', fontFamily: 'Space Grotesk, sans-serif' }}>CONFIDENCE</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: demColor }}>{emotion.score}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${emotion.score}%` }} transition={{ duration: .6 }}
                      style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${demColor}, ${demColor}bb)` }} />
                  </div>
                </div>

                {/* Stress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,.4)', fontFamily: 'Space Grotesk, sans-serif' }}>STRESS</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: emotion.stressLevel > 0.6 ? '#D46B6B' : emotion.stressLevel > 0.35 ? '#C9A84C' : '#4A9A6A' }}>
                      {Math.round(emotion.stressLevel * 100)}%
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${emotion.stressLevel * 100}%` }} transition={{ duration: .6 }}
                      style={{ height: '100%', borderRadius: 3, background: emotion.stressLevel > 0.6 ? 'linear-gradient(90deg,#D46B6B,#FF8888)' : emotion.stressLevel > 0.35 ? 'linear-gradient(90deg,#C9A84C,#E8C96A)' : 'linear-gradient(90deg,#4A9A6A,#6DBF8A)' }} />
                  </div>
                </div>

                {/* Raw expression pills */}
                {Object.keys(emotion.raw).length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,.4)', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 5 }}>EXPRESSIONS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(emotion.raw)
                        .sort(([,a],[,b]) => b - a)
                        .slice(0, 4)
                        .map(([label, val]) => {
                          const pct = Math.round((val as number) * 100)
                          if (pct < 3) return null
                          const pillColor = label === 'happy' || label === 'neutral' ? '#4A9A6A'
                            : label === 'fearful' || label === 'sad' ? '#D46B6B'
                            : label === 'surprised' ? '#C9A84C' : '#666'
                          return (
                            <span key={label} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10,
                              background: `${pillColor}18`, border: `1px solid ${pillColor}44`, color: pillColor,
                              fontFamily: 'Space Grotesk, sans-serif', textTransform: 'capitalize' }}>
                              {label} {pct}%
                            </span>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Stress alert */}
                {emotion.stressLevel > 0.6 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ borderRadius: 6, padding: '6px 8px', background: 'rgba(212,107,107,.12)', border: '1px solid rgba(212,107,107,.3)', fontSize: 9, color: '#E07070', lineHeight: 1.4 }}>
                    {difficulty === 'easy' ? '💡 High stress detected — a hint may help.' : '⚠ Stress elevated — stay composed.'}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AVATARS ── */}
      {/* Player */}
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .6, delay: .5 }}
        style={{ position: 'absolute', bottom: '28%', left: '18%', zIndex: 20 }}>
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: .94 }}
          onClick={() => !locked && setInputOpen(true)}
          style={{ cursor: locked ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            background: `radial-gradient(circle, ${myColor}44 0%, ${myColor}11 100%)`,
            border: `2px solid ${myColor}`, boxShadow: `0 0 24px ${myColor}55` }}>
            👨‍⚖️
            <motion.div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${myColor}` }}
              animate={{ scale: [1, 1.2, 1], opacity: [.6, 0, .6] }} transition={{ duration: 2.5, repeat: Infinity }} />
            {/* Demeanor dot on avatar */}
            {camReady && emotion.demeanor !== 'unknown' && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: demColor, border: '2px solid #0a0a0a', boxShadow: `0 0 6px ${demColor}` }} title={`Demeanor: ${emotion.demeanor}`} />
            )}
          </div>
          <motion.div animate={{ opacity: locked ? .4 : 1 }}
            style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(0,0,0,.75)', border: `1px solid ${myColor}55`, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 14 }}>{locked ? '🔒' : '👆'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>{locked ? 'Locked' : 'Click to Argue'}</span>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Opposing */}
      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .6, delay: .5 }}
        style={{ position: 'absolute', bottom: '28%', right: '18%', zIndex: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

          {/* Speech bubble when opposing is speaking */}
          <AnimatePresence>
            {oppSpeaking && (
              <motion.div initial={{ opacity: 0, y: 8, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .92 }}
                transition={{ duration: .2 }}
                style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, maxWidth: 220, padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(8,10,20,.92)', border: `1px solid ${oppColor}55`, backdropFilter: 'blur(12px)',
                  boxShadow: `0 4px 20px rgba(0,0,0,.6), 0 0 12px ${oppColor}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: oppColor, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: oppColor, fontFamily: 'Space Grotesk, sans-serif' }}>SPEAKING</span>
                </div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                  {[0, 1, 2, 3].map(i => (
                    <motion.div key={i} animate={{ height: ['6px', '18px', '6px'] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                      style={{ width: 4, borderRadius: 2, background: oppColor, flexShrink: 0 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={oppSpeaking ? { boxShadow: [`0 0 24px ${oppColor}55`, `0 0 48px ${oppColor}99`, `0 0 24px ${oppColor}55`] } : { boxShadow: `0 0 24px ${oppColor}55` }}
            transition={{ duration: 0.8, repeat: oppSpeaking ? Infinity : 0 }}
            style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              background: `radial-gradient(circle, ${oppColor}44 0%, ${oppColor}11 100%)`,
              border: `2px solid ${oppColor}` }}>
            👩‍⚖️
            <motion.div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${oppColor}` }}
              animate={{ scale: [1, 1.2, 1], opacity: [.6, 0, .6] }} transition={{ duration: 2.5, repeat: Infinity, delay: .8 }} />
          </motion.div>
          <div style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(0,0,0,.65)', border: `1px solid ${oppColor}44`, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontFamily: 'DM Sans, sans-serif' }}>{oppName}</span>
          </div>
          {/* 15D: Respond to Counsel button */}
          <AnimatePresence>
            {showReplyToCounsel && !locked && (
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                onClick={() => {
                  setShowReplyToCounsel(false)
                  setInputOpen(true)
                  // pre-set mode to direct_rebuttal
                }}
                whileHover={{ scale: 1.06 }} whileTap={{ scale: .94 }}
                style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${oppColor}55`, color: oppColor, background: `${oppColor}12`, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                ⚡ Respond to Counsel
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── WITNESS ── */}
      <AnimatePresence>
        {activeWitness && (
          <motion.div initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }}
            style={{ position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 20, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 8px',
              background: 'rgba(74,122,176,.3)', border: '2px solid rgba(74,122,176,.6)', boxShadow: '0 0 20px rgba(74,122,176,.4)' }}>🧑</div>
            <div style={{ padding: '4px 12px', borderRadius: 12, background: 'rgba(0,0,0,.7)', border: '1px solid rgba(74,122,176,.4)', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(74,122,176,.8)', fontFamily: 'Space Grotesk, sans-serif' }}>WITNESS</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#7AB0D8' }}>{activeWitness}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAW CHIPS ── */}
      {lawChips.length > 0 && (
        <div style={{ position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
          {lawChips.map((l, i) => {
            const code = (l as { code?: string }).code || ''
            const color = LAW_BADGE_COLOR[code] || '#8A8070'
            const ref = (l as { bare_act_reference?: string; section?: string }).bare_act_reference || `${code} §${(l as { section?: string }).section}`
            return <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: `1px solid ${color}55`, color, background: `${color}11`, backdropFilter: 'blur(8px)', cursor: 'pointer' }}>{ref}</span>
          })}
        </div>
      )}

      {/* ── BOTTOM BAR ── */}
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .5, delay: .3 }}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          {/* Evidence board button */}
          <motion.button onClick={() => togglePanel('evidence')} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(201,168,76,.35)', color: '#C9A84C', background: openPanel === 'evidence' ? 'rgba(201,168,76,.15)' : 'rgba(201,168,76,.06)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', backdropFilter: 'blur(8px)' }}>
            📋 EVIDENCE BOARD
          </motion.button>

          {/* Round dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
              <motion.div key={i} animate={{ scale: i === round - 1 ? [1, 1.4, 1] : 1 }} transition={{ duration: .4 }}
                style={{ width: 10, height: 10, borderRadius: '50%', background: i < round - 1 ? '#C9A84C' : i === round - 1 ? '#E8C96A' : 'rgba(255,255,255,.15)', boxShadow: i === round - 1 ? '0 0 10px #C9A84C' : 'none', transition: 'all .3s' }} />
            ))}
          </div>

          {/* Right icons + conclude */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {([
              { id: 'transcript', icon: '📜', label: 'Log', badge: transcript.length },
              { id: 'scores', icon: '📊', label: 'Score' },
              { id: 'witnesses', icon: '👤', label: 'Witness' },
            ] as { id: Panel; icon: string; label: string; badge?: number }[]).map(p => (
              <motion.button key={p.id} onClick={() => togglePanel(p.id)} whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }}
                style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer',
                  border: `1px solid ${openPanel === p.id ? 'rgba(201,168,76,.5)' : 'rgba(255,255,255,.12)'}`,
                  background: openPanel === p.id ? 'rgba(201,168,76,.15)' : 'rgba(0,0,0,.5)',
                  backdropFilter: 'blur(8px)', boxShadow: openPanel === p.id ? '0 0 14px rgba(201,168,76,.25)' : 'none' }}>
                <span style={{ fontSize: 14 }}>{p.icon}</span>
                <span style={{ fontSize: 7, color: openPanel === p.id ? '#C9A84C' : '#555', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{p.label}</span>
                {p.badge !== undefined && p.badge > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#C9A84C', color: '#000', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.badge > 99 ? '99' : p.badge}</span>
                )}
              </motion.button>
            ))}
            <motion.button onClick={() => nav('/closing')} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(201,168,76,.4)', color: '#C9A84C', background: 'rgba(201,168,76,.1)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', backdropFilter: 'blur(8px)' }}>
              📜 CLOSING
            </motion.button>
            <motion.button onClick={concludeSession} whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(212,107,107,.5)', color: '#E88B8B', background: 'rgba(192,60,60,.15)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', backdropFilter: 'blur(8px)' }}>
              ⚖ CONCLUDE
            </motion.button>
          </div>
        </div>
        {/* Ethics notice */}
        <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,.2)', padding: '4px 0 6px', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.04em', background: 'rgba(0,0,0,.6)' }}>
          📷 Camera used locally for demeanor feedback only. No video is recorded or transmitted.
        </div>
      </motion.div>

      {/* ── FLOATING PANELS ── */}
      <AnimatePresence>
        {openPanel && (
          <motion.div key={openPanel}
            initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ position: 'absolute', top: 60, right: 16, bottom: 160, width: 320, zIndex: 30, borderRadius: 16,
              background: 'rgba(6,8,16,.92)', border: '1px solid rgba(201,168,76,.18)', backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,.12)', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: '#C9A84C', letterSpacing: '0.08em' }}>
                {{ transcript: '📜 Transcript', scores: '📊 Scores', evidence: '📋 Evidence', witnesses: '👤 Witnesses' }[openPanel]}
              </span>
              <button onClick={() => setOpenPanel(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {openPanel === 'transcript' && <TranscriptPanel messages={transcript} typing={typing} />}

            {openPanel === 'scores' && (
              <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '20px 0', borderRadius: 10, border: '1px solid rgba(201,168,76,.15)', background: 'rgba(201,168,76,.05)' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 52, lineHeight: 1, color: '#C9A84C' }}>{overall}</div>
                  <div style={{ fontSize: 11, letterSpacing: '0.12em', marginTop: 4, color: '#8A8070' }}>OVERALL SCORE</div>
                </div>
                {Object.entries(scores).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 72, flexShrink: 0, color: '#8A8070', textTransform: 'capitalize' }}>
                      {{ logic: 'Logic', clarity: 'Clarity', proc: 'Procedure', cite: 'Citations', reb: 'Rebuttal' }[k] || k}
                    </span>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                      <motion.div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#C9A84C,#E8C96A)' }}
                        animate={{ width: `${v}%` }} transition={{ duration: .5 }} />
                    </div>
                    <span style={{ fontSize: 11, width: 24, textAlign: 'right', color: '#C9A84C' }}>{v}</span>
                  </div>
                ))}
                {/* Demeanor score row */}
                {camReady && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 72, flexShrink: 0, color: '#8A8070' }}>Demeanor</span>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                      <motion.div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${demColor},${demColor}aa)` }}
                        animate={{ width: `${emotion.score}%` }} transition={{ duration: .5 }} />
                    </div>
                    <span style={{ fontSize: 11, width: 24, textAlign: 'right', color: demColor }}>{emotion.score}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, textAlign: 'center', paddingTop: 8, color: '#8A8070', borderTop: '1px solid rgba(201,168,76,.1)' }}>
                  Bench Queries: <strong style={{ color: '#C9A84C' }}>{benchQueryCount}</strong> · Objections: <strong style={{ color: '#E07070' }}>{objectionCount}</strong>
                </div>
                {verdict && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{ borderRadius: 10, border: '1px solid rgba(201,168,76,.35)', padding: 16, textAlign: 'center', background: 'rgba(201,168,76,.08)' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, color: '#C9A84C', marginBottom: 4 }}>{verdict.verdict}</div>
                    <div style={{ fontWeight: 700, fontSize: 32, color: '#E8C96A' }}>{verdict.grade}</div>
                    <div style={{ fontSize: 11, color: '#8A8070', marginTop: 4 }}>Score: {verdict.score}/100</div>
                    <button onClick={() => nav('/evaluation')} style={{ marginTop: 12, fontSize: 12, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(201,168,76,.4)', color: '#C9A84C', background: 'rgba(201,168,76,.1)', cursor: 'pointer' }}>
                      Full Evaluation →
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {openPanel === 'evidence' && (
              <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                <div style={{ borderRadius: 10, padding: 16, background: 'linear-gradient(135deg,#3D2B1A,#2A1E0F)', border: '3px solid #5C3D1E', boxShadow: 'inset 0 2px 8px rgba(0,0,0,.5)', minHeight: 200 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {caseData.evidence_items?.map((ev: { type: string; title: string; admissibility: string }, i: number) => {
                      const angle = (i % 2 === 0 ? 1 : -1) * (2 + (i % 3) * 1.5)
                      const admColor = ev.admissibility === 'admissible' ? '#4A9A6A' : ev.admissibility === 'inadmissible' ? '#C05050' : '#FFA500'
                      return (
                        <div key={i} style={{ position: 'relative', width: 130, padding: 10, borderRadius: 4, cursor: 'pointer', transform: `rotate(${angle}deg)`, background: '#F5F0E8', border: `2px dashed ${admColor}88`, boxShadow: '2px 4px 12px rgba(0,0,0,.5)', transition: 'transform .2s' }}>
                          <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: admColor, boxShadow: `0 0 6px ${admColor}` }} />
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{EMOJI_MAP[ev.type] || '📋'}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.3, color: '#1A1A1A', marginBottom: 3 }}>{ev.title}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: admColor, marginTop: 4 }}>{ev.admissibility}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {openPanel === 'witnesses' && (
              <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select onChange={e => setActiveWitness(e.target.value || null)}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#E8E0D0', fontSize: 13, padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">— Select witness —</option>
                  {caseData.key_witnesses?.map((w: { name: string; role: string }) => (
                    <option key={w.name} value={w.name}>{w.name} ({w.role})</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => activeWitness && submitArgument(`Direct examination of ${activeWitness}`)}
                    style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(74,122,176,.3)', color: '#7AB0D8', background: 'rgba(74,122,176,.08)', cursor: 'pointer' }}>Direct</button>
                  <button onClick={() => activeWitness && submitArgument(`Cross examination of ${activeWitness}`)}
                    style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(192,80,80,.3)', color: '#E07070', background: 'rgba(192,80,80,.06)', cursor: 'pointer' }}>Cross</button>
                </div>
                {caseData.key_witnesses?.map((w: { name: string; role: string; testimony_summary?: string }) => (
                  <div key={w.name} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#E8E0D0', marginBottom: 2 }}>{w.name}</div>
                    <div style={{ color: '#7AB0D8', marginBottom: 4 }}>{w.role}</div>
                    <div style={{ color: '#8A8070' }}>{w.testimony_summary}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INPUT MODAL ── */}
      <AnimatePresence>
        {inputOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setInputOpen(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 80, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}>
            <motion.div
              initial={{ y: 60, opacity: 0, scale: .96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: .96 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              style={{ width: '100%', maxWidth: 680, borderRadius: 18, overflow: 'hidden',
                background: 'rgba(6,8,18,.96)', border: `1px solid ${myColor}44`,
                backdropFilter: 'blur(24px)', boxShadow: `0 32px 80px rgba(0,0,0,.85), 0 0 40px ${myColor}18` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${myColor}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    background: `radial-gradient(circle, ${myColor}44 0%, ${myColor}11 100%)`, border: `1.5px solid ${myColor}` }}>👨‍⚖️</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif' }}>{user ? `Adv. ${user.name}` : 'Adv. [You]'}</div>
                    <div style={{ fontSize: 10, color: myColor, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {role === 'defence' ? 'Defence Counsel' : 'Public Prosecutor'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setInputOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>✕</button>
              </div>
              {/* Selected choice banner */}
              {choiceSelected && (
                <div style={{ margin: '0 20px 8px', padding: '8px 12px', borderRadius: 8, background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.06em' }}>⚡ Strategy:</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontFamily: 'DM Sans, sans-serif' }}>{choiceSelected.label}</span>
                </div>
              )}
              <InputArea onSubmit={submitArgument} onObjection={raiseObjection} onHint={getHint}
                disabled={loading} locked={locked} showHint={difficulty === 'easy'} evidenceItems={caseData.evidence_items}
                sessionId={sessionId || undefined} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {benchModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: .88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .88, y: 24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ width: '100%', maxWidth: 520, borderRadius: 18, border: '1px solid rgba(201,168,76,.3)', padding: 32, background: 'rgba(8,12,24,.96)', backdropFilter: 'blur(20px)', boxShadow: '0 32px 80px rgba(0,0,0,.9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 28 }}>⚖</motion.span>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#C9A84C' }}>Bench Query</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>The court requires a response before you may proceed</div>
                </div>
              </div>
              <div style={{ borderRadius: 10, border: '1px solid rgba(255,165,0,.22)', padding: '14px 16px', marginBottom: 16, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6, background: 'rgba(255,165,0,.05)', color: '#E8E0D0' }}>
                {benchModal.query}
              </div>
              <textarea value={benchResponse} onChange={e => setBenchResponse(e.target.value)}
                placeholder="Your response to the court…" rows={3}
                style={{ width: '100%', borderRadius: 10, fontSize: 14, padding: '12px 14px', outline: 'none', resize: 'none', marginBottom: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.18)', color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <motion.button onClick={submitBenchResponse} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  style={{ fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(201,168,76,.4)', background: 'rgba(201,168,76,.14)', color: '#C9A84C', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.06em' }}>
                  Submit Response
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OBJECTION OVERLAY ── */}
      <AnimatePresence>
        {objOverlay && (
          <motion.div initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 60, textAlign: 'center', borderRadius: 16, padding: '32px 56px',
              background: 'rgba(10,6,2,.95)', border: '1px solid rgba(212,107,107,.45)', backdropFilter: 'blur(16px)',
              boxShadow: '0 32px 80px rgba(0,0,0,.9), 0 0 60px rgba(192,80,80,.15)' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: 8, fontFamily: 'Space Grotesk, sans-serif' }}>Objection</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: '#E07070', marginBottom: 12 }}>{objOverlay.type}</div>
            <motion.div initial={{ scale: .8 }} animate={{ scale: 1 }} transition={{ delay: .1, type: 'spring', stiffness: 500 }}
              style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 56, fontWeight: 700,
                color: objOverlay.ruling === 'Sustained' ? '#6DBF8A' : '#E07070',
                textShadow: `0 0 30px ${objOverlay.ruling === 'Sustained' ? 'rgba(109,191,138,.5)' : 'rgba(224,112,112,.5)'}` }}>
              {objOverlay.ruling}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ROLE SWITCH MODAL ── */}
      <AnimatePresence>
        {roleSwitchModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: .88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .88, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ maxWidth: 400, width: '90%', borderRadius: 18, padding: 32, background: 'rgba(8,12,24,.97)', border: '1px solid rgba(201,168,76,.3)', backdropFilter: 'blur(20px)', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,.9)' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔄</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: '#C9A84C', marginBottom: 8 }}>New Speaker Detected</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginBottom: 24, lineHeight: 1.6 }}>
                Switch role to <strong style={{ color: '#E8E0D0' }}>{role === 'defence' ? 'Prosecution' : 'Defence'}</strong>?
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
                  onClick={() => setRoleSwitchModal(false)}
                  style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.6)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>
                  Stay
                </motion.button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
                  onClick={() => { setRoleSwitchModal(false); nav('/dashboard') }}
                  style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(201,168,76,.4)', color: '#C9A84C', background: 'rgba(201,168,76,.12)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                  Yes, Switch Role
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── POST-SESSION DEBRIEF OVERLAY ── */}
      <AnimatePresence>
        {debrief && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(12px)', overflowY: 'auto', padding: 24 }}>
            <motion.div initial={{ scale: .9, y: 32 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .9, y: 32 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{ width: '100%', maxWidth: 640, borderRadius: 20, background: 'rgba(8,12,24,.98)', border: '1px solid rgba(201,168,76,.25)', backdropFilter: 'blur(24px)', boxShadow: '0 40px 100px rgba(0,0,0,.95)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid rgba(201,168,76,.12)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C', marginBottom: 4 }}>Session Debrief</div>
                <div style={{ fontSize: 13, color: '#8A8070' }}>Hon. Justice R.K. Krishnamurthy's Assessment</div>
              </div>

              <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Grade + Badge */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '20px 0', borderRadius: 12, border: '1px solid rgba(201,168,76,.2)', background: 'rgba(201,168,76,.06)' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 64, lineHeight: 1, color: '#E8C96A' }}>{debrief.grade}</div>
                    <div style={{ fontSize: 11, letterSpacing: '0.12em', color: '#8A8070', marginTop: 4 }}>FINAL GRADE</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '20px 16px', borderRadius: 12, border: '1px solid rgba(201,168,76,.15)', background: 'rgba(201,168,76,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ fontSize: 32 }}>🏅</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif', lineHeight: 1.3 }}>{debrief.badge}</div>
                  </div>
                </div>

                {/* Ruling */}
                <div style={{ borderRadius: 10, border: '1px solid rgba(255,165,0,.2)', padding: '14px 18px', background: 'rgba(255,165,0,.04)' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#C9A84C', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>COURT RULING</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,.85)' }}>{debrief.ruling}</div>
                </div>

                {/* Scores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 2 }}>PERFORMANCE SCORES</div>
                  {Object.entries(scores).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, width: 80, color: '#8A8070', textTransform: 'capitalize' }}>{{ logic: 'Logic', clarity: 'Clarity', proc: 'Procedure', cite: 'Citations', reb: 'Rebuttal' }[k] || k}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#C9A84C,#E8C96A)', width: `${v}%`, transition: 'width .6s' }} />
                      </div>
                      <span style={{ fontSize: 12, width: 28, textAlign: 'right', color: '#C9A84C' }}>{v}</span>
                    </div>
                  ))}
                  {camReady && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, width: 80, color: '#8A8070' }}>Demeanor</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${demColor},${demColor}aa)`, width: `${emotion.score}%`, transition: 'width .6s' }} />
                      </div>
                      <span style={{ fontSize: 12, width: 28, textAlign: 'right', color: demColor }}>{emotion.score}</span>
                    </div>
                  )}
                </div>

                {/* Emotion timeline SVG */}
                {debrief.emotionTimeline.length > 1 && (
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>CONFIDENCE TIMELINE</div>
                    <div style={{ borderRadius: 10, border: '1px solid rgba(201,168,76,.12)', padding: '12px 16px', background: 'rgba(0,0,0,.3)' }}>
                      <svg width="100%" height="60" viewBox={`0 0 ${debrief.emotionTimeline.length * 20} 60`} preserveAspectRatio="none">
                        <polyline
                          points={debrief.emotionTimeline.map((v, i) => `${i * 20},${60 - (v / 100) * 50}`).join(' ')}
                          fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline
                          points={[`0,60`, ...debrief.emotionTimeline.map((v, i) => `${i * 20},${60 - (v / 100) * 50}`), `${(debrief.emotionTimeline.length - 1) * 20},60`].join(' ')}
                          fill="rgba(201,168,76,.12)" stroke="none" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Improvement tips */}
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>3 IMPROVEMENT TIPS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {debrief.tips.map((tip, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{['💡', '📚', '⚖'][i] || '•'}</span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                    onClick={() => nav('/dashboard')}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}>
                    ← Dashboard
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                    onClick={() => nav('/evaluation')}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(201,168,76,.4)', color: '#C9A84C', background: 'rgba(201,168,76,.1)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                    Full Evaluation →
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .sel-field{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(201,168,76,.2);border-radius:6px;color:#E8E0D0;font-size:13px;padding:8px 12px;outline:none;cursor:pointer}
        .sel-field option{background:#0A0F1E}
      `}</style>
    </motion.div>
  )
}
