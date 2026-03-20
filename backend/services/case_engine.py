"""Case engine — orchestrates case generation with RAG grounding."""
from .llm_service import LLMService
from .rag_service import IndianLawRAG


class CaseEngine:
    law_framework = "BNS/BNSS/BSA"

    def __init__(self, llm: LLMService, rag: IndianLawRAG):
        self.llm = llm
        self.rag = rag

    async def generate_enriched_case(self, case_type: str, difficulty: str,
                                      court_level: str, complexity: str,
                                      custom_notes: str = "") -> dict:
        """Generate case and enrich with RAG-sourced law sections."""
        case = await self.llm.generate_case(case_type, difficulty, court_level,
                                             complexity, custom_notes)
        # Enrich with relevant laws from RAG
        query = f"{case_type} {' '.join([c.get('section','') for c in case.get('charges',[])])}"
        relevant_laws = self.rag.search_relevant_laws(query, n_results=6)
        case["relevant_laws"] = relevant_laws
        case["legal_framework"] = self.law_framework
        return case

    async def get_grounded_judge_response(self, case_context: dict,
                                           conversation_history: list,
                                           student_argument: str,
                                           role: str,
                                           difficulty: str = "medium",
                                           round_number: int = 1,
                                           judge_archetype: str = "Pragmatist") -> dict:
        """Retrieve relevant laws then get judge response."""
        relevant_laws = self.rag.search_relevant_laws(student_argument, n_results=5)
        return await self.llm.get_judge_response(
            case_context, conversation_history, student_argument,
            role, relevant_laws, difficulty,
            round_number=round_number, judge_archetype=judge_archetype
        )

    async def get_citation_linked_evaluation(self, case_context: dict,
                                              full_conversation: list,
                                              student_role: str) -> dict:
        """Evaluate with RAG-sourced bare act citations for every feedback point."""
        query = " ".join([m["content"] for m in full_conversation if m["speaker"] == "student"])
        relevant_laws = self.rag.search_relevant_laws(query, n_results=8)
        return await self.llm.evaluate_performance(
            case_context, full_conversation, student_role, relevant_laws
        )
