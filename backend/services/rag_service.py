"""BNS/BNSS/BSA RAG service using ChromaDB."""
import os
import chromadb
from chromadb.utils import embedding_functions
from typing import List
from dotenv import load_dotenv

# Suppress TF/Keras import errors from transformers
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")

load_dotenv()

CHROMA_PATH = os.getenv("CHROMA_DB_PATH", "./data/chromadb")
COLLECTION_NAME = "new_criminal_laws_2024"


def _get_embedding_function():
    """Get embedding function — prefer SentenceTransformer, fall back to default."""
    try:
        return embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
    except Exception:
        # Fall back to ChromaDB's built-in default embeddings
        return embedding_functions.DefaultEmbeddingFunction()


class IndianLawRAG:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.ef = _get_embedding_function()
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self.ef,
            metadata={"description": "BNS, BNSS, BSA — India's new criminal codes 2024"}
        )

    def index_laws(self):
        """Index all law text files into ChromaDB."""
        data_dir = os.path.join(os.path.dirname(__file__), "../data/new_criminal_laws")
        # Prefer full text files; fall back to key sections if full not present
        files = {}
        for code, full_name, key_name in [
            ("BNS", "bns_full.txt", "bns_key_sections.txt"),
            ("BNSS", "bnss_full.txt", "bnss_key_sections.txt"),
            ("BSA", "bsa_full.txt", "bsa_key_sections.txt"),
        ]:
            if os.path.exists(os.path.join(data_dir, full_name)):
                files[code] = full_name
            else:
                files[code] = key_name
        docs, ids, metas = [], [], []
        for code, fname in files.items():
            fpath = os.path.join(data_dir, fname)
            if not os.path.exists(fpath):
                continue
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            # Split by section markers
            sections = content.split("\n\nSection ")
            for i, sec in enumerate(sections):
                if not sec.strip():
                    continue
                sec_text = sec if i == 0 else "Section " + sec
                lines = sec_text.strip().split("\n")
                sec_id = f"{code}_{i}"
                # Extract section number from first line
                first_line = lines[0].strip()
                docs.append(sec_text[:2000])
                ids.append(sec_id)
                metas.append({
                    "code": code,
                    "section_header": first_line[:100],
                    "effective_from": "2024-07-01",
                    "replaces": self._get_replacement(code, first_line)
                })

        if docs:
            # Add in batches
            batch_size = 50
            for i in range(0, len(docs), batch_size):
                self.collection.upsert(
                    documents=docs[i:i+batch_size],
                    ids=ids[i:i+batch_size],
                    metadatas=metas[i:i+batch_size]
                )
        print(f"Indexed {len(docs)} sections from BNS/BNSS/BSA")

    def _get_replacement(self, code: str, header: str) -> str:
        replacements = {
            "BNS": "Indian Penal Code (IPC)",
            "BNSS": "Code of Criminal Procedure (CrPC)",
            "BSA": "Indian Evidence Act (IEA)"
        }
        return replacements.get(code, "")

    def search_relevant_laws(self, query: str, n_results: int = 5) -> List[dict]:
        """Semantic search across BNS/BNSS/BSA."""
        if self.collection.count() == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(n_results, self.collection.count())
        )
        laws = []
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            distance = results["distances"][0][i] if results.get("distances") else 0
            relevance = max(0, 1 - distance)
            lines = doc.strip().split("\n")
            section_header = lines[0] if lines else ""
            laws.append({
                "law_name": {"BNS": "Bharatiya Nyaya Sanhita",
                              "BNSS": "Bharatiya Nagarik Suraksha Sanhita",
                              "BSA": "Bharatiya Sakshya Adhiniyam"}.get(meta.get("code", ""), meta.get("code", "")),
                "code": meta.get("code", ""),
                "section": section_header,
                "title": meta.get("section_header", ""),
                "text": doc[:500],
                "bare_act_reference": f"{meta.get('code','')} — {section_header[:60]}",
                "effective_from": meta.get("effective_from", "2024-07-01"),
                "replaces": meta.get("replaces", ""),
                "relevance_score": round(relevance, 3)
            })
        return laws

    def is_indexed(self) -> bool:
        return self.collection.count() > 0

    def verify_framework(self):
        """Raise if any old law text found in index."""
        forbidden = ["Indian Penal Code", "IPC Section", "CrPC Section", "Indian Evidence Act"]
        results = self.collection.get(limit=200)
        for doc in results.get("documents", []):
            for term in forbidden:
                if term in doc:
                    raise ValueError(f"Old law reference found in RAG index: '{term}'. Re-index with BNS/BNSS/BSA only.")
        print("Framework verification passed — no old law references found.")
