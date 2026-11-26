/**
 * AttendX 2.0 — ML Service Client
 * Calls the Python FastAPI prediction service.
 * Falls back to rule-based if ML service is unavailable.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

function mlHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.ML_API_KEY) {
    headers['X-ML-API-Key'] = process.env.ML_API_KEY;
  }
  return headers;
}

interface MLPredictRequest {
  studentId: string;
  attendancePercentage?: number;
  internalMarksAverage?: number;
  quizAverage?: number;
  assignmentCompletion?: number;
}

export interface MLPredictResponse {
  studentId: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  assessmentType: 'ML_MODEL' | 'RULE_BASED';
  riskScore: number;
  riskProbability: number | null;
  contributingFactors: { factor: string; value: number; impact: string }[];
  recommendations: string[];
  dataWarnings: string[];
  modelVersion: string;
  predictionTimestamp: string;
}

export async function mlPredict(payload: MLPredictRequest): Promise<MLPredictResponse | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: mlHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    if (!res.ok) return null;
    return (await res.json()) as MLPredictResponse;
  } catch {
    return null; // ML service unavailable — caller uses rule-based fallback
  }
}

export async function mlServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mlModelInfo(): Promise<any> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/model/info`, {
      headers: mlHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export interface MLTrainingSample {
  attendancePercentage: number;
  internalMarksAverage: number;
  quizAverage: number;
  assignmentCompletion: number;
  riskLabel: 0 | 1 | 2;
}

export async function mlTrainModel(samples: MLTrainingSample[]): Promise<{ trained: boolean; metadata: any } | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/model/train`, {
      method: 'POST',
      headers: mlHeaders(),
      body: JSON.stringify({ samples }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return (await res.json()) as { trained: boolean; metadata: any };
  } catch {
    return null;
  }
}
