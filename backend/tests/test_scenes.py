"""Backend tests for VJ Kinetic Type Engine scenes CRUD API."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://text-visual-studio-2.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup TEST_ scenes
    try:
        for sc in s.get(f"{API}/scenes", timeout=10).json():
            if sc.get("name", "").startswith("TEST_"):
                s.delete(f"{API}/scenes/{sc['id']}", timeout=10)
    except Exception:
        pass


def _sample_config():
    return {
        "text": "TEST;LINE",
        "font": "Anton",
        "aspect": "16/9",
        "textColor": "#FFFFFF",
        "bgColor": "#000000",
    }


# --- health ---
def test_api_root(session):
    r = session.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert "message" in r.json()


# --- CRUD ---
def test_list_scenes_returns_list(session):
    r = session.get(f"{API}/scenes", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_and_get_scene(session):
    name = f"TEST_create_{uuid.uuid4().hex[:6]}"
    r = session.post(f"{API}/scenes", json={"name": name, "config": _sample_config()}, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == name
    assert body["config"]["text"] == "TEST;LINE"
    assert "id" in body and isinstance(body["id"], str)
    assert "_id" not in body

    # GET by id
    g = session.get(f"{API}/scenes/{body['id']}", timeout=10)
    assert g.status_code == 200
    assert g.json()["id"] == body["id"]
    assert g.json()["name"] == name


def test_update_scene(session):
    r = session.post(f"{API}/scenes", json={"name": f"TEST_upd_{uuid.uuid4().hex[:6]}", "config": _sample_config()}, timeout=10)
    sid = r.json()["id"]
    new_name = f"TEST_upd_renamed_{uuid.uuid4().hex[:6]}"
    u = session.put(f"{API}/scenes/{sid}", json={"name": new_name, "config": {"text": "NEW"}}, timeout=10)
    assert u.status_code == 200
    assert u.json()["name"] == new_name
    assert u.json()["config"]["text"] == "NEW"

    g = session.get(f"{API}/scenes/{sid}", timeout=10)
    assert g.json()["name"] == new_name
    assert g.json()["config"]["text"] == "NEW"


def test_delete_scene(session):
    r = session.post(f"{API}/scenes", json={"name": f"TEST_del_{uuid.uuid4().hex[:6]}", "config": _sample_config()}, timeout=10)
    sid = r.json()["id"]
    d = session.delete(f"{API}/scenes/{sid}", timeout=10)
    assert d.status_code == 200
    assert d.json().get("deleted") is True

    g = session.get(f"{API}/scenes/{sid}", timeout=10)
    assert g.status_code == 404


def test_get_unknown_scene_404(session):
    r = session.get(f"{API}/scenes/does-not-exist-{uuid.uuid4()}", timeout=10)
    assert r.status_code == 404


def test_put_unknown_scene_404(session):
    r = session.put(f"{API}/scenes/does-not-exist-{uuid.uuid4()}", json={"name": "x"}, timeout=10)
    assert r.status_code == 404


def test_delete_unknown_scene_404(session):
    r = session.delete(f"{API}/scenes/does-not-exist-{uuid.uuid4()}", timeout=10)
    assert r.status_code == 404
