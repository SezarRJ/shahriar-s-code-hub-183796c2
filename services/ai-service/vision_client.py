"""
SHAHID AI Vision Client
Integrates with Google Vision API and Claude (Anthropic) API for construction
stage classification and defect detection.

SRS: FR-3.1 — Classify each photo by construction stage
     FR-3.2 — Detect visible defects and flag as potential snags
     AI Governance — AI only suggests, never decides
"""

import os, json, base64, io
from typing import Optional, List, Dict, Any
from PIL import Image


class VisionClient:
    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        raise NotImplementedError


class GoogleVisionClient(VisionClient):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GOOGLE_VISION_API_KEY', '')
        self.base_url = 'https://vision.googleapis.com/v1/images:annotate'

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        if not self.api_key: return {"error": "GOOGLE_VISION_API_KEY not configured"}
        import httpx
        encoded = base64.b64encode(image_bytes).decode('utf-8')
        payload = {"requests": [{"image": {"content": encoded}, "features": [{"type": "LABEL_DETECTION", "maxResults": 20}, {"type": "OBJECT_LOCALIZATION", "maxResults": 20}, {"type": "TEXT_DETECTION", "maxResults": 10}]}]}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.base_url}?key={self.api_key}", json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code != 200: return {"error": f"Google Vision API error: {resp.status_code}", "details": resp.text}
            return self._parse_results(resp.json())

    def _parse_results(self, data: Dict) -> Dict[str, Any]:
        responses = data.get("responses", [{}])[0]
        labels = responses.get("labelAnnotations", [])
        objects = responses.get("localizedObjectAnnotations", [])
        text = responses.get("textAnnotations", [])
        stage_keywords = {"foundations": ["foundation", "concrete", "excavation", "footing", "basement"], "structure": ["steel", "beam", "column", "rebar", "frame", "structural", "scaffolding"], "mep": ["electrical", "plumbing", "hvac", "mechanical", "pipe", "cable", "wiring"], "finishing": ["paint", "tile", "flooring", "drywall", "plaster", "interior", "facade"], "landscaping": ["landscape", "garden", "paving", "outdoor"]}
        stage_scores = {stage: 0.0 for stage in stage_keywords}
        for label in labels:
            desc, score = label.get("description", "").lower(), label.get("score", 0.0)
            for stage, keywords in stage_keywords.items():
                if any(kw in desc for kw in keywords): stage_scores[stage] = max(stage_scores[stage], score)
        best_stage = max(stage_scores, key=stage_scores.get)
        best_score = stage_scores[best_stage]
        defect_keywords = {"crack": ["crack", "fracture", "split", "fissure"], "water_damage": ["water", "leak", "moisture", "stain", "mold"], "incomplete_work": ["incomplete", "unfinished", "missing", "gap"], "rust": ["rust", "corrosion", "oxidation"], "poor_finishing": ["rough", "uneven", "poor", "bad quality"]}
        defect_flags = []
        for dtype, keywords in defect_keywords.items():
            for label in labels:
                desc, score = label.get("description", "").lower(), label.get("score", 0.0)
                if any(kw in desc for kw in keywords) and score > 0.6:
                    defect_flags.append({"category": dtype, "confidence": round(score, 4), "source": "label", "description": desc})
            for obj in objects:
                name, score = obj.get("name", "").lower(), obj.get("score", 0.0)
                if any(kw in name for kw in keywords) and score > 0.6:
                    defect_flags.append({"category": dtype, "confidence": round(score, 4), "source": "object", "description": name, "bounding_box": obj.get("boundingPoly", {}).get("normalizedVertices", [])})
        extracted_text = text[0].get("description", "") if text else ""
        return {"stage_classification": best_stage if best_score > 0.3 else "unknown", "confidence_score": round(best_score, 4) if best_score > 0.3 else 0.0, "defect_flags": defect_flags, "extracted_text": extracted_text[:500], "model": "google_vision_v1", "raw_labels": [{"description": l["description"], "score": round(l["score"], 4)} for l in labels[:10]]}


class ClaudeVisionClient(VisionClient):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY', '')
        self.base_url = 'https://api.anthropic.com/v1/messages'

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        if not self.api_key: return {"error": "ANTHROPIC_API_KEY not configured"}
        import httpx, re
        encoded = base64.b64encode(image_bytes).decode('utf-8')
        fmt = "jpeg"
        try:
            img = Image.open(io.BytesIO(image_bytes))
            if img.format: fmt = img.format.lower()
            if fmt == "jpg": fmt = "jpeg"
        except Exception: pass
        prompt = ('Analyze this construction site photo. Classify the construction stage: Foundations, Structure, MEP, or Finishing. '
                  'Identify any visible defects: cracks, water damage, incomplete work, rust, or poor finishing. '
                  'Return ONLY a JSON object with this exact format: '
                  '{"stage": "foundations|structure|mep|finishing", "confidence": 0.0-1.0, "defects": [{"category": "crack|water_damage|incomplete_work|rust|poor_finishing", "confidence": 0.0-1.0, "description": "brief description"}], "notes": "brief notes"}')
        payload = {"model": "claude-3-sonnet-20240229", "max_tokens": 1024, "messages": [{"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": f"image/{fmt}", "data": encoded}}, {"type": "text", "text": prompt}]}]}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(self.base_url, json=payload, headers={"Content-Type": "application/json", "x-api-key": self.api_key, "anthropic-version": "2023-06-01"})
            if resp.status_code != 200: return {"error": f"Claude API error: {resp.status_code}", "details": resp.text}
            return self._parse_results(resp.json())

    def _parse_results(self, data: Dict) -> Dict[str, Any]:
        import re
        content = data.get("content", [])
        text = next((item.get("text", "") for item in content if item.get("type") == "text"), "")
        json_text = text
        if "```json" in text: json_text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: json_text = text.split("```")[1].split("```")[0].strip()
        try: parsed = json.loads(json_text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            parsed = json.loads(match.group()) if match else {}
        return {"stage_classification": parsed.get("stage", "unknown"), "confidence_score": round(parsed.get("confidence", 0.0), 4), "defect_flags": [{"category": d.get("category", "unknown"), "confidence": round(d.get("confidence", 0.0), 4), "description": d.get("description", ""), "source": "claude_vision"} for d in parsed.get("defects", [])], "notes": parsed.get("notes", ""), "model": "claude_3_sonnet", "raw_response": text[:1000]}


class AIAggregator:
    def __init__(self):
        self.google = GoogleVisionClient()
        self.claude = ClaudeVisionClient()

    async def analyze(self, image_bytes: bytes) -> Dict[str, Any]:
        g, c = None, None
        try: g = await self.google.analyze(image_bytes)
        except Exception as e: print(f"Google Vision failed: {e}")
        try: c = await self.claude.analyze(image_bytes)
        except Exception as e: print(f"Claude failed: {e}")
        if g is None and c is None: return {"stage_classification": "unknown", "confidence_score": 0.0, "defect_flags": [], "error": "All AI models failed", "model": "aggregator"}
        if g is None or "error" in g: return c if c else g
        if c is None or "error" in c: return g
        g_stage, g_conf, c_stage, c_conf = g.get("stage_classification", "unknown"), g.get("confidence_score", 0.0), c.get("stage_classification", "unknown"), c.get("confidence_score", 0.0)
        best_stage = g_stage if g_conf > c_conf else c_stage
        best_conf = (g_conf * 0.6 + c_conf * 0.4) if g_conf > c_conf else (c_conf * 0.6 + g_conf * 0.4)
        all_defects = g.get("defect_flags", []) + c.get("defect_flags", [])
        seen = set()
        unique = []
        for d in all_defects:
            cat = d["category"]
            if cat not in seen:
                seen.add(cat)
                unique.append(d)
            else:
                existing = next(x for x in unique if x["category"] == cat)
                if d["confidence"] > existing["confidence"]: existing["confidence"] = d["confidence"]
        return {"stage_classification": best_stage, "confidence_score": round(best_conf, 4), "defect_flags": unique, "extracted_text": g.get("extracted_text", ""), "notes": c.get("notes", ""), "model": "ensemble_google_claude", "google_result": g, "claude_result": c}
