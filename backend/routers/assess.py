"""
assess.py - ML Model API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.services.model_service import classify_entry, generate_feedback

router = APIRouter(prefix="/assess", tags=["Assessment"])

class LogbookAssessmentRequest(BaseModel):
    text: str

class LogbookAssessmentResponse(BaseModel):
    classification: str
    confidence: float
    probabilities: dict
    feedback: str

@router.post("/logbook", response_model=LogbookAssessmentResponse)
def assess_logbook_entry(
    payload: LogbookAssessmentRequest,
    user = Depends(get_current_user)
):
    """
    Exposes the logbook evaluation model.
    Provides instant pre-submission evaluation, generating a pedagogical feedback layer.
    """
    try:
        result = classify_entry(payload.text)
        feedback = generate_feedback(result["class"])
        return LogbookAssessmentResponse(
            classification=result["class"],
            confidence=result["confidence"],
            probabilities=result["probabilities"],
            feedback=feedback
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
