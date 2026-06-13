"""
SHAHID AI Service
Processes photos for construction stage classification and defect detection.
Year 1: Uses pre-trained models / APIs (Google Vision, Claude).
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime
from typing import Optional, List

import httpx
import redis.asyncio as redis
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, UUID4
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SHAHID AI Service", version="1.0.0")

# Redis connection
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)

# Database connection helper
def get_db():
    conn = psycopg2.connect(os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres"))
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service", "version": "1.0.0"}


@app.post("/analyze", response_model=AIResultResponse)
async def analyze_photo(request: AIResultRequest):
    """
    Analyze a single photo for construction stage classification and defect detection.
    In Year 1, this simulates or delegates to external APIs.
    """
    try:
        # Fetch photo from URL or download
        # In production: download image from S3, analyze with Google Vision / Claude

        # Simulated classification for Year 1 MVP
        stage_classification = "structure"
        confidence_score = 0.85
        defect_flags = []

        # Store result in database
        conn = get_db()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            INSERT INTO ai_results (photo_id, stage_classification, confidence_score, defect_flags, model_version)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (photo_id) DO UPDATE SET
                stage_classification = EXCLUDED.stage_classification,
                confidence_score = EXCLUDED.confidence_score,
                defect_flags = EXCLUDED.defect_flags,
                model_version = EXCLUDED.model_version,
                reprocessed_at = NOW()
            RETURNING *
            """,
            (str(request.photo_id), stage_classification, confidence_score, json.dumps(defect_flags), "v1"),
        )
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()

        return AIResultResponse(
            photo_id=str(request.photo_id),
            stage_classification=stage_classification,
            confidence_score=confidence_score,
            defect_flags=defect_flags,
            processed_at=datetime.utcnow().isoformat(),
            model_version="v1",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-analyze")
async def batch_analyze():
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/{photo_id}")
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Background worker to process AI queue
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

            # Simulate analysis delay
            await asyncio.sleep(0.5)

            # Run analysis
            await analyze_photo(AIResultRequest(photo_id=photo_id, image_url=image_url))
            print(f"Processed AI for photo {photo_id}")

        except Exception as e:
            print(f"AI worker error: {e}")
            await asyncio.sleep(5)


@app.on_event("startup")
async def startup():
    asyncio.create_task(ai_worker())
