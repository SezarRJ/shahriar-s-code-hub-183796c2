"""
SHAHID AI Service
Processes photos for construction stage classification and defect detection.
Year 1: Uses pre-trained models / APIs (Google Vision API, Claude Vision).
Year 2: Custom model training deferred.

Updated: Full integration with Google Vision API and Claude Vision.
Implements concurrent workers with semaphore for throughput.
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime
from typing import Optional, List, Annotated
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import httpx
import redis.asyncio as redis
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Depends
from pydantic import BaseModel, UUID4
from dotenv import load_dotenv

from vision_client import AIAggregator, VisionClient, GoogleVisionClient, ClaudeVisionClient

load_dotenv()

app = FastAPI(title="SHAHID AI Service", version="1.1.0")

# Redis connection
redis_client = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379"),
    decode_responses=True
)

# AI Model aggregator
ai_aggregator = AIAggregator()

# Concurrency limit: 10 parallel AI calls
ai_semaphore = asyncio.Semaphore(10)

# Database connection helper
def get_db():
    conn = psycopg2.connect(
        os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    )
    return conn


class AIResultRequest(BaseModel):
    photo_id: UUID4
    image_url: str


class AIResultResponse(BaseModel):
    photo_id: str
    stage_classification: Optional[str] = None
    confidence_score: Optional[float] = None
    defect_flags: List[dict] = []
    processed_at: str
    model_version: str = "v1"
    extracted_text: str = ""
    notes: str = ""


async def verify_service_token(x_service_token: Annotated[str, Header()] = None):
    """
    Dependency to verify that the request comes from an internal service.
    """
    expected_token = os.getenv("INTERNAL_SERVICE_TOKEN")
    if not expected_token:
        # Log warning in production, but allow in dev if not set
        return
    
    if x_service_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid or missing internal service token")


async def validate_image_url(url: str):
    """
    Validate that the image URL is safe to prevent SSRF.
    Allow only http/https and specifically allow S3/MinIO endpoint.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(status_code=400, detail=f"Unsupported URL scheme: {parsed.scheme}")
        
        # Allowlist check: allow the configured S3 endpoint or localhost for dev
        allowed_hosts = [
            os.getenv("S3_ENDPOINT", "").replace("http://", "").replace("https://", "").split(":")[0],
            "localhost",
            "127.0.0.1"
        ]
        
        if parsed.hostname not in allowed_hosts:
            raise HTTPException(status_code=400, detail=f"Forbidden image host: {parsed.hostname}")
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Invalid image URL: {str(e)}")


async def download_image_from_url(image_url: str) -> bytes:
    """Download image from S3/MinIO or HTTP URL."""
    await validate_image_url(image_url)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(image_url)
        if response.status_code != 200:
            print(f"Image download failed: {image_url} status={response.status_code}", flush=True)
            raise HTTPException(
                status_code=502,
                detail="Failed to download image"
            )
        return response.content


async def analyze_with_aggregator(image_bytes: bytes) -> dict:
    """Run AI analysis with concurrency limit."""
    async with ai_semaphore:
        return await ai_aggregator.analyze(image_bytes)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "1.1.0",
        "models": {
            "google_vision": bool(os.getenv("GOOGLE_VISION_API_KEY")),
            "claude_vision": bool(os.getenv("ANTHROPIC_API_KEY")),
        }
    }


@app.post("/analyze", response_model=AIResultResponse, dependencies=[Depends(verify_service_token)])
async def analyze_photo(request: AIResultRequest):
    """
    Analyze a single photo for construction stage classification and defect detection.
    """
    try:
        # Download image from URL
        image_bytes = await download_image_from_url(request.image_url)

        # Run AI analysis
        result = await analyze_with_aggregator(image_bytes)

        if "error" in result and result["error"]:
            if not os.getenv("GOOGLE_VISION_API_KEY") and not os.getenv("ANTHROPIC_API_KEY"):
                result = simulate_classification(image_bytes)
            else:
                raise HTTPException(status_code=503, detail=result["error"])

        # Store result in database
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            INSERT INTO ai_results (photo_id, stage_classification, confidence_score, defect_flags, model_version, extracted_text, notes, verification_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
            ON CONFLICT (photo_id) DO UPDATE SET
                stage_classification = EXCLUDED.stage_classification,
                confidence_score = EXCLUDED.confidence_score,
                defect_flags = EXCLUDED.defect_flags,
                model_version = EXCLUDED.model_version,
                extracted_text = EXCLUDED.extracted_text,
                notes = EXCLUDED.notes,
                reprocessed_at = NOW(),
                verification_status = 'pending'
            RETURNING *
            """,
            (
                str(request.photo_id),
                result.get("stage_classification", "unknown"),
                result.get("confidence_score", 0.0),
                json.dumps(result.get("defect_flags", [])),
                result.get("model", "aggregator_v1"),
                result.get("extracted_text", ""),
                result.get("notes", ""),
            ),
        )
        db_result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()

        defect_flags = result.get("defect_flags", [])
        if defect_flags and len(defect_flags) > 0:
            await create_snag_from_defects(str(request.photo_id), defect_flags)

        return AIResultResponse(
            photo_id=str(request.photo_id),
            stage_classification=result.get("stage_classification"),
            confidence_score=result.get("confidence_score"),
            defect_flags=result.get("defect_flags", []),
            processed_at=datetime.utcnow().isoformat(),
            model_version=result.get("model", "aggregator_v1"),
            extracted_text=result.get("extracted_text", ""),
            notes=result.get("notes", ""),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"analyze_photo error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Internal processing error")


@app.post("/batch-analyze", dependencies=[Depends(verify_service_token)])
async def batch_analyze(background_tasks: BackgroundTasks):
    """
    Queue all unprocessed photos for batch analysis.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT p.id, p.file_url
            FROM photos p
            LEFT JOIN ai_results ai ON ai.photo_id = p.id
            WHERE ai.id IS NULL
            LIMIT 100
            """
        )
        photos = cursor.fetchall()
        cursor.close()
        conn.close()

        queued = 0
        for photo in photos:
            await redis_client.lpush("ai:queue", json.dumps({
                "photo_id": str(photo["id"]),
                "image_url": photo["file_url"],
                "queued_at": datetime.utcnow().isoformat(),
            }))
            queued += 1

        return {"queued": queued, "status": "processing"}

    except Exception as e:
        print(f"batch_analyze error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Internal processing error")


@app.get("/results/{photo_id}", dependencies=[Depends(verify_service_token)])
async def get_results(photo_id: UUID4):
    """
    Retrieve AI results for a specific photo.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM ai_results WHERE photo_id = %s", (str(photo_id),))
        result = cursor.fetchone()
        cursor.close()
        conn.close()

        if not result:
            raise HTTPException(status_code=404, detail="AI results not found for this photo")

        return dict(result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"get_results error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Internal processing error")


def simulate_classification(image_bytes: bytes) -> dict:
    """
    Fallback simulation for development when no AI keys are configured.
    """
    image_hash = hashlib.md5(image_bytes[:1024]).hexdigest()
    stages = ["foundations", "structure", "mep", "finishing"]
    stage_index = int(image_hash[:8], 16) % 4
    stage = stages[stage_index]
    confidence = 0.6 + (int(image_hash[8:12], 16) % 30) / 100.0

    defect_categories = ["crack", "water_damage", "incomplete_work", "rust"]
    defects = []
    if int(image_hash[12:16], 16) % 100 < 30:
        defect_count = 1 + (int(image_hash[16:20], 16) % 2)
        for i in range(defect_count):
            cat_index = (int(image_hash[20+i*4:24+i*4], 16) + i) % 4
            defects.append({
                "category": defect_categories[cat_index],
                "confidence": round(0.5 + (int(image_hash[24+i*4:28+i*4], 16) % 40) / 100.0, 4),
                "description": f"Detected {defect_categories[cat_index]} during simulation",
                "source": "simulated",
                "note": "This is simulated data. No AI model was called.",
            })

    return {
        "stage_classification": stage,
        "confidence_score": round(confidence, 4),
        "defect_flags": defects,
        "extracted_text": "",
        "notes": f"SIMULATED ANALYSIS. Deterministic classification based on image hash prefix.",
        "model": "simulated_dev",
    }


async def create_snag_from_defects(photo_id: str, defects: List[dict]) -> None:
    """
    Auto-create snag entries for detected defects.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT p.capture_point_id, cp.zone_id, z.project_id
            FROM photos p
            JOIN capture_points cp ON cp.id = p.capture_point_id
            JOIN zones z ON z.id = cp.zone_id
            WHERE p.id = %s
        """, (photo_id,))
        photo_info = cursor.fetchone()

        if not photo_info:
            return

        seen_categories = set()
        for defect in defects:
            category = defect.get("category", "unknown")
            if category in seen_categories:
                continue
            seen_categories.add(category)

            confidence = defect.get("confidence", 0.0)
            severity = "low" if confidence < 0.7 else "medium" if confidence < 0.85 else "high"

            cursor.execute("""
                INSERT INTO snags (project_id, photo_id, capture_point_id, category, severity, status, description, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (project_id, photo_id, category) DO NOTHING
            """, (
                photo_info["project_id"],
                photo_id,
                photo_info["capture_point_id"],
                category,
                severity,
                "open",
                f"AI detected {category} with confidence {confidence:.2f}. Source: {defect.get('source', 'unknown')}. {defect.get('description', '')}",
                "ai_system",
            ))

        conn.commit()
        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Failed to create snag from defects: {e}")


async def ai_worker():
    """
    Continuously process photos from the Redis queue.
    """
    while True:
        try:
            job_data = await redis_client.brpop("ai:queue", timeout=30)
            if not job_data:
                await asyncio.sleep(1)
                continue

            job = json.loads(job_data[1])
            photo_id = job["photo_id"]
            image_url = job["image_url"]

            print(f"Processing AI for photo {photo_id}")

            request = AIResultRequest(photo_id=photo_id, image_url=image_url)
            try:
                await analyze_photo(request)
                print(f"✅ AI analysis completed for photo {photo_id}")
            except Exception as e:
                print(f"❌ AI analysis failed for photo {photo_id}: {e}")

        except Exception as e:
            print(f"AI worker error: {e}")
            await asyncio.sleep(5)


@app.on_event("startup")
async def startup():
    asyncio.create_task(ai_worker())
    print("AI Service started. Models available:")
    print(f"  - Google Vision: {bool(os.getenv('GOOGLE_VISION_API_KEY'))}")
    print(f"  - Claude Vision: {bool(os.getenv('ANTHROPIC_API_KEY'))}")
    if not os.getenv('GOOGLE_VISION_API_KEY') and not os.getenv('ANTHROPIC_API_KEY'):
        print("  ⚠️ No AI API keys configured. Running in simulation mode.")
