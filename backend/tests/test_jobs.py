import io
import os


def register_and_get_headers(client):
    reg = client.post("/api/auth/register", json={
        "email": f"jobuser-{os.urandom(4).hex()}@example.com",
        "password": "testpass123",
        "name": "Job User",
    })
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_test_job(client, headers, title="Test Job"):
    file_content = b"fake audio content"
    return client.post(
        "/api/jobs",
        data={"title": title},
        files={"file": ("test.mp3", io.BytesIO(file_content), "audio/mpeg")},
        headers=headers,
    )


def test_create_job(client):
    headers = register_and_get_headers(client)
    response = create_test_job(client, headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Job"
    assert data["media_type"] == "audio"
    assert data["status"] == "draft"
    assert data["media_original_name"] == "test.mp3"


def test_create_job_invalid_format(client):
    headers = register_and_get_headers(client)
    response = client.post(
        "/api/jobs",
        data={"title": "Bad Job"},
        files={"file": ("test.txt", io.BytesIO(b"not audio"), "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_list_jobs(client):
    headers = register_and_get_headers(client)
    create_test_job(client, headers, "Job 1")
    create_test_job(client, headers, "Job 2")
    response = client.get("/api/jobs", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["jobs"]) == 2


def test_get_job(client):
    headers = register_and_get_headers(client)
    created = create_test_job(client, headers).json()
    response = client.get(f"/api/jobs/{created['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Test Job"


def test_update_job(client):
    headers = register_and_get_headers(client)
    created = create_test_job(client, headers).json()
    response = client.patch(
        f"/api/jobs/{created['id']}",
        json={"title": "Updated Title", "status": "completed"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"
    assert response.json()["status"] == "completed"


def test_delete_job(client):
    headers = register_and_get_headers(client)
    created = create_test_job(client, headers).json()
    response = client.delete(f"/api/jobs/{created['id']}", headers=headers)
    assert response.status_code == 204
    response = client.get(f"/api/jobs/{created['id']}", headers=headers)
    assert response.status_code == 404


def test_cannot_access_other_users_job(client):
    headers1 = register_and_get_headers(client)
    headers2 = register_and_get_headers(client)
    created = create_test_job(client, headers1).json()
    response = client.get(f"/api/jobs/{created['id']}", headers=headers2)
    assert response.status_code == 404
