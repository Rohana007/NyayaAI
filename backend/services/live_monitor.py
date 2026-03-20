"""Agentic live argument monitor — proactive bench query injection."""
import time
from typing import Optional
from .llm_service import LLMService
from .rag_service import IndianLawRAG


class LiveArgumentMonitor:
    """Scans in-progress arguments and triggers bench queries proactively."""

    DEBOUNCE_SECONDS = 90
    MIN_NEW_CHARS = 50

    def __init__(self, llm_service: LLMService, rag_service: IndianLawRAG):
        self.llm = llm_service
        self.rag = rag_service
        # session_id -> last interrupt timestamp
        self._last_interrupt: dict[str, float] = {}

    def _can_interrupt(self, session_id: str) -> bool:
        last = self._last_interrupt.get(session_id, 0)
        return (time.time() - last) > self.DEBOUNCE_SECONDS

    async def check_argument(self, session_id: str, partial_text: str,
                              case_context: dict, current_phase: str,
                              last_check_text: str = "") -> dict:
        """Check if judge should interrupt. Returns interrupt payload or {interrupt: false}."""
        new_chars = len(partial_text) - len(last_check_text)
        if new_chars < self.MIN_NEW_CHARS:
            return {"interrupt": False}
        if not self._can_interrupt(session_id):
            return {"interrupt": False}
        if len(partial_text) < 80:
            return {"interrupt": False}

        result = await self.llm.scan_argument_for_bench_query(
            partial_text, case_context, current_phase
        )

        if result.get("should_interrupt") and result.get("urgency") == "high":
            self._last_interrupt[session_id] = time.time()
            return {
                "interrupt": True,
                "bench_query": result.get("bench_query"),
                "query_type": result.get("interrupt_reason", "logical_inconsistency"),
                "input_locked": True
            }
        return {"interrupt": False}

    async def resolve_bench_query(self, query_text: str, student_response: str,
                                   case_context: dict) -> dict:
        """Evaluate student's response to bench query."""
        # Simple heuristic: if response is substantive (>30 chars), acknowledge
        if len(student_response.strip()) > 30:
            return {
                "judge_acknowledgment": "Thank you, Counsel. The Court notes your response. You may proceed.",
                "can_continue": True
            }
        return {
            "judge_acknowledgment": "That explanation is insufficient, Counsel. Please reconsider your position and address the Court's concern more precisely.",
            "can_continue": False
        }
