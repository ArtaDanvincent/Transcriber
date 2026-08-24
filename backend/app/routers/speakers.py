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
