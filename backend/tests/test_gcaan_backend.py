"""GCAAN backend integration tests covering auth, RBAC, activities workflow and reports."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://flight-ops-portal-4.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# ---------- Session-scoped state ----------
STATE = {}


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d and d["user"]["role"] == "general_manager"
        STATE["gm_token"] = d["access_token"]
        STATE["gm_user"] = d["user"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"}, timeout=20)
        assert r.status_code == 400

    def test_me_with_token(self):
        r = requests.get(f"{API}/auth/me", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == "admin"
        assert "hashed_password" not in d
        assert "_id" not in d

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad.jwt.token"}, timeout=20)
        assert r.status_code == 401


# ---------- Departments ----------
class TestDepartments:
    def test_list_departments_seeded(self):
        r = requests.get(f"{API}/departments", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        depts = r.json()
        assert isinstance(depts, list) and len(depts) >= 5
        for d in depts:
            assert "_id" not in d
            assert "id" in d and "name" in d
        STATE["dept"] = depts[0]

    def test_create_department_gm(self):
        name = f"TEST_dept_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/departments", json={"name": name},
                          headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == name and "id" in d
        # verify persistence
        r2 = requests.get(f"{API}/departments", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert any(x["id"] == d["id"] for x in r2.json())
        STATE["new_dept"] = d


# ---------- Users hierarchy ----------
class TestUserHierarchy:
    def test_gm_cannot_create_employee_directly(self):
        r = requests.post(f"{API}/users", json={
            "username": f"TEST_emp_{uuid.uuid4().hex[:6]}",
            "password": "pass1234", "full_name": "Emp", "role": "employee",
        }, headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 403

    def test_gm_creates_dept_manager_requires_dept(self):
        # missing department_id -> 400
        r = requests.post(f"{API}/users", json={
            "username": f"TEST_dm_{uuid.uuid4().hex[:6]}",
            "password": "pass1234", "full_name": "DM", "role": "department_manager",
        }, headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 400

    def test_gm_creates_dept_manager(self):
        uname = f"TEST_dm_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", json={
            "username": uname, "password": "pass1234", "full_name": "Dept Manager",
            "role": "department_manager", "department_id": STATE["dept"]["id"],
        }, headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "department_manager" and d["department_id"] == STATE["dept"]["id"]
        assert "hashed_password" not in d and "_id" not in d
        STATE["dm_username"] = uname
        STATE["dm_user"] = d
        # login as dm
        lr = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pass1234"}, timeout=20)
        assert lr.status_code == 200
        STATE["dm_token"] = lr.json()["access_token"]

    def test_dm_cannot_create_division_in_other_dept(self):
        other_dept_id = str(uuid.uuid4())
        r = requests.post(f"{API}/divisions", json={"name": "TEST_div", "department_id": other_dept_id},
                          headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_dm_creates_division_in_own_dept(self):
        r = requests.post(f"{API}/divisions", json={
            "name": f"TEST_div_{uuid.uuid4().hex[:5]}",
            "department_id": STATE["dept"]["id"],
        }, headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["department_id"] == STATE["dept"]["id"]
        assert "_id" not in d
        STATE["division"] = d

    def test_dm_creates_division_manager(self):
        uname = f"TEST_divm_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", json={
            "username": uname, "password": "pass1234", "full_name": "Div Manager",
            "role": "division_manager",
            "department_id": STATE["dept"]["id"],
            "division_id": STATE["division"]["id"],
        }, headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        lr = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pass1234"}, timeout=20)
        assert lr.status_code == 200
        STATE["divm_token"] = lr.json()["access_token"]
        STATE["divm_user"] = lr.json()["user"]

    def test_dm_cannot_create_employee(self):
        r = requests.post(f"{API}/users", json={
            "username": f"TEST_emp_{uuid.uuid4().hex[:5]}", "password": "pass1234",
            "full_name": "Emp", "role": "employee",
            "department_id": STATE["dept"]["id"],
        }, headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_divm_creates_employee(self):
        uname = f"TEST_emp_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", json={
            "username": uname, "password": "pass1234", "full_name": "Employee",
            "role": "employee",
        }, headers=_auth_headers(STATE["divm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "employee"
        assert d["division_id"] == STATE["divm_user"]["division_id"]
        lr = requests.post(f"{API}/auth/login", json={"username": uname, "password": "pass1234"}, timeout=20)
        STATE["emp_token"] = lr.json()["access_token"]
        STATE["emp_user"] = lr.json()["user"]

    def test_employee_cannot_create_users(self):
        r = requests.post(f"{API}/users", json={
            "username": "TEST_x", "password": "pass1234", "full_name": "X", "role": "employee",
        }, headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 403

    def test_non_gm_cannot_create_department(self):
        r = requests.post(f"{API}/departments", json={"name": "TEST_forbid"},
                          headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 403


# ---------- Activities workflow ----------
class TestActivitiesWorkflow:
    def test_employee_creates_activity(self):
        r = requests.post(f"{API}/activities", json={
            "activity_date": "2026-01-10",
            "activity_type": "تفتيش أمني",
            "target_department_id": STATE["dept"]["id"],
            "notes": "TEST_note",
        }, headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending_division"
        assert d["target_department_name"]  # backfilled from id
        assert "_id" not in d
        STATE["act_id"] = d["id"]

    def test_wrong_role_cannot_act(self):
        # GM tries to approve while it's pending_division -> 403
        r = requests.post(f"{API}/activities/{STATE['act_id']}/action",
                          json={"action": "approve"},
                          headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 403

    def test_divm_approves_to_pending_department(self):
        r = requests.post(f"{API}/activities/{STATE['act_id']}/action",
                          json={"action": "approve"},
                          headers=_auth_headers(STATE["divm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending_department"

    def test_dm_approves_to_pending_gm(self):
        r = requests.post(f"{API}/activities/{STATE['act_id']}/action",
                          json={"action": "approve"},
                          headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending_gm"

    def test_gm_approves_final(self):
        r = requests.post(f"{API}/activities/{STATE['act_id']}/action",
                          json={"action": "approve"},
                          headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"

    def test_list_pending_scope_for_gm(self):
        r = requests.get(f"{API}/activities?scope=pending",
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        for a in r.json():
            assert a["status"] == "pending_gm"

    def test_employee_scope_mine_returns_own(self):
        r = requests.get(f"{API}/activities?scope=mine",
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 200
        acts = r.json()
        assert len(acts) >= 1
        assert all(a["employee_id"] == STATE["emp_user"]["id"] for a in acts)


# ---------- Reports ----------
class TestReports:
    def test_summary(self):
        r = requests.get(f"{API}/reports/summary", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        for k in ("total", "approved", "rejected", "pending", "approval_rate"):
            assert k in r.json()

    def test_weekly_monthly(self):
        for ep in ("weekly", "monthly"):
            r = requests.get(f"{API}/reports/{ep}", headers=_auth_headers(STATE["gm_token"]), timeout=20)
            assert r.status_code == 200
            d = r.json()
            assert d["period"] == ep and "count" in d and isinstance(d["activities"], list)

    def test_by_department(self):
        r = requests.get(f"{API}/reports/by-department", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 5
        for x in arr:
            assert "department_name" in x and "approval_rate" in x

    def test_completion_rates(self):
        r = requests.get(f"{API}/reports/completion-rates", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_kpis(self):
        r = requests.get(f"{API}/reports/kpis", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            k = arr[0]
            for f in ("employee_id", "total_activities", "approval_rate", "kpi_score", "rating"):
                assert f in k


# ---------- Editing (PUT) endpoints ----------
class TestEditing:
    def test_gm_updates_department_and_denormalizes(self):
        dept = STATE["new_dept"]
        new_name = dept["name"] + "_upd"
        r = requests.put(f"{API}/departments/{dept['id']}", json={"name": new_name},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name
        # verify persistence
        r2 = requests.get(f"{API}/departments", headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert any(x["id"] == dept["id"] and x["name"] == new_name for x in r2.json())
        STATE["new_dept"]["name"] = new_name

    def test_non_gm_cannot_update_department(self):
        r = requests.put(f"{API}/departments/{STATE['dept']['id']}", json={"name": "hack"},
                         headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_update_nonexistent_department_404(self):
        r = requests.put(f"{API}/departments/{uuid.uuid4()}", json={"name": "x"},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 404

    def test_gm_updates_division(self):
        div = STATE["division"]
        new_name = div["name"] + "_upd"
        r = requests.put(f"{API}/divisions/{div['id']}", json={"name": new_name},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name

    def test_dm_updates_own_division(self):
        div = STATE["division"]
        new_name = div["name"] + "_dm"
        r = requests.put(f"{API}/divisions/{div['id']}", json={"name": new_name},
                         headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name

    def test_dm_cannot_update_other_dept_division(self):
        # Create another department + division as GM, then attempt with dm_token
        other = requests.post(f"{API}/departments", json={"name": f"TEST_other_{uuid.uuid4().hex[:5]}"},
                              headers=_auth_headers(STATE["gm_token"]), timeout=20).json()
        # GM creates a division in that other dept (GM cannot via create_division? Yes: general_manager is allowed)
        odiv = requests.post(f"{API}/divisions", json={"name": "TEST_odiv", "department_id": other["id"]},
                             headers=_auth_headers(STATE["gm_token"]), timeout=20).json()
        r = requests.put(f"{API}/divisions/{odiv['id']}", json={"name": "hack"},
                         headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 403

    def test_gm_updates_dept_manager_name_and_password(self):
        target_id = STATE["dm_user"]["id"]
        new_pw = "newpass99"
        new_name = "DM Updated"
        r = requests.put(f"{API}/users/{target_id}",
                         json={"full_name": new_name, "password": new_pw},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["full_name"] == new_name
        assert "hashed_password" not in d and "_id" not in d
        # login with NEW password
        lr = requests.post(f"{API}/auth/login",
                           json={"username": STATE["dm_username"], "password": new_pw}, timeout=20)
        assert lr.status_code == 200, lr.text
        STATE["dm_token"] = lr.json()["access_token"]

    def test_gm_cannot_update_employee_directly(self):
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"full_name": "hacked"},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        # GM only allowed to edit department_managers per implementation
        assert r.status_code == 403

    def test_dm_updates_employee_in_own_dept(self):
        new_name = "Emp Renamed"
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"full_name": new_name},
                         headers=_auth_headers(STATE["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == new_name
        # Verify denormalized employee_name update on activities
        acts = requests.get(f"{API}/activities?scope=mine",
                            headers=_auth_headers(STATE["emp_token"]), timeout=20).json()
        assert all(a["employee_name"] == new_name for a in acts if a["employee_id"] == STATE["emp_user"]["id"])

    def test_divm_updates_employee_in_own_division(self):
        new_name = "Emp DivRename"
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"full_name": new_name},
                         headers=_auth_headers(STATE["divm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == new_name

    def test_user_updates_self(self):
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"full_name": "Self Named", "password": "selfpw12"},
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 200
        # re-login with new pw
        lr = requests.post(f"{API}/auth/login",
                           json={"username": STATE["emp_user"]["username"] if "username" in STATE["emp_user"] else None,
                                 "password": "selfpw12"}, timeout=20)
        # emp_user from login response has "username" from server
        if lr.status_code != 200:
            # Fallback: get username via /auth/me
            me = requests.get(f"{API}/auth/me", headers=_auth_headers(STATE["emp_token"]), timeout=20)
            uname = me.json()["username"]
            lr = requests.post(f"{API}/auth/login",
                               json={"username": uname, "password": "selfpw12"}, timeout=20)
        assert lr.status_code == 200, lr.text
        STATE["emp_token"] = lr.json()["access_token"]

    def test_password_too_short_returns_400(self):
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"password": "abc"},
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 400

    def test_empty_update_returns_400(self):
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={},
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 400

    def test_empty_name_returns_400(self):
        r = requests.put(f"{API}/users/{STATE['emp_user']['id']}",
                         json={"full_name": "   "},
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 400

    def test_update_nonexistent_user_404(self):
        r = requests.put(f"{API}/users/{uuid.uuid4()}",
                         json={"full_name": "Ghost"},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 404


# ---------- Employee Department Name Denormalization (new feature) ----------
class TestEmployeeDepartmentName:
    """Verify 'employee_department_name' is denormalized into activities on create,
    backfilled on startup, and updated when the department is renamed."""

    def test_new_activity_has_employee_department_name(self):
        # Create a fresh activity from the (recently renamed) employee
        r = requests.post(f"{API}/activities", json={
            "activity_date": "2026-01-15",
            "activity_type": "TEST_edn_create",
            "target_department_id": STATE["dept"]["id"],
            "notes": "check edn field",
        }, headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "employee_department_name" in d, "employee_department_name field missing on create"
        assert d["employee_department_name"] == STATE["dept"]["name"], (
            f"expected {STATE['dept']['name']!r} got {d['employee_department_name']!r}"
        )
        STATE["edn_act_id"] = d["id"]

    def test_list_activities_returns_employee_department_name(self):
        r = requests.get(f"{API}/activities?scope=mine",
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        assert r.status_code == 200
        acts = r.json()
        assert acts, "expected at least one activity for employee"
        for a in acts:
            assert "employee_department_name" in a, f"missing field on {a.get('id')}"
            # Employee belongs to STATE['dept'], so name must match
            assert a["employee_department_name"] == STATE["dept"]["name"]

    def test_backfill_migration_populated_existing_activity(self):
        # STATE["act_id"] was the very first activity created; ensure it also has the field
        r = requests.get(f"{API}/activities?scope=mine",
                         headers=_auth_headers(STATE["emp_token"]), timeout=20)
        acts = r.json()
        old = next((a for a in acts if a["id"] == STATE["act_id"]), None)
        assert old is not None
        assert old.get("employee_department_name") == STATE["dept"]["name"], (
            f"backfill failed: {old.get('employee_department_name')!r}"
        )

    def test_department_rename_updates_both_target_and_employee_dept_names(self):
        # Rename STATE['dept'] as GM, verify BOTH employee_department_name and
        # target_department_name in activities are updated.
        dept_id = STATE["dept"]["id"]
        new_name = STATE["dept"]["name"] + f"_r{uuid.uuid4().hex[:4]}"
        r = requests.put(f"{API}/departments/{dept_id}", json={"name": new_name},
                         headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name

        # Verify activities updated (both target and employee sides)
        acts = requests.get(f"{API}/activities?scope=mine",
                            headers=_auth_headers(STATE["emp_token"]), timeout=20).json()
        assert acts
        for a in acts:
            # this employee's department == dept, so employee_department_name must reflect new_name
            assert a["employee_department_name"] == new_name, (
                f"employee_department_name not updated: {a.get('employee_department_name')!r}"
            )
            # activities were created with target_department_id == dept, so target should also match
            if a.get("target_department_id") == dept_id:
                assert a["target_department_name"] == new_name, (
                    f"target_department_name not updated: {a.get('target_department_name')!r}"
                )
        STATE["dept"]["name"] = new_name

    def test_gm_activity_has_no_employee_department_name(self):
        # Sanity: general_manager has no department → employee_department_name should be None
        r = requests.post(f"{API}/activities", json={
            "activity_date": "2026-01-15",
            "activity_type": "TEST_gm_activity",
            "notes": "gm has no dept",
        }, headers=_auth_headers(STATE["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("employee_department_name") is None

