"""
Standalone ingestion script — run once to populate ChromaDB with full BNS/BNSS/BSA corpus.

Usage (from nyayaai/ directory):
    python -m backend.ingest_laws

Or directly:
    python ingest_laws.py
"""
import os
import sys

# Allow running directly from backend/ or from nyayaai/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from backend.services.rag_service import IndianLawRAG


def main():
    print("=" * 60)
    print("NyayaAI — BNS/BNSS/BSA RAG Corpus Ingestion")
    print("=" * 60)

    rag = IndianLawRAG()

    existing = rag.collection.count()
    if existing > 0:
        print(f"Existing index has {existing} sections. Re-indexing with full corpus...")
        # Delete and recreate collection for clean re-index
        rag.client.delete_collection(rag.collection.name)
        rag.collection = rag.client.get_or_create_collection(
            name=rag.collection.name,
            embedding_function=rag.ef,
            metadata={"description": "BNS, BNSS, BSA — India's new criminal codes 2024"}
        )

    rag.index_laws()

    final_count = rag.collection.count()
    print(f"\nIngestion complete. Total sections indexed: {final_count}")

    # Quick sanity check
    print("\nRunning verification...")
    try:
        rag.verify_framework()
    except ValueError as e:
        print(f"WARNING: {e}")
        return

    # Test search
    results = rag.search_relevant_laws("murder culpable homicide punishment", n_results=3)
    print(f"\nSample search — 'murder culpable homicide punishment':")
    for r in results:
        print(f"  [{r['code']}] {r['section'][:80]} (relevance: {r['relevance_score']})")

    results2 = rag.search_relevant_laws("bail non-bailable offence arrest", n_results=3)
    print(f"\nSample search — 'bail non-bailable offence arrest':")
    for r in results2:
        print(f"  [{r['code']}] {r['section'][:80]} (relevance: {r['relevance_score']})")

    results3 = rag.search_relevant_laws("electronic records admissibility evidence", n_results=3)
    print(f"\nSample search — 'electronic records admissibility evidence':")
    for r in results3:
        print(f"  [{r['code']}] {r['section'][:80]} (relevance: {r['relevance_score']})")

    print("\nAll done. RAG corpus is ready.")


if __name__ == "__main__":
    main()
