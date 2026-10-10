#!/usr/bin/env python3
"""Strict Gate 4G canonical-contract validator."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ALLOWED_TOOLS = {
    "finance.get_summary",
    "finance.transaction.create",
    "finance.transaction.delete",
    "task.create",
    "reminder.create",
    "analyze_file",
    "web_search",
}

ALLOWED_INTENTS = {
    "conversation",
    "expense",
    "task",
    "reminder",
    "file_analysis",
    "web_research",
    "unknown",
}

INTENT_TO_TOOLS = {
    "conversation": {None},
    "unknown": {None},
    "expense": {
        "finance.get_summary",
        "finance.transaction.create",
        "finance.transaction.delete",
    },
    "task": {"task.create"},
    "reminder": {"reminder.create"},
    "file_analysis": {"analyze_file"},
    "web_research": {"web_search"},
}

EXACT_KEYS = {
    "intent",
    "tool",
    "arguments",
    "requiresConfirmation",
}


def validate_prediction(row: dict) -> list[str]:
    errors: list[str] = []
    prediction = row.get("prediction")

    if not isinstance(prediction, dict):
        return ["prediction is not a JSON object"]

    if set(prediction) != EXACT_KEYS:
        errors.append(
            "schema keys must be exactly "
            + ",".join(sorted(EXACT_KEYS))
        )

    if "args" in prediction:
        errors.append("forbidden key: args")
    if "confirmation" in prediction:
        errors.append("forbidden key: confirmation")

    intent = prediction.get("intent")
    tool = prediction.get("tool")
    arguments = prediction.get("arguments")
    confirmation = prediction.get("requiresConfirmation")

    if intent not in ALLOWED_INTENTS:
        errors.append(f"invalid intent: {intent!r}")

    if tool is not None and tool not in ALLOWED_TOOLS:
        errors.append(f"invalid tool: {tool!r}")

    if intent in INTENT_TO_TOOLS and tool not in INTENT_TO_TOOLS[intent]:
        errors.append(f"tool {tool!r} is invalid for intent {intent!r}")

    if not isinstance(arguments, dict):
        errors.append("arguments must be an object")

    if not isinstance(confirmation, bool):
        errors.append("requiresConfirmation must be boolean")

    expected = row.get("expected") or {}
    conversation_unknown_fallback = (
        expected.get("intent") == "conversation"
        and prediction.get("intent") == "unknown"
        and prediction.get("tool") is None
        and prediction.get("requiresConfirmation") is False
        and isinstance(arguments, dict)
        and arguments == {}
    )

    if not conversation_unknown_fallback:
        if prediction.get("intent") != expected.get("intent"):
            errors.append("intent mismatch")
        if prediction.get("tool") != expected.get("tool"):
            errors.append("tool mismatch")
        if prediction.get("requiresConfirmation") != expected.get(
            "requiresConfirmation"
        ):
            errors.append("requiresConfirmation mismatch")

    if isinstance(arguments, dict):
        required = expected.get("requiredArguments") or []
        missing = [key for key in required if key not in arguments]
        if missing:
            errors.append("missing required arguments: " + ",".join(missing))

    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print(
            "Usage: python validate_gate4g_contract.py "
            "<predictions.jsonl>",
            file=sys.stderr,
        )
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    rows = []
    parse_failures = 0

    for line_no, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), 1
    ):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            parse_failures += 1
            print(f"line {line_no}: invalid JSONL: {exc}")

    results = []
    for row in rows:
        errors = validate_prediction(row)
        results.append(
            {
                "case_id": row.get("case_id"),
                "pass": not errors,
                "errors": errors,
            }
        )

    passed = sum(item["pass"] for item in results)
    total = len(results)
    rate = (passed / total) if total else 0.0

    result = {
        "gate": "4G",
        "contract": "canonical",
        "passed": passed,
        "total": total,
        "pass_rate": round(rate, 3),
        "parse_failures": parse_failures,
        "failures": [item for item in results if not item["pass"]],
        "rules": {
            "exact_keys": sorted(EXACT_KEYS),
            "allowed_tools": sorted(ALLOWED_TOOLS),
            "post_generation_normalization": False,
        },
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if total > 0 and passed == total and parse_failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
