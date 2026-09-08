import logging
from pathlib import Path

import whisper
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.job import Job
from app.models.segment import Segment

logger = logging.getLogger(__name__)

_model = None


def get_model():
    global _model
    if _model is None:
        logger.info(f"Loading Whisper model: {settings.WHISPER_MODEL}")
        _model = whisper.load_model(settings.WHISPER_MODEL)
    return _model


def transcribe_job(job_id: str):
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        model = get_model()
        media_path = str(Path(job.media_file_path).resolve())

        result = model.transcribe(media_path)

        db.query(Segment).filter(Segment.job_id == job.id).delete()

        for i, seg in enumerate(result["segments"]):
            segment = Segment(
                job_id=job.id,
                start_time=round(seg["start"], 3),
                end_time=round(seg["end"], 3),
                text=seg["text"].strip(),
                position=i,
            )
            db.add(segment)

        if result.get("segments"):
            last_end = max(seg["end"] for seg in result["segments"])
            job.media_duration = int(last_end)

        job.status = "draft"
        job.error_message = None
        db.commit()
        logger.info(f"Transcription completed for job {job_id}")

    except Exception as e:
        logger.exception(f"Transcription failed for job {job_id}")
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()
