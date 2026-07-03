"""Tests for /api/admin/system-info, /api/admin/backup, /api/admin/restore (GM only)"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get('EXPO_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"


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
    # Find any non-GM user; create a fresh dept_manager if needed
    depts = requests.get(f"{API}/departments", headers=gm_headers).json()
    assert depts, "seeded departments missing"
    dept_id = depts[0]["id"]
    uname = "TEST_admin_dm_probe"
    # Try login first
    r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    if r.status_code != 200:
        cr = requests.post(f"{API}/users", headers=gm_headers, json={
            "username": uname, "password": "pw1234", "full_name": "TEST DM Probe",
            "role": "department_manager", "department_id": dept_id,
        })
        assert cr.status_code == 200, cr.text
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pw1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


class TestSystemInfo:
    def test_unauth_401(self):
        r = requests.get(f"{API}/admin/system-info")
        assert r.status_code == 401

    def test_non_gm_403(self, non_gm_token):
        r = requests.get(f"{API}/admin/system-info", headers={"Authorization": f"Bearer {non_gm_token}"})
        assert r.status_code == 403

    def test_gm_ok_shape(self, gm_headers):
        r = requests.get(f"{API}/admin/system-info", headers=gm_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["database", "total_data_bytes", "total_storage_bytes", "index_bytes", "objects", "collections", "generated_at"]:
            assert k in d, f"missing {k}"
        names = {c["name"] for c in d["collections"]}
        assert {"users", "departments", "divisions", "activities"}.issubset(names)
        for c in d["collections"]:
            assert set(["name", "count", "size_bytes", "storage_bytes"]).issubset(c.keys())
            assert isinstance(c["count"], int)


class TestBackup:
    def test_unauth_401(self):
        r = requests.get(f"{API}/admin/backup")
        assert r.status_code == 401

    def test_non_gm_403(self, non_gm_token):
        r = requests.get(f"{API}/admin/backup", headers={"Authorization": f"Bearer {non_gm_token}"})
        assert r.status_code == 403

    def test_gm_returns_json_with_headers(self, gm_headers):
        r = requests.get(f"{API}/admin/backup", headers=gm_headers)
        assert r.status_code == 200
        assert "application/json" in r.headers.get("content-type", "").lower()
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        assert ".json" in cd.lower()
        body = r.json()
        assert body.get("version") == 1
        assert "generated_at" in body and "database" in body
        assert isinstance(body.get("collections"), dict)
        for k in ["users", "departments", "divisions", "activities"]:
            assert k in body["collections"], f"missing collection {k}"
            assert isinstance(body["collections"][k], list)
        # Sanity: at least one GM user present
        assert any(u.get("role") == "general_manager" for u in body["collections"]["users"])


class TestRestoreValidation:
    """We DO NOT actually restore data (would wipe DB). Only exercise validation branches."""

    def test_unauth_401(self):
        r = requests.post(f"{API}/admin/restore", json={"collections": {}})
        assert r.status_code == 401

    def test_non_gm_403(self, non_gm_token):
        r = requests.post(
            f"{API}/admin/restore",
            headers={"Authorization": f"Bearer {non_gm_token}", "Content-Type": "application/json"},
            json={"collections": {}},
        )
        assert r.status_code == 403

    def test_missing_collections_400(self, gm_headers):
        r = requests.post(f"{API}/admin/restore", headers=gm_headers, json={})
        assert r.status_code == 400

    def test_invalid_collections_type_400(self, gm_headers):
        r = requests.post(f"{API}/admin/restore", headers=gm_headers, json={"collections": "notadict"})
        assert r.status_code == 400

    def test_no_gm_in_backup_400(self, gm_headers):
        # payload missing a general_manager user should be rejected
        payload = {
            "collections": {
                "users": [{"id": "x", "username": "u", "hashed_password": "h",
                           "full_name": "U", "role": "employee",
                           "department_id": None, "division_id": None}],
                "departments": [],
                "divisions": [],
                "activities": [],
            }
        }
        r = requests.post(f"{API}/admin/restore", headers=gm_headers, json=payload)
        assert r.status_code == 400
        assert "مدير عام" in r.json().get("detail", "")
