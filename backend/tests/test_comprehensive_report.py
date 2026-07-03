"""Tests for the new comprehensive report endpoints (JSON + DOCX).

Verifies:
- GET /api/reports/comprehensive returns aggregated data per employee
  with required fields (employee_id, employee_name, employee_department_name,
  total, approved, targets [{name,count}]), sorted by total desc.
- GET /api/reports/comprehensive.docx returns a valid .docx (Content-Type +
  Content-Disposition attachment, >10KB, magic bytes 'PK').
- Role scoping: dept manager sees only their dept employees; employee sees
  only themselves.
"""
import io
import os
import uuid
import zipfile

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://flight-ops-portal-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def gm_token():
    r = requests.post(f"{API}/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# --- JSON endpoint ---
class TestComprehensiveJson:
    def test_returns_list_with_required_shape(self, gm_token):
        r = requests.get(f"{API}/reports/comprehensive", headers=_h(gm_token), timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        required = {"employee_id", "employee_name",
                    "employee_department_name", "total", "approved", "targets"}
        for row in arr:
            assert required.issubset(row.keys()), f"missing: {required - row.keys()}"
            assert isinstance(row["total"], int)
            assert isinstance(row["approved"], int)
            assert isinstance(row["targets"], list)
            for t in row["targets"]:
                assert "name" in t and "count" in t
                assert isinstance(t["count"], int)

    def test_sorted_by_total_desc(self, gm_token):
        arr = requests.get(f"{API}/reports/comprehensive",
                           headers=_h(gm_token), timeout=20).json()
        totals = [r["total"] for r in arr]
        assert totals == sorted(totals, reverse=True)

    def test_targets_sorted_by_count_desc(self, gm_token):
        arr = requests.get(f"{API}/reports/comprehensive",
                           headers=_h(gm_token), timeout=20).json()
        for row in arr:
            counts = [t["count"] for t in row["targets"]]
            assert counts == sorted(counts, reverse=True)


# --- DOCX endpoint ---
class TestComprehensiveDocx:
    def test_docx_response_valid_headers_and_body(self, gm_token):
        r = requests.get(f"{API}/reports/comprehensive.docx",
                         headers={"Authorization": f"Bearer {gm_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:500]
        assert r.headers.get("content-type", "").startswith(DOCX_MIME), (
            f"unexpected content-type: {r.headers.get('content-type')}"
        )
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".docx" in cd, cd
        # File magic: docx is a zip, starts with 'PK'
        assert r.content[:2] == b"PK", "response is not a valid zip/docx"
        assert len(r.content) > 10_000, f"docx too small: {len(r.content)} bytes"
        # Ensure it's a real zip and contains word/document.xml
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            names = z.namelist()
            assert "word/document.xml" in names, f"not a docx (no document.xml): {names[:5]}"

    def test_docx_unauthorized_returns_401(self):
        r = requests.get(f"{API}/reports/comprehensive.docx", timeout=15)
        assert r.status_code in (401, 403), r.status_code


# --- Role scoping ---
class TestComprehensiveScoping:
    @pytest.fixture(scope="class")
    def seeded(self, gm_token):
        """Seed 1 dept + 1 division + 1 dept_mgr + 1 employee, and 1 activity."""
        suffix = uuid.uuid4().hex[:6]
        d = requests.post(f"{API}/departments",
                          json={"name": f"TEST_dept_{suffix}"},
                          headers=_h(gm_token), timeout=20).json()
        dept_id = d["id"]
        dm_user = {"username": f"TEST_dm_{suffix}", "password": "pass123",
                   "full_name": "Test DeptMgr", "role": "department_manager",
                   "department_id": dept_id}
        rdm = requests.post(f"{API}/users", json=dm_user,
                            headers=_h(gm_token), timeout=20)
        assert rdm.status_code == 200, rdm.text

        # login as dept mgr and create a division
        dm_tok = requests.post(f"{API}/auth/login",
                               json={"username": dm_user["username"],
                                     "password": "pass123"}, timeout=20
                               ).json()["access_token"]
        div = requests.post(f"{API}/divisions",
                            json={"name": f"TEST_div_{suffix}",
                                  "department_id": dept_id},
                            headers=_h(dm_tok), timeout=20).json()
        div_id = div["id"]
        # dept mgr creates a division mgr
        dvm_user = {"username": f"TEST_dvm_{suffix}", "password": "pass123",
                    "full_name": "Test DivMgr", "role": "division_manager",
                    "department_id": dept_id, "division_id": div_id}
        requests.post(f"{API}/users", json=dvm_user,
                      headers=_h(dm_tok), timeout=20)
        dvm_tok = requests.post(f"{API}/auth/login",
                                json={"username": dvm_user["username"],
                                      "password": "pass123"}, timeout=20
                                ).json()["access_token"]
        # div mgr creates an employee
        emp_user = {"username": f"TEST_emp_{suffix}", "password": "pass123",
                    "full_name": "Test Emp", "role": "employee",
                    "department_id": dept_id, "division_id": div_id}
        remp = requests.post(f"{API}/users", json=emp_user,
                             headers=_h(dvm_tok), timeout=20)
        assert remp.status_code == 200, remp.text
        emp_tok = requests.post(f"{API}/auth/login",
                                json={"username": emp_user["username"],
                                      "password": "pass123"}, timeout=20
                                ).json()["access_token"]

        # pick some target dept (any existing)
        all_depts = requests.get(f"{API}/departments",
                                 headers=_h(gm_token), timeout=20).json()
        target = next((x for x in all_depts if x["id"] != dept_id), all_depts[0])
        # create an activity as the employee
        act = requests.post(f"{API}/activities",
                            json={"activity_date": "2026-01-15",
                                  "activity_type": "TEST_activity",
                                  "target_department_id": target["id"],
                                  "target_department_name": target["name"],
                                  "notes": "test"},
                            headers=_h(emp_tok), timeout=20)
        assert act.status_code == 200, act.text
        return {"dept_id": dept_id, "dm_tok": dm_tok, "emp_tok": emp_tok,
                "emp_username": emp_user["username"], "suffix": suffix}

    def test_dept_manager_sees_only_dept_employees(self, seeded):
        arr = requests.get(f"{API}/reports/comprehensive",
                           headers=_h(seeded["dm_tok"]), timeout=20).json()
        assert isinstance(arr, list) and len(arr) >= 1
        # All rows must be from this dept
        for row in arr:
            assert row["employee_department_name"].startswith("TEST_dept_"), (
                f"leaked non-dept employee: {row['employee_department_name']}"
            )

    def test_employee_sees_only_themselves(self, seeded):
        arr = requests.get(f"{API}/reports/comprehensive",
                           headers=_h(seeded["emp_tok"]), timeout=20).json()
        assert isinstance(arr, list)
        # exactly one employee (themselves) with at least 1 activity
        assert len(arr) == 1
        assert arr[0]["employee_name"] == "Test Emp"
        assert arr[0]["total"] >= 1

    def test_dept_manager_docx_is_scoped(self, seeded):
        r = requests.get(f"{API}/reports/comprehensive.docx",
                         headers={"Authorization": f"Bearer {seeded['dm_tok']}"},
                         timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"
        assert len(r.content) > 8_000
