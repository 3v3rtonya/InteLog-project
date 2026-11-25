"""
assess.py - ML Model API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user

router = APIRouter(prefix="/assess", tags=["Assessment"])

class LogbookAssessmentRequest(BaseModel):
    text: str

class LogbookAssessmentResponse(BaseModel):
    classification: str
    confidence: float
    probabilities: dict
    feedback: str


@router.get("/warmup")
def warmup_model():
    """
    Public endpoint used by start.bat to pre-load the AI model into memory
    on startup (no authentication required). Running a classification on a
    throwaway string forces PyTorch to load the weights before the first
    real intern request arrives.
    """
    try:
        from backend.services.model_service import _load_model
        _load_model()
        return {"status": "ok", "message": "AI model loaded and ready."}
    except ImportError:
        return {"status": "unavailable", "message": "ML dependencies not installed. Run: pip install -r backend/requirements-ml.txt"}
    except Exception as e:
        # Return 200 so start.bat curl check does not fail — the model will
        # simply load lazily on the first real /assess/logbook request.
        return {"status": "degraded", "message": str(e)}


@router.post("/logbook", response_model=LogbookAssessmentResponse)
def assess_logbook_entry(
    payload: LogbookAssessmentRequest,
    user = Depends(get_current_user)
):
    """
    Exposes the logbook evaluation model.
    Provides instant pre-submission evaluation, generating a pedagogical feedback layer.
    Requires a valid JWT (all authenticated roles).
    """
    try:
        from backend.services.model_service import classify_entry, generate_feedback
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="ML assessment feature is not available on this deployment."
        )
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
