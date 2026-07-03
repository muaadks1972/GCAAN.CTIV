"""Post-refactor regression for reports endpoints & JWT_SECRET env sourcing.

Verifies:
- /api/reports/by-department preserves shape and includes departments with 0 activities.
- /api/reports/completion-rates preserves shape.
- /api/reports/kpis preserves shape (kpi_score / rating / avg_turnaround_days).
- JWT tokens signed with a different secret are rejected (401).
- Valid admin login still produces a working token.
"""
import os
import uuid
import time
import pytest
import requests
import jwt as pyjwt

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://flight-ops-portal-4.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _auth(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gm_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ---------- Reports shape / correctness ----------
class TestByDepartmentShape:
    def test_by_department_shape_and_includes_empty(self, gm_token):
        # Create a brand new department with no activities → must still appear in report
        new_name = f"TEST_empty_{uuid.uuid4().hex[:6]}"
        cr = requests.post(f"{API}/departments", json={"name": new_name},
                           headers=_auth(gm_token), timeout=20)
        assert cr.status_code == 200, cr.text
        new_id = cr.json()["id"]

        r = requests.get(f"{API}/reports/by-department", headers=_auth(gm_token), timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)

        required = {"department_id", "department_name", "total", "approved",
                    "rejected", "pending", "approval_rate"}
        for row in arr:
            assert required.issubset(row.keys()), f"missing keys: {required - row.keys()}"
            assert isinstance(row["total"], int)
            assert isinstance(row["approved"], int)
            assert isinstance(row["rejected"], int)
            assert isinstance(row["pending"], int)
            assert isinstance(row["approval_rate"], (int, float))
            # invariant: total = approved + rejected + pending
            assert row["total"] == row["approved"] + row["rejected"] + row["pending"]
            # invariant: approval_rate matches computed value
            expected = round((row["approved"] / row["total"]) * 100, 1) if row["total"] else 0.0
            assert row["approval_rate"] == expected

        # New empty department must be in the result with total=0
        new_row = next((x for x in arr if x["department_id"] == new_id), None)
        assert new_row is not None, "empty department missing from by-department report"
        assert new_row["total"] == 0
        assert new_row["approved"] == 0
        assert new_row["rejected"] == 0
        assert new_row["pending"] == 0
        assert new_row["approval_rate"] == 0.0


class TestCompletionRatesShape:
    def test_completion_rates_shape(self, gm_token):
        r = requests.get(f"{API}/reports/completion-rates", headers=_auth(gm_token), timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        required = {"employee_id", "employee_name", "total", "approved", "rejected", "completion_rate"}
        prev = None
        for row in arr:
            assert required.issubset(row.keys()), f"missing keys: {required - row.keys()}"
            assert isinstance(row["total"], int)
            assert isinstance(row["approved"], int)
            assert isinstance(row["rejected"], int)
            assert isinstance(row["completion_rate"], (int, float))
            # invariant: rate matches
            expected = round((row["approved"] / row["total"]) * 100, 1) if row["total"] else 0.0
            assert row["completion_rate"] == expected
            # sorted descending by completion_rate
            if prev is not None:
                assert prev >= row["completion_rate"]
            prev = row["completion_rate"]


class TestKpisShape:
    def test_kpis_shape(self, gm_token):
        r = requests.get(f"{API}/reports/kpis", headers=_auth(gm_token), timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        required = {"employee_id", "employee_name", "total_activities", "approved",
                    "approval_rate", "avg_turnaround_days", "kpi_score", "rating"}
        valid_ratings = {"ممتاز", "جيد جداً", "جيد", "يحتاج تحسين"}
        prev = None
        for row in arr:
            assert required.issubset(row.keys()), f"missing keys: {required - row.keys()}"
            assert row["rating"] in valid_ratings
            assert 0 <= row["approval_rate"] <= 100
            assert 0 <= row["kpi_score"] <= 100
            assert row["avg_turnaround_days"] >= 0
            if prev is not None:
                assert prev >= row["kpi_score"]  # sorted desc
            prev = row["kpi_score"]


# ---------- JWT_SECRET sourced from env ----------
class TestJwtSecretFromEnv:
    def test_valid_admin_token_works(self, gm_token):
        r = requests.get(f"{API}/auth/me", headers=_auth(gm_token), timeout=20)
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_token_signed_with_wrong_secret_rejected(self, gm_token):
        # Sign a valid-shaped token with a DIFFERENT secret; should be rejected.
        fake_payload = {
            "sub": "admin",
            "role": "general_manager",
            "exp": int(time.time()) + 3600,
        }
        forged = pyjwt.encode(fake_payload, "definitely-not-the-real-secret-xyz",
                              algorithm="HS256")
        r = requests.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {forged}"}, timeout=20)
        assert r.status_code == 401, (
            f"forged token accepted; expected 401 got {r.status_code}: {r.text}"
        )

    def test_backend_reads_jwt_secret_from_env_not_hardcoded(self):
        # Verify env var exists and matches the .env file (no hardcoded fallback in code).
        env_path = "/app/backend/.env"
        with open(env_path) as f:
            content = f.read()
        assert "JWT_SECRET" in content, "JWT_SECRET must be present in backend/.env"
        # And in server.py it must be sourced from environ WITHOUT default
        with open("/app/backend/server.py") as f:
            src = f.read()
        assert "os.environ['JWT_SECRET']" in src or 'os.environ["JWT_SECRET"]' in src, (
            "server.py must read JWT_SECRET via os.environ['JWT_SECRET'] (no default)"
        )
