import io
import os


def setup_job(client):
    reg = client.post("/api/auth/register", json={
        "email": f"seguser-{os.urandom(4).hex()}@example.com",
        "password": "testpass123",
        "name": "Seg User",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    job = client.post(
        "/api/jobs",
        data={"title": "Seg Job"},
        files={"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")},
        headers=headers,
    ).json()
    return headers, job["id"]


def test_create_segment(client):
    headers, job_id = setup_job(client)
    response = client.post(f"/api/jobs/{job_id}/segments", json={
        "start_time": 0.0,
        "end_time": 5.0,
        "text": "Hello world",
        "position": 0,
    }, headers=headers)
    assert response.status_code == 201
    assert response.json()["text"] == "Hello world"


def test_list_segments_ordered(client):
    headers, job_id = setup_job(client)
    client.post(f"/api/jobs/{job_id}/segments", json={
        "start_time": 5.0, "end_time": 10.0, "text": "Second", "position": 1,
    }, headers=headers)
    client.post(f"/api/jobs/{job_id}/segments", json={
        "start_time": 0.0, "end_time": 5.0, "text": "First", "position": 0,
    }, headers=headers)
    response = client.get(f"/api/jobs/{job_id}/segments", headers=headers)
    assert response.status_code == 200
    segments = response.json()
    assert len(segments) == 2
    assert segments[0]["text"] == "First"
    assert segments[1]["text"] == "Second"


def test_bulk_save_segments(client):
    headers, job_id = setup_job(client)
    seg = client.post(f"/api/jobs/{job_id}/segments", json={
        "start_time": 0.0, "end_time": 5.0, "text": "Original", "position": 0,
    }, headers=headers).json()

    response = client.put(f"/api/jobs/{job_id}/segments", json={
        "segments": [
            {"id": seg["id"], "start_time": 0.0, "end_time": 5.0, "text": "Updated", "position": 0},
            {"start_time": 5.0, "end_time": 10.0, "text": "New segment", "position": 1},
        ]
    }, headers=headers)
    assert response.status_code == 200
    segments = response.json()
    assert len(segments) == 2
    assert segments[0]["text"] == "Updated"
    assert segments[1]["text"] == "New segment"


def test_delete_segment(client):
    headers, job_id = setup_job(client)
    seg = client.post(f"/api/jobs/{job_id}/segments", json={
        "start_time": 0.0, "end_time": 5.0, "text": "Delete me", "position": 0,
    }, headers=headers).json()
    response = client.delete(f"/api/segments/{seg['id']}", headers=headers)
    assert response.status_code == 204
