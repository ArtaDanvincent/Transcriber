
def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "name": "Test User",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email(client):
    client.post("/api/auth/register", json={
        "email": "dupe@example.com",
        "password": "testpass123",
        "name": "User One",
    })
    response = client.post("/api/auth/register", json={
        "email": "dupe@example.com",
        "password": "testpass123",
        "name": "User Two",
    })
    assert response.status_code == 409


def test_login_success(client):
    client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "testpass123",
        "name": "Login User",
    })
    response = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "testpass123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "password": "testpass123",
        "name": "Wrong User",
    })
    response = client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass",
    })
    assert response.status_code == 401


def test_me_with_valid_token(client):
    reg = client.post("/api/auth/register", json={
        "email": "me@example.com",
        "password": "testpass123",
        "name": "Me User",
    })
    token = reg.json()["access_token"]
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
    assert response.json()["name"] == "Me User"


def test_me_without_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 403


def test_refresh_token(client):
    reg = client.post("/api/auth/register", json={
        "email": "refresh@example.com",
        "password": "testpass123",
        "name": "Refresh User",
    })
    refresh_token = reg.json()["refresh_token"]
    response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
