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
