"""Tests for the Subscription management endpoints (GCAAN).

Endpoints under test:
- GET  /api/admin/subscription  (any authenticated user)
- POST /api/admin/subscription  (GM only)

Verifies:
- Response shape (start_date, end_date, days_remaining, days_total, percent_used,
  expired, configured, note)
- Default subscription behaviour when nothing has been set
- Validation errors (400) for bad dates / bad duration / missing input
- 403 for non-GM POST, 401 for unauthenticated
- Persistence (POST result == subsequent GET)
- Audit-log entry with entity_type='subscription'
- Correctness of days_remaining and percent_used
"""
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "http://localhost:8001"
).rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def gm_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def gm_headers(gm_token):
    return {"Authorization": f"Bearer {gm_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def non_gm_token(gm_headers):
    """Reuse (or create) TEST_audit_dm_probe department_manager (pw1234)."""
    uname = "TEST_audit_dm_probe"
    r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    if r.status_code != 200:
        depts = requests.get(f"{API}/departments", headers=gm_headers).json()
        assert depts, "seeded departments missing"
        cr = requests.post(
            f"{API}/users",
            headers=gm_headers,
            json={
                "username": uname,
                "password": "pw1234",
                "full_name": "TEST Audit DM",
                "role": "department_manager",
                "department_id": depts[0]["id"],
            },
        )
        assert cr.status_code == 200, cr.text
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def non_gm_headers(non_gm_token):
    return {"Authorization": f"Bearer {non_gm_token}", "Content-Type": "application/json"}


REQUIRED_KEYS = {
    "start_date",
    "end_date",
    "days_remaining",
    "days_total",
    "percent_used",
    "expired",
    "configured",
    "note",
}


# ---------- Auth guards ----------
class TestSubscriptionAuth:
    def test_get_unauth_401(self):
        r = requests.get(f"{API}/admin/subscription")
        assert r.status_code == 401, r.text

    def test_post_unauth_401(self):
        r = requests.post(f"{API}/admin/subscription", json={"duration_days": 30})
        assert r.status_code == 401, r.text

    def test_get_non_gm_allowed(self, non_gm_headers):
        """Any authenticated user (incl. department_manager) must be able to GET."""
        r = requests.get(f"{API}/admin/subscription", headers=non_gm_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert REQUIRED_KEYS.issubset(body.keys()), body.keys()

    def test_post_non_gm_403(self, non_gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=non_gm_headers,
            json={"duration_days": 30},
        )
        assert r.status_code == 403, r.text


# ---------- GET default / shape ----------
class TestSubscriptionGetShape:
    def test_get_shape_fields_present(self, gm_headers):
        r = requests.get(f"{API}/admin/subscription", headers=gm_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert REQUIRED_KEYS.issubset(body.keys()), f"missing keys: {REQUIRED_KEYS - set(body.keys())}"
        # types
        assert isinstance(body["days_remaining"], int)
        assert isinstance(body["days_total"], int)
        assert isinstance(body["percent_used"], (int, float))
        assert isinstance(body["expired"], bool)
        assert isinstance(body["configured"], bool)
        assert isinstance(body["note"], str)
        # dates are YYYY-MM-DD strings
        assert len(body["start_date"]) == 10 and body["start_date"][4] == "-"
        assert len(body["end_date"]) == 10 and body["end_date"][4] == "-"


# ---------- POST validation ----------
class TestSubscriptionValidation:
    def test_invalid_end_date_format_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"end_date": "2026/12/31"},
        )
        assert r.status_code == 400, r.text

    def test_invalid_start_date_format_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"start_date": "not-a-date", "duration_days": 30},
        )
        assert r.status_code == 400, r.text

    def test_end_before_start_400(self, gm_headers):
        today = date.today()
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={
                "start_date": today.strftime("%Y-%m-%d"),
                "end_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            },
        )
        assert r.status_code == 400, r.text

    def test_duration_zero_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"duration_days": 0},
        )
        assert r.status_code == 400, r.text

    def test_duration_negative_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"duration_days": -5},
        )
        assert r.status_code == 400, r.text

    def test_duration_too_large_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"duration_days": 3651},
        )
        assert r.status_code == 400, r.text

    def test_missing_end_and_duration_400(self, gm_headers):
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"note": "no end no duration"},
        )
        assert r.status_code == 400, r.text


# ---------- POST success + persistence + computation + audit ----------
class TestSubscriptionSetAndPersist:
    def test_set_with_duration_and_verify_via_get(self, gm_headers):
        today = date.today()
        payload = {
            "start_date": today.strftime("%Y-%m-%d"),
            "duration_days": 100,
            "note": "TEST_sub_duration_100",
        }
        r = requests.post(f"{API}/admin/subscription", headers=gm_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()

        # Response fields
        assert body["configured"] is True
        assert body["start_date"] == payload["start_date"]
        assert body["end_date"] == (today + timedelta(days=100)).strftime("%Y-%m-%d")
        assert body["note"] == "TEST_sub_duration_100"
        assert body["days_total"] == 100
        assert body["days_remaining"] == 100
        assert body["percent_used"] == 0 or body["percent_used"] == 0.0
        assert body["expired"] is False

        # Same data returned by GET
        g = requests.get(f"{API}/admin/subscription", headers=gm_headers)
        assert g.status_code == 200
        gg = g.json()
        assert gg["start_date"] == body["start_date"]
        assert gg["end_date"] == body["end_date"]
        assert gg["note"] == body["note"]
        assert gg["configured"] is True
        assert gg["days_total"] == 100
        assert gg["days_remaining"] == 100

    def test_set_with_end_date_and_computation(self, gm_headers):
        """Start 100 days ago, end 100 days ahead → days_total=200, days_remaining=100, percent_used≈50."""
        today = date.today()
        start = today - timedelta(days=100)
        end = today + timedelta(days=100)
        payload = {
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date": end.strftime("%Y-%m-%d"),
            "note": "TEST_sub_midway",
        }
        r = requests.post(f"{API}/admin/subscription", headers=gm_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["configured"] is True
        assert body["start_date"] == payload["start_date"]
        assert body["end_date"] == payload["end_date"]
        assert body["days_total"] == 200
        assert body["days_remaining"] == 100
        # percent_used should be around 50 (elapsed 100 / total 200)
        assert 49.0 <= float(body["percent_used"]) <= 51.0, body["percent_used"]
        assert body["expired"] is False

    def test_expired_subscription_flag(self, gm_headers):
        """end_date in the past → expired True, days_remaining 0."""
        today = date.today()
        payload = {
            "start_date": (today - timedelta(days=10)).strftime("%Y-%m-%d"),
            "end_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "note": "TEST_sub_expired",
        }
        r = requests.post(f"{API}/admin/subscription", headers=gm_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["expired"] is True
        assert body["days_remaining"] == 0

    def test_default_start_date_is_today(self, gm_headers):
        """Omit start_date → defaults to today."""
        today_str = date.today().strftime("%Y-%m-%d")
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"duration_days": 45, "note": "TEST_sub_default_start"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["start_date"] == today_str
        assert body["days_total"] == 45
        assert body["days_remaining"] == 45

    def test_audit_log_entry_created(self, gm_headers):
        """After a successful POST, an audit row with entity_type='subscription' must exist."""
        r = requests.post(
            f"{API}/admin/subscription",
            headers=gm_headers,
            json={"duration_days": 15, "note": "TEST_sub_audit"},
        )
        assert r.status_code == 200, r.text

        # Query audit-logs filtered by entity_type=subscription
        a = requests.get(
            f"{API}/admin/audit-logs",
            headers=gm_headers,
            params={"entity_type": "subscription", "limit": 20},
        )
        assert a.status_code == 200, a.text
        logs = a.json().get("logs", [])
        assert len(logs) >= 1, "no subscription audit log entries found"
        # newest first — the top row must be a subscription entry
        top = logs[0]
        assert top["entity_type"] == "subscription"
        assert top.get("user_role") == "general_manager"
        # action = 'update' per implementation
        assert top.get("action") == "update"


# ---------- Regression sanity (all endpoints from previous iteration) ----------
class TestRegression:
    def test_login_ok(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200

    def test_departments_ok(self, gm_headers):
        r = requests.get(f"{API}/departments", headers=gm_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activities_ok(self, gm_headers):
        r = requests.get(f"{API}/activities", headers=gm_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reports_summary_ok(self, gm_headers):
        r = requests.get(f"{API}/reports/summary", headers=gm_headers)
        assert r.status_code == 200

    def test_admin_backup_ok(self, gm_headers):
        r = requests.get(f"{API}/admin/backup", headers=gm_headers)
        assert r.status_code == 200

    def test_audit_logs_ok(self, gm_headers):
        r = requests.get(f"{API}/admin/audit-logs", headers=gm_headers, params={"limit": 5})
        assert r.status_code == 200
        body = r.json()
        assert {"total", "count", "logs"}.issubset(body.keys())

    def test_analysis_doc_ok(self, gm_headers):
        r = requests.get(f"{API}/admin/analysis-doc", headers=gm_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
