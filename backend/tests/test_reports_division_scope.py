"""Reports scope visibility — division-level for employees.

Verifies the updated `_filter_by_scope(user)` and `users_q` behavior:
  employee            → sees ALL colleagues in same DIVISION (not self-only)
  division_manager    → sees own division
  department_manager  → sees own department
  general_manager     → sees everything

Setup (idempotent per run using uuid suffix):
  - Department X (via GM)
  - Divisions DivA, DivB under X (via department_manager of X)
  - Employees E1, E2 in DivA (via division_manager DMA)
  - Employee    E3 in DivB (via division_manager DMB)
  - 1 activity per employee → walk through approve chain (divm → dm → gm)

All fixtures are module-scoped so the setup runs once and every assertion
uses the same clean data island (prefixed TEST_divscope_*).
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL")
            or "https://flight-ops-portal-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TAG = uuid.uuid4().hex[:6]  # unique per test run


def _auth(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _login(username, password):
    r = requests.post(f"{API}/auth/login",
                      json={"username": username, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {username}: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


# --------------------------------------------------------------------------
# Module-scoped fixture: build hierarchy + activities and drive them to approved
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def env():
    ctx = {"tag": TAG}

    # 1. GM login
    ctx["gm_token"], ctx["gm_user"] = _login("admin", "admin123")

    # 2. GM creates department X
    dept_name = f"TEST_divscope_X_{TAG}"
    r = requests.post(f"{API}/departments", json={"name": dept_name},
                      headers=_auth(ctx["gm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["dept"] = r.json()

    # 3. GM creates department_manager for X
    dm_uname = f"TEST_divscope_dm_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": dm_uname, "password": "pw1234", "full_name": "DM X",
        "role": "department_manager", "department_id": ctx["dept"]["id"],
    }, headers=_auth(ctx["gm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["dm_token"], ctx["dm_user"] = _login(dm_uname, "pw1234")

    # 4. DM creates DivA and DivB under X
    r = requests.post(f"{API}/divisions",
                      json={"name": f"TEST_divscope_A_{TAG}", "department_id": ctx["dept"]["id"]},
                      headers=_auth(ctx["dm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["divA"] = r.json()

    r = requests.post(f"{API}/divisions",
                      json={"name": f"TEST_divscope_B_{TAG}", "department_id": ctx["dept"]["id"]},
                      headers=_auth(ctx["dm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["divB"] = r.json()

    # 5. DM creates division_manager DMA for DivA, DMB for DivB
    dma_uname = f"TEST_divscope_dma_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": dma_uname, "password": "pw1234", "full_name": "Divm A",
        "role": "division_manager",
        "department_id": ctx["dept"]["id"],
        "division_id": ctx["divA"]["id"],
    }, headers=_auth(ctx["dm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["dma_token"], ctx["dma_user"] = _login(dma_uname, "pw1234")

    dmb_uname = f"TEST_divscope_dmb_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": dmb_uname, "password": "pw1234", "full_name": "Divm B",
        "role": "division_manager",
        "department_id": ctx["dept"]["id"],
        "division_id": ctx["divB"]["id"],
    }, headers=_auth(ctx["dm_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["dmb_token"], ctx["dmb_user"] = _login(dmb_uname, "pw1234")

    # 6. DMA creates employees E1 and E2 (both in DivA)
    e1_uname = f"TEST_divscope_e1_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": e1_uname, "password": "pw1234", "full_name": "Emp E1",
        "role": "employee",
    }, headers=_auth(ctx["dma_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["e1_user_full"] = r.json()
    ctx["e1_token"], ctx["e1_user"] = _login(e1_uname, "pw1234")
    assert ctx["e1_user"]["division_id"] == ctx["divA"]["id"]

    e2_uname = f"TEST_divscope_e2_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": e2_uname, "password": "pw1234", "full_name": "Emp E2",
        "role": "employee",
    }, headers=_auth(ctx["dma_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["e2_token"], ctx["e2_user"] = _login(e2_uname, "pw1234")
    assert ctx["e2_user"]["division_id"] == ctx["divA"]["id"]

    # 7. DMB creates employee E3 in DivB
    e3_uname = f"TEST_divscope_e3_{TAG}"
    r = requests.post(f"{API}/users", json={
        "username": e3_uname, "password": "pw1234", "full_name": "Emp E3",
        "role": "employee",
    }, headers=_auth(ctx["dmb_token"]), timeout=20)
    assert r.status_code == 200, r.text
    ctx["e3_token"], ctx["e3_user"] = _login(e3_uname, "pw1234")
    assert ctx["e3_user"]["division_id"] == ctx["divB"]["id"]

    # 8. Each employee creates an activity, then walk it through the approval chain
    def _create_and_approve(emp_token, divm_token, note):
        r = requests.post(f"{API}/activities", json={
            "activity_date": "2026-01-15",
            "activity_type": "تفتيش أمني",
            "target_department_id": ctx["dept"]["id"],
            "notes": note,
        }, headers=_auth(emp_token), timeout=20)
        assert r.status_code == 200, r.text
        act = r.json()
        aid = act["id"]
        # divm approve
        r = requests.post(f"{API}/activities/{aid}/action", json={"action": "approve"},
                         headers=_auth(divm_token), timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "pending_department", r.text
        # dm approve
        r = requests.post(f"{API}/activities/{aid}/action", json={"action": "approve"},
                         headers=_auth(ctx["dm_token"]), timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "pending_gm", r.text
        # gm approve
        r = requests.post(f"{API}/activities/{aid}/action", json={"action": "approve"},
                         headers=_auth(ctx["gm_token"]), timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "approved", r.text
        return aid

    ctx["act_e1"] = _create_and_approve(ctx["e1_token"], ctx["dma_token"], f"TEST_divscope_a_{TAG}_e1")
    ctx["act_e2"] = _create_and_approve(ctx["e2_token"], ctx["dma_token"], f"TEST_divscope_a_{TAG}_e2")
    ctx["act_e3"] = _create_and_approve(ctx["e3_token"], ctx["dmb_token"], f"TEST_divscope_a_{TAG}_e3")

    return ctx


# --------------------------------------------------------------------------
# Employee E1 perspective — must see BOTH E1 and E2 (same division), not E3
# --------------------------------------------------------------------------
class TestEmployeeDivisionScope:
    def test_summary_counts_include_division_colleague(self, env):
        r = requests.get(f"{API}/reports/summary",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # There must be at least 2 approved activities visible (E1 + E2)
        assert d["approved"] >= 2, f"expected approved>=2 (E1+E2), got {d}"
        assert d["total"] >= 2, f"expected total>=2 (E1+E2), got {d}"

    def test_by_department_returns_dept_stats(self, env):
        r = requests.get(f"{API}/reports/by-department",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        # E1 must see the row for their own department (dept X) with the
        # 2 division-A activities counted (E1+E2). E3's activity in DivB
        # is same department, so from department-aggregation viewpoint the
        # scope filter is employee_division_id → E3 is EXCLUDED here.
        # The dept row for dept X should still exist but with total counting
        # only DivA activities under employee division-scope filter.
        row = next((x for x in arr if x["department_id"] == env["dept"]["id"]), None)
        assert row is not None, "employee should see own department row"
        assert row["total"] >= 2, f"expected E1's dept to include E1+E2 (>=2), got {row}"

    def test_completion_rates_contains_e1_and_e2_not_e3(self, env):
        r = requests.get(f"{API}/reports/completion-rates",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        ids = {x["employee_id"] for x in arr}
        assert env["e1_user"]["id"] in ids, "E1 must be present"
        assert env["e2_user"]["id"] in ids, "E2 must be present (same division as E1)"
        assert env["e3_user"]["id"] not in ids, "E3 must NOT be present (different division)"

        # Sanity: E1 and E2 should have total >=1 approved each
        for e_id in (env["e1_user"]["id"], env["e2_user"]["id"]):
            row = next(x for x in arr if x["employee_id"] == e_id)
            assert row["total"] >= 1
            assert row["approved"] >= 1
            assert row["completion_rate"] == 100.0

    def test_kpis_contains_e1_and_e2_not_e3(self, env):
        r = requests.get(f"{API}/reports/kpis",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        ids = {x["employee_id"] for x in arr}
        assert env["e1_user"]["id"] in ids
        assert env["e2_user"]["id"] in ids
        assert env["e3_user"]["id"] not in ids

    def test_weekly_returns_both_e1_and_e2(self, env):
        r = requests.get(f"{API}/reports/weekly",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period"] == "weekly"
        emp_ids = {a["employee_id"] for a in d["activities"]}
        assert env["e1_user"]["id"] in emp_ids
        assert env["e2_user"]["id"] in emp_ids
        assert env["e3_user"]["id"] not in emp_ids

    def test_monthly_returns_both_e1_and_e2(self, env):
        r = requests.get(f"{API}/reports/monthly",
                        headers=_auth(env["e1_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period"] == "monthly"
        emp_ids = {a["employee_id"] for a in d["activities"]}
        assert env["e1_user"]["id"] in emp_ids
        assert env["e2_user"]["id"] in emp_ids
        assert env["e3_user"]["id"] not in emp_ids


# --------------------------------------------------------------------------
# Department manager perspective — sees whole department (E1, E2, E3)
# --------------------------------------------------------------------------
class TestDepartmentManagerScope:
    def test_completion_rates_dm_sees_all_three(self, env):
        r = requests.get(f"{API}/reports/completion-rates",
                        headers=_auth(env["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        for e in ("e1_user", "e2_user", "e3_user"):
            assert env[e]["id"] in ids, f"{e} missing from dept manager view"

    def test_kpis_dm_sees_all_three(self, env):
        r = requests.get(f"{API}/reports/kpis",
                        headers=_auth(env["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        for e in ("e1_user", "e2_user", "e3_user"):
            assert env[e]["id"] in ids

    def test_summary_dm_counts_all_three_approved(self, env):
        r = requests.get(f"{API}/reports/summary",
                        headers=_auth(env["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["approved"] >= 3, f"expected DM to see >=3 approved (E1+E2+E3), got {d}"

    def test_weekly_dm_returns_all_three(self, env):
        r = requests.get(f"{API}/reports/weekly",
                        headers=_auth(env["dm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        emp_ids = {a["employee_id"] for a in r.json()["activities"]}
        for e in ("e1_user", "e2_user", "e3_user"):
            assert env[e]["id"] in emp_ids


# --------------------------------------------------------------------------
# Division manager perspective — sees only own division (regression)
# --------------------------------------------------------------------------
class TestDivisionManagerScope:
    def test_dma_sees_only_diva_employees(self, env):
        r = requests.get(f"{API}/reports/completion-rates",
                        headers=_auth(env["dma_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        assert env["e1_user"]["id"] in ids
        assert env["e2_user"]["id"] in ids
        assert env["e3_user"]["id"] not in ids

    def test_dmb_sees_only_divb_employee(self, env):
        r = requests.get(f"{API}/reports/completion-rates",
                        headers=_auth(env["dmb_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        assert env["e3_user"]["id"] in ids
        assert env["e1_user"]["id"] not in ids
        assert env["e2_user"]["id"] not in ids


# --------------------------------------------------------------------------
# General manager — sees everything (regression)
# --------------------------------------------------------------------------
class TestGeneralManagerScope:
    def test_gm_sees_all_three_employees(self, env):
        r = requests.get(f"{API}/reports/completion-rates",
                        headers=_auth(env["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        for e in ("e1_user", "e2_user", "e3_user"):
            assert env[e]["id"] in ids

    def test_gm_kpis_sees_all_three(self, env):
        r = requests.get(f"{API}/reports/kpis",
                        headers=_auth(env["gm_token"]), timeout=20)
        assert r.status_code == 200, r.text
        ids = {x["employee_id"] for x in r.json()}
        for e in ("e1_user", "e2_user", "e3_user"):
            assert env[e]["id"] in ids
