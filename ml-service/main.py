"""
AttendX 2.0 — ML Prediction FastAPI Service
Provides risk assessment via trained ML model with rule-based fallback.
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import joblib
import json
import os
import numpy as np
from datetime import datetime

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'risk_model.joblib')
META_PATH  = os.path.join(os.path.dirname(__file__), 'models', 'model_metadata.json')

app = FastAPI(
    title="AttendX ML Prediction Service",
    description="Academic risk assessment — Rule-Based + ML Model",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup
model = None
metadata = {}

@app.on_event("startup")
def load_model():
    global model, metadata
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print("✅ ML model loaded")
    else:
        print("⚠️  No trained model found — using rule-based fallback")
    if os.path.exists(META_PATH):
        with open(META_PATH) as f:
            metadata = json.load(f)


# ── Request / Response Models ─────────────────────────────────

class PredictRequest(BaseModel):
    studentId: str
    attendancePercentage: Optional[float] = Field(None, ge=0, le=100)
    internalMarksAverage: Optional[float] = Field(None, ge=0, le=100)
    quizAverage:          Optional[float] = Field(None, ge=0, le=100)
    assignmentCompletion: Optional[float] = Field(None, ge=0, le=100)

class ContributingFactor(BaseModel):
    factor: str
    value:  float
    impact: str

class PredictResponse(BaseModel):
    studentId:            str
    riskLevel:            str
    assessmentType:       str
    riskScore:            float
    riskProbability:      Optional[float]
    contributingFactors:  list
    recommendations:      list
    dataWarnings:         list
    modelVersion:         str
    predictionTimestamp:  str


def rule_based_predict(req: PredictRequest):
    """Transparent rule-based fallback when ML model unavailable or insufficient data."""
    warnings = []
    factors  = []
    score    = 0

    att  = req.attendancePercentage
    intm = req.internalMarksAverage
    quiz = req.quizAverage
    asgn = req.assignmentCompletion

    if att is None:   warnings.append("Attendance data unavailable")
    if intm is None:  warnings.append("Internal marks data unavailable")
    if quiz is None:  warnings.append("Quiz data unavailable")
    if asgn is None:  warnings.append("Assignment data unavailable")

    if att is not None:
        if att < 60:   score += 40; factors.append({"factor":"Attendance","value":att,"impact":"HIGH"})
        elif att < 75: score += 25; factors.append({"factor":"Attendance","value":att,"impact":"HIGH"})
        elif att < 85: score += 10; factors.append({"factor":"Attendance","value":att,"impact":"MEDIUM"})

    if intm is not None:
        if intm < 40:   score += 35; factors.append({"factor":"Internal Marks","value":intm,"impact":"HIGH"})
        elif intm < 55: score += 20; factors.append({"factor":"Internal Marks","value":intm,"impact":"HIGH"})
        elif intm < 70: score += 8;  factors.append({"factor":"Internal Marks","value":intm,"impact":"MEDIUM"})

    if quiz is not None:
        if quiz < 40:   score += 15; factors.append({"factor":"Quiz Average","value":quiz,"impact":"MEDIUM"})
        elif quiz < 55: score += 8;  factors.append({"factor":"Quiz Average","value":quiz,"impact":"LOW"})

    if asgn is not None:
        if asgn < 50:   score += 10; factors.append({"factor":"Assignment Completion","value":asgn,"impact":"MEDIUM"})
        elif asgn < 75: score += 5;  factors.append({"factor":"Assignment Completion","value":asgn,"impact":"LOW"})

    score = min(score, 100)
    risk  = "HIGH" if score >= 50 else "MODERATE" if score >= 25 else "LOW"

    recs = []
    if att  is not None and att  < 75: recs.append("Attend all upcoming classes to improve attendance")
    if intm is not None and intm < 55: recs.append("Seek faculty mentoring for weak subjects")
    if quiz is not None and quiz < 55: recs.append("Practice topic-wise quizzes to improve understanding")
    if asgn is not None and asgn < 75: recs.append("Complete all pending assignments before deadlines")
    if risk == "LOW": recs.append("Keep up the good work and maintain current performance")

    return risk, score, None, factors, recs, warnings, "1.0-rule-based"


def ml_predict(req: PredictRequest):
    """ML model prediction with probability estimate."""
    warnings  = []
    available = {}

    if req.attendancePercentage is not None:   available['attendance_pct']     = req.attendancePercentage
    else: warnings.append("Attendance data unavailable — using median imputation")

    if req.internalMarksAverage is not None:   available['internal_marks_avg'] = req.internalMarksAverage
    else: warnings.append("Internal marks unavailable — using median imputation")

    if req.quizAverage is not None:            available['quiz_avg']           = req.quizAverage
    else: warnings.append("Quiz data unavailable — using median imputation")

    if req.assignmentCompletion is not None:   available['assignment_pct']     = req.assignmentCompletion
    else: warnings.append("Assignment data unavailable — using median imputation")

    # Impute missing with median values from training (approximate)
    defaults = {'attendance_pct': 72, 'internal_marks_avg': 58, 'quiz_avg': 60, 'assignment_pct': 70}
    features = ['attendance_pct', 'internal_marks_avg', 'quiz_avg', 'assignment_pct']
    X = np.array([[available.get(f, defaults[f]) for f in features]])

    pred       = model.predict(X)[0]
    proba      = model.predict_proba(X)[0]
    class_map  = {0: 'LOW', 1: 'MODERATE', 2: 'HIGH'}
    risk       = class_map[pred]
    risk_prob  = round(float(max(proba)), 3)
    score      = round(float(proba[2]) * 100, 1)  # HIGH probability as score

    # Contributing factors from feature importance
    factors = []
    fi = metadata.get('feature_importance', {})
    labels = {
        'attendance_pct':     ('Attendance',          available.get('attendance_pct',     defaults['attendance_pct'])),
        'internal_marks_avg': ('Internal Marks',       available.get('internal_marks_avg', defaults['internal_marks_avg'])),
        'quiz_avg':           ('Quiz Average',          available.get('quiz_avg',           defaults['quiz_avg'])),
        'assignment_pct':     ('Assignment Completion', available.get('assignment_pct',     defaults['assignment_pct'])),
    }
    for feat, (label, val) in labels.items():
        imp = fi.get(feat, 0.25)
        impact = "HIGH" if imp > 0.3 else "MEDIUM" if imp > 0.2 else "LOW"
        factors.append({"factor": label, "value": round(val, 1), "impact": impact})

    recs = []
    att  = available.get('attendance_pct')
    intm = available.get('internal_marks_avg')
    quiz = available.get('quiz_avg')
    asgn = available.get('assignment_pct')
    if att  and att  < 75: recs.append("Attend all upcoming classes to improve attendance")
    if intm and intm < 55: recs.append("Seek faculty mentoring for weak subjects")
    if quiz and quiz < 55: recs.append("Practice topic-wise quizzes")
    if asgn and asgn < 75: recs.append("Complete all pending assignments before deadlines")
    if risk == "LOW":      recs.append("Keep up the good work and maintain current performance")

    return risk, score, risk_prob, factors, recs, warnings, metadata.get('version', '2.0-ml')


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "AttendX ML Service", "status": "running", "model_loaded": model is not None}

@app.get("/health")
def health():
    return {"status": "OK", "model_loaded": model is not None, "timestamp": datetime.now().isoformat()}

@app.get("/model/info")
def model_info():
    return {"model_loaded": model is not None, "metadata": metadata}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    Predict academic risk for a student.
    Uses ML model if available, falls back to rule-based if not.
    """
    available_fields = sum([
        req.attendancePercentage is not None,
        req.internalMarksAverage is not None,
        req.quizAverage is not None,
        req.assignmentCompletion is not None,
    ])

    if available_fields == 0:
        raise HTTPException(status_code=400, detail="At least one academic indicator is required")

    if model is not None:
        risk, score, prob, factors, recs, warnings, version = ml_predict(req)
        assessment_type = "ML_MODEL"
    else:
        risk, score, prob, factors, recs, warnings, version = rule_based_predict(req)
        assessment_type = "RULE_BASED"

    return PredictResponse(
        studentId           = req.studentId,
        riskLevel           = risk,
        assessmentType      = assessment_type,
        riskScore           = score,
        riskProbability     = prob,
        contributingFactors = factors,
        recommendations     = recs,
        dataWarnings        = warnings,
        modelVersion        = version,
        predictionTimestamp = datetime.now().isoformat(),
    )

@app.post("/predict/batch")
def predict_batch(requests: list[PredictRequest]):
    """Batch predict for multiple students."""
    return [predict(r) for r in requests]

@app.get("/model/evaluate")
def evaluate():
    """Return model evaluation metrics."""
    if not metadata:
        return {"error": "No model metadata found"}
    return {
        "model":    metadata.get('model_name'),
        "version":  metadata.get('version'),
        "dataType": metadata.get('data_type'),
        "evaluation": metadata.get('evaluation', {}),
        "features": metadata.get('features', []),
        "warning":  "Metrics based on SYNTHETIC data — retrain with real records for production",
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
