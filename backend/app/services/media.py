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
