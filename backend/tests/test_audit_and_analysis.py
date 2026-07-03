"""Tests for the new audit-log endpoints and analysis-doc download (GM only).

Endpoints under test:
- GET /api/admin/audit-logs
- GET /api/admin/audit-logs/summary
- GET /api/admin/analysis-doc

Also verifies audit logging invocation from:
- /api/auth/login (success + failed)
- departments CRUD (create/update/delete)

Regression sanity:
- /api/auth/login
- /api/departments
- /api/activities
- /api/reports/summary
- /api/admin/system-info
- /api/admin/backup
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


# ---------- Shared fixtures ----------
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
    """Reuse existing TEST dept_manager probe user or create it."""
    depts = requests.get(f"{API}/departments", headers=gm_headers).json()
    assert depts, "seeded departments missing"
    dept_id = depts[0]["id"]
    uname = "TEST_audit_dm_probe"
    r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    if r.status_code != 200:
        cr = requests.post(
            f"{API}/users",
            headers=gm_headers,
            json={
                "username": uname,
                "password": "pw1234",
                "full_name": "TEST Audit DM",
                "role": "department_manager",
                "department_id": dept_id,
            },
        )
        assert cr.status_code == 200, cr.text
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


# ---------- /api/admin/audit-logs auth guard ----------
class TestAuditLogsAuth:
    def test_unauth_401(self):
        r = requests.get(f"{API}/admin/audit-logs")
        assert r.status_code == 401

    def test_non_gm_403(self, non_gm_token):
        r = requests.get(
            f"{API}/admin/audit-logs",
            headers={"Authorization": f"Bearer {non_gm_token}"},
        )
        assert r.status_code == 403

    def test_summary_unauth_401(self):
        r = requests.get(f"{API}/admin/audit-logs/summary")
        assert r.status_code == 401

    def test_summary_non_gm_403(self, non_gm_token):
        r = requests.get(
            f"{API}/admin/audit-logs/summary",
            headers={"Authorization": f"Bearer {non_gm_token}"},
        )
        assert r.status_code == 403


# ---------- /api/admin/audit-logs structure & content ----------
class TestAuditLogsList:
    def test_list_shape(self, gm_headers):
        r = requests.get(f"{API}/admin/audit-logs", headers=gm_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("total", "count", "logs"):
            assert k in body, f"missing key {k}"
        assert isinstance(body["logs"], list)
        assert isinstance(body["total"], int)
        assert isinstance(body["count"], int)
        assert body["count"] == len(body["logs"])
        assert body["count"] <= 200  # default limit
        if body["logs"]:
            log = body["logs"][0]
            for k in ("id", "at", "action", "entity_type", "status"):
                assert k in log, f"log missing key {k}"
            assert "_id" not in log

    def test_limit_query(self, gm_headers):
        r = requests.get(f"{API}/admin/audit-logs?limit=5", headers=gm_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["logs"]) <= 5

    def test_limit_out_of_range(self, gm_headers):
        # limit must be 1..1000
        r = requests.get(f"{API}/admin/audit-logs?limit=0", headers=gm_headers)
        assert r.status_code == 422
        r = requests.get(f"{API}/admin/audit-logs?limit=1001", headers=gm_headers)
        assert r.status_code == 422

    def test_login_success_creates_entry(self, gm_headers):
        # Perform a fresh successful admin login and verify entry appears
        r = requests.post(
            f"{API}/auth/login", json={"username": "admin", "password": "admin123"}
        )
        assert r.status_code == 200
        time.sleep(0.4)
        lg = requests.get(
            f"{API}/admin/audit-logs?action=login&limit=50", headers=gm_headers
        ).json()
        assert lg["count"] >= 1
        # Should have at least one successful login entry
        successes = [
            x for x in lg["logs"] if x.get("action") == "login" and x.get("status") == "success"
        ]
        assert successes, "expected at least one login success entry"

    def test_failed_login_logged(self, gm_headers):
        # Do a failed login attempt
        bad_user = f"TEST_no_such_user_{int(time.time())}"
        r = requests.post(
            f"{API}/auth/login", json={"username": bad_user, "password": "wrongpw"}
        )
        assert r.status_code == 400
        # Also a wrong-password attempt for admin
        r2 = requests.post(
            f"{API}/auth/login", json={"username": "admin", "password": "definitelywrong"}
        )
        assert r2.status_code == 400
        time.sleep(0.5)
        lg = requests.get(
            f"{API}/admin/audit-logs?action=login&limit=100", headers=gm_headers
        ).json()
        failed = [
            x for x in lg["logs"]
            if x.get("action") == "login" and x.get("status") == "failed"
        ]
        assert failed, "expected failed login entries in audit log"

    def test_filter_action_login_only(self, gm_headers):
        r = requests.get(
            f"{API}/admin/audit-logs?action=login&limit=100", headers=gm_headers
        )
        assert r.status_code == 200
        logs = r.json()["logs"]
        assert logs, "expected some login logs"
        for lgn in logs:
            assert lgn.get("action") == "login", f"non-login action leaked: {lgn.get('action')}"

    def test_filter_entity_type(self, gm_headers):
        # Login entries use entity_type='auth'
        r = requests.get(
            f"{API}/admin/audit-logs?entity_type=auth&limit=50", headers=gm_headers
        )
        assert r.status_code == 200
        for lg in r.json()["logs"]:
            assert lg.get("entity_type") == "auth"


# ---------- Department CRUD triggers audit entries ----------
class TestDepartmentAudit:
    def test_dept_create_update_delete_logs(self, gm_headers):
        # Create
        dept_name = f"TEST_audit_dept_{int(time.time())}"
        cr = requests.post(f"{API}/departments", headers=gm_headers, json={"name": dept_name})
        assert cr.status_code == 200, cr.text
        dept_id = cr.json()["id"]

        # Update
        new_name = dept_name + "_upd"
        ur = requests.put(
            f"{API}/departments/{dept_id}", headers=gm_headers, json={"name": new_name}
        )
        assert ur.status_code == 200

        # Delete
        dr = requests.delete(f"{API}/departments/{dept_id}", headers=gm_headers)
        assert dr.status_code == 200

        time.sleep(0.5)
        # Verify three log entries for this entity_id
        r = requests.get(
            f"{API}/admin/audit-logs?entity_type=department&limit=1000",
            headers=gm_headers,
        )
        assert r.status_code == 200
        logs = r.json()["logs"]
        matched = [lg for lg in logs if lg.get("entity_id") == dept_id]
        actions = {lg["action"] for lg in matched}
        assert "create" in actions, f"missing create audit for dept, saw {actions}"
        assert "update" in actions, f"missing update audit for dept, saw {actions}"
        assert "delete" in actions, f"missing delete audit for dept, saw {actions}"
        # entity_type is department
        for lg in matched:
            assert lg["entity_type"] == "department"
            assert lg.get("user_role") == "general_manager"


# ---------- /api/admin/audit-logs/summary structure ----------
class TestAuditLogsSummary:
    def test_summary_shape(self, gm_headers):
        r = requests.get(f"{API}/admin/audit-logs/summary", headers=gm_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("total", "last_24h", "failed_logins_24h", "by_action"):
            assert k in body, f"missing key {k}"
        assert isinstance(body["total"], int)
        assert isinstance(body["last_24h"], int)
        assert isinstance(body["failed_logins_24h"], int)
        assert isinstance(body["by_action"], list)
        # last_24h can't exceed total
        assert body["last_24h"] <= body["total"]
        # failed logins in 24h can't exceed last_24h
        assert body["failed_logins_24h"] <= body["last_24h"]
        # by_action entries shape
        for row in body["by_action"]:
            assert "action" in row and "count" in row
            assert isinstance(row["count"], int)
        # given prior tests, we expect at least one failed login recorded overall (may or may not be within 24h — but should be)
        assert body["failed_logins_24h"] >= 1


# ---------- /api/admin/analysis-doc ----------
class TestAnalysisDoc:
    def test_unauth_401(self):
        r = requests.get(f"{API}/admin/analysis-doc")
        assert r.status_code == 401

    def test_non_gm_403(self, non_gm_token):
        r = requests.get(
            f"{API}/admin/analysis-doc",
            headers={"Authorization": f"Bearer {non_gm_token}"},
        )
        assert r.status_code == 403

    def test_gm_download_docx(self, gm_headers):
        r = requests.get(f"{API}/admin/analysis-doc", headers=gm_headers)
        assert r.status_code == 200
        ctype = r.headers.get("Content-Type", "")
        assert DOCX_MIME in ctype, f"unexpected content-type {ctype}"
        # DOCX files start with the ZIP magic bytes "PK"
        assert r.content[:2] == b"PK", "file does not appear to be a docx (ZIP) archive"
        assert len(r.content) > 1000, f"docx too small: {len(r.content)} bytes"
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd
        assert ".docx" in cd


# ---------- Regression checks ----------
class TestRegression:
    def test_departments_list(self, gm_headers):
        r = requests.get(f"{API}/departments", headers=gm_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_activities_list(self, gm_headers):
        r = requests.get(f"{API}/activities", headers=gm_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reports_summary(self, gm_headers):
        r = requests.get(f"{API}/reports/summary", headers=gm_headers)
        assert r.status_code == 200
        body = r.json()
        # Sanity: expect an object
        assert isinstance(body, dict)

    def test_admin_system_info(self, gm_headers):
        r = requests.get(f"{API}/admin/system-info", headers=gm_headers)
        assert r.status_code == 200
        body = r.json()
        assert "database" in body
        assert "collections" in body

    def test_admin_backup(self, gm_headers):
        r = requests.get(f"{API}/admin/backup", headers=gm_headers)
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/json")
        body = r.json()
        assert "collections" in body
