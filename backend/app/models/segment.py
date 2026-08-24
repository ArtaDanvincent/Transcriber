import uuid
from datetime import datetime, timezone

from sqlalchemy import Text, Integer, Numeric, DateTime, ForeignKey, Index
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
        Index('ix_segments_job_position', 'job_id', 'position'),
    )

    job: Mapped["Job"] = relationship(back_populates="segments")
    speaker: Mapped["Speaker | None"] = relationship(back_populates="segments")
