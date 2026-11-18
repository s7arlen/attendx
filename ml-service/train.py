"""
AttendX 2.0 — ML Training Pipeline
Trains a Random Forest + Logistic Regression on synthetic data.
Synthetic data is clearly labelled — never presented as real student data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.pipeline import Pipeline
import joblib
import json
import os
from datetime import datetime

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def generate_synthetic_data(n=800, seed=42):
    """
    Generate synthetic academic data for demonstration.
    CLEARLY LABELLED AS SYNTHETIC — not real student records.
    Risk label derived from multiple correlated indicators.
    """
    np.random.seed(seed)
    
    attendance     = np.clip(np.random.normal(72, 18, n), 0, 100)
    internal_marks = np.clip(np.random.normal(58, 20, n), 0, 100)
    quiz_avg       = np.clip(np.random.normal(60, 18, n), 0, 100)
    assignment_pct = np.clip(np.random.normal(70, 20, n), 0, 100)

    # Risk label: based on combined academic indicators
    risk_score = (
        (100 - attendance)     * 0.35 +
        (100 - internal_marks) * 0.35 +
        (100 - quiz_avg)       * 0.15 +
        (100 - assignment_pct) * 0.15
    )
    # Add noise
    risk_score += np.random.normal(0, 5, n)
    risk_score = np.clip(risk_score, 0, 100)

    # Labels
    risk_label = np.where(risk_score >= 55, 2,     # HIGH
                 np.where(risk_score >= 35, 1, 0)) # MODERATE / LOW

    df = pd.DataFrame({
        'attendance_pct':     attendance,
        'internal_marks_avg': internal_marks,
        'quiz_avg':           quiz_avg,
        'assignment_pct':     assignment_pct,
        'risk_label':         risk_label,
    })

    return df

def train():
    print("=" * 55)
    print(" AttendX 2.0 — ML Training Pipeline")
    print(" DATA TYPE: SYNTHETIC (demonstration only)")
    print("=" * 55)

    df = generate_synthetic_data(800)
    print(f"\nDataset: {len(df)} synthetic records")
    print(f"Class distribution: {dict(zip(['LOW','MODERATE','HIGH'], np.bincount(df['risk_label'])))}")

    features = ['attendance_pct', 'internal_marks_avg', 'quiz_avg', 'assignment_pct']
    X = df[features].values
    y = df['risk_label'].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # ── Random Forest ─────────────────────────────────────────
    rf_pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight='balanced'))
    ])
    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_cv  = cross_val_score(rf_pipeline, X, y, cv=5, scoring='accuracy').mean()

    print(f"\n── Random Forest ──────────────────────────────")
    print(f"Test Accuracy : {rf_acc:.3f}")
    print(f"CV  Accuracy  : {rf_cv:.3f}")
    print(classification_report(y_test, rf_preds, target_names=['LOW', 'MODERATE', 'HIGH']))

    # ── Logistic Regression ───────────────────────────────────
    lr_pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf', LogisticRegression(max_iter=500, random_state=42, class_weight='balanced'))
    ])
    lr_pipeline.fit(X_train, y_train)
    lr_preds = lr_pipeline.predict(X_test)
    lr_acc = accuracy_score(y_test, lr_preds)
    lr_cv  = cross_val_score(lr_pipeline, X, y, cv=5, scoring='accuracy').mean()

    print(f"\n── Logistic Regression ────────────────────────")
    print(f"Test Accuracy : {lr_acc:.3f}")
    print(f"CV  Accuracy  : {lr_cv:.3f}")
    print(classification_report(y_test, lr_preds, target_names=['LOW', 'MODERATE', 'HIGH']))

    # Pick best
    best_pipeline = rf_pipeline if rf_acc >= lr_acc else lr_pipeline
    best_name     = 'RandomForest' if rf_acc >= lr_acc else 'LogisticRegression'
    best_acc      = max(rf_acc, lr_acc)
    best_cv       = rf_cv if rf_acc >= lr_acc else lr_cv
    best_preds    = rf_preds if rf_acc >= lr_acc else lr_preds

    print(f"\n✅ Best model: {best_name} (acc={best_acc:.3f})")

    # Save model
    model_path = os.path.join(MODELS_DIR, 'risk_model.joblib')
    joblib.dump(best_pipeline, model_path)

    # Feature importance (RF only)
    feature_importance = {}
    if best_name == 'RandomForest':
        clf = best_pipeline.named_steps['clf']
        for fname, imp in zip(features, clf.feature_importances_):
            feature_importance[fname] = round(float(imp), 4)

    # Save metadata
    cm = confusion_matrix(y_test, best_preds).tolist()
    report = classification_report(y_test, best_preds, target_names=['LOW','MODERATE','HIGH'], output_dict=True)
    
    metadata = {
        'model_name':         best_name,
        'version':            '2.0-ml',
        'training_date':      datetime.now().isoformat(),
        'data_type':          'SYNTHETIC',
        'data_description':   'Synthetic demonstration data — NOT real student records',
        'training_samples':   len(X_train),
        'test_samples':       len(X_test),
        'features':           features,
        'feature_importance': feature_importance,
        'evaluation': {
            'test_accuracy':    round(float(best_acc), 4),
            'cv_accuracy':      round(float(best_cv), 4),
            'confusion_matrix': cm,
            'classification_report': report,
        },
        'classes': ['LOW', 'MODERATE', 'HIGH'],
        'threshold_note': 'Labels derived from composite academic risk score on synthetic data',
    }

    meta_path = os.path.join(MODELS_DIR, 'model_metadata.json')
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n✅ Model saved   : {model_path}")
    print(f"✅ Metadata saved: {meta_path}")
    print("\n⚠️  REMINDER: This model was trained on SYNTHETIC data.")
    print("   For production, retrain with real institutional records.")
    return metadata

if __name__ == '__main__':
    train()
