"""
SHAHID AI Service - Feedback Loop Implementation
GAP FIX: AI-03 - Feedback Loop for AI Predictions
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, UUID4
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

class VerificationRequest(BaseModel):
    is_correct: bool
    corrected_stage: Optional[str] = None
    notes: Optional[str] = None

async def verify_service_token(x_service_token: str = Header(None)):
    expected_token = os.getenv("INTERNAL_SERVICE_TOKEN")
    if expected_token and x_service_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid service token")

@app.patch("/results/{photo_id}/verify", dependencies=[Depends(verify_service_token)])
async def verify_ai_result(photo_id: UUID4, request: VerificationRequest):
    """
    Allows a Project Manager to confirm or correct an AI prediction.
    """
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()
        
        status = 'verified' if request.is_correct else 'corrected'
        
        cursor.execute(
            """
            UPDATE ai_results 
            SET verification_status = %s, 
                stage_classification = COALESCE(%s, stage_classification),
                notes = COALESCE(%s, notes)
            WHERE photo_id = %s
            """,
            (status, request.corrected_stage, request.notes, str(photo_id))
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"status": "success", "verification_status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
