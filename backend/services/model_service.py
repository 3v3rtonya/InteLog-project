import os
import json
import logging

logger = logging.getLogger(__name__)

# Lazy initialization variables
tokenizer = None
model = None
label_map = None

# Calculate absolute path to the model directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "intel_logbook_model")

def _load_model():
    global tokenizer, model, label_map
    if model is not None:
        return
    
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        import torch

        logger.info(f"Loading logbook model from {MODEL_DIR}")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        model.eval()

        label_map_path = os.path.join(MODEL_DIR, "label_mapping.json")
        if os.path.exists(label_map_path):
            with open(label_map_path) as f:
                data = json.load(f)
                # handle if it's already a dict or if it's nested
                label_map = data.get("id2label", data) if "id2label" in data else data
        else:
            # Fallback
            label_map = {"0": "INADEQUATE", "1": "LOW_DETAIL", "2": "HIGH_QUALITY"}
            
        logger.info("Logbook classification model loaded successfully.")
    except ImportError as e:
        raise RuntimeError(
            "ML dependencies (torch, transformers) are not installed. "
            "Run: pip install -r backend/requirements-ml.txt"
        ) from e
    except Exception as e:
        logger.error(f"Failed to load classification model: {e}")
        raise


def classify_entry(text: str):
    """
    Runs text through the classification model and returns probabilities.
    Will lazily load the model on first call.
    """
    import torch
    
    if not text or len(text.strip()) == 0:
        return {
            "class": "INADEQUATE",
            "confidence": 1.0,
            "probabilities": {"INADEQUATE": 1.0, "LOW_DETAIL": 0.0, "HIGH_QUALITY": 0.0}
        }
        
    if not model:
        _load_model()
        
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1).squeeze().tolist()
        pred_id = int(torch.argmax(logits, dim=-1))
    
    # In case the model output dimension is somewhat different (e.g. 1D tensor vs list)
    if not isinstance(probs, list):
        probs = [probs]
        
    class_name = label_map.get(str(pred_id), "UNKNOWN")
    
    return {
        "class": class_name,
        "confidence": probs[pred_id] if pred_id < len(probs) else 0.0,
        "probabilities": {
            "INADEQUATE": probs[0] if len(probs) > 0 else 0.0,
            "LOW_DETAIL": probs[1] if len(probs) > 1 else 0.0,
            "HIGH_QUALITY": probs[2] if len(probs) > 2 else 0.0
        }
    }


def generate_feedback(class_name: str) -> str:
    """Generate pedagogical feedback based on model classification."""
    if class_name == "INADEQUATE":
        return "Please specify actual technical activities rather than generic attendance. Add more detail about the work done."
    elif class_name == "LOW_DETAIL":
        return "Your entry is plausible but lacks specific tools, software versions, measurements, or methodologies. Please elaborate."
    elif class_name == "HIGH_QUALITY":
        return "Excellent entry! It meets academic standards for faculty review."
    return "Entry received."

