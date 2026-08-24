import io
import os


def setup_job_with_segments(client):
    reg = client.post("/api/auth/register", json={
        "email": f"expuser-{os.urandom(4).hex()}@example.com",
        "password": "testpass123",
        "name": "Export User",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    job = client.post(
        "/api/jobs",
        data={"title": "Export Job"},
        files={"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")},
        headers=headers,
    ).json()
    job_id = job["id"]

    speaker = client.post(f"/api/jobs/{job_id}/speakers", json={
        "name": "Speaker 1", "label": "S1", "color": "#FF0000",
    }, headers=headers).json()

    client.post(f"/api/jobs/{job_id}/segments", json={
        "speaker_id": speaker["id"],
        "start_time": 0.0, "end_time": 5.5, "text": "Hello world", "position": 0,
    }, headers=headers)
    client.post(f"/api/jobs/{job_id}/segments", json={
        "speaker_id": speaker["id"],
        "start_time": 5.5, "end_time": 12.0, "text": "Second line", "position": 1,
    }, headers=headers)

    return headers, job_id


def test_export_txt(client):
    headers, job_id = setup_job_with_segments(client)
    response = client.post(f"/api/jobs/{job_id}/export", json={"format": "txt"}, headers=headers)
    assert response.status_code == 201
    export_id = response.json()["id"]

    download = client.get(f"/api/exports/{export_id}/download", headers=headers)
    assert download.status_code == 200
    content = download.text
    assert "[00:00:00] Speaker 1: Hello world" in content
    assert "[00:00:05] Speaker 1: Second line" in content


def test_export_srt(client):
    headers, job_id = setup_job_with_segments(client)
    response = client.post(f"/api/jobs/{job_id}/export", json={"format": "srt"}, headers=headers)
    assert response.status_code == 201
    export_id = response.json()["id"]

    download = client.get(f"/api/exports/{export_id}/download", headers=headers)
    assert download.status_code == 200
    content = download.text
    assert "00:00:00,000 --> 00:00:05,500" in content
    assert "Speaker 1: Hello world" in content


def test_export_vtt(client):
    headers, job_id = setup_job_with_segments(client)
    response = client.post(f"/api/jobs/{job_id}/export", json={"format": "vtt"}, headers=headers)
    assert response.status_code == 201
    export_id = response.json()["id"]

    download = client.get(f"/api/exports/{export_id}/download", headers=headers)
    assert download.status_code == 200
    content = download.text
    assert content.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:05.500" in content


def test_export_invalid_format(client):
    headers, job_id = setup_job_with_segments(client)
    response = client.post(f"/api/jobs/{job_id}/export", json={"format": "docx"}, headers=headers)
    assert response.status_code == 400
