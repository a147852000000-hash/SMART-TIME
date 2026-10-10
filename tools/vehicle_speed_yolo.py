from __future__ import annotations
import os
from collections import defaultdict


def estimate_vehicle_speeds(video_path: str, meters_per_pixel: float, model_name: str = "yolo11n.pt") -> dict:
    """Track vehicles and estimate speed. Calibration is mandatory; no physical units are guessed."""
    if meters_per_pixel <= 0: raise ValueError("meters_per_pixel must be a measured calibration value")
    from ultralytics import YOLO
    import cv2
    model = YOLO(model_name)
    cap = cv2.VideoCapture(video_path)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    if fps <= 0: raise ValueError("Video FPS unavailable")
    track_positions = defaultdict(list)
    samples = defaultdict(list)
    frame_index = 0
    while True:
        ok, frame = cap.read()
        if not ok: break
        results = model.track(frame, persist=True, verbose=False, classes=[2, 3, 5, 7])
        if not results: continue
        boxes = results[0].boxes
        if boxes.id is None: continue
        for box, tid in zip(boxes.xyxy.cpu().tolist(), boxes.id.int().cpu().tolist()):
            x1, y1, x2, y2 = box
            center = ((x1+x2)/2, (y1+y2)/2)
            track_positions[tid].append((frame_index, center))
            if len(track_positions[tid]) >= 2:
                f0, p0 = track_positions[tid][-2]; f1, p1 = track_positions[tid][-1]
                dt = (f1-f0)/fps
                if dt > 0:
                    px = ((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2) ** 0.5
                    samples[tid].append(px * meters_per_pixel / dt)
        frame_index += 1
    cap.release()
    per_vehicle = {str(tid): {"mean_mps": sum(v)/len(v) if v else None, "max_mps": max(v) if v else None, "samples": len(v)} for tid, v in samples.items()}
    return {"video": video_path, "fps": fps, "meters_per_pixel": meters_per_pixel, "vehicles": per_vehicle,
            "warning": "Image-plane calibration alone is sensitive to perspective; use homography/road-plane calibration for production accuracy."}
