from __future__ import annotations
import os
import re
from datetime import datetime, timezone
from typing import Any

SENSITIVE = re.compile(r"password|passcode|pin|token|secret|api[_-]?key|authorization|cookie|session|private key|credit card|cvv", re.I)
ALLOWED_CATEGORIES = {"preference", "profile", "goal", "project", "workflow", "constraint"}


def get_collection(user_id: str = "default"):
    import chromadb
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "_", str(user_id))[:80] or "default"
    client = chromadb.PersistentClient(path=os.getenv("OPEN_MIND_CHROMA_PATH", "./data/chroma"))
    return client.get_or_create_collection(name=f"user_{safe_user}", metadata={"hnsw:space": "cosine"})


def _validate_policy(text: str, metadata: dict[str, Any]) -> None:
    if not text or not text.strip(): raise ValueError("memory text cannot be empty")
    if SENSITIVE.search(text) or any(SENSITIVE.search(str(k)) for k in metadata):
        raise ValueError("Sensitive credentials/secrets must never be stored in long-term memory")
    category = str(metadata.get("category", "")).strip().lower()
    if category not in ALLOWED_CATEGORIES:
        raise ValueError(f"Memory category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}")


def should_remember(*, explicit_request: bool, category: str, stable: bool = True) -> bool:
    """Policy gate: save only explicit user requests or stable user-approved facts/preferences."""
    return bool((explicit_request or stable) and category in ALLOWED_CATEGORIES)


def remember(user_id: str, memory_id: str, text: str, metadata: dict[str, Any] | None = None, *, explicit_request: bool = True) -> None:
    meta = dict(metadata or {})
    if not should_remember(explicit_request=explicit_request, category=str(meta.get("category", "")), stable=bool(meta.get("stable", True))):
        raise ValueError("Memory policy rejected this item")
    _validate_policy(text, meta)
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    meta["policy"] = "explicit-or-stable-approved"
    get_collection(user_id).upsert(ids=[memory_id], documents=[text.strip()], metadatas=[meta])


def recall(user_id: str, query: str, n: int = 5) -> list[dict[str, Any]]:
    if not query.strip(): return []
    result = get_collection(user_id).query(query_texts=[query], n_results=max(1, min(n, 20)))
    docs = result.get("documents", [[]])[0]
    metas = result.get("metadatas", [[]])[0]
    ids = result.get("ids", [[]])[0]
    now = datetime.now(timezone.utc)
    out = []
    for i, d, m in zip(ids, docs, metas):
        meta = m or {}
        expires = str(meta.get("expires_at", "")).strip()
        if expires:
            try:
                if datetime.fromisoformat(expires.replace("Z", "+00:00")) <= now: continue
            except ValueError:
                continue
        if meta.get("deleted") is True: continue
        out.append({"id": i, "text": d, "metadata": meta})
    return out


def forget(user_id: str, memory_ids: list[str]) -> None:
    """Deletion is explicit and permanent for the selected memory IDs."""
    ids = [str(x).strip() for x in memory_ids if str(x).strip()]
    if ids: get_collection(user_id).delete(ids=ids)


def update_memory(user_id: str, memory_id: str, text: str, metadata: dict[str, Any] | None = None) -> None:
    """Editing uses the same ID, preserving one canonical memory instead of duplicates."""
    remember(user_id, memory_id, text, metadata, explicit_request=True)


def memory_policy() -> dict[str, Any]:
    return {
        "save": "explicit user request or stable user-approved preference/profile/goal/project/workflow/constraint",
        "edit": "explicit correction/update; same memory_id is upserted",
        "delete": "explicit user deletion request; permanent delete by id",
        "never_save": "credentials, secrets, tokens, transient chat, or unverified claims",
        "expiry": "optional expires_at metadata is enforced at recall time",
    }
