"""
SHAHID AI Vision Client
Integrates with Google Vision API and Claude (Anthropic) API for construction
stage classification and defect detection.

SRS: FR-3.1 — Classify each photo by construction stage
     FR-3.2 — Detect visible defects and flag as potential snags
     AI Governance — AI only suggests, never decides
"""

import os
import json
import base64
import httpx
from typing import Optional, List, Dict, Any
from PIL import Image
import io


class VisionClient:
    """Base class for vision API clients."""

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        raise NotImplementedError


class GoogleVisionClient(VisionClient):
    """Google Cloud Vision API client for label detection and object detection."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GOOGLE_VISION_API_KEY', '')
        self.base_url = 'https://vision.googleapis.com/v1/images:annotate'

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        if not self.api_key:
            return {"error": "GOOGLE_VISION_API_KEY not configured"}

        encoded_image = base64.b64encode(image_bytes).decode('utf-8')

        payload = {
            "requests": [
                {
                    "image": {"content": encoded_image},
                    "features": [
                        {"type": "LABEL_DETECTION", "maxResults": 20},
                        {"type": "OBJECT_LOCALIZATION", "maxResults": 20},
                        {"type": "TEXT_DETECTION", "maxResults": 10},
                    ],
                }
            ]
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}?key={self.api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                return {
                    "error": f"Google Vision API error: {response.status_code}",
                    "details": response.text,
                }

            data = response.json()
            return self._parse_results(data)

    def _parse_results(self, data: Dict) -> Dict[str, Any]:
        """Parse Google Vision response into SHAHID AIResult format."""
        responses = data.get("responses", [{}])[0]
        labels = responses.get("labelAnnotations", [])
        objects = responses.get("localizedObjectAnnotations", [])
        text = responses.get("textAnnotations", [])

        # Construction stage classification from labels
        stage_keywords = {
            "foundations": ["foundation", "concrete", "excavation", "footing", "basement"],
            "structure": ["steel", "beam", "column", "rebar", "frame", "structural", "scaffolding"],
            "mep": ["electrical", "plumbing", "hvac", "mechanical", "pipe", "cable", "wiring"],
            "finishing": ["paint", "tile", "flooring", "drywall", "plaster", "interior", "facade"],
            "landscaping": ["landscape", "garden", "paving", "outdoor"],
        }

        stage_scores = {stage: 0.0 for stage in stage_keywords}
        for label in labels:
            desc = label.get("description", "").lower()
            score = label.get("score", 0.0)
            for stage, keywords in stage_keywords.items():
                if any(kw in desc for kw in keywords):
                    stage_scores[stage] = max(stage_scores[stage], score)

        best_stage = max(stage_scores, key=stage_scores.get)
        best_score = stage_scores[best_stage]

        # Defect detection from labels and objects
        defect_keywords = {
            "crack": ["crack", "fracture", "split", "fissure"],
            "water_damage": ["water", "leak", "moisture", "stain", "mold"],
            "incomplete_work": ["incomplete", "unfinished", "missing", "gap"],
            "rust": ["rust", "corrosion", "oxidation"],
            "poor_finishing": ["rough", "uneven", "poor", "bad quality"],
        }

        defect_flags = []
        for defect_type, keywords in defect_keywords.items():
            for label in labels:
                desc = label.get("description", "").lower()
                score = label.get("score", 0.0)
                if any(kw in desc for kw in keywords) and score > 0.6:
                    defect_flags.append({
                        "category": defect_type,
                        "confidence": round(score, 4),
                        "source": "label",
                        "description": desc,
                    })

            for obj in objects:
                name = obj.get("name", "").lower()
                score = obj.get("score", 0.0)
                if any(kw in name for kw in keywords) and score > 0.6:
                    defect_flags.append({
                        "category": defect_type,
                        "confidence": round(score, 4),
                        "source": "object",
                        "description": name,
                        "bounding_box": obj.get("boundingPoly", {}).get("normalizedVertices", []),
                    })

        # Extract text for OCR
        extracted_text = ""
        if text and len(text) > 0:
            extracted_text = text[0].get("description", "")

        return {
            "stage_classification": best_stage if best_score > 0.3 else "unknown",
            "confidence_score": round(best_score, 4) if best_score > 0.3 else 0.0,
            "defect_flags": defect_flags,
            "extracted_text": extracted_text[:500],  # Limit text length
            "model": "google_vision_v1",
            "raw_labels": [
                {"description": l["description"], "score": round(l["score"], 4)}
                for l in labels[:10]
            ],
        }


class ClaudeVisionClient(VisionClient):
    """Anthropic Claude Vision API client for construction analysis."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY', '')
        self.base_url = 'https://api.anthropic.com/v1/messages'

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        if not self.api_key:
            return {"error": "ANTHROPIC_API_KEY not configured"}

        encoded_image = base64.b64encode(image_bytes).decode('utf-8')

        # Determine image format
        image_format = "jpeg"
        try:
            img = Image.open(io.BytesIO(image_bytes))
            if img.format:
                image_format = img.format.lower()
                if image_format == "jpg":
                    image_format = "jpeg"
        except Exception:
            pass

        payload = {
            "model": "claude-3-sonnet-20240229",
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": f"image/{image_format}",
                                "data": encoded_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Analyze this construction site photo. "
                                "Classify the construction stage: Foundations, Structure, MEP, or Finishing. "
                                "Identify any visible defects: cracks, water damage, incomplete work, rust, or poor finishing. "
                                "Return ONLY a JSON object with this exact format: "
                                '{"stage": "foundations|structure|mep|finishing", "confidence": 0.0-1.0, "defects": [{"category": "crack|water_damage|incomplete_work|rust|poor_finishing", "confidence": 0.0-1.0, "description": "brief description"}], "notes": "brief notes"}'
                            ),
                        },
                    ],
                }
            ],
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                self.base_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                },
            )

            if response.status_code != 200:
                return {
                    "error": f"Claude API error: {response.status_code}",
                    "details": response.text,
                }

            data = response.json()
            return self._parse_results(data)

    def _parse_results(self, data: Dict) -> Dict[str, Any]:
        """Parse Claude response into SHAHID AIResult format."""
        content = data.get("content", [])
        text_content = ""
        for item in content:
            if item.get("type") == "text":
                text_content = item.get("text", "")
                break

        # Extract JSON from text (Claude may wrap in markdown)
        json_text = text_content
        if "```json" in text_content:
            json_text = text_content.split("```json")[1].split("```")[0].strip()
        elif "```" in text_content:
            json_text = text_content.split("```")[1].split("```")[0].strip()

        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON object
            import re
            match = re.search(r'\{.*\}', text_content, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                except json.JSONDecodeError:
                    parsed = {}
            else:
                parsed = {}

        stage = parsed.get("stage", "unknown")
        confidence = parsed.get("confidence", 0.0)
        defects = parsed.get("defects", [])
        notes = parsed.get("notes", "")

        return {
            "stage_classification": stage,
            "confidence_score": round(confidence, 4),
            "defect_flags": [
                {
                    "category": d.get("category", "unknown"),
                    "confidence": round(d.get("confidence", 0.0), 4),
                    "description": d.get("description", ""),
                    "source": "claude_vision",
                }
                for d in defects
            ],
            "notes": notes,
            "model": "claude_3_sonnet",
            "raw_response": text_content[:1000],
        }


class AIAggregator:
    """
    Aggregates results from multiple AI vision models.
    Uses ensemble voting for stage classification and union of defect detections.
    """

    def __init__(self):
        self.google_client = GoogleVisionClient()
        self.claude_client = ClaudeVisionClient()

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Run both models and aggregate results.
        Falls back to single model if other fails.
        """
        google_result = None
        claude_result = None

        # Try Google Vision
        try:
            google_result = await self.google_client.analyze(image_bytes)
        except Exception as e:
            print(f"Google Vision failed: {e}")

        # Try Claude
        try:
            claude_result = await self.claude_client.analyze(image_bytes)
        except Exception as e:
            print(f"Claude failed: {e}")

        # If both failed, return error
        if google_result is None and claude_result is None:
            return {
                "stage_classification": "unknown",
                "confidence_score": 0.0,
                "defect_flags": [],
                "error": "All AI models failed",
                "model": "aggregator",
            }

        # If only one succeeded, use it
        if google_result is None or "error" in google_result:
            return claude_result if claude_result else google_result
        if claude_result is None or "error" in claude_result:
            return google_result

        # Ensemble: weighted average of confidence scores
        google_stage = google_result.get("stage_classification", "unknown")
        google_conf = google_result.get("confidence_score", 0.0)
        claude_stage = claude_result.get("stage_classification", "unknown")
        claude_conf = claude_result.get("confidence_score", 0.0)

        # Weighted by confidence
        if google_conf > claude_conf:
            best_stage = google_stage
            best_conf = (google_conf * 0.6 + claude_conf * 0.4)
        else:
            best_stage = claude_stage
            best_conf = (claude_conf * 0.6 + google_conf * 0.4)

        # Union of defect flags (deduplicate by category)
        all_defects = google_result.get("defect_flags", []) + claude_result.get("defect_flags", [])
        seen_categories = set()
        unique_defects = []
        for d in all_defects:
            cat = d["category"]
            if cat not in seen_categories:
                seen_categories.add(cat)
                unique_defects.append(d)
            else:
                # Merge: keep highest confidence
                existing = next(x for x in unique_defects if x["category"] == cat)
                if d["confidence"] > existing["confidence"]:
                    existing["confidence"] = d["confidence"]

        return {
            "stage_classification": best_stage,
            "confidence_score": round(best_conf, 4),
            "defect_flags": unique_defects,
            "extracted_text": google_result.get("extracted_text", ""),
            "notes": claude_result.get("notes", ""),
            "model": "ensemble_google_claude",
            "google_result": google_result,
            "claude_result": claude_result,
        }
