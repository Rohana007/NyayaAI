# How NyayaAI Works

A technical walkthrough of every layer — from login to verdict.

---

## The Big Picture

```
Browser (React + Vite)          Backend (FastAPI)           External
─────────────────────           ─────────────────           ────────
Landing / Login
    │ JWT token
    ▼
Dashboard ──── POST /cases/generate ──────► CaseEngine
    │                                           │
    │                                    RAG search (ChromaDB)
    │                                           │
    │                                    Gemini 2.5 Flash
    │                                           │
    │◄──── CaseData JSON (+ based_on, judge_archetype) ─────┘
    │
PreTrial (read case, landmark ref, archetype, plan)
    │
    │ GET /courtroom/opening-cards/{session_id}
    │◄──── 3 tactical choice cards (phase: Opening Statements)
    │
Courtroom ──── POST /courtroom/argue ────► JudgeEngine (round 1–5)
    │                                           │
    │                                    RAG → relevant laws
    │                                           │
    │                                    Gemini (judge + opposing, archetype + phase aware)
    │                                           │
    │◄──── judge_response + opposing_response + tactical_choices + case_predictor ──┘
    │
    │  (on submit) ── POST /demeanor ─────► Gemini Vision
    │◄──── demeanor score ────────────────────────┘
    │
ClosingArgument ── POST /courtroom/closing ► Gemini
    │◄──── verdict document ──────────────────────┘
    │
Evaluation ─── POST /evaluation/generate ─► Gemini
    │◄──── grade + feedback + citations ──────────┘
```

---

## 1. Authentication

**Files:** `backend/routers/auth.py`, `store/session.ts`

- User registers or logs in via `POST /api/v1/auth/register` or `/auth/login`
- Backend hashes the password with `bcrypt` (passlib), stores in SQLite via SQLAlchemy async
- Returns a **JWT token** (python-jose, HS256, 7-day expiry)
- Frontend stores the token in `localStorage` as `nyaya_token`
- Every subsequent API call sends `Authorization: Bearer <token>` in the header
- Zustand session store (`store/session.ts`) persists `user`, `token`, `sessionId`, `caseData` to `localStorage` via the `persist` middleware — so a page refresh doesn't log you out

---

## 2. Case Generation

**Files:** `backend/routers/cases.py`, `services/case_engine.py`, `services/llm_service.py`, `services/rag_service.py`

When you click "Generate Case" on the Dashboard:

1. Frontend sends `POST /api/v1/cases/generate` with `{ case_type, court_level, difficulty, role, ... }`
2. `CaseEngine.generate_enriched_case()` runs two things in sequence:
   - **Gemini call** — `LLMService.generate_case()` sends a structured prompt asking for a full case JSON (title, charges, facts, witnesses, evidence items, legal sections, prosecution/defence briefs)
   - **RAG enrichment** — `IndianLawRAG.search_relevant_laws()` queries ChromaDB with the case type + charge sections, returns the top 6 matching law excerpts from the BNS/BNSS/BSA text files
3. The enriched case is saved to SQLite as a `Session` row
4. The full `CaseData` JSON is returned to the frontend
5. Zustand stores it in `caseData` + `sessionId` — this is the single source of truth for the entire simulation

### Real Case Grounding (15A)

`LLMService` contains a `LANDMARK_CASES` dictionary that maps each case type (murder, theft, harassment, bail, fraud, dowry, etc.) to a real Indian Supreme Court judgment — citation, key holding, and relevant BNS sections. When `generate_case()` is called, the matching landmark is injected into the Gemini prompt so the generated case is structurally modelled on that precedent.

The returned case JSON includes two extra fields:
- `based_on` — the landmark citation (e.g. "Nanavati v. State of Maharashtra, AIR 1962 SC 605")
- `judge_archetype` — one of four personality types assigned at generation time (see Judge Archetypes below)

Both fields are stored in `case_data` in the database and surfaced in the Pre-Trial room.

### RAG (Retrieval-Augmented Generation)

The three law files in `backend/data/new_criminal_laws/` are indexed into **ChromaDB** on first startup using `sentence-transformers` (all-MiniLM-L6-v2). Each chunk is a law section with its code, section number, and text. When a query comes in, ChromaDB does a cosine similarity search and returns the most relevant sections. These are injected into every Gemini prompt so the AI always cites real law text, not hallucinated sections.

---

## 3. Pre-Trial Room

**File:** `pages/PreTrial.tsx`

A 5-tab preparation screen before entering the courtroom:
- **Brief** — shows the case background, prosecution brief, defence brief, the landmark case it is based on (`based_on`), and the judge's archetype with a description of what to expect
- **Evidence** — lists all evidence items with admissibility status
- **Witnesses** — key witnesses with their roles and testimony summaries
- **Laws** — the relevant BNS/BNSS/BSA sections for this case
- **Notes** — free-text strategy notepad (stored in local component state)

No API calls here — everything comes from `caseData` already in the Zustand store. Clicking "All Rise — Enter Courtroom" navigates to `/courtroom`.

---

## 4. The Courtroom Loop

**Files:** `pages/Courtroom.tsx`, `backend/routers/courtroom.py`, `services/case_engine.py`, `services/judge_engine.py`

### 5-Round Structure (15B)

Every session is divided into exactly **5 rounds**, each mapped to a named phase:

| Round | Phase |
|---|---|
| 1 | Opening Statements |
| 2 | Evidence Examination |
| 3 | Witness Examination |
| 4 | Rebuttals |
| 5 | Closing Arguments |

`ROUND_PHASES` and `MAX_ROUNDS = 5` are exported from both `judge_engine.py` (backend) and `store/session.ts` (frontend) so both sides share the same constants. The current phase name is displayed in the courtroom top bar. After round 5, `JudgeEngine.advance_round()` sets `session_concluded = True` and the `/argue` endpoint returns a 400 error blocking further submissions.

The phase is passed to every Gemini call so the judge's tone and the opposing counsel's strategy shift appropriately across rounds.

### Opening Tactical Cards (15E)

When the Courtroom page mounts, before the student has submitted a single argument, the frontend calls `GET /courtroom/opening-cards/{session_id}`. The backend calls `LLMService.generate_opening_tactical_choices()` which generates 3 strategic options tailored to the case type and the student's role (defence / prosecution) for the Opening Statements phase.

These cards appear immediately so the student has strategic guidance from the very first argument. If the Gemini call fails, a hardcoded fallback set of 3 phase-appropriate cards is returned — so cards are always present.

### Each Round

```
Student clicks avatar → Input modal opens
    │
Student types argument (or uses voice input)
    │
[Optional] Camera frame captured → POST /demeanor → Gemini Vision
    │
POST /courtroom/argue
    {
      session_id,
      content: argument + demeanor context,
      argument_type: 'argue' | 'rebuttal' | 'examine' | 'direct_rebuttal',
      witness_name (if examining)
    }
    │
Backend:
  1. RAG search on the argument text → top 5 relevant law sections
  2. LLM call 1: get_opposing_counsel_response() → counter-argument (aggression-scaled)
  3. LLM call 2: get_grounded_judge_response() → ruling + cited laws + optional bench_query
  4. LLM call 3: generate_tactical_choices() → 3 next-move cards for the student
  5. LLM call 4: predict_case_outcome() → win probability + momentum signal
  6. Auto-objection check (probability scales with aggression level)
  7. scores_update delta calculated
  8. JudgeEngine.advance_round() called — round increments, aggression level updates
  9. Everything saved to DB
    │
Frontend receives:
  - opposing_response → shown as opposing counsel message
  - judge_response → shown as judge message + read aloud via TTS
  - bench_query (if triggered) → locks input, opens bench query modal
  - cited_laws → shown as law chips at bottom of screen
  - scores_update → Zustand updates score bars
  - tactical_choices → new 3-card set replaces previous cards
  - case_predictor → updates live win-probability meter
```

### Judge Archetypes (15C)

At case generation, one of four archetypes is assigned and stored in `case_data.judge_archetype`. The `JudgeEngine` reads this from the session on first access and holds it for the entire session. `get_judge_persona()` combines the archetype with the difficulty level into a single persona string that is injected into every judge Gemini call.

| Archetype | Behaviour |
|---|---|
| Pragmatist | Focuses on hard facts; dismisses procedural technicalities; rewards concise evidence-grounded arguments |
| Constitutionalist | Scrutinises every argument through Articles 14, 19, 21; rewards constitutional law arguments |
| Empathetic | Weighs victim impact and proportionality; rewards arguments addressing justice alongside law |
| Unpredictable | Shifts stance between rounds; keeps both sides on edge; no fixed pattern |

The archetype badge is shown on the judge card in the courtroom and in the Pre-Trial Brief tab.

### Lawyer-vs-Lawyer Dialogue (15D)

After opposing counsel responds, a "⚡ Respond to Counsel" button appears. Clicking it submits an argument with `argument_type: "direct_rebuttal"`, which signals to the judge and opposing counsel LLM prompts that this is a direct exchange rather than a fresh submission. This allows back-and-forth confrontation without waiting for the judge to speak.

Opposing counsel aggression scales with the round number — `aggression_level` in `JudgeEngine` starts at 1 and increments each round (capped at 5). This value is passed to `get_opposing_counsel_response()` which adjusts the tone and length of the counter-argument. The auto-objection probability also scales with aggression: `0.10 + (aggression_level - 1) * 0.06`, ranging from 10% in round 1 to 34% in round 5.

### Tactical Choice Cards (15E — continued)

After each `/argue` response, `generate_tactical_choices()` returns a new set of 3 cards contextualised to the current round's phase, the judge's last response, and the conversation so far. The cards are always present — if the Gemini call fails, the frontend falls back to a set of phase-named generic cards so the student is never left without options.

### Bench Queries

If the judge detects a critical flaw (logical inconsistency, missing evidence, procedural violation), `bench_query.triggered = true`. The frontend:
- Locks the input
- Shows a modal with the judge's question
- Student must respond before proceeding
- Response goes to `POST /courtroom/respond-bench-query`

### Objections

`POST /courtroom/objection` with `{ session_id, objection_type }`. Gemini rules Sustained or Overruled with a BSA citation. The ruling flashes as a full-screen overlay.

### Witness Examination

Student selects a witness from the Witnesses panel, clicks Direct or Cross. This sets `activeWitness` in Zustand and submits an argument with `argument_type: 'examine'`. The backend calls `get_witness_response()` which plays the witness in character, consistent with their prior testimony summary.

---

## 5. Demeanor Analysis

**Files:** `hooks/useCamera.ts`, `hooks/useTTS.ts`, `backend/routers/demeanor.py`, `services/llm_service.py`

Two systems run in parallel:

### face-api.js (continuous, local)
- Runs in the browser — no server needed
- Models loaded from CDN (tinyFaceDetector + faceExpressionNet)
- Runs every 2 seconds via `setInterval`
- Detects: happy, sad, angry, fearful, disgusted, surprised, neutral
- Maps expressions to courtroom demeanor: confident / nervous / uncertain
- Maintains a rolling stress average over the last 5 readings
- If no face detected for 3+ consecutive readings → triggers role switch prompt (dual-student mode)

### Gemini Vision (on submit)
- When student submits an argument, `captureFrame()` grabs a single JPEG frame from the video element
- Sent as base64 to `POST /api/v1/demeanor`
- Gemini Vision analyzes posture, eye contact, expression
- Returns `{ demeanor, score, stress_level, feedback }`
- If Gemini succeeds → `✦ AI` badge shown; if it fails → falls back to face-api result → `⚡ LOCAL` badge

The demeanor result is appended to the argument text before sending to the judge:
```
[Student appeared nervous during this submission. Factor this into your feedback.]
```
This makes the judge's response adapt to the student's visible confidence level.

---

## 6. Text-to-Speech

**File:** `hooks/useTTS.ts`

Uses the browser's built-in **Web Speech API** (`SpeechSynthesis`). No external service.

- Voice: prefers `en-IN` voices, falls back to any English voice
- Rate: 0.88 (slightly slower than default for clarity)
- Pitch: 0.95 (slightly lower, more authoritative)
- Every judge response is automatically spoken
- Mute toggle in the top bar silences it
- Replay button (🔁) on the judge card re-reads the last response
- The judge card pulses green while speaking

---

## 7. Closing Argument & Verdict

**Files:** `pages/ClosingArgument.tsx`, `backend/routers/courtroom.py`

Student writes their closing argument and submits it to `POST /courtroom/closing`. Gemini generates:
- Opposing counsel's closing (2-3 sentences)
- Judge's dramatic verdict speech
- Verdict: Convicted / Acquitted / Partially Convicted / Bail Granted / Case Dismissed
- Legal reasoning with BNS/BNSS/BSA citations
- Key finding (the single decisive factor)
- Grade + overall score

This is rendered as a formal cream-paper judgment document with an animated verdict stamp.

---

## 8. Evaluation

**Files:** `pages/Evaluation.tsx`, `backend/routers/evaluation.py`

`POST /evaluation/generate` sends the full conversation transcript + relevant laws to Gemini. It returns scores across 5 axes:

| Axis | What it measures |
|---|---|
| Legal Accuracy | Correct BNS/BNSS/BSA citations |
| Argument Structure | Logic, flow, coherence |
| Evidence Usage | How well evidence was deployed |
| Procedural Compliance | Following court procedure |
| Articulation | Clarity and persuasiveness |

Each feedback point includes the exact law section it references. A bias audit field confirms the evaluation was based purely on legal arguments.

---

## 9. Demo Mode

**Files:** `pages/Demo.tsx`, `backend/routers/courtroom.py`

No login required. Gemini generates a complete pre-scripted session JSON with 8-10 turns, each with a `delay` in milliseconds. The frontend plays them back with `setTimeout`, showing each turn in sequence — arguments, objection flash, bench query, verdict. A hardcoded fallback script (murder + theft cases) is always available so demo mode never crashes if Gemini is unavailable.

---

## 10. State Management

**File:** `store/session.ts`

Zustand store with two layers:

**Persisted** (survives page refresh, stored in `localStorage`):
- `user`, `token` — auth
- `sessionId`, `caseData` — current case
- `role`, `difficulty` — session config

**Runtime** (reset on new session via `resetRuntime()`):
- `transcript` — all messages
- `scores` — live score bars
- `round`, `argMode`, `activeWitness`
- `benchQueryCount`, `objectionCount`, `sessionSeconds`

`ROUND_PHASES` (the round→phase name map) and `MAX_ROUNDS = 5` are exported from `store/session.ts` so any component can reference the phase name for the current round without hardcoding strings.

All components that read from the store use `useShallow` to prevent infinite re-render loops when selecting multiple fields.

---

## 11. API Layer

**File:** `api/client.ts`

Single `req<T>()` function handles all HTTP calls:
- Attaches JWT from `localStorage`
- Handles empty responses (guards against blank body crashes)
- Parses JSON safely, throws typed errors
- All API namespaces: `authApi`, `casesApi`, `courtroomApi`, `evaluationApi`, `demeanorApi`, `leaderboardApi`
- `courtroomApi.getOpeningCards(sessionId)` — fetches tactical cards before the first argument

Vite proxies all `/api` requests to `http://localhost:8000` in development, so there are no CORS issues during dev.

---

## 12. Running It

```bash
# Terminal 1 — Backend (from nyayaai/ directory)
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (from nyayaai/nyaya-ui/ directory)
npm run dev -- --port 3000
```

On first backend start, the RAG index is built automatically from the law text files. This takes ~10 seconds. After that it's instant.

API docs available at `http://localhost:8000/docs`.

---

## Legal Compliance

Every Gemini prompt includes a hard constraint block (`LAW_FRAMEWORK_NOTE`) that:
- Lists the BNS/BNSS/BSA codes and their IPC/CrPC/IEA equivalents
- Explicitly forbids citing IPC, CrPC, or IEA section numbers
- Is injected into every single LLM call — case generation, judge responses, objection rulings, evaluation, demeanor feedback, demo scripts

This ensures the AI never accidentally uses the old law codes.

## The Big Picture

```
Browser (React + Vite)          Backend (FastAPI)           External
─────────────────────           ─────────────────           ────────
Landing / Login
    │ JWT token
    ▼
Dashboard ──── POST /cases/generate ──────► CaseEngine
    │                                           │
    │                                    RAG search (ChromaDB)
    │                                           │
    │                                    Gemini 2.5 Flash
    │                                           │
    │◄──── CaseData JSON (+ based_on, judge_archetype) ─────┘
    │
PreTrial (read case, landmark ref, archetype, plan)
    │
    │ GET /courtroom/opening-cards/{session_id}
    │◄──── 3 tactical choice cards (phase: Opening Statements)
    │
Courtroom ──── POST /courtroom/argue ────► JudgeEngine (round 1–5)
    │                                           │
    │                                    RAG → relevant laws
    │                                           │
    │             Gemini (judge + opposing, archetype + phase aware)
    │                                           │
    │◄──── judge_response + opposing_response + tactical_choices + case_predictor ──┘
    │
    │  (on submit) ── POST /demeanor ─────► Gemini Vision
    │◄──── demeanor score ────────────────────────┘
    │
ClosingArgument ── POST /courtroom/closing ► Gemini
    │◄──── verdict document ──────────────────────┘
    │
Evaluation ─── POST /evaluation/generate ─► Gemini
    │◄──── grade + feedback + citations ──────────┘
```

---

## 1. Authentication

**Files:** `backend/routers/auth.py`, `store/session.ts`

- User registers or logs in via `POST /api/v1/auth/register` or `/auth/login`
- Backend hashes the password with `bcrypt` (passlib), stores in SQLite via SQLAlchemy async
- Returns a **JWT token** (python-jose, HS256, 7-day expiry)
- Frontend stores the token in `localStorage` as `nyaya_token`
- Every subsequent API call sends `Authorization: Bearer <token>` in the header
- Zustand session store (`store/session.ts`) persists `user`, `token`, `sessionId`, `caseData` to `localStorage` via the `persist` middleware — so a page refresh doesn't log you out

---

## 2. Case Generation

**Files:** `backend/routers/cases.py`, `services/case_engine.py`, `services/llm_service.py`, `services/rag_service.py`

When you click "Generate Case" on the Dashboard:

1. Frontend sends `POST /api/v1/cases/generate` with `{ case_type, court_level, difficulty, role, ... }`
2. `CaseEngine.generate_enriched_case()` runs two things in sequence:
   - **Gemini call** — `LLMService.generate_case()` sends a structured prompt asking for a full case JSON (title, charges, facts, witnesses, evidence items, legal sections, prosecution/defence briefs)
   - **RAG enrichment** — `IndianLawRAG.search_relevant_laws()` queries ChromaDB with the case type + charge sections, returns the top 6 matching law excerpts from the BNS/BNSS/BSA text files
riched case is saved to SQLite as a `Session` row
4. The full `CaseData` JSON is returned to the frontend
5. Zustand stores it in `caseData` + `sessionId` — this is the single source of truth for the entire simulation

### Real Case Grounding (15A)

g landmark is injected into the Gemini prompt so the generated case is structurally modelled on that precedent.

The returned case JSON includes two extra fields:
- `based_on` — the landmark citation (e.g. "Nanavati v. State of Maharashtra, AIR 1962 SC 605")
- `judge_archetype` — one of four personality types assigned at generation time (see Judge Archetypes below)

Both fields are stored in `case_data` in the database and surfaced in the Pre-Trial room.

### RAG (Retrieval-Augmented Generation)

The three law files in `backend/data/new_criminal_laws/` are indexed into **ChromaDB** on first startup using `sentence-transformers` (all-MiniLM-L6-v2). Each chunk is a law section with its code, section number, and text. When a query comes in, ChromaDB does a cosine similarity search and returns the most relevant sections. These are injected into every Gemini prompt so the AI always cites real law text, not hallucinated sections.

---

## 3. Pre-Trial Room

**File:** `pages/PreTrial.tsx`

A 5-tab preparation screen before entering the courtroom:
- **Brief** — shows the case background, prosecution brief, defence brief, the landmark case it is based on (`based_on`), and the judge's archetype with a description of what to expect
- **Evidence** — lists all evidence items with admissibility status
- **Witnesses** — key witnesses with their roles and testimony summaries
- **Laws** — the relevant BNS/BNSS/BSA sections for this case
- **Notes** — free-text strategy notepad (stored in local component state)

No API calls here — everything comes from `caseData` already in the Zustand store. Clicking "All Rise — Enter Courtroom" navigates to `/courtroom`.

---

## 4. The Courtroom Loop

**Files:** `pages/Courtroom.tsx`, `backend/routers/courtroom.py`, `services/case_engine.py`, `services/judge_engine.py`

### 5-Round Structure (15B)

Every session is divided into exactly **5 rounds**, each mapped to a named phase:

| Round | Phase |
|---|---|
| 1 | Opening Statements |
| 2 | Evidence Examination |
| 3 | Witness Examination |
| 4 | Rebuttals |
| 5 |Closing Arguments |

`ROUND_PHASES` and `MAX_ROUNDS = 5` are exported from both `judge_engine.py` (backend) and `store/session.ts` (frontend) so both sides share the same constants. The current phase name is displayed in the courtroom top bar. After round 5, `JudgeEngine.advance_round()` sets `session_concluded = True` and the `/argue` endpoint returns a 400 error blocking further submissions.

The phase is passed to every Gemini call so the judge's tone and the across rounds.

### Opening Tactical Cards (15E)

When the Courtroom page mounts, before the student has submitted a single argument, the frontend calls `GET /courtroom/opening-cards/{session_id}`. The backend calls `LLMService.generate_opening_tactical_choices()` which generates 3 strategic options tailored to the case type and the student's role (defence / prosecution) for the Opening Statements phase.

ni call fails, a hardcoded fallback set of 3 phase-appropriate cards is returned — so cards are always present.

### Each Round

```
Student clicks avatar → Input modal opens
    │
Student types argument (or uses voice input)
    │
[Optional] Camera frame captured → POST /demeanor → Gemini Vision
    │
POST /courtroom/argue
    {
      session_id,
      content: argument + demeanor context,
      argument_type: 'argue' | 'rebuttal' | 'examine' | 'direct_rebuttal',
      witness_name (if examining)
    }
    │
Backend:
  1. RAG search on the argument text → top 5 relevant law sections
  2. LLM call 1: get_opposing_counsel_response() → counter-argument (aggression-scaled)
  3. LLM call 2: get_grounded_judge_response() → ruling + cited laws + optional bench_query
  4. LLM call 3: generate_tactical_choices() → 3 next-move cards for the student
  5. LLM call 4: predict_case_outcome() → win probability + momentum signal
  6. Auto-objection check (probability scales with aggression level)
  7. scores_update delta calculated
  8. JudgeEngine.advance_round() called — round increments, aggression level updates
  9. Everything saved to DB
    │
Frontend receives:
  - opposing_response → shown as opposing counsel message
  - judge_response → shown as judge message + read aloud via TTS
  - bench_query (if triggered) → locks input, opens bench query modal
  - cited_laws → shown as law chips at bottom of screen
  - scores_update → Zustand updates score bars
  - tactical_choices → new 3-card set replaces previous cards
  - case_predictor → updates live win-probability meter
```

### Judge Archetypes (15C)

At case generation, one of four archetypes is assigned and stored in `case_data.judge_archetype`. The `JudgeEngine` reads this from the session on first access and holds it for the entire session. `get_judge_persona()` combines the archetype with the difficulty level into a single persona string that is injected into every judge Gemini call.

| Archetype | Behaviour |
|---|---|
icalities; rewards concise evidence-grounded arguments |
| Constitutionalist | Scrutinises every argument through Articles 14, 19, 21; rewards constitutional law arguments |
| Empathetic | Weighs victim impact and proportionality; rewards arguments addressing justice alongside law |
| Unpredictable | Shifts stance between rounds; keeps both sides on edge; no fixed pattern |

The archetype badge is shown on the judge card in the courtroom and in the Pre-Trial Brief tab.

### Lawyer-vs-Lawyer Dialogue (15D)

After opposing counsel responds, a "⚡ Respond to Counsel" button appears. Clicking it submits an argument with `argument_type: "direct_rebuttal"`, which signals to the judge and opposing counsel LLM prompts that this is a direct exchange rather than a fresh submission. This allows back-and-forth confrontation without waiting for the judge to speak.

Opposing counsel aggression scales with to `get_opposing_counsel_response()` which adjusts the tone and length of the counter-argument. The auto-objection probability also scales with aggression: `0.10 + (aggression_level - 1) * 0.06`, ranging from 10% in round 1 to 34% in round 5.

### Tactical Choice Cards (15E — continued)

Aft the Gemini call fails, the frontend falls back to a set of phase-named generic cards so the student is never left without options.

### Bench Queries

If the judge detects a critical flaw (logical inconsistency, missing evidence, procedural violation), `bench_query.triggered = true`. The frontend:
- Locks the input
- Shows a modal with the judge's question
- Student must respond before proceeding
- Response goes to `POST /courtroom/respond-bench-query`

### Objections

`POST /courtroom/objectid, objection_type }`. Gemini rules Sustained or Overruled with a BSA citation. The ruling flashes as a full-screen overlay.

### Witness Examination

Student selects a witness from the Witnesses panel, clicks Direct or Cross. This sets `activeWitness` in Zustand and submits an argument with `argument_type: 'examine'`. The backend calls `get_witness_response()` which plays the witness in character, consistent with their prior testimony summary.

---

## 5. Demeanor Analysis

**Files:** `hooks/useCamera.ts`, `hooks/useTTS.ts`, `backend/routers/demeanor.py`, `services/llm_service.py`

Two systems run in parallel:

### face-api.js (continuous, local)
- Runs in the browser — no server needed
- Models loaded from CDN (tinyFaceDetector + faceExpressionNet)
- Runs every 2 seconds via `setInterval`
- Detects: happy, sad, angry, fearful, disgusted, surprised, neutral
- Maps expressions to courtroom demeanor: confident / nervous / uncertain
- Maintains a rolling stress average over the last 5 readings
or 3+ consecutive readings → triggers role switch prompt (dual-student mode)

### Gemini Vision (on submit)
- When student submits an argument, `captureFrame()` grabs a single JPEG frame from the video element
- Sent as base64 to `POST /api/v1/demeanor`
- Gemini Vision analyzes posture, eye contact, expression
- Returns `{ demeanor, score, stress_level, feedback }`
- If Gemini succeeds → `✦ AI` badge shown; if it fails → falls back to face-api result → `⚡ LOCAL` badge

Thent text before sending to the judge:
```
[Student appeared nervous during this submission. Factor this into your feedback.]
```
This makes the judge's response adapt to the student's visible confidence level.

---

## 6. Text-to-Speech

**File:** `hooks/useTTS.ts`

Uses the browser's built-in **Web Speech API** (`SpeechSynthesis`). No external service.

- Voice: prefers `en-IN` voices, falls back to any English voice
- Rate: 0.88 (slightly slower than default for clarity)
- Pitch: 0.95 (slightly lower, more authoritative)
- Every judge response is automatically spoken
- Mute toggle in the top bar silences it
- Replay button (🔁) on the judge card re-reads the last response
- The judge card pulses green while speaking

---

## 7. Closing Argument & Verdict

**Files:** `pages/ClosingArgument.tsx`, `backend/routers/courtroom.py`

Student writes their closing argument and submits it to `POST /courtroom/closing`. Gemini generates:
- Opposing counsel's closing (2-3 sentences)
- Judge's dramatic verdict speech
- Verdict: Convicted / Acquitted / Partially Convicted / Bail Granted / Case Dismissed
- Legal reasoning with BNS/BNSS/BSA citations
- Key finding (the single decisive factor)
- Grade + overall score

This is rendered as a formal cream-paper judgment document with an animated verdict stamp.

---

## 8. Evaluation

**Files:** `pages/Evaluation.tsx`, `backend/routers/evaluation.py`

`POST /evaluation/generate` sends the full conversation transcript + relevant laws to Gemini. It returns scores across 5 axes:

it measures |
|---|---|
| Legal Accuracy | Correct BNS/BNSS/BSA citations |
| Argument Structure | Logic, flow, coherence |
| Evidence Usage | How well evidence was deployed |
| Procedural Compliance | Following court procedure |
| Articulation | Clarity and persuasiveness |

Each feedback point includes the exact law section it references. A bias audit field confirms the evaluation was based purely on legal arguments.

---

## 9. Demo Mode

**Files:** `pages/Demo.tsx`, `backend/routers/courtroom.py`
 codes.
nds. After that it's instant.

API docs available at `http://localhost:8000/docs`.

---

## Legal Compliance

Every Gemini prompt includes a hard constraint block (`LAW_FRAMEWORK_NOTE`) that:
- Lists the BNS/BNSS/BSA codes and their IPC/CrPC/IEA equivalents
- Explicitly forbids citing IPC, CrPC, or IEA section numbers
- Is injected into every single LLM call — case generation, judge responses, objection rulings, evaluation, demeanor feedback, demo scripts

This ensures the AI never accidentally uses the old lawsionId)` — fetches tactical cards before the first argument

Vite proxies all `/api` requests to `http://localhost:8000` in development, so there are no CORS issues during dev.

---

## 12. Running It

```bash
# Terminal 1 — Backend (from nyayaai/ directory)
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (from nyayaai/nyaya-ui/ directory)
npm run dev -- --port 3000
```

On first backend start, the RAG index is built automatically from the law text files. This takes ~10 seco

All components that read from the store use `useShallow` to prevent infinite re-render loops when selecting multiple fields.

---

## 11. API Layer

**File:** `api/client.ts`

Single `req<T>()` function handles all HTTP calls:
- Attaches JWT from `localStorage`
- Handles empty responses (guards against blank body crashes)
- Parses JSON safely, throws typed errors
- All API namespaces: `authApi`, `casesApi`, `courtroomApi`, `evaluationApi`, `demeanorApi`, `leaderboardApi`
- `courtroomApi.getOpeningCards(sesrage`):
- `user`, `token` — auth
- `sessionId`, `caseData` — current case
- `role`, `difficulty` — session config

**Runtime** (reset on new session via `resetRuntime()`):
- `transcript` — all messages
- `scores` — live score bars
- `round`, `argMode`, `activeWitness`
- `benchQueryCount`, `objectionCount`, `sessionSeconds`

`ROUND_PHASES` (the round→phase name map) and `MAX_ROUNDS = 5` are exported from `store/session.ts` so any component can reference the phase name for the current round without hardcoding strings.quired. Gemini generates a complete pre-scripted session JSON with 8-10 turns, each with a `delay` in milliseconds. The frontend plays them back with `setTimeout`, showing each turn in sequence — arguments, objection flash, bench query, verdict. A hardcoded fallback script (murder + theft cases) is always available so demo mode never crashes if Gemini is unavailable.

---

## 10. State Management

**File:** `store/session.ts`

Zustand store with two layers:

**Persisted** (survives page refresh, stored in `localSto
No login re