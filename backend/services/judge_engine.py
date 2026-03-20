"""Agentic Judge Engine — manages session state and judge behavior."""
from typing import Optional
import time

# 15B: Strict 5-round phase map
ROUND_PHASES = {
    1: "Opening Statements",
    2: "Evidence Examination",
    3: "Witness Examination",
    4: "Rebuttals",
    5: "Closing Arguments",
}
MAX_ROUNDS = 5


class JudgeEngine:
    """Manages per-session judge state including agentic interrupts."""

    def __init__(self, session_id: str, difficulty: str = "medium", is_agentic: bool = True,
                 judge_archetype: str = "Pragmatist"):
        self.session_id = session_id
        self.difficulty = difficulty
        self.is_agentic = is_agentic
        # 15C: judge archetype persists for the whole session
        self.judge_archetype = judge_archetype
        # 15B: strict 5-round tracking
        self.round = 1
        self.phase = ROUND_PHASES[1]
        self.session_concluded = False
        self.pending_bench_query: Optional[dict] = None
        self.bench_query_count = 0
        self._last_interrupt_time: float = 0
        self.objection_history: list = []
        self.sustained_count = 0
        self.overruled_count = 0
        # 15D: opposing counsel aggression (1-5, increments per round)
        self.aggression_level = 1

    def can_interrupt(self) -> bool:
        if not self.is_agentic:
            return False
        return (time.time() - self._last_interrupt_time) > 90

    def set_pending_query(self, query: dict):
        self.pending_bench_query = query
        self.bench_query_count += 1
        self._last_interrupt_time = time.time()

    def clear_pending_query(self):
        self.pending_bench_query = None

    def has_pending_query(self) -> bool:
        return self.pending_bench_query is not None

    def advance_round(self):
        """15B: advance round, update phase, cap at MAX_ROUNDS."""
        if self.round < MAX_ROUNDS:
            self.round += 1
            self.phase = ROUND_PHASES.get(self.round, "Closing Arguments")
            # 15D: aggression scales with round
            self.aggression_level = min(self.round, 5)
        else:
            self.session_concluded = True

    def is_final_round(self) -> bool:
        return self.round >= MAX_ROUNDS

    def record_objection(self, obj_type: str, ruling: str):
        self.objection_history.append({"type": obj_type, "ruling": ruling})
        if ruling == "Sustained":
            self.sustained_count += 1
        else:
            self.overruled_count += 1

    def get_judge_persona(self) -> str:
        """15C + difficulty combined persona string."""
        difficulty_desc = {
            "easy": "supportive and patient, offering gentle guidance",
            "medium": "balanced and fair, questioning weak points",
            "hard": "strict and demanding, interrupting on any flaw"
        }.get(self.difficulty, "balanced and fair")
        return f"{self.judge_archetype} archetype, {difficulty_desc}"

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "difficulty": self.difficulty,
            "judge_archetype": self.judge_archetype,
            "phase": self.phase,
            "round": self.round,
            "max_rounds": MAX_ROUNDS,
            "session_concluded": self.session_concluded,
            "aggression_level": self.aggression_level,
            "bench_query_count": self.bench_query_count,
            "has_pending_query": self.has_pending_query(),
            "objection_history": self.objection_history,
            "sustained_count": self.sustained_count,
            "overruled_count": self.overruled_count,
        }


# In-memory store of active judge engines (keyed by session_id)
_engines: dict[str, JudgeEngine] = {}


def get_engine(session_id: str, difficulty: str = "medium",
               judge_archetype: str = "Pragmatist") -> JudgeEngine:
    if session_id not in _engines:
        _engines[session_id] = JudgeEngine(session_id, difficulty,
                                            judge_archetype=judge_archetype)
    return _engines[session_id]


def remove_engine(session_id: str):
    _engines.pop(session_id, None)
