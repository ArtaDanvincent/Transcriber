import uuid

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth import decode_token

security_optional = HTTPBearer(auto_error=False)

ANONYMOUS_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def ensure_anonymous_user(db: Session) -> User:
    user = db.query(User).filter(User.id == ANONYMOUS_USER_ID).first()
    if not user:
        user = User(
            id=ANONYMOUS_USER_ID,
            email="anonymous@transcriber.local",
            password_hash="nologin",
            name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
) -> User:
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    return user

    return ensure_anonymous_user(db)


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    db: Session = Depends(get_db),
) -> User | None:
    return get_current_user(credentials, db)
