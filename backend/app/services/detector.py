"""CrowdGuard Vision Detector service.
Supports Ultralytics YOLOv8n with automatic lazy-loading and mock fallback.
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import math
import os
from typing import Dict, Optional, Tuple

from PIL import Image

from app.schemas.shared import Flow, VisionAnalyzeResponse, ZONE_BY_ID
from app.services import store

logger = logging.getLogger(__name__)

# Track previous frame centroid per zone for optical flow / movement estimation
_prev_centroids: Dict[str, Tuple[float, float]] = {}

# Cached YOLO model instance and mock flag
_model = None
_mock: bool = os.getenv("CROWDGUARD_MOCK_VISION", "0") == "1"


def get_model():
    """Lazily load YOLOv8n model if not mocked."""
    global _model, _mock
    if _mock:
        return None
    if _model is not None:
        return _model

    try:
        from ultralytics import YOLO  # type: ignore

        logger.info("Loading YOLOv8n model...")
        _model = YOLO("yolov8n.pt")
        return _model
    except Exception as exc:
        logger.warning(f"Could not load ultralytics YOLO model ({exc}). Falling back to mock vision detector.")
        _mock = True
        return None


def reset_detector_state():
    """Reset flow centroids tracking."""
    global _prev_centroids
    _prev_centroids.clear()


def calculate_flow(zone_id: str, centres: list[Tuple[float, float]], width: int, height: int) -> Flow:
    """Calculate centroid movement between consecutive frames for a zone."""
    global _prev_centroids

    if not centres or width <= 0 or height <= 0:
        return Flow(dx=0.0, dy=0.0, magnitude=0.0)

    cur_cx = sum(c[0] for c in centres) / len(centres)
    cur_cy = sum(c[1] for c in centres) / len(centres)

    if zone_id in _prev_centroids:
        prev_cx, prev_cy = _prev_centroids[zone_id]
        dx = round((cur_cx - prev_cx) / float(width), 4)
        dy = round((cur_cy - prev_cy) / float(height), 4)
        magnitude = round(math.sqrt(dx * dx + dy * dy), 4)
    else:
        dx, dy, magnitude = 0.0, 0.0, 0.0

    _prev_centroids[zone_id] = (cur_cx, cur_cy)
    return Flow(dx=dx, dy=dy, magnitude=magnitude)


def resize_max_dim(pil_img: Image.Image, max_dim: int = 640) -> Image.Image:
    """Downscale image keeping aspect ratio so longest side <= max_dim."""
    w, h = pil_img.size
    if max(w, h) <= max_dim:
        return pil_img

    if w >= h:
        new_w = max_dim
        new_h = int(h * (max_dim / float(w)))
    else:
        new_h = max_dim
        new_w = int(w * (max_dim / float(h)))

    return pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def analyze_image(image_bytes: bytes, zone_id: str) -> VisionAnalyzeResponse:
    """Analyze image bytes for person count, density, flow, and confidence."""
    # 1. Decode and validate image
    try:
        img_buffer = io.BytesIO(image_bytes)
        pil_image = Image.open(img_buffer)
        pil_image.verify()
        # Re-open after verify as per PIL documentation
        img_buffer.seek(0)
        pil_image = Image.open(img_buffer).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Invalid or undecodable image: {exc}") from exc

    zone = ZONE_BY_ID.get(zone_id)
    if not zone:
        raise ValueError(f"Unknown zone_id: {zone_id}")

    width, height = pil_image.size
    timestamp = store.utcnow()
    model = get_model()

    # 2. Real YOLO detection if available
    if model is not None:
        try:
            # Class 0 in COCO is person
            results = model(pil_image, classes=[0], conf=0.25, verbose=False)
            res = results[0]
            boxes = res.boxes

            person_count = len(boxes)
            centres: list[Tuple[float, float]] = []
            confidences: list[float] = []

            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                cx = (xyxy[0] + xyxy[2]) / 2.0
                cy = (xyxy[1] + xyxy[3]) / 2.0
                centres.append((cx, cy))
                confidences.append(float(box.conf[0]))

            confidence = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
            flow = calculate_flow(zone_id, centres, width, height)
            density_per_sqm = round(person_count / zone.area_sqm, 4)

            # Generate downscaled annotated image
            annotated_array = res.plot()  # BGR numpy array
            annotated_pil = Image.fromarray(annotated_array[..., ::-1])  # Convert BGR to RGB
            annotated_pil = resize_max_dim(annotated_pil, max_dim=640)

            out_buf = io.BytesIO()
            annotated_pil.save(out_buf, format="JPEG", quality=80)
            annotated_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")

            return VisionAnalyzeResponse(
                zone_id=zone_id,
                timestamp=timestamp,
                person_count=person_count,
                density_per_sqm=density_per_sqm,
                flow=flow,
                confidence=confidence,
                annotated_image_b64=annotated_b64,
                model_name="yolov8n",
                mocked=False,
            )
        except Exception as exc:
            logger.warning(f"YOLO inference failed ({exc}), using mock fallback.")

    # 3. Deterministic mock path
    # Hash bytes into a plausible range (e.g. 10 to 65 people)
    hash_val = int(hashlib.sha256(image_bytes).hexdigest()[:8], 16)
    person_count = (hash_val % 55) + 10
    density_per_sqm = round(person_count / zone.area_sqm, 4)

    # Mock flow
    flow = Flow(dx=0.0, dy=0.0, magnitude=0.0)

    return VisionAnalyzeResponse(
        zone_id=zone_id,
        timestamp=timestamp,
        person_count=person_count,
        density_per_sqm=density_per_sqm,
        flow=flow,
        confidence=0.88,
        annotated_image_b64=None,
        model_name="mock",
        mocked=True,
    )
