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
