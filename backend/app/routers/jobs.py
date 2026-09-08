import os

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobResponse, JobListResponse, JobUpdate
from app.services.media import validate_media_file, get_media_type, save_upload, delete_job_files
from app.services.auth import decode_token
from app.services.transcription import transcribe_job

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
    background_tasks: BackgroundTasks,
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
        status="transcribing",
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

    background_tasks.add_task(transcribe_job, str(job.id))
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
        if data.status not in ("draft", "completed", "transcribing", "failed"):
            raise HTTPException(status_code=400, detail="Invalid status")
        job.status = data.status
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/retry", response_model=JobResponse)
def retry_transcription(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ("failed", "draft"):
        raise HTTPException(status_code=400, detail="Job is not in a retryable state")
    job.status = "transcribing"
    job.error_message = None
    db.commit()
    db.refresh(job)
    background_tasks.add_task(transcribe_job, str(job.id))
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
    token: str = Query(None),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    # Try bearer token first, then fall back to query param token
    authenticated_user = current_user

    if authenticated_user is None and token:
        # Fall back to query parameter token
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                authenticated_user = db.query(User).filter(User.id == user_id).first()

    if authenticated_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    job = db.query(Job).filter(Job.id == job_id, Job.user_id == authenticated_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not os.path.exists(job.media_file_path):
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(job.media_file_path, media_type=f"{job.media_type}/{'mp4' if job.media_type == 'video' else 'mpeg'}")
