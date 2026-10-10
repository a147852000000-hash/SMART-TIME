#!/usr/bin/env python3
"""Verify the five user-provided Phase 12 recordings against the committed evidence.

Usage:
  python scripts/verify-phase12-user-audio.py /path/to/wav_corpus

The raw recordings stay outside Git. This verifier checks the local files against
docs/phase12_user_audio_evidence.json and writes no audio/transcript data.
"""
from __future__ import annotations

import hashlib
import json
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "phase12_user_audio_evidence.json"

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())

def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python scripts/verify-phase12-user-audio.py /path/to/wav_corpus", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).expanduser().resolve()
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))

    if data.get("raw_audio_in_git") is not False:
        raise SystemExit("FAIL: raw_audio_in_git must remain false")

    failures = []
    verified = []
    for item in data["files"]:
        path = root / item["file"]
        if not path.exists():
            failures.append(f"missing: {path.name}")
            continue
        try:
            with wave.open(str(path), "rb") as w:
                channels = w.getnchannels()
                rate = w.getframerate()
                width = w.getsampwidth()
                frames = w.getnframes()
                comptype = w.getcomptype()
            if comptype != "NONE":
                failures.append(f"{path.name}: compressed WAV ({comptype})")
                continue
            if width != 2:
                failures.append(f"{path.name}: expected 16-bit PCM, got {width * 8}-bit")
            if rate != data["conversion"]["sample_rate_hz"]:
                failures.append(f"{path.name}: expected {data['conversion']['sample_rate_hz']} Hz, got {rate} Hz")
            if channels != item["channels"]:
                failures.append(f"{path.name}: expected {item['channels']} channels, got {channels}")
            got_hash = sha256(path)
            if got_hash != item["sha256"]:
                failures.append(f"{path.name}: SHA-256 mismatch")
            got_duration = duration(path)
            if abs(got_duration - item["duration_s"]) > 0.01:
                failures.append(f"{path.name}: duration mismatch ({got_duration:.6f}s)")
            verified.append({
                "file": path.name,
                "sha256": got_hash,
                "duration_s": round(got_duration, 6),
                "sample_rate_hz": rate,
                "channels": channels,
                "pcm_bits": width * 8,
            })
        except wave.Error as exc:
            failures.append(f"{path.name}: invalid WAV: {exc}")

    report = {
        "phase": 12,
        "artifact": "user-provided-real-audio-corpus",
        "raw_audio_in_git": False,
        "verified_files": verified,
        "failures": failures,
        "status": "PASS" if not failures and len(verified) == len(data["files"]) else "FAIL",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1

if __name__ == "__main__":
    raise SystemExit(main())
