import io
import os


def setup_job(client):
    reg = client.post("/api/auth/register", json={
        "email": f"spkuser-{os.urandom(4).hex()}@example.com",
        "password": "testpass123",
        "name": "Speaker User",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    job = client.post(
        "/api/jobs",
        data={"title": "Speaker Job"},
        files={"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")},
        headers=headers,
    ).json()
    return headers, job["id"]


def test_create_speaker(client):
    headers, job_id = setup_job(client)
    response = client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 1",
        "label": "S1",
        "color": "#FF0000",
    }, headers=headers)
    assert response.status_code == 201
    assert response.json()["name"] == "Speaker 1"
    assert response.json()["color"] == "#FF0000"


def test_list_speakers(client):
    headers, job_id = setup_job(client)
    client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 1", "label": "S1", "color": "#FF0000",
    }, headers=headers)
    client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 2", "label": "S2", "color": "#0000FF",
    }, headers=headers)
    response = client.get(f"/api/jobs/{job_id}/speakers", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_speaker(client):
    headers, job_id = setup_job(client)
    speaker = client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 1", "label": "S1", "color": "#FF0000",
    }, headers=headers).json()
    response = client.patch(f"/api/speakers/{speaker['id']}", json={
        "name": "Juan",
    }, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Juan"


def test_delete_speaker(client):
    headers, job_id = setup_job(client)
    speaker = client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 1", "label": "S1", "color": "#FF0000",
    }, headers=headers).json()
    response = client.delete(f"/api/speakers/{speaker['id']}", headers=headers)
    assert response.status_code == 204
