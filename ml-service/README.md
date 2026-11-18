# AttendX 2.0 — ML Prediction Service

FastAPI + Scikit-learn academic risk prediction microservice.

## Setup

```bash
pip install -r requirements.txt
python train.py        # Train model (generates models/risk_model.joblib)
python main.py         # Start API on http://localhost:8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /model/info | Model metadata |
| GET | /model/evaluate | Evaluation metrics |
| POST | /predict | Single student prediction |
| POST | /predict/batch | Batch predictions |

## Data Notice

⚠️ The model is trained on **SYNTHETIC** data for demonstration.
Retrain with real institutional records for production use.

## Environment Variables

```
ML_SERVICE_URL=http://localhost:8000   # Set in backend .env
```
