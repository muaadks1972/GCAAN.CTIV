"""Tests for iteration 10 additions: DELETE endpoints (departments/divisions/users)
and the new GET /api/reports/range endpoint."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://flight-ops-portal-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ctx():
    """Build a fresh isolated hierarchy: dept -> division -> dm -> divm -> emp -> activity."""
    c = {}
    # Login GM
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, r.text
    c["gm_token"] = r.json()["access_token"]
    c["gm_user"] = r.json()["user"]

    # Create dept
    dname = f"TEST_del_dept_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/departments", json={"name": dname}, headers=_h(c["gm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["dept"] = r.json()

    # Create division
    r = requests.post(f"{API}/divisions",
                      json={"name": f"TEST_del_div_{uuid.uuid4().hex[:5]}", "department_id": c["dept"]["id"]},
                      headers=_h(c["gm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["div"] = r.json()

    # Create dept_manager
    dm_uname = f"TEST_del_dm_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/users", json={
        "username": dm_uname, "password": "pass1234", "full_name": "Del DM",
        "role": "department_manager", "department_id": c["dept"]["id"],
    }, headers=_h(c["gm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["dm"] = r.json()
    c["dm_token"] = requests.post(f"{API}/auth/login",
                                  json={"username": dm_uname, "password": "pass1234"},
                                  timeout=20).json()["access_token"]

    # Create division_manager
    divm_uname = f"TEST_del_divm_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/users", json={
        "username": divm_uname, "password": "pass1234", "full_name": "Del DivM",
        "role": "division_manager",
        "department_id": c["dept"]["id"], "division_id": c["div"]["id"],
    }, headers=_h(c["dm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["divm"] = r.json()
    c["divm_token"] = requests.post(f"{API}/auth/login",
                                    json={"username": divm_uname, "password": "pass1234"},
                                    timeout=20).json()["access_token"]

    # Create employee
    emp_uname = f"TEST_del_emp_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/users", json={
        "username": emp_uname, "password": "pass1234", "full_name": "Del Emp",
        "role": "employee",
    }, headers=_h(c["divm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["emp"] = r.json()
    c["emp_token"] = requests.post(f"{API}/auth/login",
                                   json={"username": emp_uname, "password": "pass1234"},
                                   timeout=20).json()["access_token"]

    # Create an activity today
    r = requests.post(f"{API}/activities", json={
        "activity_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "activity_type": "TEST_range_act",
        "target_department_id": c["dept"]["id"],
        "notes": "range",
    }, headers=_h(c["emp_token"]), timeout=20)
    assert r.status_code == 200, r.text
    c["act"] = r.json()
    return c


# ---------- DELETE /users ----------
class TestDeleteUser:
    def test_cannot_delete_self(self, ctx):
        # admin is GM+self → GM-role check fires first (403); either 400 (self) or 403 (GM) prevents deletion
        r = requests.delete(f"{API}/users/{ctx['gm_user']['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code in (400, 403)

    def test_cannot_delete_general_manager(self, ctx):
        r = requests.delete(f"{API}/users/{ctx['gm_user']['id']}", headers=_h(ctx["dm_token"]), timeout=20)
        # dm can't delete gm anyway; but response should be 403 or 400 (self check happens after GM check)
        assert r.status_code in (400, 403)

    def test_dm_cannot_delete_out_of_dept(self, ctx):
        # dm tries to delete gm's account -> 403 (gm role blocked)
        r = requests.delete(f"{API}/users/{ctx['gm_user']['id']}", headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_employee_cannot_delete_anyone(self, ctx):
        r = requests.delete(f"{API}/users/{ctx['divm']['id']}", headers=_h(ctx["emp_token"]), timeout=20)
        assert r.status_code == 403

    def test_delete_nonexistent(self, ctx):
        r = requests.delete(f"{API}/users/{uuid.uuid4()}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 404

    def test_divm_deletes_employee_in_own_division(self, ctx):
        # Create a throwaway emp for this test
        uname = f"TEST_del_emp2_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/users", json={
            "username": uname, "password": "pass1234", "full_name": "Emp2", "role": "employee",
        }, headers=_h(ctx["divm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        emp2 = r.json()

        r = requests.delete(f"{API}/users/{emp2['id']}", headers=_h(ctx["divm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify gone: login should fail
        lr = requests.post(f"{API}/auth/login",
                           json={"username": uname, "password": "pass1234"}, timeout=20)
        assert lr.status_code == 400

    def test_dm_deletes_divm_in_own_dept(self, ctx):
        # Create a throwaway divm to delete
        uname = f"TEST_del_divm2_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/users", json={
            "username": uname, "password": "pass1234", "full_name": "DivM2",
            "role": "division_manager",
            "department_id": ctx["dept"]["id"], "division_id": ctx["div"]["id"],
        }, headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        divm2 = r.json()

        r = requests.delete(f"{API}/users/{divm2['id']}", headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text


# ---------- DELETE /divisions ----------
class TestDeleteDivision:
    def test_delete_division_with_users_blocked(self, ctx):
        # ctx['div'] currently has divm + emp; expect 400
        r = requests.delete(f"{API}/divisions/{ctx['div']['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 400

    def test_delete_empty_division_success(self, ctx):
        # Create an empty division and delete it
        r = requests.post(f"{API}/divisions",
                          json={"name": f"TEST_empty_div_{uuid.uuid4().hex[:5]}",
                                "department_id": ctx["dept"]["id"]},
                          headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        div_id = r.json()["id"]

        r = requests.delete(f"{API}/divisions/{div_id}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text

        # Verify it's gone
        r = requests.get(f"{API}/divisions", headers=_h(ctx["gm_token"]), timeout=20)
        assert not any(d["id"] == div_id for d in r.json())

    def test_dm_cannot_delete_other_dept_division(self, ctx):
        other = requests.post(f"{API}/departments",
                              json={"name": f"TEST_o_{uuid.uuid4().hex[:5]}"},
                              headers=_h(ctx["gm_token"]), timeout=20).json()
        odiv = requests.post(f"{API}/divisions",
                             json={"name": "TEST_od", "department_id": other["id"]},
                             headers=_h(ctx["gm_token"]), timeout=20).json()
        r = requests.delete(f"{API}/divisions/{odiv['id']}", headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 403
        # cleanup
        requests.delete(f"{API}/divisions/{odiv['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        requests.delete(f"{API}/departments/{other['id']}", headers=_h(ctx["gm_token"]), timeout=20)

    def test_delete_nonexistent_division(self, ctx):
        r = requests.delete(f"{API}/divisions/{uuid.uuid4()}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 404


# ---------- DELETE /departments ----------
class TestDeleteDepartment:
    def test_delete_department_with_users_blocked(self, ctx):
        r = requests.delete(f"{API}/departments/{ctx['dept']['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 400

    def test_non_gm_cannot_delete_department(self, ctx):
        r = requests.delete(f"{API}/departments/{ctx['dept']['id']}", headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_delete_empty_department_success(self, ctx):
        # Create an empty department (no users/divisions), delete it
        name = f"TEST_empty_dept_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/departments", json={"name": name},
                          headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200
        dept_id = r.json()["id"]

        r = requests.delete(f"{API}/departments/{dept_id}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text

        # Verify gone
        r = requests.get(f"{API}/departments", headers=_h(ctx["gm_token"]), timeout=20)
        assert not any(d["id"] == dept_id for d in r.json())

    def test_delete_dept_with_division_blocked(self, ctx):
        # Create dept + division only (no users)
        d = requests.post(f"{API}/departments",
                          json={"name": f"TEST_dwd_{uuid.uuid4().hex[:5]}"},
                          headers=_h(ctx["gm_token"]), timeout=20).json()
        dv = requests.post(f"{API}/divisions",
                           json={"name": "TEST_dv", "department_id": d["id"]},
                           headers=_h(ctx["gm_token"]), timeout=20).json()
        r = requests.delete(f"{API}/departments/{d['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 400
        # Cleanup
        requests.delete(f"{API}/divisions/{dv['id']}", headers=_h(ctx["gm_token"]), timeout=20)
        requests.delete(f"{API}/departments/{d['id']}", headers=_h(ctx["gm_token"]), timeout=20)


# ---------- GET /reports/range ----------
class TestReportsRange:
    def _range(self, days=30):
        end = datetime.utcnow().date()
        start = end - timedelta(days=days)
        return start.isoformat(), end.isoformat()

    def test_range_returns_shape(self, ctx):
        f, t = self._range()
        r = requests.get(f"{API}/reports/range?from_date={f}&to_date={t}",
                         headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("count", "approved", "pending", "rejected",
                  "by_department", "activities", "from_date", "to_date"):
            assert k in d, f"missing {k}"
        assert d["from_date"] == f and d["to_date"] == t
        assert isinstance(d["by_department"], list)
        assert isinstance(d["activities"], list)
        # activity we created in ctx is within 30d, so count>=1
        assert d["count"] >= 1

    def test_range_invalid_date_format(self, ctx):
        r = requests.get(f"{API}/reports/range?from_date=2026/01/01&to_date=2026-01-05",
                         headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 400

    def test_range_end_before_start(self, ctx):
        r = requests.get(f"{API}/reports/range?from_date=2026-01-10&to_date=2026-01-05",
                         headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 400

    def test_range_end_equal_start_ok(self, ctx):
        # end == start: end = start+1day > start (per impl), so should be 200
        r = requests.get(f"{API}/reports/range?from_date=2026-01-01&to_date=2026-01-01",
                         headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200

    def test_range_department_id_filter_gm(self, ctx):
        f, t = self._range()
        r = requests.get(f"{API}/reports/range?from_date={f}&to_date={t}&department_id={ctx['dept']['id']}",
                         headers=_h(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["department_id"] == ctx["dept"]["id"]
        # All activities returned should belong to this dept
        for a in d["activities"]:
            assert a.get("employee_department_id") == ctx["dept"]["id"]

    def test_range_department_id_ignored_for_non_gm(self, ctx):
        """Non-GM roles are already scoped; passing department_id should not broaden or narrow scope."""
        f, t = self._range()
        # dm role scoped to own dept -> passing another dept_id shouldn't leak activities
        other_id = str(uuid.uuid4())
        r = requests.get(f"{API}/reports/range?from_date={f}&to_date={t}&department_id={other_id}",
                         headers=_h(ctx["dm_token"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        # All returned activities must belong to dm's own department (ctx dept)
        for a in d["activities"]:
            assert a.get("employee_department_id") == ctx["dept"]["id"]

    def test_range_scoped_for_employee(self, ctx):
        f, t = self._range()
        r = requests.get(f"{API}/reports/range?from_date={f}&to_date={t}",
                         headers=_h(ctx["emp_token"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for a in d["activities"]:
            assert a.get("employee_id") == ctx["emp"]["id"]

    def test_range_unauthenticated(self, ctx):
        f, t = self._range()
        r = requests.get(f"{API}/reports/range?from_date={f}&to_date={t}", timeout=20)
        assert r.status_code == 401
