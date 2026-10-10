from __future__ import annotations
import os
from typing import Any


def web_search(query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Sourced search using Brave Search API. No answer is fabricated when the API is absent."""
    import requests
    key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not key:
        raise RuntimeError("BRAVE_SEARCH_API_KEY is required for web search")
    r = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": max(1, min(limit, 20))},
        headers={"Accept": "application/json", "X-Subscription-Token": key},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    return [
        {"title": x.get("title"), "url": x.get("url"), "description": x.get("description")}
        for x in data.get("web", {}).get("results", [])
    ]


def format_research(results: list[dict[str, Any]]) -> str:
    lines = ["Research sources:"]
    for i, item in enumerate(results, 1):
        lines.append(f"{i}. {item.get('title')} — {item.get('url')}\n   {item.get('description') or ''}")
    return "\n".join(lines)
