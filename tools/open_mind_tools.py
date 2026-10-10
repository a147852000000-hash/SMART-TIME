"""OPEN MIND AI deterministic tools.

Install: pip install -r tools/requirements-open-mind.txt
All tool functions validate inputs and write outputs under /outputs.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

OUTPUTS = Path(os.getenv("OPEN_MIND_OUTPUTS", "/outputs"))
OUTPUTS.mkdir(parents=True, exist_ok=True)


def _safe_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name)[:120]


def create_pdf(title: str, sections: list[dict[str, Any]], filename: str = "open_mind_report.pdf") -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.enums import TA_RIGHT
    path = OUTPUTS / _safe_name(filename)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    for section in sections:
        story.append(Paragraph(str(section.get("heading", "")), styles["Heading2"]))
        body = str(section.get("body", "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(body.replace("\n", "<br/>"), styles["BodyText"]))
        story.append(Spacer(1, 8))
    SimpleDocTemplate(str(path), pagesize=A4).build(story)
    return str(path)


def create_excel(rows: list[dict[str, Any]], filename: str = "open_mind_report.xlsx") -> str:
    import pandas as pd
    path = OUTPUTS / _safe_name(filename)
    pd.DataFrame(rows).to_excel(path, index=False, engine="openpyxl")
    return str(path)


def create_word(title: str, sections: list[dict[str, Any]], filename: str = "open_mind_report.docx") -> str:
    from docx import Document
    path = OUTPUTS / _safe_name(filename)
    doc = Document()
    doc.add_heading(title, level=0)
    for section in sections:
        doc.add_heading(str(section.get("heading", "")), level=1)
        doc.add_paragraph(str(section.get("body", "")))
    doc.save(path)
    return str(path)


def analyze_dxf(path: str, render_png: bool = True) -> dict[str, Any]:
    import ezdxf
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    counts: dict[str, int] = {}
    bbox = {"min_x": math.inf, "min_y": math.inf, "max_x": -math.inf, "max_y": -math.inf}
    for e in msp:
        typ = e.dxftype()
        counts[typ] = counts.get(typ, 0) + 1
        try:
            for p in e.vertices():
                bbox["min_x"] = min(bbox["min_x"], p.x); bbox["max_x"] = max(bbox["max_x"], p.x)
                bbox["min_y"] = min(bbox["min_y"], p.y); bbox["max_y"] = max(bbox["max_y"], p.y)
        except Exception:
            pass
    result = {"file": str(path), "entities": sum(counts.values()), "by_type": counts, "bounds": bbox}
    (OUTPUTS / "cad_analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    # DXF rendering is intentionally delegated to ezdxf/addons when available; no fake image is produced.
    return result


def estimate_video_speed(video_path: str, meters_per_pixel: float, fps: float | None = None) -> dict[str, Any]:
    """Baseline optical-flow speed estimator. It requires a real calibration scale.
    For vehicle tracking, use the YOLO variant in production; this function refuses
    to produce a physical speed without meters-per-pixel calibration.
    """
    import cv2
    if meters_per_pixel <= 0:
        raise ValueError("meters_per_pixel must be a measured calibration value")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    video_fps = fps or float(cap.get(cv2.CAP_PROP_FPS) or 0)
    if video_fps <= 0:
        raise ValueError("Video FPS is unavailable; provide fps explicitly")
    ok, prev = cap.read()
    if not ok:
        raise ValueError("Video contains no readable frames")
    prev_gray = cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY)
    speeds = []
    while True:
        ok, frame = cap.read()
        if not ok: break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        px_per_frame = float(mag.mean())
        speeds.append(px_per_frame * meters_per_pixel * video_fps)
        prev_gray = gray
    cap.release()
    result = {"video": video_path, "samples": len(speeds), "mean_mps": sum(speeds)/len(speeds) if speeds else None,
              "max_mps": max(speeds) if speeds else None, "assumption": "uniform measured meters_per_pixel; optical flow is not object tracking"}
    (OUTPUTS / "speed_estimation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def google_maps_route(origin: str, destination: str, api_key: str | None = None) -> dict[str, Any]:
    import requests
    key = api_key or os.getenv("GOOGLE_MAPS_API_KEY")
    if not key: raise ValueError("GOOGLE_MAPS_API_KEY is required; no route is fabricated")
    r = requests.get("https://maps.googleapis.com/maps/api/directions/json", params={"origin": origin, "destination": destination, "key": key}, timeout=20)
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "OK": raise RuntimeError(f"Google Maps returned {data.get('status')}")
    route = data["routes"][0]
    leg = route["legs"][0]
    result = {"distance": leg["distance"], "duration": leg["duration"], "start_address": leg["start_address"], "end_address": leg["end_address"]}
    (OUTPUTS / "maps_route.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
