import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from fastapi.testclient import TestClient
    import main as ml_main
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "FastAPI dependencies not installed in this Python environment")
class TestMLService(unittest.TestCase):
    def setUp(self):
        os.environ["ENV"] = "development"
        os.environ["ML_API_KEY"] = "test-ml-key"
        self.client = TestClient(ml_main.app)

    def test_health_endpoint(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "OK")

    def test_predict_requires_api_key(self):
        res = self.client.post("/predict", json={
            "studentId": "stu1",
            "attendancePercentage": 80,
        })
        self.assertEqual(res.status_code, 401)

    def test_predict_with_valid_api_key(self):
        res = self.client.post(
            "/predict",
            headers={"X-ML-API-Key": "test-ml-key"},
            json={
                "studentId": "stu1",
                "attendancePercentage": 50,
                "internalMarksAverage": 45,
                "quizAverage": 55,
                "assignmentCompletion": 60,
            },
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn(body["riskLevel"], ["LOW", "MODERATE", "HIGH"])


if __name__ == "__main__":
    unittest.main()
