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
