# NyayaAI — AI Courtroom Simulation for Indian Law Students

> Argue real cases under **BNS, BNSS & BSA** — India's new criminal codes (effective July 1, 2024).  
> Face an AI judge with a persistent personality, cross-examine witnesses, raise objections, and get scored on every argument across a strict 5-round trial.

---

## What is NyayaAI?

NyayaAI is a full-stack courtroom simulation platform built for law students. It replaces passive reading with active practice — you step into the role of Defence Counsel or Public Prosecutor, argue a case grounded in real Indian landmark judgments, and receive real-time feedback from an AI judge powered by Gemini 2.5 Flash.

Every ruling, citation, and evaluation is grounded exclusively in **BNS / BNSS / BSA** — never IPC, CrPC, or IEA.

---

## Features

### Core Simulation
- **AI Judge with Personality** — Justice R.K. Krishnamurthy has one of 4 persistent archetypes (Pragmatist, Constitutionalist, Empathetic, Unpredictable) that shapes every ruling, bench query, and verdict throughout the session
- **Strict 5-Round Trial** — Opening Statements → Evidence Examination → Witness Examination → Rebuttals → Closing Arguments, each with distinct judge and opposing counsel behavior
- **Opposing Counsel** — AI plays the other side with aggression that scales from measured (Round 1) to relentless (Round 5)
- **Lawyer-vs-Lawyer Confrontation** — After opposing counsel responds, a "Respond to Counsel" button lets you engage in direct back-and-forth exchanges without waiting for the judge
- **Tactical Choice Cards** — 3 strategic options appear before your very first argument and after every exchange, contextualised to the current round's phase
- **Objection System** — Raise objections (Hearsay, Relevance, etc.); judge rules Sustained/Overruled with BSA citations; opposing counsel raises objections more aggressively in later rounds
- **Witness Examination** — Direct and cross-examine AI-played witnesses
- **Bench Queries** — Judge interrupts when arguments have critical flaws

### Real Case Grounding
- Every generated case is structurally based on a real Indian landmark judgment (Nanavati v. State of Maharashtra, Bachan Singh v. State of Punjab, Vishaka v. State of Rajasthan, Hussainara Khatoon v. State of Bihar, Maneka Gandhi v. Union of India, and more)
- The `based_on` field is shown in the Pre-Trial preparation room so students know which precedent they are practising

### Workflow
- **Pre-Trial Preparation Room** — Read the case file, see the landmark case it's based on, the judge's archetype, highlight evidence, plan strategy before entering court
- **Courtroom** — Full-screen immersive simulation with photo background
- **Closing Argument** — Formal closing submission → AI generates opposing closing + dramatic verdict document
- **Post-Session Debrief** — Grade, badge, confidence timeline chart, 3 improvement tips

### Intelligence
- **Gemini Vision Demeanor Analysis** — Webcam frame sent to Gemini on each submission; reads posture, eye contact, expression
- **face-api.js Fallback** — Local ML (tinyFaceDetector + faceExpressionNet) runs continuously as backup
- **Stress Detection** — Rolling stress average adjusts judge difficulty in real time
- **RAG Legal Engine** — ChromaDB + sentence-transformers grounds every response in actual BNS/BNSS/BSA text
- **Judge TTS** — Web Speech API reads judge responses aloud (en-IN, rate 0.88)
- **Voice Input** — Web Speech API for hands-free argument submission

### Presentation
- **Demo Mode** — Auto-plays a pre-scripted session (Gemini-generated) for hackathon presentations
- **Presentation Page** — QR code to try the live app, stat cards, user flow, tech stack — designed for projector display
- **Dual-Student Mode** — face-api detects face switch, prompts role swap for two students sharing one device

### Ethics & Transparency
- **Bias Audit** — Every evaluation includes a bias audit confirming the score was based purely on legal arguments
- **Ethics Page** — Documents camera privacy, data minimisation, AI transparency, and legal framework integrity
- **AI Source Badge** — Every demeanor reading shows whether it came from Gemini Vision (✦ AI) or local face-api.js (⚡ LOCAL)

---

## Pages

| Route | Page |
|---|---|
| `/` | Landing — login / register |
| `/dashboard` | Dashboard — stats, skill radar, badges, start case |
| `/pretrial` | Pre-Trial Preparation Room (shows landmark case + judge archetype) |
| `/courtroom` | Courtroom simulation (5-round, archetype judge, tactical cards) |
| `/closing` | Closing argument + formal verdict document |
| `/evaluation` | Full evaluation report |
| `/leaderboard` | Leaderboard |
| `/demo` | Demo mode auto-play (no login required) |
| `/ethics` | AI ethics & privacy policy |
| `/present` | Hackathon presentation page with QR code |

---

## Tech Stack

### Frontend (`nyayaai/nyaya-ui/`)
| | |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 8 |
| Routing | React Router v7 |
| State | Zustand v5 |
| Animation | Framer Motion v12, @react-spring/web v10 |
| Styling | Inline styles (layout-critical) + Tailwind v4 |
| Gestures | @use-gesture/react v10 |
| Scroll | Lenis v1 |
| Icons | lucide-react |
| ML | face-api.js (CDN) |
| Fonts | Cormorant Garamond, Playfair Display, DM Sans, Space Grotesk |

### Backend (`nyayaai/backend/`)
| | |
|---|---|
| Framework | FastAPI 0.111 |
| AI | Gemini 2.5 Flash (google-generativeai SDK) |
| RAG | ChromaDB 0.5 + sentence-transformers 3.0 |
| Auth | JWT (python-jose + passlib bcrypt) |
| DB | SQLite via SQLAlchemy 2.0 async + aiosqlite |
| Server | Uvicorn 0.30 |

---

## Project Structure

```
nyayaai/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan, CORS
│   ├── .env                     # GEMINI_API_KEY (not committed)
│   ├── models/
│   │   ├── database.py          # SQLAlchemy models + async engine
│   │   └── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── auth.py              # Register / login / JWT
│   │   ├── cases.py             # Case generation (landmark grounding)
│   │   ├── courtroom.py         # Argue, objection, witness, bench query, closing, opening-cards
│   │   ├── evaluation.py        # Session evaluation + skill radar
│   │   ├── demeanor.py          # Gemini Vision demeanor analysis
│   │   ├── evidence.py          # Evidence board
│   │   └── leaderboard.py       # Leaderboard
│   ├── services/
│   │   ├── llm_service.py       # All Gemini calls — judge (archetype+phase aware),
│   │   │                        #   opposing counsel (aggression scaling), tactical cards,
│   │   │                        #   opening cards, case predictor, eval, demeanor, demo
│   │   ├── rag_service.py       # ChromaDB indexing + law search
│   │   ├── case_engine.py       # RAG-grounded judge response (round + archetype aware)
│   │   ├── judge_engine.py      # Per-session state: 5-round phases, archetype, aggression level
│   │   └── live_monitor.py      # Agentic bench query monitor
│   └── data/
│       └── new_criminal_laws/   # BNS, BNSS, BSA key sections (txt)
└── nyaya-ui/
    ├── index.html               # face-api.js CDN script tag here
    ├── public/
    │   └── courtroom-bg.png     # Courtroom background photo
    └── src/
        ├── api/client.ts        # All API calls + TypeScript types (incl. getOpeningCards)
        ├── store/session.ts     # Zustand store — ROUND_PHASES, MAX_ROUNDS exported
        ├── hooks/
        │   ├── useCamera.ts     # Webcam + face-api.js + captureFrame()
        │   └── useTTS.ts        # Web Speech API TTS
        ├── components/
        │   ├── Navbar.tsx
        │   ├── TranscriptPanel.tsx
        │   ├── InputArea.tsx
        │   ├── CaseMeter.tsx    # Live win-probability meter
        │   ├── ChoiceCards.tsx  # Tactical decision cards (phase-aware)
        │   └── ParticleBackground.tsx
        └── pages/
            ├── Landing.tsx
            ├── Dashboard.tsx
            ├── PreTrial.tsx     # Shows based_on landmark + judge archetype
            ├── Courtroom.tsx    # 5-round, archetype badge, tactical cards from round 1,
            │                    #   "Respond to Counsel" button, phase name in top bar
            ├── ClosingArgument.tsx
            ├── Evaluation.tsx
            ├── Leaderboard.tsx
            ├── Demo.tsx
            ├── Ethics.tsx
            └── Present.tsx
```

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- A Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com)

### 1. Backend

```bash
cd nyayaai

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r backend/requirements.txt
pip install google-genai      # new SDK (replaces google-generativeai)

# Edit backend/.env:
# GEMINI_API_KEY=your_key_here

# Start the server (from nyayaai/ directory)
python -m uvicorn backend.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`  
API docs at `http://localhost:8000/docs`

### 2. Frontend

```bash
cd nyayaai/nyaya-ui
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`  
Vite proxies `/api` → `http://localhost:8000`

---

## Environment Variables

`nyayaai/backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=any_random_string_for_jwt
DATABASE_URL=sqlite+aiosqlite:///./nyayaai.db
CHROMA_DB_PATH=./data/chromadb
```

---

## Legal Framework

NyayaAI operates exclusively under India's new criminal codes:

| Code | Full Name | Replaces |
|---|---|---|
| **BNS** | Bharatiya Nyaya Sanhita | Indian Penal Code (IPC) |
| **BNSS** | Bharatiya Nagarik Suraksha Sanhita | Code of Criminal Procedure (CrPC) |
| **BSA** | Bharatiya Sakshya Adhiniyam | Indian Evidence Act (IEA) |

The AI is hard-constrained to never cite IPC, CrPC, or IEA section numbers.

---

## Landmark Cases Used

| Case Type | Landmark Reference |
|---|---|
| Murder | Nanavati v. State of Maharashtra, AIR 1962 SC 605 |
| Death Penalty | Bachan Singh v. State of Punjab, AIR 1980 SC 898 |
| Harassment | Vishaka v. State of Rajasthan, AIR 1997 SC 3011 |
| Bail / Speedy Trial | Hussainara Khatoon v. State of Bihar, AIR 1979 SC 1360 |
| Fundamental Rights | Maneka Gandhi v. Union of India, AIR 1978 SC 597 |
| Cheating | Hridaya Ranjan Prasad Verma v. State of Bihar, AIR 2000 SC 2341 |
| Dowry | Shanti v. State of Haryana, AIR 1991 SC 1226 |
| Fraud | S.W. Palanitkar v. State of Bihar, AIR 2002 SC 1049 |

---

## Judge Archetypes

Each session is assigned one of four judge personalities at case generation time:

| Archetype | Behaviour |
|---|---|
| **Pragmatist** | Focuses on hard facts; dismisses procedural technicalities; rewards concise evidence-grounded arguments |
| **Constitutionalist** | Scrutinises every argument through Articles 14, 19, 21; rewards constitutional law arguments |
| **Empathetic** | Weighs victim impact and proportionality; rewards arguments addressing justice alongside law |
| **Unpredictable** | Shifts stance between rounds; keeps both sides on edge; no fixed pattern |

---

## Camera & Privacy

- Webcam access is **optional** — all features work without it
- Video frames are processed **client-side** by face-api.js (continuous analysis)
- On argument submission, one frame is sent to **Gemini Vision** for demeanor analysis
- **No video is recorded or stored** — frames are discarded immediately after analysis
- Camera can be toggled on/off at any time via the `📷 CAM` button in the courtroom

---

*Educational simulation only. Not legal advice.*
