#!/usr/bin/env python3
"""
Phase 12 — EGYSpeak acquisition + pairing validation.
Run only in an authorized external workspace (for example Kaggle).
Never writes raw audio into Git.

Expected source:
  MohamedGomaa30/EGYSpeak
  CC-BY-4.0
  147,979 Egyptian Arabic WAV clips with metadata.

This script is intentionally not a training script.
"""
from __future__ import annotations

import csv
import hashlib
import json
import tarfile
from pathlib import Path

from huggingface_hub import snapshot_download

REPO_ID = "MohamedGomaa30/EGYSpeak"
ROOT = Path("/kaggle/working/phase12-egyspeak")
DATASET_DIR = ROOT / "dataset"
REPORT = ROOT / "phase12-egyspeak-validation.json"
ROOT.mkdir(parents=True, exist_ok=True)

snapshot_download(
    repo_id=REPO_ID,
    repo_type="dataset",
    local_dir=str(DATASET_DIR),
)

extract_root = (DATASET_DIR / "train").resolve()
for shard in sorted((DATASET_DIR / "train").glob("audio_shard_*.tar")):
    with tarfile.open(shard, "r:*") as tf:
        members = tf.getmembers()
        for member in members:
            target = (extract_root / member.name).resolve()
            if target != extract_root and extract_root not in target.parents:
                raise RuntimeError(f"Unsafe archive member: {member.name}")
        tf.extractall(extract_root, members=members)

metadata = DATASET_DIR / "metadata.csv"
if not metadata.exists():
    raise RuntimeError("metadata.csv was not acquired")

pairs = 0
missing = []
bad_audio = []
hashes = []
seen_transcripts = set()
duplicate_transcripts = 0

with metadata.open("r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f, delimiter="|")
    if "file_name" not in reader.fieldnames or "transcription" not in reader.fieldnames:
        raise RuntimeError("Unexpected EGYSpeak metadata columns")

    for row in reader:
        pairs += 1
        rel = row["file_name"].strip()
        text = row["transcription"].strip()
        audio = DATASET_DIR / rel

        if not audio.exists():
            missing.append(rel)
            continue

        if audio.suffix.lower() != ".wav":
            bad_audio.append({"file": rel, "reason": "not_wav"})
            continue

        if text in seen_transcripts:
            duplicate_transcripts += 1
        seen_transcripts.add(text)

        h = hashlib.sha256()
        with audio.open("rb") as af:
            for chunk in iter(lambda: af.read(1024 * 1024), b""):
                h.update(chunk)
        hashes.append({"file_name": rel, "sha256": h.hexdigest()})

result = {
    "phase": 12,
    "source": REPO_ID,
    "license": "CC-BY-4.0",
    "metadata_rows": pairs,
    "missing_audio_count": len(missing),
    "bad_audio_count": len(bad_audio),
    "duplicate_transcript_count": duplicate_transcripts,
    "sha256_manifest_count": len(hashes),
    "raw_audio_in_git": False,
    "training_started": False,
    "status": "PASS" if pairs > 0 and not missing and not bad_audio and len(hashes) == pairs else "FAIL",
    "missing_examples": missing[:20],
    "bad_audio_examples": bad_audio[:20],
    "note": "Audio remains outside Git; this report is the reproducibility artifact."
}
REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
