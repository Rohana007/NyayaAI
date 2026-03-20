"""Core LLM service — Gemini API (google-genai SDK), BNS/BNSS/BSA compliant."""
import os
import json
import asyncio
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

LAW_FRAMEWORK_NOTE = """
CRITICAL LEGAL COMPLIANCE — You are operating under India's NEW criminal codes 
effective July 1, 2024. You MUST use ONLY these laws:
  - Bharatiya Nyaya Sanhita (BNS) — replaces Indian Penal Code (IPC)
  - Bharatiya Nagarik Suraksha Sanhita (BNSS) — replaces CrPC
  - Bharatiya Sakshya Adhiniyam (BSA) — replaces Indian Evidence Act

Common mappings (DO NOT use old IPC sections):
  IPC 302 (Murder) → BNS Section 103
  IPC 304 (Culpable Homicide) → BNS Section 105
  IPC 375/376 (Rape) → BNS Section 63/64
  IPC 378/379 (Theft) → BNS Section 303/304
  IPC 415/420 (Cheating) → BNS Section 316/318
  IPC 498A (Cruelty) → BNS Section 85/86
  CrPC 154 (FIR) → BNSS Section 173
  CrPC 173 (Police Report) → BNSS Section 193
  IEA Section 65B (Electronic Records) → BSA Section 63
  IEA Section 101 (Burden of Proof) → BSA Section 104

NEVER use IPC, CrPC, or IEA names or section numbers. Only BNS/BNSS/BSA.
"""

ETHICS_CONSTRAINT = """
AI ETHICS & BIAS PREVENTION:
  - NEVER reference gender, caste, religion, economic status, or regional origin
    when making legal judgments or scoring.
  - Base ALL rulings purely on legal arguments, evidence, and procedure.
  - Apply equal standards to prosecution and defense.
"""

MODEL = "gemini-2.5-flash"


class LLMService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")
        self.client = genai.Client(api_key=api_key)

    async def _call(self, system: str, user: str, max_tokens: int = 2000) -> str:
        """Async Gemini call — runs sync SDK in thread executor."""
        config = types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.7,
        )
        for attempt in range(3):
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.models.generate_content(
                        model=MODEL,
                        contents=user,
                        config=config,
                    )
                )
                # gemini-2.5-flash may return None text if only thinking tokens used
                text = response.text
                if not text:
                    # Try extracting from parts directly
                    for part in (response.candidates[0].content.parts if response.candidates else []):
                        if hasattr(part, 'text') and part.text:
                            text = part.text
                            break
                if not text:
                    raise ValueError("Gemini returned empty text response")
                return text
            except Exception as e:
                if attempt == 2:
                    raise e
                await asyncio.sleep(1.5 ** attempt)

    def _parse_json(self, raw: str) -> dict:
        """Strip markdown fences and parse JSON robustly."""
        if not raw or not raw.strip():
            raise ValueError("LLM returned empty response")
        raw = raw.strip()
        # Strip ```json ... ``` or ``` ... ``` fences
        if "```" in raw:
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
            if match:
                raw = match.group(1).strip()
        # Find the outermost JSON object
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            raise ValueError(f"No JSON object found in LLM response. Got: {raw[:200]}")
        raw = raw[start:end+1]
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON parse error: {e}. Raw: {raw[:300]}")

    # ── 15A: Landmark case reference map ──
    LANDMARK_CASES = {
        "murder":      "Nanavati v. State of Maharashtra, AIR 1962 SC 605 (murder, self-defence, jury trial)",
        "culpable_homicide": "Bachan Singh v. State of Punjab, AIR 1980 SC 898 (death penalty, rarest of rare)",
        "rape":        "Tukaram v. State of Maharashtra (Mathura Rape Case), AIR 1979 SC 185",
        "theft":       "State of Maharashtra v. Vishwanath Tukaram Umale, (2012) 7 SCC 165 (theft, chain of custody)",
        "cheating":    "Hridaya Ranjan Prasad Verma v. State of Bihar, AIR 2000 SC 2341 (cheating, mens rea)",
        "harassment":  "Vishaka v. State of Rajasthan, AIR 1997 SC 3011 (workplace harassment, fundamental rights)",
        "bail":        "Hussainara Khatoon v. State of Bihar, AIR 1979 SC 1360 (bail, speedy trial, Article 21)",
        "fundamental_rights": "Maneka Gandhi v. Union of India, AIR 1978 SC 597 (personal liberty, Article 21)",
        "dowry":       "Shanti v. State of Haryana, AIR 1991 SC 1226 (dowry death, BNS Section 80)",
        "assault":     "State of U.P. v. Ram Swarup, AIR 1974 SC 1570 (grievous hurt, intention)",
        "fraud":       "S.W. Palanitkar v. State of Bihar, AIR 2002 SC 1049 (criminal breach of trust)",
        "kidnapping":  "State of Haryana v. Raja Ram, AIR 1973 SC 819 (kidnapping, abduction)",
        "default":     "Maneka Gandhi v. Union of India, AIR 1978 SC 597 (due process, fundamental rights)",
    }

    # ── 15C: Judge archetypes ──
    JUDGE_ARCHETYPES = [
        {
            "name": "Pragmatist",
            "description": "Focuses on hard facts and evidence; dismisses procedural technicalities; rewards concise, evidence-grounded arguments.",
            "persona": "You are a pragmatic judge who cares only about facts and evidence. You dismiss procedural technicalities as time-wasting. You reward concise, evidence-grounded arguments and grow impatient with abstract legal theory."
        },
        {
            "name": "Constitutionalist",
            "description": "Strict on fundamental rights; cites Articles 14, 19, 21; scrutinises constitutional implications of every argument.",
            "persona": "You are a constitutionalist judge who scrutinises every argument through the lens of fundamental rights (Articles 14, 19, 21). You frequently cite constitutional provisions and reward arguments that engage with constitutional law."
        },
        {
            "name": "Empathetic",
            "description": "Weighs victim impact and human consequences; rewards arguments addressing proportionality and justice.",
            "persona": "You are an empathetic judge who weighs the human consequences of the case alongside the law. You acknowledge victim impact, consider proportionality, and reward arguments that address justice and fairness alongside legal technicality."
        },
        {
            "name": "Unpredictable",
            "description": "Shifts stance between rounds; keeps both sides on edge; may favour either side without a fixed pattern.",
            "persona": "You are an unpredictable judge who shifts your stance between rounds. You may appear sympathetic to the defence in one round and hostile in the next. Keep both sides on edge. Never be consistently predictable."
        },
    ]

    async def generate_case(self, case_type: str, difficulty: str, court_level: str,
                             complexity: str, custom_notes: str = "") -> dict:
        import random
        # 15A: pick landmark case
        landmark = self.LANDMARK_CASES.get(case_type.lower().replace(" ", "_"),
                                            self.LANDMARK_CASES["default"])
        # 15C: assign judge archetype
        archetype = random.choice(self.JUDGE_ARCHETYPES)

        system = f"{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}\nYou are a legal case generator for Indian law students. Always respond with valid JSON only. No markdown, no explanation — pure JSON."
        prompt = f"""Generate a realistic Indian court case for law students.
Case type: {case_type} | Difficulty: {difficulty} | Court: {court_level} | Complexity: {complexity}
Custom notes: {custom_notes or 'None'}

IMPORTANT — Base this case on the following landmark judgment: {landmark}
The facts, legal arguments, and charges must be structurally analogous to this landmark case.

Return ONLY valid JSON:
{{
  "case_title": "State v. [Name]",
  "case_type": "{case_type}",
  "court": "{court_level}, [City]",
  "year": "2025",
  "based_on": "{landmark}",
  "judge_archetype": "{archetype['name']}",
  "judge_archetype_description": "{archetype['description']}",
  "background": "200-word narrative analogous to the landmark case...",
  "charges": [{{"section": "BNS Section 103", "description": "Murder", "full_text": "..."}}],
  "facts": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5"],
  "prosecution_brief": "100-word prosecution summary...",
  "defense_brief": "100-word defence summary...",
  "key_witnesses": [{{"name": "...", "role": "...", "testimony_summary": "..."}}],
  "legal_sections": [{{"code": "BNS", "section": "103", "title": "Murder"}}],
  "evidence_items": [
    {{"title": "FIR No. ...", "type": "fir", "admissibility": "admissible", "content": "..."}},
    {{"title": "Post-mortem Report", "type": "forensic", "admissibility": "admissible", "content": "..."}},
    {{"title": "CCTV Footage", "type": "cctv", "admissibility": "disputed", "content": "..."}},
    {{"title": "Witness Statement", "type": "witness", "admissibility": "admissible", "content": "..."}}
  ],
  "estimated_duration": "45 minutes",
  "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"]
}}"""
        raw = await self._call(system, prompt, max_tokens=8000)
        result = self._parse_json(raw)
        # Ensure archetype fields are always present even if LLM omits them
        result.setdefault("based_on", landmark)
        result.setdefault("judge_archetype", archetype["name"])
        result.setdefault("judge_archetype_description", archetype["description"])
        return result

    # 15B: Phase names for 5-round structure
    PHASE_NAMES = {
        1: "Opening Statements",
        2: "Evidence Examination",
        3: "Witness Examination",
        4: "Rebuttals",
        5: "Closing Arguments",
    }

    # 15B: Phase-specific judge guidance
    PHASE_JUDGE_GUIDANCE = {
        1: "This is the Opening Statements phase. Focus on procedural guidance, ensure both sides state their positions clearly. Ask about the legal framework the student intends to rely on.",
        2: "This is the Evidence Examination phase. Scrutinise every piece of evidence. Challenge admissibility under BSA. Ask about chain of custody and certification requirements.",
        3: "This is the Witness Examination phase. Challenge witness credibility. Ask about prior inconsistent statements. Probe the examination technique under BNSS.",
        4: "This is the Rebuttals phase. Evaluate how well the student counters opposing arguments. Be more demanding — press hard on any logical gaps. Aggression is appropriate.",
        5: "This is the Closing Arguments phase. Deliver a summative assessment. Ask the student to synthesise their strongest legal points. This is the final round.",
    }

    async def get_judge_response(self, case_context: dict, conversation_history: list,
                                  student_argument: str, role: str,
                                  relevant_laws: list, difficulty: str = "medium",
                                  round_number: int = 1, judge_archetype: str = "Pragmatist") -> dict:
        difficulty_persona = {
            "easy": "Be lenient on procedural errors and offer gentle guidance.",
            "medium": "Question weak points but allow reasonable arguments.",
            "hard": "Interrupt aggressively on any logical flaw. Demand precision and cite exact sections."
        }.get(difficulty, "Question weak points but allow reasonable arguments.")

        # 15C: archetype persona
        archetype_obj = next(
            (a for a in self.JUDGE_ARCHETYPES if a["name"] == judge_archetype),
            self.JUDGE_ARCHETYPES[0]
        )
        archetype_persona = archetype_obj["persona"]

        # 15B: phase guidance
        phase_name = self.PHASE_NAMES.get(round_number, "Main Arguments")
        phase_guidance = self.PHASE_JUDGE_GUIDANCE.get(round_number, "")

        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are Hon. Justice R.K. Krishnamurthy, a Sessions Court judge.
PERSONALITY ARCHETYPE — {judge_archetype}: {archetype_persona}
DIFFICULTY: {difficulty_persona}
Follow BNS/BNSS/BSA exclusively. Respond with valid JSON only. No markdown."""

        history_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_history[-6:]])
        laws_text = "\n".join([f"- {l.get('bare_act_reference','')}: {l.get('title','')}" for l in relevant_laws[:5]])

        prompt = f"""Case: {case_context.get('case_title')}
Charges: {', '.join([c.get('section','') for c in case_context.get('charges',[])])}
Student role: {role} | Round: {round_number}/5 | Phase: {phase_name}
{phase_guidance}
Relevant laws: {laws_text}
Recent proceedings:\n{history_text}
Student's latest argument: {student_argument}

Respond with JSON:
{{
  "judge_response": "Your response as judge, consistent with your {judge_archetype} archetype and the {phase_name} phase...",
  "follow_up_question": null,
  "ruling": null,
  "cited_laws": [{{"code": "BNS", "section": "103", "text_excerpt": "..."}}],
  "proceeding": "continue",
  "bench_query": null
}}
If argument has a critical flaw set bench_query to:
{{"triggered": true, "reason": "logical_inconsistency", "query": "Counsel, before you proceed..."}}"""

        raw = await self._call(system, prompt, max_tokens=1000)
        return self._parse_json(raw)

    async def get_opposing_counsel_response(self, case_context: dict,
                                             conversation_history: list,
                                             student_argument: str,
                                             student_role: str,
                                             relevant_laws: list,
                                             round_number: int = 1,
                                             argument_type: str = "argue") -> str:
        opp_role = "prosecution" if student_role == "defence" else "defence"
        # 15D: aggression scales with round (1=mild, 5=aggressive)
        aggression_level = min(round_number, 5)
        aggression_desc = {
            1: "measured and collegial — introduce your position calmly",
            2: "assertive — challenge evidence admissibility and facts",
            3: "pointed — attack witness credibility and procedural gaps",
            4: "aggressive — relentlessly counter every argument, raise objections",
            5: "relentless — interrupt, object, and demolish every point with BNS/BNSS/BSA citations",
        }.get(aggression_level, "assertive")

        # 15D: direct rebuttal mode — shorter, more confrontational
        is_direct_rebuttal = argument_type == "direct_rebuttal"
        if is_direct_rebuttal:
            tone_note = "The student is directly rebutting you. Respond with a sharp, immediate counter-argument in 1-2 sentences. Be confrontational."
        else:
            tone_note = f"Aggression level {aggression_level}/5: be {aggression_desc}."

        # 15D: raise objection if aggression >= 3
        objection_note = ""
        if aggression_level >= 3:
            objection_note = " Include at least one objection citing a specific BNS, BNSS, or BSA section."

        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are an experienced {opp_role} counsel in an Indian court.
{tone_note}{objection_note}
Cite only BNS/BNSS/BSA sections. Respond in 2-3 sentences only. No JSON."""

        history_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_history[-4:]])
        prompt = f"""Case: {case_context.get('case_title')} | Round: {round_number}/5
Recent proceedings: {history_text}
Opposing counsel ({student_role}) just argued: {student_argument}
Respond as {opp_role} counsel, countering this argument with BNS/BNSS/BSA citations."""

        return await self._call(system, prompt, max_tokens=400)

    async def get_witness_response(self, witness_name: str, witness_info: dict,
                                    question: str, examination_type: str,
                                    case_context: dict) -> dict:
        system = f"""{LAW_FRAMEWORK_NOTE}
You are {witness_name}, a witness in an Indian court case.
Role: {witness_info.get('role', 'witness')}
Prior statement: {witness_info.get('testimony_summary', '')}
Answer consistently with your prior statement. Respond with JSON only. No markdown."""

        prompt = f"""Case: {case_context.get('case_title')}
Examination type: {examination_type}
Question: {question}

Respond with JSON:
{{
  "answer": "Your answer as the witness...",
  "demeanor": "calm",
  "contradiction_detected": false,
  "impeachment_possible": false
}}
demeanor must be one of: calm, nervous, evasive, hostile, cooperative"""

        raw = await self._call(system, prompt, max_tokens=500)
        return self._parse_json(raw)

    async def rule_on_objection(self, objection_type: str, context: str,
                                 case_context: dict, difficulty: str = "medium") -> dict:
        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are a judge ruling on a legal objection. Cite BSA sections where relevant.
Respond with JSON only. No markdown."""

        prompt = f"""Objection: {objection_type} | Context: {context}
Case: {case_context.get('case_title')} | Difficulty: {difficulty}

Respond with JSON:
{{
  "ruling": "Sustained",
  "judge_reasoning": "The objection is sustained because...",
  "bsa_section": "BSA Section 22",
  "score_impact": 5
}}
ruling must be exactly "Sustained" or "Overruled"."""

        raw = await self._call(system, prompt, max_tokens=400)
        return self._parse_json(raw)

    async def scan_argument_for_bench_query(self, partial_argument: str,
                                             case_context: dict,
                                             current_phase: str) -> dict:
        system = f"""{LAW_FRAMEWORK_NOTE}
You are an agentic AI judge scanning an in-progress argument for critical flaws.
Only interrupt for HIGH urgency issues. Respond with JSON only. No markdown."""

        prompt = f"""Case: {case_context.get('case_title')} | Phase: {current_phase}
Partial argument: {partial_argument}

Respond with JSON:
{{
  "should_interrupt": false,
  "interrupt_reason": null,
  "bench_query": null,
  "urgency": "low"
}}
Only set should_interrupt=true for logical_inconsistency, missing_evidence, or procedural_violation of HIGH urgency."""

        raw = await self._call(system, prompt, max_tokens=200)
        return self._parse_json(raw)

    async def evaluate_performance(self, case_context: dict, full_conversation: list,
                                    student_role: str, relevant_laws: list) -> dict:
        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are a legal education evaluator. Every feedback point MUST cite the exact BNS/BNSS/BSA section.
Respond with valid JSON only. No markdown."""

        conv_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in full_conversation])
        laws_text = "\n".join([f"- {l.get('bare_act_reference','')}: {l.get('title','')}" for l in relevant_laws[:8]])

        prompt = f"""Case: {case_context.get('case_title')} | Student role: {student_role}
Relevant laws: {laws_text}
Transcript:\n{conv_text}

Evaluate and respond with JSON:
{{
  "scores": {{"legal_accuracy": 75, "argument_structure": 70, "evidence_usage": 80, "procedural_compliance": 65, "articulation": 72}},
  "overall_score": 72,
  "grade": "B",
  "verdict": "Acquittal",
  "verdict_reasoning": "Based on the arguments presented...",
  "feedback_points": [
    {{
      "type": "strength",
      "point": "Correctly challenged electronic evidence admissibility",
      "legal_basis": "BSA Section 63 requires a certificate for electronic records",
      "citations": [{{"code": "BSA", "section": "63", "title": "Admissibility of Electronic Records"}}]
    }},
    {{
      "type": "weakness",
      "point": "Failed to establish mens rea under BNS Section 103",
      "legal_basis": "BNS Section 103 requires proof of intention to cause death",
      "citations": [{{"code": "BNS", "section": "103", "title": "Murder"}}]
    }}
  ],
  "bench_queries": [],
  "next_steps": ["Study BNS Chapter X", "Practice BSA Section 63 challenges"],
  "bias_audit": {{"passed": true, "note": "Evaluation based solely on legal arguments"}}
}}"""

        raw = await self._call(system, prompt, max_tokens=6000)
        return self._parse_json(raw)

    async def analyze_demeanor_frame(self, image_b64: str, context: str = "") -> dict:
        """Send a webcam frame to Gemini Vision and get courtroom demeanor analysis."""
        from google.genai import types as gtypes

        prompt = f"""You are analyzing a law student's facial expression and body language during a courtroom simulation.
Context: {context or 'Student is presenting a legal argument.'}

Look at their face and visible posture. Assess:
1. Overall courtroom confidence (0-100)
2. Stress/anxiety level (0.0 to 1.0)
3. Demeanor category

Respond ONLY with valid JSON, no markdown:
{{
  "demeanor": "confident",
  "score": 78,
  "stress_level": 0.22,
  "feedback": "Student maintains steady eye contact and appears composed."
}}

demeanor must be exactly one of: confident, nervous, uncertain, unknown
score: integer 0-100 (higher = more confident)
stress_level: float 0.0-1.0 (higher = more stressed)
feedback: one sentence, specific observation about their expression/posture"""

        config = gtypes.GenerateContentConfig(max_output_tokens=300, temperature=0.3)

        import asyncio
        loop = asyncio.get_event_loop()

        def _call():
            image_part = gtypes.Part.from_bytes(
                data=__import__('base64').b64decode(image_b64),
                mime_type="image/jpeg"
            )
            return self.client.models.generate_content(
                model=MODEL,
                contents=[image_part, prompt],
                config=config,
            )

        for attempt in range(3):
            try:
                response = await loop.run_in_executor(None, _call)
                text = response.text or ""
                return self._parse_json(text)
            except Exception as e:
                if attempt == 2:
                    raise e
                await asyncio.sleep(1.0)

    async def suggest_argument(self, case_context: dict, conversation_so_far: list,
                                student_role: str) -> str:
        system = f"""{LAW_FRAMEWORK_NOTE}
You are a legal mentor. Give a brief hint (2-3 sentences) about what argument the student should make next.
Only cite BNS/BNSS/BSA sections. No JSON."""

        history = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_so_far[-4:]])
        prompt = f"""Case: {case_context.get('case_title')} | Role: {student_role}
Recent proceedings: {history}
What should the student argue next? Give a brief hint."""

        return await self._call(system, prompt, max_tokens=200)

    async def suggest_argument_options(self, case_context: dict, conversation_so_far: list,
                                        student_role: str, arg_mode: str = "argue") -> list[dict]:
        """Return 3 ready-to-use argument options the student can pick from."""
        system = f"""{LAW_FRAMEWORK_NOTE}
You are a legal mentor generating argument suggestions for a law student in an Indian courtroom simulation.
Return ONLY valid JSON — a list of exactly 3 argument objects. No markdown, no explanation.
Each object: {{"label": "short title (5-8 words)", "text": "full argument (2-4 sentences, cite BNS/BNSS/BSA)", "type": "aggressive|defensive|procedural|emotional_appeal"}}"""

        history = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_so_far[-6:]])
        prompt = f"""Case: {case_context.get('case_title')}
Role: {student_role} | Mode: {arg_mode}
Recent proceedings:
{history}

Generate 3 distinct argument options for the student's next submission. Each must cite a specific BNS/BNSS/BSA section. Make them meaningfully different in approach."""

        raw = await self._call(system, prompt, max_tokens=600)
        try:
            import json, re
            m = re.search(r'\[.*\]', raw, re.DOTALL)
            if m:
                return json.loads(m.group())
        except Exception:
            pass
        # Fallback
        return [
            {"label": "Challenge evidence admissibility", "text": f"My Lord, the evidence presented by the opposing side lacks proper certification as required under BSA Section 63. Without a valid certificate from a responsible official, this electronic record cannot be admitted as primary evidence in these proceedings.", "type": "procedural"},
            {"label": "Cite BNS directly", "text": f"My Lord, the facts of this case clearly fall within the ambit of BNS Section 105. The prosecution has failed to establish the requisite mens rea beyond reasonable doubt, and the defence submits that culpable homicide not amounting to murder is the appropriate charge.", "type": "aggressive"},
            {"label": "Attack witness credibility", "text": f"My Lord, the sole eyewitness testimony is contradicted by the forensic timeline established in the post-mortem report. Under BSA Section 155, the credibility of this witness is impeachable on grounds of prior inconsistent statements recorded under BNSS Section 180.", "type": "defensive"},
        ]

    async def generate_closing_argument(self, case_context: dict, conversation_history: list,
                                         role: str, student_closing: str) -> dict:
        """Generate opposing closing + dramatic judge verdict."""
        opp_role = "prosecution" if role == "defence" else "defence"
        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are generating the finale of an Indian courtroom simulation.
Respond with valid JSON only. No markdown."""

        history_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_history[-8:]])
        prompt = f"""Case: {case_context.get('case_title')}
Charges: {', '.join([c.get('section','') for c in case_context.get('charges',[])])}
Student role: {role}
Proceedings summary:\n{history_text}
Student's closing argument: {student_closing}

Generate the full finale. Respond with JSON:
{{
  "opposing_closing": "2-3 sentence closing by {opp_role} counsel...",
  "judge_verdict_speech": "Dramatic 3-4 sentence verdict speech by Justice Krishnamurthy...",
  "verdict": "Acquitted",
  "verdict_reasoning": "2-3 sentence legal reasoning citing BNS/BNSS/BSA sections...",
  "key_finding": "One sentence — the single most decisive factor in this verdict.",
  "sentence_or_order": "If convicted: sentence. If acquitted: order. If bail: conditions.",
  "grade": "B+",
  "overall_score": 74
}}
verdict must be one of: Convicted, Acquitted, Partially Convicted, Bail Granted, Bail Denied, Case Dismissed"""

        raw = await self._call(system, prompt, max_tokens=2500)
        return self._parse_json(raw)

    async def generate_tactical_choices(self, case_context: dict, conversation_history: list,
                                         student_argument: str, student_role: str,
                                         judge_response: str, round_number: int = 1) -> dict:
        """After each exchange, generate 2-4 strategic decision cards for the student.
        15E: phase-aware cards, available from round 1."""
        phase_name = self.PHASE_NAMES.get(round_number, "Main Arguments")
        phase_card_guidance = {
            1: "Cards should be opening-statement tactics: how to frame your position, which legal principle to lead with, whether to challenge jurisdiction.",
            2: "Cards should be evidence-challenge tactics: admissibility under BSA, chain of custody, electronic record certification.",
            3: "Cards should be witness-examination tactics: direct examination, cross-examination, impeachment under BSA Section 155.",
            4: "Cards should be rebuttal tactics: how to counter the opposing argument, which BNS/BNSS section to invoke, whether to raise a procedural objection.",
            5: "Cards should be closing-argument tactics: how to synthesise your strongest points, which verdict to argue for, how to address the judge's archetype.",
        }.get(round_number, "Cards should be general litigation tactics grounded in BNS/BNSS/BSA.")

        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are a legal strategy advisor generating tactical decision cards for a law student mid-trial.
Respond with valid JSON only. No markdown."""

        history_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_history[-4:]])
        context_note = f"Student's last argument: {student_argument}\nJudge's response: {judge_response}" if student_argument else "No argument submitted yet — generate opening-round strategy cards."

        prompt = f"""Case: {case_context.get('case_title')}
Student role: {student_role} | Round: {round_number}/5 | Phase: {phase_name}
{phase_card_guidance}
{context_note}
Recent proceedings:\n{history_text}

Generate 3 tactical choices for the student's NEXT move. Each must be grounded in BNS/BNSS/BSA.

Respond with JSON:
{{
  "decision_prompt": "One sentence describing the current strategic situation in the {phase_name} phase...",
  "choices": [
    {{
      "id": "A",
      "label": "Short action label (max 8 words)",
      "hint": "One-line consequence preview — what happens if you pick this",
      "type": "aggressive"
    }},
    {{
      "id": "B",
      "label": "Short action label",
      "hint": "One-line consequence preview",
      "type": "defensive"
    }},
    {{
      "id": "C",
      "label": "Short action label",
      "hint": "One-line consequence preview",
      "type": "procedural"
    }}
  ]
}}
type must be one of: aggressive, defensive, procedural, emotional_appeal
Generate exactly 3 choices. Make them meaningfully different and grounded in the case facts."""

        raw = await self._call(system, prompt, max_tokens=800)
        return self._parse_json(raw)

    async def generate_opening_tactical_choices(self, case_context: dict, student_role: str) -> dict:
        """15E: Generate tactical cards BEFORE the first argument (round 1 opening)."""
        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are a legal strategy advisor generating opening-statement tactical cards for a law student.
Respond with valid JSON only. No markdown."""

        charges_str = ', '.join([c.get('section', '') for c in case_context.get('charges', [])])
        prompt = f"""Case: {case_context.get('case_title')}
Student role: {student_role} | Phase: Opening Statements (Round 1)
Charges: {charges_str}
Background: {case_context.get('background', '')[:300]}

The student has NOT yet spoken. Generate 3 opening-statement strategy cards.
Each card should suggest a different approach to the opening statement.

Respond with JSON:
{{
  "decision_prompt": "You are about to deliver your opening statement. Choose your approach:",
  "choices": [
    {{
      "id": "A",
      "label": "Lead with the strongest BNS section",
      "hint": "Anchor your opening in statute — establishes legal authority immediately",
      "type": "aggressive"
    }},
    {{
      "id": "B",
      "label": "Challenge the prosecution's evidence first",
      "hint": "Attack admissibility under BSA before they build their case",
      "type": "defensive"
    }},
    {{
      "id": "C",
      "label": "Invoke procedural rights under BNSS",
      "hint": "Establish procedural compliance — protects your position throughout",
      "type": "procedural"
    }}
  ]
}}
Make the cards specific to the case type and charges. Cite actual BNS/BNSS/BSA sections in the hints."""

        raw = await self._call(system, prompt, max_tokens=600)
        return self._parse_json(raw)

    async def predict_case_outcome(self, case_context: dict, conversation_history: list,
                                    student_argument: str, student_role: str,
                                    judge_response: str) -> dict:
        """Predict win probability and momentum after each student argument."""
        system = f"""{LAW_FRAMEWORK_NOTE}\n{ETHICS_CONSTRAINT}
You are a neutral legal analyst assessing the live probability of a student winning their case.
Be honest and critical — do NOT be encouraging by default. Ground all assessments in BNS/BNSS/BSA.
Respond with valid JSON only. No markdown."""

        history_text = "\n".join([f"{m['speaker'].upper()}: {m['content']}" for m in conversation_history[-6:]])
        prompt = f"""Case: {case_context.get('case_title')}
Charges: {', '.join([c.get('section','') for c in case_context.get('charges',[])])}
Student role: {student_role}
Student's latest argument: {student_argument}
Judge's response: {judge_response}
Recent proceedings:\n{history_text}

Assess the current state of the case. Respond with JSON:
{{
  "win_probability": 52,
  "momentum": "stable",
  "momentum_reason": "One sentence explaining the current momentum shift",
  "judge_sentiment": "neutral",
  "tip": "One actionable suggestion the student can use immediately, citing a BNS/BNSS/BSA section"
}}
win_probability: integer 0-100 (realistic assessment — not encouraging by default)
momentum: exactly one of "rising" | "stable" | "declining"
judge_sentiment: exactly one of "favorable" | "neutral" | "skeptical" | "hostile"
Be honest. If the argument was weak, reflect that in the score."""

        raw = await self._call(system, prompt, max_tokens=400)
        return self._parse_json(raw)

    async def generate_demo_script(self, case_type: str = "murder") -> dict:
        """Generate a pre-scripted demo session for auto-play."""
        system = f"""{LAW_FRAMEWORK_NOTE}
You are generating a demo courtroom script for a hackathon presentation.
Make it dramatic, educational, and showcase all features. JSON only."""

        prompt = f"""Generate a complete demo courtroom script for case type: {case_type}

Return JSON:
{{
  "case_title": "State v. Arjun Sharma",
  "case_summary": "Brief 1-sentence summary",
  "turns": [
    {{"speaker": "system", "text": "Court is now in session.", "delay": 0}},
    {{"speaker": "judge", "text": "Judge opening...", "delay": 1500}},
    {{"speaker": "prosecution", "text": "Prosecution opening...", "delay": 3000}},
    {{"speaker": "defence", "text": "Defence opening...", "delay": 5000}},
    {{"speaker": "objection", "text": "Objection: Hearsay", "ruling": "Sustained", "delay": 7000}},
    {{"speaker": "judge", "text": "Bench query...", "delay": 9000}},
    {{"speaker": "prosecution", "text": "Closing argument...", "delay": 11000}},
    {{"speaker": "defence", "text": "Defence closing...", "delay": 13000}},
    {{"speaker": "verdict", "text": "Dramatic verdict...", "verdict": "Acquitted", "delay": 15000}}
  ]
}}
Make 8-10 turns total. Each turn text should be 1-2 sentences. Use BNS/BNSS/BSA citations."""

        raw = await self._call(system, prompt, max_tokens=2000)
        return self._parse_json(raw)
