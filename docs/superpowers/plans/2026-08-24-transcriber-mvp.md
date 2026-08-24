# Transcriber MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based transcription tool where users upload audio/video, transcribe in a split-panel workspace, and export as TXT/SRT/VTT.

**Architecture:** Next.js frontend on Vercel communicates via REST API with a self-hosted FastAPI backend. PostgreSQL stores users, jobs, segments, speakers, and exports. Media files live on the local filesystem, served through auth-checked API endpoints.

**Tech Stack:** Next.js 14 + React 18 + TypeScript + Tailwind CSS (frontend), Python 3.11+ + FastAPI + SQLAlchemy + Alembic (backend), PostgreSQL 15+

**Spec:** `docs/superpowers/specs/2026-08-24-transcriber-system-design.md`

## Global Constraints

- Python 3.11+, Node.js 18+, PostgreSQL 15+
- Backend runs on port 8000 in development
- Frontend runs on port 3000 in development
- All API routes prefixed with `/api`
- All UUIDs use `uuid4`
- All timestamps are UTC
- JWT access tokens expire in 15 minutes, refresh tokens in 7 days
- Max upload size: 500MB
- Accepted media: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.mp4`, `.webm`, `.mov`
- Storage path: configurable via `STORAGE_PATH` env var, default `./storage`
- CORS: allow `http://localhost:3000` in dev, configurable `FRONTEND_URL` for prod

---

### Task 1: Backend Project Setup + Database Models

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/job.py`
- Create: `backend/app/models/segment.py`
- Create: `backend/app/models/speaker.py`
- Create: `backend/app/models/export.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_database.py`

**Interfaces:**
- Produces: `get_db()` dependency yielding SQLAlchemy sessions, all 5 SQLAlchemy model classes (`User`, `Job`, `Segment`, `Speaker`, `Export`), `settings` config object with attributes `DATABASE_URL: str`, `STORAGE_PATH: str`, `JWT_SECRET: str`, `JWT_ALGORITHM: str`, `ACCESS_TOKEN_EXPIRE_MINUTES: int`, `REFRESH_TOKEN_EXPIRE_DAYS: int`, `FRONTEND_URL: str`

- [ ] **Step 1: Create requirements.txt**

```
# backend/requirements.txt
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.31
psycopg2-binary==2.9.9
alembic==1.13.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
pydantic-settings==2.3.4
python-dotenv==1.0.1
pytest==8.2.2
httpx==0.27.0
```

- [ ] **Step 2: Create .env file**

```
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transcriber
STORAGE_PATH=./storage
JWT_SECRET=dev-secret-change-in-production
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Create config.py**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/transcriber"
    STORAGE_PATH: str = "./storage"
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 4: Create database.py**

```python
# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Create all 5 SQLAlchemy models**

```python
# backend/app/models/user.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    jobs: Mapped[list["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan")
```

```python
# backend/app/models/job.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    media_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    media_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="jobs")
    segments: Mapped[list["Segment"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    speakers: Mapped[list["Speaker"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    exports: Mapped[list["Export"]] = relationship(back_populates="job", cascade="all, delete-orphan")
```

```python
# backend/app/models/speaker.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Speaker(Base):
    __tablename__ = "speakers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job: Mapped["Job"] = relationship(back_populates="speakers")
    segments: Mapped[list["Segment"]] = relationship(back_populates="speaker")
```

```python
# backend/app/models/segment.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import Text, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    speaker_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True)
    start_time: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    end_time: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        {"indexes": [{"name": "ix_segments_job_position", "columns": ["job_id", "position"]}]},
    )

    job: Mapped["Job"] = relationship(back_populates="segments")
    speaker: Mapped["Speaker | None"] = relationship(back_populates="segments")
```

```python
# backend/app/models/export.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job: Mapped["Job"] = relationship(back_populates="exports")
```

```python
# backend/app/models/__init__.py
from app.models.user import User
from app.models.job import Job
from app.models.segment import Segment
from app.models.speaker import Speaker
from app.models.export import Export

__all__ = ["User", "Job", "Segment", "Speaker", "Export"]
```

- [ ] **Step 6: Create main.py with CORS**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="Transcriber API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 7: Initialize Alembic and create initial migration**

```ini
# backend/alembic.ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/transcriber

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

```python
# backend/alembic/env.py
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.database import Base
from app.models import User, Job, Segment, Speaker, Export  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Run:
```bash
cd backend
pip install -r requirements.txt
alembic init alembic  # only to generate script.py.mako if not already there
alembic revision --autogenerate -m "initial tables"
alembic upgrade head
```

- [ ] **Step 8: Write database connection test**

```python
# backend/tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import User, Job, Segment, Speaker, Export  # noqa: F401

TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/transcriber_test"

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db):
    from httpx import Client, ASGITransport

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    with Client(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

```python
# backend/tests/test_database.py
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
```

- [ ] **Step 9: Run tests to verify**

Run: `cd backend && pytest tests/test_database.py -v`
Expected: 2 tests PASS

- [ ] **Step 10: Create the PostgreSQL test database and commit**

Run:
```bash
createdb transcriber_test
cd backend && pytest tests/test_database.py -v
git add backend/
git commit -m "feat: backend project setup with FastAPI, SQLAlchemy models, and Alembic"
```

---

### Task 2: Auth System

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/dependencies.py`
- Modify: `backend/app/main.py` — add auth router
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `get_db()` from `app.database`, `User` model from `app.models`, `settings` from `app.config`
- Produces: `get_current_user(token: str, db: Session) -> User` dependency, auth router mounted at `/api/auth`

- [ ] **Step 1: Write auth Pydantic schemas**

```python
# backend/app/schemas/auth.py
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: str
    password: str
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
```

- [ ] **Step 2: Write auth service (password hashing + JWT)**

```python
# backend/app/services/auth.py
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, password: str, name: str) -> User:
    user = User(email=email, password_hash=hash_password(password), name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 3: Write get_current_user dependency**

```python
# backend/app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth import decode_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
```

- [ ] **Step 4: Write auth router**

```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse, RefreshRequest
from app.services.auth import (
    get_user_by_email,
    create_user,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = create_user(db, data.email, data.password, data.name)
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 5: Register auth router in main.py**

Add to `backend/app/main.py` after the CORS middleware:

```python
from app.routers import auth

app.include_router(auth.router)
```

- [ ] **Step 6: Write auth tests**

```python
# backend/tests/test_auth.py

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
```

- [ ] **Step 7: Run tests**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: 7 tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/services/auth.py backend/app/routers/auth.py backend/app/dependencies.py backend/app/main.py backend/tests/test_auth.py
git commit -m "feat: auth system with register, login, JWT refresh, and /me endpoint"
```

---

### Task 3: Jobs API + File Upload

**Files:**
- Create: `backend/app/schemas/job.py`
- Create: `backend/app/services/media.py`
- Create: `backend/app/routers/jobs.py`
- Modify: `backend/app/main.py` — add jobs router
- Create: `backend/tests/test_jobs.py`

**Interfaces:**
- Consumes: `get_db()`, `get_current_user()`, `Job` model, `settings.STORAGE_PATH`
- Produces: Jobs CRUD router at `/api/jobs`, `GET /api/jobs/{id}/media` streaming endpoint

- [ ] **Step 1: Write job Pydantic schemas**

```python
# backend/app/schemas/job.py
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class JobResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    status: str
    media_type: str
    media_duration: Optional[int]
    media_original_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
```

- [ ] **Step 2: Write media service (file save, delete, path helpers)**

```python
# backend/app/services/media.py
import os
import shutil
import uuid

from fastapi import UploadFile

from app.config import settings

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".webm", ".mov"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}


def get_media_type(filename: str) -> str | None:
    ext = os.path.splitext(filename)[1].lower()
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return None


def validate_media_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def get_storage_dir(user_id: uuid.UUID, job_id: uuid.UUID) -> str:
    path = os.path.join(settings.STORAGE_PATH, "media", str(user_id), str(job_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_upload(file: UploadFile, user_id: uuid.UUID, job_id: uuid.UUID) -> str:
    storage_dir = get_storage_dir(user_id, job_id)
    ext = os.path.splitext(file.filename)[1].lower()
    file_path = os.path.join(storage_dir, f"recording{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return file_path


def delete_job_files(user_id: uuid.UUID, job_id: uuid.UUID):
    media_dir = os.path.join(settings.STORAGE_PATH, "media", str(user_id), str(job_id))
    if os.path.exists(media_dir):
        shutil.rmtree(media_dir)
    export_dir = os.path.join(settings.STORAGE_PATH, "exports", str(user_id), str(job_id))
    if os.path.exists(export_dir):
        shutil.rmtree(export_dir)
```

- [ ] **Step 3: Write jobs router**

```python
# backend/app/routers/jobs.py
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobResponse, JobListResponse, JobUpdate
from app.services.media import validate_media_file, get_media_type, save_upload, delete_job_files

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
def list_jobs(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Job).filter(Job.user_id == current_user.id).order_by(Job.updated_at.desc())
    total = query.count()
    jobs = query.offset(offset).limit(limit).all()
    return JobListResponse(jobs=jobs, total=total)


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not validate_media_file(file.filename):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    media_type = get_media_type(file.filename)
    job = Job(
        user_id=current_user.id,
        title=title,
        description=description,
        media_type=media_type,
        media_original_name=file.filename,
        media_file_path="",
    )
    db.add(job)
    db.flush()

    file_path = save_upload(file, current_user.id, job.id)
    job.media_file_path = file_path
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    data: JobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if data.title is not None:
        job.title = data.title
    if data.description is not None:
        job.description = data.description
    if data.status is not None:
        if data.status not in ("draft", "completed"):
            raise HTTPException(status_code=400, detail="Status must be 'draft' or 'completed'")
        job.status = data.status
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    delete_job_files(current_user.id, job.id)
    db.delete(job)
    db.commit()


@router.get("/{job_id}/media")
def stream_media(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job.media_file_path):
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(job.media_file_path, media_type=f"{job.media_type}/{'mp4' if job.media_type == 'video' else 'mpeg'}")
```

- [ ] **Step 4: Register jobs router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import auth, jobs

app.include_router(auth.router)
app.include_router(jobs.router)
```

- [ ] **Step 5: Write jobs tests**

```python
# backend/tests/test_jobs.py
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
```

- [ ] **Step 6: Run tests**

Run: `cd backend && pytest tests/test_jobs.py -v`
Expected: 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/job.py backend/app/services/media.py backend/app/routers/jobs.py backend/app/main.py backend/tests/test_jobs.py
git commit -m "feat: jobs API with file upload, CRUD, media streaming, and ownership checks"
```

---

### Task 4: Segments + Speakers API

**Files:**
- Create: `backend/app/schemas/segment.py`
- Create: `backend/app/schemas/speaker.py`
- Create: `backend/app/routers/segments.py`
- Create: `backend/app/routers/speakers.py`
- Modify: `backend/app/main.py` — add routers
- Create: `backend/tests/test_segments.py`
- Create: `backend/tests/test_speakers.py`

**Interfaces:**
- Consumes: `get_db()`, `get_current_user()`, `Job`, `Segment`, `Speaker` models
- Produces: Segments router at `/api/jobs/{id}/segments` + `/api/segments/{id}`, Speakers router at `/api/jobs/{id}/speakers` + `/api/speakers/{id}`, including `PUT /api/jobs/{id}/segments` for bulk autosave

- [ ] **Step 1: Write segment schemas**

```python
# backend/app/schemas/segment.py
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SegmentCreate(BaseModel):
    speaker_id: Optional[uuid.UUID] = None
    start_time: float
    end_time: float
    text: str = ""
    position: int


class SegmentUpdate(BaseModel):
    speaker_id: Optional[uuid.UUID] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    text: Optional[str] = None
    position: Optional[int] = None


class SegmentResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    speaker_id: Optional[uuid.UUID]
    start_time: float
    end_time: float
    text: str
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkSegment(BaseModel):
    id: Optional[uuid.UUID] = None
    speaker_id: Optional[uuid.UUID] = None
    start_time: float
    end_time: float
    text: str = ""
    position: int


class BulkSaveRequest(BaseModel):
    segments: list[BulkSegment]
```

- [ ] **Step 2: Write speaker schemas**

```python
# backend/app/schemas/speaker.py
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SpeakerCreate(BaseModel):
    name: str
    label: str
    color: str


class SpeakerUpdate(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None


class SpeakerResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    name: str
    label: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Write segments router with bulk save**

```python
# backend/app/routers/segments.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.job import Job
from app.models.segment import Segment
from app.models.user import User
from app.schemas.segment import SegmentCreate, SegmentUpdate, SegmentResponse, BulkSaveRequest

router = APIRouter(tags=["segments"])


def get_job_for_user(db: Session, job_id: str, user: User) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def list_segments(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    return db.query(Segment).filter(Segment.job_id == job_id).order_by(Segment.position).all()


@router.post("/api/jobs/{job_id}/segments", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
def create_segment(
    job_id: str,
    data: SegmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    segment = Segment(job_id=uuid.UUID(job_id), **data.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.put("/api/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def bulk_save_segments(
    job_id: str,
    data: BulkSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    job_uuid = uuid.UUID(job_id)

    existing_ids = {s.id for s in db.query(Segment.id).filter(Segment.job_id == job_uuid).all()}
    incoming_ids = {s.id for s in data.segments if s.id is not None}

    ids_to_delete = existing_ids - incoming_ids
    if ids_to_delete:
        db.query(Segment).filter(Segment.id.in_(ids_to_delete)).delete(synchronize_session=False)

    for seg_data in data.segments:
        if seg_data.id and seg_data.id in existing_ids:
            db.query(Segment).filter(Segment.id == seg_data.id).update({
                "speaker_id": seg_data.speaker_id,
                "start_time": seg_data.start_time,
                "end_time": seg_data.end_time,
                "text": seg_data.text,
                "position": seg_data.position,
            })
        else:
            segment = Segment(job_id=job_uuid, **seg_data.model_dump(exclude={"id"} if not seg_data.id else set()))
            db.add(segment)

    db.commit()
    return db.query(Segment).filter(Segment.job_id == job_uuid).order_by(Segment.position).all()


@router.patch("/api/segments/{segment_id}", response_model=SegmentResponse)
def update_segment(
    segment_id: str,
    data: SegmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    get_job_for_user(db, str(segment.job_id), current_user)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(segment, key, value)
    db.commit()
    db.refresh(segment)
    return segment


@router.delete("/api/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_segment(
    segment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    get_job_for_user(db, str(segment.job_id), current_user)
    db.delete(segment)
    db.commit()
```

- [ ] **Step 4: Write speakers router**

```python
# backend/app/routers/speakers.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.job import Job
from app.models.speaker import Speaker
from app.models.user import User
from app.schemas.speaker import SpeakerCreate, SpeakerUpdate, SpeakerResponse

router = APIRouter(tags=["speakers"])


def get_job_for_user(db: Session, job_id: str, user: User) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/jobs/{job_id}/speakers", response_model=list[SpeakerResponse])
def list_speakers(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    return db.query(Speaker).filter(Speaker.job_id == job_id).all()


@router.post("/api/jobs/{job_id}/speakers", response_model=SpeakerResponse, status_code=status.HTTP_201_CREATED)
def create_speaker(
    job_id: str,
    data: SpeakerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    speaker = Speaker(job_id=uuid.UUID(job_id), **data.model_dump())
    db.add(speaker)
    db.commit()
    db.refresh(speaker)
    return speaker


@router.patch("/api/speakers/{speaker_id}", response_model=SpeakerResponse)
def update_speaker(
    speaker_id: str,
    data: SpeakerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    get_job_for_user(db, str(speaker.job_id), current_user)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(speaker, key, value)
    db.commit()
    db.refresh(speaker)
    return speaker


@router.delete("/api/speakers/{speaker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_speaker(
    speaker_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    get_job_for_user(db, str(speaker.job_id), current_user)
    db.delete(speaker)
    db.commit()
```

- [ ] **Step 5: Register routers in main.py**

Update `backend/app/main.py`:

```python
from app.routers import auth, jobs, segments, speakers

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(segments.router)
app.include_router(speakers.router)
```

- [ ] **Step 6: Write segments tests**

```python
# backend/tests/test_segments.py
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
```

- [ ] **Step 7: Write speakers tests**

```python
# backend/tests/test_speakers.py
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
```

- [ ] **Step 8: Run all tests**

Run: `cd backend && pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/segment.py backend/app/schemas/speaker.py backend/app/routers/segments.py backend/app/routers/speakers.py backend/app/main.py backend/tests/test_segments.py backend/tests/test_speakers.py
git commit -m "feat: segments API with bulk save and speakers API with CRUD"
```

---

### Task 5: Export API

**Files:**
- Create: `backend/app/schemas/export.py`
- Create: `backend/app/services/export.py`
- Create: `backend/app/routers/exports.py`
- Modify: `backend/app/main.py` — add exports router
- Create: `backend/tests/test_exports.py`

**Interfaces:**
- Consumes: `get_db()`, `get_current_user()`, `Job`, `Segment`, `Speaker`, `Export` models, `settings.STORAGE_PATH`
- Produces: `POST /api/jobs/{id}/export` generating TXT/SRT/VTT files, `GET /api/exports/{id}/download` serving them

- [ ] **Step 1: Write export schemas**

```python
# backend/app/schemas/export.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class ExportRequest(BaseModel):
    format: str  # "txt", "srt", "vtt"


class ExportResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    format: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write export service (TXT, SRT, VTT generators)**

```python
# backend/app/services/export.py
import os
import uuid

from sqlalchemy.orm import Session

from app.config import settings
from app.models.segment import Segment
from app.models.speaker import Speaker


def format_timestamp_srt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def format_timestamp_txt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def get_speaker_name(db: Session, speaker_id: uuid.UUID | None) -> str:
    if speaker_id is None:
        return ""
    speaker = db.query(Speaker).filter(Speaker.id == speaker_id).first()
    return speaker.name if speaker else ""


def generate_txt(db: Session, job_id: uuid.UUID) -> str:
    segments = db.query(Segment).filter(Segment.job_id == job_id).order_by(Segment.position).all()
    lines = []
    for seg in segments:
        timestamp = format_timestamp_txt(float(seg.start_time))
        speaker = get_speaker_name(db, seg.speaker_id)
        prefix = f"[{timestamp}]"
        if speaker:
            prefix += f" {speaker}:"
        lines.append(f"{prefix} {seg.text}")
    return "\n".join(lines)


def generate_srt(db: Session, job_id: uuid.UUID) -> str:
    segments = db.query(Segment).filter(Segment.job_id == job_id).order_by(Segment.position).all()
    blocks = []
    for i, seg in enumerate(segments, 1):
        start = format_timestamp_srt(float(seg.start_time))
        end = format_timestamp_srt(float(seg.end_time))
        speaker = get_speaker_name(db, seg.speaker_id)
        text = f"{speaker}: {seg.text}" if speaker else seg.text
        blocks.append(f"{i}\n{start} --> {end}\n{text}")
    return "\n\n".join(blocks)


def generate_vtt(db: Session, job_id: uuid.UUID) -> str:
    segments = db.query(Segment).filter(Segment.job_id == job_id).order_by(Segment.position).all()
    blocks = ["WEBVTT", ""]
    for seg in segments:
        start = format_timestamp_vtt(float(seg.start_time))
        end = format_timestamp_vtt(float(seg.end_time))
        speaker = get_speaker_name(db, seg.speaker_id)
        text = f"{speaker}: {seg.text}" if speaker else seg.text
        blocks.append(f"{start} --> {end}\n{text}")
    return "\n\n".join(blocks)


GENERATORS = {
    "txt": generate_txt,
    "srt": generate_srt,
    "vtt": generate_vtt,
}


def save_export_file(content: str, user_id: uuid.UUID, job_id: uuid.UUID, fmt: str) -> str:
    export_dir = os.path.join(settings.STORAGE_PATH, "exports", str(user_id), str(job_id))
    os.makedirs(export_dir, exist_ok=True)
    file_path = os.path.join(export_dir, f"transcript.{fmt}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return file_path
```

- [ ] **Step 3: Write exports router**

```python
# backend/app/routers/exports.py
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.export import Export
from app.models.job import Job
from app.models.user import User
from app.schemas.export import ExportRequest, ExportResponse
from app.services.export import GENERATORS, save_export_file

router = APIRouter(tags=["exports"])


@router.post("/api/jobs/{job_id}/export", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
def create_export(
    job_id: str,
    data: ExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if data.format not in GENERATORS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {data.format}. Use: txt, srt, vtt")

    generator = GENERATORS[data.format]
    content = generator(db, job.id)
    file_path = save_export_file(content, current_user.id, job.id, data.format)

    export = Export(job_id=job.id, format=data.format, file_path=file_path)
    db.add(export)
    db.commit()
    db.refresh(export)
    return export


@router.get("/api/exports/{export_id}/download")
def download_export(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    export = db.query(Export).filter(Export.id == export_id).first()
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    job = db.query(Job).filter(Job.id == export.job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Export not found")

    if not os.path.exists(export.file_path):
        raise HTTPException(status_code=404, detail="Export file not found")

    ext_to_media = {"txt": "text/plain", "srt": "text/plain", "vtt": "text/vtt"}
    media_type = ext_to_media.get(export.format, "application/octet-stream")
    filename = f"{job.title}.{export.format}"
    return FileResponse(export.file_path, media_type=media_type, filename=filename)
```

- [ ] **Step 4: Register exports router in main.py**

Update `backend/app/main.py`:

```python
from app.routers import auth, jobs, segments, speakers, exports

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(segments.router)
app.include_router(speakers.router)
app.include_router(exports.router)
```

- [ ] **Step 5: Write export tests**

```python
# backend/tests/test_exports.py
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
```

- [ ] **Step 6: Run all tests**

Run: `cd backend && pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/export.py backend/app/services/export.py backend/app/routers/exports.py backend/app/main.py backend/tests/test_exports.py
git commit -m "feat: export API generating TXT, SRT, and VTT transcript formats"
```

---

### Task 6: Frontend Project Setup + TypeScript Types + API Client + Auth Pages

**Files:**
- Create: `frontend/package.json` (via `npx create-next-app`)
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/formatTime.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/components/layout/AuthGuard.tsx`
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: Backend API at `http://localhost:8000/api`
- Produces: `api` client object with methods `api.get(url)`, `api.post(url, data)`, `api.patch(url, data)`, `api.put(url, data)`, `api.delete(url)`, `api.upload(url, formData)`. `useAuth()` hook returning `{ user, token, login, register, logout, loading }`. `AuthGuard` component wrapping protected pages. TypeScript types: `User`, `Job`, `Segment`, `Speaker`, `ExportRecord`, `TokenResponse`, `JobListResponse`.

- [ ] **Step 1: Create Next.js project**

Run:
```bash
cd /c/xampp/htdocs/Transcriber
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

When prompted: use defaults (App Router, Tailwind, ESLint, src/ directory).

- [ ] **Step 2: Create TypeScript types**

```typescript
// frontend/src/types/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "completed";
  media_type: "audio" | "video";
  media_duration: number | null;
  media_original_name: string;
  created_at: string;
  updated_at: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
}

export interface Segment {
  id: string;
  job_id: string;
  speaker_id: string | null;
  start_time: number;
  end_time: number;
  text: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Speaker {
  id: string;
  job_id: string;
  name: string;
  label: string;
  color: string;
  created_at: string;
}

export interface ExportRecord {
  id: string;
  job_id: string;
  format: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
```

- [ ] **Step 3: Create API client with JWT handling**

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
      }
      return null;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async get(path: string) {
    const response = await fetch(`${API_URL}${path}`, { headers: this.getHeaders() });
    return this.handleResponse(response);
  }

  async post(path: string, body?: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(response);
  }

  async patch(path: string, body: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async put(path: string, body: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async delete(path: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async upload(path: string, formData: FormData) {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
    return this.handleResponse(response);
  }

  getMediaUrl(jobId: string): string {
    return `${API_URL}/api/jobs/${jobId}/media`;
  }

  getDownloadUrl(exportId: string): string {
    return `${API_URL}/api/exports/${exportId}/download`;
  }
}

export const api = new ApiClient();
```

- [ ] **Step 4: Create formatTime utility**

```typescript
// frontend/src/lib/formatTime.ts
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
```

- [ ] **Step 5: Create useAuth hook**

```typescript
// frontend/src/hooks/useAuth.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { User, TokenResponse } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/api/auth/me");
      setUser(data as User);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const data = (await api.post("/api/auth/login", { email, password })) as TokenResponse;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    await fetchUser();
  };

  const register = async (email: string, password: string, name: string) => {
    const data = (await api.post("/api/auth/register", { email, password, name })) as TokenResponse;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    await fetchUser();
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
```

- [ ] **Step 6: Create AuthGuard component**

```tsx
// frontend/src/components/layout/AuthGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
```

- [ ] **Step 7: Create Login page**

```tsx
// frontend/src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Transcriber</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create Register page**

```tsx
// frontend/src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(email, password, name);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded">{error}</div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Update root page to redirect and add .env.local**

```tsx
// frontend/src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 10: Run frontend dev server and verify pages render**

Run:
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` — should redirect to `/login`. Verify login and register pages render correctly. No backend calls needed for this check — just UI rendering.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: frontend project setup with auth pages, API client, and TypeScript types"
```

---

### Task 7: Dashboard Page

**Files:**
- Create: `frontend/src/hooks/useJobs.ts`
- Create: `frontend/src/components/dashboard/JobCard.tsx`
- Create: `frontend/src/components/dashboard/JobList.tsx`
- Create: `frontend/src/components/dashboard/UploadModal.tsx`
- Create: `frontend/src/components/layout/Navbar.tsx`
- Create: `frontend/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `api` client, `useAuth()` hook, `Job`, `JobListResponse` types
- Produces: `useJobs()` hook returning `{ jobs, total, loading, refresh, deleteJob }`. Dashboard page at `/dashboard`. `UploadModal` component for creating jobs with file upload.

- [ ] **Step 1: Create useJobs hook**

```typescript
// frontend/src/hooks/useJobs.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Job, JobListResponse } from "@/types";

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.get("/api/jobs")) as JobListResponse;
      setJobs(data.jobs);
      setTotal(data.total);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteJob = async (id: string) => {
    await api.delete(`/api/jobs/${id}`);
    await refresh();
  };

  return { jobs, total, loading, refresh, deleteJob };
}
```

- [ ] **Step 2: Create Navbar component**

```tsx
// frontend/src/components/layout/Navbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">Transcriber</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Create JobCard component**

```tsx
// frontend/src/components/dashboard/JobCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { Job } from "@/types";
import { formatTime, formatTimeAgo } from "@/lib/formatTime";

interface JobCardProps {
  job: Job;
  onDelete: (id: string) => void;
}

export function JobCard({ job, onDelete }: JobCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/workspace/${job.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this transcription?")) {
      onDelete(job.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{job.media_type === "video" ? "🎥" : "🎧"}</span>
          <h3 className="font-medium text-gray-900">{job.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              job.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {job.status === "completed" ? "Completed" : "Draft"}
          </span>
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 text-sm"
            title="Delete"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-500 flex items-center gap-3">
        {job.media_duration && <span>{formatTime(job.media_duration)}</span>}
        <span>{formatTimeAgo(job.updated_at)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create UploadModal component**

```tsx
// frontend/src/components/dashboard/UploadModal.tsx
"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

const ACCEPTED = ".mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov";

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", title || file.name);
      formData.append("file", file);
      await api.upload("/api/jobs", formData);
      setTitle("");
      setFile(null);
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Upload Recording</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recording
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create JobList component**

```tsx
// frontend/src/components/dashboard/JobList.tsx
"use client";

import { Job } from "@/types";
import { JobCard } from "./JobCard";

interface JobListProps {
  jobs: Job[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function JobList({ jobs, loading, onDelete }: JobListProps) {
  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p className="text-lg mb-2">No transcriptions yet</p>
        <p className="text-sm">Upload a recording to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onDelete={onDelete} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create Dashboard page**

```tsx
// frontend/src/app/dashboard/page.tsx
"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Navbar } from "@/components/layout/Navbar";
import { JobList } from "@/components/dashboard/JobList";
import { UploadModal } from "@/components/dashboard/UploadModal";
import { useJobs } from "@/hooks/useJobs";

export default function DashboardPage() {
  const { jobs, loading, refresh, deleteJob } = useJobs();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">My Transcriptions</h2>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              + Upload
            </button>
          </div>
          <JobList jobs={jobs} loading={loading} onDelete={deleteJob} />
        </div>
        <UploadModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          onUploaded={refresh}
        />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 7: Run dev server and verify dashboard**

Run backend: `cd backend && uvicorn app.main:app --reload`
Run frontend: `cd frontend && npm run dev`

1. Register a new account at `/register`
2. Should redirect to `/dashboard`
3. Dashboard shows "No transcriptions yet"
4. Click "+ Upload", select an audio file, submit
5. Job appears in the list
6. Click the X to delete — confirm dialog, job disappears

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useJobs.ts frontend/src/components/ frontend/src/app/dashboard/
git commit -m "feat: dashboard page with job list, upload modal, and delete"
```

---

### Task 8: Workspace — Media Player

**Files:**
- Create: `frontend/src/components/workspace/MediaPlayer.tsx`
- Create: `frontend/src/components/workspace/PlaybackControls.tsx`

**Interfaces:**
- Consumes: `api.getMediaUrl(jobId)`, `formatTime()`, `Job` type
- Produces: `MediaPlayer` component with props `{ jobId: string, mediaType: "audio" | "video", mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement>, onTimeUpdate: (time: number) => void }`. `PlaybackControls` component with props `{ mediaRef, duration }`.

- [ ] **Step 1: Create PlaybackControls component**

```tsx
// frontend/src/components/workspace/PlaybackControls.tsx
"use client";

import { useState } from "react";
import { formatTime } from "@/lib/formatTime";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlaybackControlsProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  currentTime: number;
  duration: number;
}

export function PlaybackControls({ mediaRef, currentTime, duration }: PlaybackControlsProps) {
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const skip = (seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.currentTime + seconds, el.duration || 0));
  };

  const changeSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (mediaRef.current) mediaRef.current.playbackRate = newSpeed;
  };

  const changeVolume = (newVolume: number) => {
    setVolume(newVolume);
    if (mediaRef.current) mediaRef.current.volume = newVolume;
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (mediaRef.current) mediaRef.current.currentTime = time;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-12 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={seek}
          className="flex-1 h-1.5 accent-blue-600"
        />
        <span className="text-xs text-gray-500 w-12">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => skip(-5)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Rewind 5s">
            -5s
          </button>
          <button onClick={togglePlay} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            {mediaRef.current?.paused !== false ? "Play" : "Pause"}
          </button>
          <button onClick={() => skip(5)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Forward 5s">
            +5s
          </button>
        </div>

        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-1.5 py-0.5 text-xs rounded ${
                speed === s ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-20 h-1 accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MediaPlayer component**

```tsx
// frontend/src/components/workspace/MediaPlayer.tsx
"use client";

import { useState, useEffect } from "react";
import { PlaybackControls } from "./PlaybackControls";

interface MediaPlayerProps {
  jobId: string;
  mediaType: "audio" | "video";
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  onTimeUpdate: (time: number) => void;
}

export function MediaPlayer({ jobId, mediaType, mediaRef, onTimeUpdate }: MediaPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [, setForceRender] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const mediaUrl = `${apiUrl}/api/jobs/${jobId}/media`;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const handleTimeUpdate = () => {
      const time = el.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
    };

    const handleLoaded = () => {
      setDuration(el.duration);
    };

    const handlePlayPause = () => {
      setForceRender((n) => n + 1);
    };

    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("loadedmetadata", handleLoaded);
    el.addEventListener("play", handlePlayPause);
    el.addEventListener("pause", handlePlayPause);

    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("loadedmetadata", handleLoaded);
      el.removeEventListener("play", handlePlayPause);
      el.removeEventListener("pause", handlePlayPause);
    };
  }, [mediaRef, onTimeUpdate]);

  return (
    <div className="space-y-3">
      {mediaType === "video" ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaUrl}
          className="w-full rounded bg-black"
          crossOrigin="use-credentials"
        >
          <source src={mediaUrl} />
        </video>
      ) : (
        <div className="bg-gray-900 rounded p-8 flex items-center justify-center">
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaUrl}
          />
          <span className="text-4xl">&#x1F3A7;</span>
        </div>
      )}
      <PlaybackControls
        mediaRef={mediaRef}
        currentTime={currentTime}
        duration={duration}
      />
    </div>
  );
}
```

**Important: Media auth.** Browser `<audio>`/`<video>` elements cannot send Authorization headers. The solution: add a `?token=` query parameter to the media URL, and update the backend `/media` endpoint to accept an optional `token` query param in addition to the Authorization header. In `backend/app/routers/jobs.py`, update `stream_media`:

```python
from fastapi import Query as QueryParam

@router.get("/{job_id}/media")
def stream_media(
    job_id: str,
    token: str = QueryParam(None),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    # If no bearer token in header, try query param
    if current_user is None and token:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            current_user = db.query(User).filter(User.id == payload["sub"]).first()
    if current_user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    ...
```

Add a `get_current_user_optional` dependency in `dependencies.py` that returns `None` instead of raising 401:

```python
def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        return None
    return db.query(User).filter(User.id == payload.get("sub")).first()
```

In `MediaPlayer.tsx`, the `mediaUrl` becomes: `` `${apiUrl}/api/jobs/${jobId}/media?token=${token}` ``

- [ ] **Step 3: Run dev server and test with an uploaded file**

1. Upload an audio or video file via the dashboard
2. Navigate to workspace (next task creates the page, but you can test the component in isolation by temporarily rendering it)
3. Verify the media plays, seek bar works, speed controls change playback rate

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/workspace/MediaPlayer.tsx frontend/src/components/workspace/PlaybackControls.tsx
git commit -m "feat: media player component with playback controls, speed, and volume"
```

---

### Task 9: Workspace — Transcript Editor + Speaker Panel

**Files:**
- Create: `frontend/src/hooks/useSegments.ts`
- Create: `frontend/src/hooks/useAutoSave.ts`
- Create: `frontend/src/components/workspace/SegmentBlock.tsx`
- Create: `frontend/src/components/workspace/TranscriptEditor.tsx`
- Create: `frontend/src/components/workspace/SpeakerPanel.tsx`

**Interfaces:**
- Consumes: `api` client, `Segment`, `Speaker` types, `formatTimestamp()`
- Produces: `useSegments(jobId)` hook returning `{ segments, setSegments, speakers, setSpeakers, loadSegments, loadSpeakers, addSegment, updateSegment, removeSegment, addSpeaker, updateSpeaker, removeSpeaker, dirty }`. `useAutoSave(jobId, segments, dirty)` hook that auto-saves segments. `TranscriptEditor` component. `SpeakerPanel` component. `SegmentBlock` component.

- [ ] **Step 1: Create useSegments hook**

```typescript
// frontend/src/hooks/useSegments.ts
"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Segment, Speaker } from "@/types";

export function useSegments(jobId: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadSegments = useCallback(async () => {
    const data = (await api.get(`/api/jobs/${jobId}/segments`)) as Segment[];
    setSegments(data);
    setDirty(false);
  }, [jobId]);

  const loadSpeakers = useCallback(async () => {
    const data = (await api.get(`/api/jobs/${jobId}/speakers`)) as Speaker[];
    setSpeakers(data);
  }, [jobId]);

  const addSegment = (startTime: number) => {
    const maxPos = segments.length > 0 ? Math.max(...segments.map((s) => s.position)) + 1 : 0;
    const newSeg: Segment = {
      id: crypto.randomUUID(),
      job_id: jobId,
      speaker_id: null,
      start_time: startTime,
      end_time: startTime + 5,
      text: "",
      position: maxPos,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSegments((prev) => [...prev, newSeg].sort((a, b) => a.position - b.position));
    setDirty(true);
  };

  const updateSegment = (id: string, updates: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg))
    );
    setDirty(true);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
    setDirty(true);
  };

  const addSpeaker = async (name: string, color: string) => {
    const label = name.substring(0, 2).toUpperCase();
    const data = (await api.post(`/api/jobs/${jobId}/speakers`, {
      name,
      label,
      color,
    })) as Speaker;
    setSpeakers((prev) => [...prev, data]);
    return data;
  };

  const updateSpeaker = async (id: string, updates: Partial<Speaker>) => {
    const data = (await api.patch(`/api/speakers/${id}`, updates)) as Speaker;
    setSpeakers((prev) => prev.map((s) => (s.id === id ? data : s)));
  };

  const removeSpeaker = async (id: string) => {
    await api.delete(`/api/speakers/${id}`);
    setSpeakers((prev) => prev.filter((s) => s.id !== id));
    setSegments((prev) =>
      prev.map((seg) => (seg.speaker_id === id ? { ...seg, speaker_id: null } : seg))
    );
    setDirty(true);
  };

  return {
    segments,
    setSegments,
    speakers,
    setSpeakers,
    loadSegments,
    loadSpeakers,
    addSegment,
    updateSegment,
    removeSegment,
    addSpeaker,
    updateSpeaker,
    removeSpeaker,
    dirty,
    setDirty,
  };
}
```

- [ ] **Step 2: Create useAutoSave hook**

```typescript
// frontend/src/hooks/useAutoSave.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { Segment } from "@/types";

export function useAutoSave(
  jobId: string,
  segments: Segment[],
  dirty: boolean,
  setDirty: (d: boolean) => void
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const payload = segments.map((seg) => ({
        id: seg.id,
        speaker_id: seg.speaker_id,
        start_time: seg.start_time,
        end_time: seg.end_time,
        text: seg.text,
        position: seg.position,
      }));
      const saved = (await api.put(`/api/jobs/${jobId}/segments`, {
        segments: payload,
      })) as Segment[];
      setDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error("Autosave failed:", err);
    } finally {
      setSaving(false);
    }
  }, [jobId, segments, dirty, saving, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, 5000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [dirty, segments, save]);

  const forceSave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save();
  };

  return { lastSaved, saving, forceSave };
}
```

- [ ] **Step 3: Create SegmentBlock component**

```tsx
// frontend/src/components/workspace/SegmentBlock.tsx
"use client";

import { useRef, useEffect } from "react";
import { Segment, Speaker } from "@/types";
import { formatTimestamp } from "@/lib/formatTime";

interface SegmentBlockProps {
  segment: Segment;
  speakers: Speaker[];
  isActive: boolean;
  onUpdate: (id: string, updates: Partial<Segment>) => void;
  onDelete: (id: string) => void;
  onTimestampClick: (time: number) => void;
}

export function SegmentBlock({
  segment,
  speakers,
  isActive,
  onUpdate,
  onDelete,
  onTimestampClick,
}: SegmentBlockProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const speaker = speakers.find((s) => s.id === segment.speaker_id);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = textRef.current.scrollHeight + "px";
    }
  }, [segment.text]);

  return (
    <div
      className={`p-3 rounded border transition-colors ${
        isActive ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => onTimestampClick(segment.start_time)}
          className="text-xs text-blue-600 hover:underline font-mono"
        >
          [{formatTimestamp(segment.start_time)}]
        </button>
        <select
          value={segment.speaker_id || ""}
          onChange={(e) => onUpdate(segment.id, { speaker_id: e.target.value || null })}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
          style={speaker ? { color: speaker.color, fontWeight: 600 } : {}}
        >
          <option value="">No speaker</option>
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(segment.id)}
          className="ml-auto text-xs text-gray-400 hover:text-red-500"
          title="Delete segment"
        >
          &times;
        </button>
      </div>
      <textarea
        ref={textRef}
        value={segment.text}
        onChange={(e) => onUpdate(segment.id, { text: e.target.value })}
        placeholder="Type transcription here..."
        rows={1}
        className="w-full text-sm text-gray-800 bg-transparent resize-none outline-none overflow-hidden"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create TranscriptEditor component**

```tsx
// frontend/src/components/workspace/TranscriptEditor.tsx
"use client";

import { useRef, useEffect } from "react";
import { Segment, Speaker } from "@/types";
import { SegmentBlock } from "./SegmentBlock";

interface TranscriptEditorProps {
  segments: Segment[];
  speakers: Speaker[];
  currentTime: number;
  onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (time: number) => void;
  onTimestampClick: (time: number) => void;
  wordCount: number;
  lastSaved: Date | null;
  saving: boolean;
}

export function TranscriptEditor({
  segments,
  speakers,
  currentTime,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment,
  onTimestampClick,
  wordCount,
  lastSaved,
  saving,
}: TranscriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.start_time && currentTime < seg.end_time
  );

  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeIndex]);

  const formatLastSaved = () => {
    if (saving) return "Saving...";
    if (!lastSaved) return "";
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 5) return "Saved just now";
    if (diff < 60) return `Saved ${diff}s ago`;
    return `Saved ${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1 p-2">
        {segments.map((seg, i) => (
          <SegmentBlock
            key={seg.id}
            segment={seg}
            speakers={speakers}
            isActive={i === activeIndex}
            onUpdate={onUpdateSegment}
            onDelete={onDeleteSegment}
            onTimestampClick={onTimestampClick}
          />
        ))}
      </div>
      <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => onAddSegment(currentTime)}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add Segment
        </button>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{wordCount} words</span>
          <span>{formatLastSaved()}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create SpeakerPanel component**

```tsx
// frontend/src/components/workspace/SpeakerPanel.tsx
"use client";

import { useState } from "react";
import { Speaker } from "@/types";

const DEFAULT_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

interface SpeakerPanelProps {
  speakers: Speaker[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, updates: Partial<Speaker>) => void;
  onDelete: (id: string) => void;
}

export function SpeakerPanel({ speakers, onAdd, onUpdate, onDelete }: SpeakerPanelProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const color = DEFAULT_COLORS[speakers.length % DEFAULT_COLORS.length];
    onAdd(newName.trim(), color);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Speakers</h3>
      {speakers.map((speaker) => (
        <div key={speaker.id} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: speaker.color }}
          />
          <input
            value={speaker.name}
            onChange={(e) => onUpdate(speaker.id, { name: e.target.value })}
            className="text-sm text-gray-700 bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 flex-1"
          />
          <button
            onClick={() => onDelete(speaker.id)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            &times;
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Speaker name"
            autoFocus
            className="text-sm border border-gray-300 rounded px-2 py-1 flex-1 outline-none focus:border-blue-500"
          />
          <button onClick={handleAdd} className="text-xs text-blue-600">
            Add
          </button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-400">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add Speaker
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useSegments.ts frontend/src/hooks/useAutoSave.ts frontend/src/components/workspace/SegmentBlock.tsx frontend/src/components/workspace/TranscriptEditor.tsx frontend/src/components/workspace/SpeakerPanel.tsx
git commit -m "feat: transcript editor with segments, speakers, and autosave"
```

---

### Task 10: Workspace Page Assembly + Keyboard Shortcuts + Export

**Files:**
- Create: `frontend/src/components/workspace/ExportMenu.tsx`
- Create: `frontend/src/app/workspace/[jobId]/page.tsx`

**Interfaces:**
- Consumes: All workspace components from Tasks 8 and 9, `useAuth()`, `useSegments()`, `useAutoSave()`, `api` client, `Job` type
- Produces: Workspace page at `/workspace/[jobId]` with full media player + transcript editor + speakers + keyboard shortcuts + export

- [ ] **Step 1: Create ExportMenu component**

```tsx
// frontend/src/components/workspace/ExportMenu.tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ExportRecord } from "@/types";

interface ExportMenuProps {
  jobId: string;
}

const FORMATS = [
  { value: "txt", label: "Plain Text (.txt)" },
  { value: "srt", label: "Subtitles (.srt)" },
  { value: "vtt", label: "Web Subtitles (.vtt)" },
];

export function ExportMenu({ jobId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: string) => {
    setExporting(true);
    try {
      const exportData = (await api.post(`/api/jobs/${jobId}/export`, { format })) as ExportRecord;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${apiUrl}/api/exports/${exportData.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcript.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting ? "Exporting..." : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-10">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleExport(f.value)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Workspace page with keyboard shortcuts**

```tsx
// frontend/src/app/workspace/[jobId]/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MediaPlayer } from "@/components/workspace/MediaPlayer";
import { TranscriptEditor } from "@/components/workspace/TranscriptEditor";
import { SpeakerPanel } from "@/components/workspace/SpeakerPanel";
import { ExportMenu } from "@/components/workspace/ExportMenu";
import { useSegments } from "@/hooks/useSegments";
import { useAutoSave } from "@/hooks/useAutoSave";
import { api } from "@/lib/api";
import { Job } from "@/types";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const mediaRef = useRef<HTMLMediaElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [title, setTitle] = useState("");

  const {
    segments,
    speakers,
    loadSegments,
    loadSpeakers,
    addSegment,
    updateSegment,
    removeSegment,
    addSpeaker,
    updateSpeaker,
    removeSpeaker,
    dirty,
    setDirty,
  } = useSegments(jobId);

  const { lastSaved, saving, forceSave } = useAutoSave(jobId, segments, dirty, setDirty);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const data = (await api.get(`/api/jobs/${jobId}`)) as Job;
        setJob(data);
        setTitle(data.title);
      } catch {
        router.push("/dashboard");
      }
    };
    loadJob();
    loadSegments();
    loadSpeakers();
  }, [jobId, loadSegments, loadSpeakers, router]);

  const handleTitleBlur = async () => {
    if (job && title !== job.title) {
      await api.patch(`/api/jobs/${jobId}`, { title });
    }
  };

  const handleTimestampClick = useCallback((time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
    }
  }, []);

  const wordCount = segments.reduce((sum, seg) => {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    return sum + words.length;
  }, 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case "Space":
            e.preventDefault();
            if (mediaRef.current) {
              if (mediaRef.current.paused) mediaRef.current.play();
              else mediaRef.current.pause();
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            if (mediaRef.current) {
              mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 5);
            }
            break;
          case "ArrowRight":
            e.preventDefault();
            if (mediaRef.current) {
              mediaRef.current.currentTime = Math.min(
                mediaRef.current.duration || 0,
                mediaRef.current.currentTime + 5
              );
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            if (mediaRef.current) {
              const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const idx = speeds.indexOf(mediaRef.current.playbackRate);
              if (idx < speeds.length - 1) {
                mediaRef.current.playbackRate = speeds[idx + 1];
              }
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            if (mediaRef.current) {
              const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const idx = speeds.indexOf(mediaRef.current.playbackRate);
              if (idx > 0) {
                mediaRef.current.playbackRate = speeds[idx - 1];
              }
            }
            break;
          case "Enter":
            e.preventDefault();
            addSegment(currentTime);
            break;
          case "KeyS":
            e.preventDefault();
            forceSave();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, addSegment, forceSave]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-lg font-semibold text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500"
            />
          </div>
          <ExportMenu jobId={jobId} />
        </div>

        {/* Main workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Media + Speakers */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col">
            <div className="p-4 flex-shrink-0">
              <MediaPlayer
                jobId={jobId}
                mediaType={job.media_type}
                mediaRef={mediaRef}
                onTimeUpdate={setCurrentTime}
              />
            </div>
            <div className="p-4 border-t border-gray-200">
              <SpeakerPanel
                speakers={speakers}
                onAdd={addSpeaker}
                onUpdate={updateSpeaker}
                onDelete={removeSpeaker}
              />
            </div>
          </div>

          {/* Right panel: Transcript */}
          <div className="w-1/2 flex flex-col">
            <TranscriptEditor
              segments={segments}
              speakers={speakers}
              currentTime={currentTime}
              onUpdateSegment={updateSegment}
              onDeleteSegment={removeSegment}
              onAddSegment={addSegment}
              onTimestampClick={handleTimestampClick}
              wordCount={wordCount}
              lastSaved={lastSaved}
              saving={saving}
            />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 3: Run full app end-to-end test**

Run backend: `cd backend && uvicorn app.main:app --reload`
Run frontend: `cd frontend && npm run dev`

Test the complete flow:
1. Register at `/register` -> redirects to `/dashboard`
2. Upload an audio file via "+ Upload" button
3. Click the job card -> opens workspace at `/workspace/{id}`
4. Media player loads and plays the audio
5. Add speakers in the speaker panel
6. Click "+ Add Segment" -> new segment appears
7. Type transcription text -> autosave indicator shows "Saving..." then "Saved Xs ago"
8. Click timestamp -> media jumps to that time
9. Test keyboard shortcuts: Ctrl+Space (play/pause), Ctrl+Left/Right (skip), Ctrl+S (force save)
10. Click "Export" -> select TXT -> file downloads
11. Click "Back" -> returns to dashboard
12. Refresh page -> workspace reloads with saved segments

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/workspace/ExportMenu.tsx frontend/src/app/workspace/
git commit -m "feat: workspace page with media player, transcript editor, keyboard shortcuts, and export"
```
