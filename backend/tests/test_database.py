def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_tables_created(db):
    from sqlalchemy import inspect
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()
    assert "users" in tables
    assert "jobs" in tables
    assert "segments" in tables
    assert "speakers" in tables
    assert "exports" in tables
