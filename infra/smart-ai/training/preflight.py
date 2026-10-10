#!/usr/bin/env python3
"""Fail-fast checks before starting a SMART AI GPU training run."""

from __future__ import annotations

import os
import sys

import torch


def main() -> None:
    print("SMART AI training preflight")
    print(f"torch={torch.__version__}")
    print(f"cuda_available={torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        raise SystemExit(
            "No CUDA GPU detected. Run the training job on a CUDA-capable host; "
            "the repository does not silently fall back to a long CPU fine-tune."
        )

    print(f"gpu_count={torch.cuda.device_count()}")
    for index in range(torch.cuda.device_count()):
        props = torch.cuda.get_device_properties(index)
        free, total = torch.cuda.mem_get_info(index)
        print({
            "index": index,
            "name": props.name,
            "total_memory_gb": round(total / 1024**3, 2),
            "free_memory_gb": round(free / 1024**3, 2),
        })

    base_model = os.getenv("BASE_MODEL", "Qwen/Qwen3-4B").strip()
    if not base_model:
        raise SystemExit("BASE_MODEL must not be empty.")

    print(f"base_model={base_model}")
    print("mode=ready_for_training")


if __name__ == "__main__":
    main()
