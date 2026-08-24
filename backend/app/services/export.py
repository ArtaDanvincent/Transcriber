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
