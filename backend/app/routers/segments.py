import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.job import Job
from app.models.segment import Segment
from app.models.user import User
from app.schemas.segment import SegmentCreate, SegmentUpdate, SegmentResponse, BulkSaveRequest

router = APIRouter(tags=["segments"])


def get_job_for_user(db: Session, job_id: str, user: User) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/api/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def list_segments(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    return db.query(Segment).filter(Segment.job_id == job_id).order_by(Segment.position).all()


@router.post("/api/jobs/{job_id}/segments", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
def create_segment(
    job_id: str,
    data: SegmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    segment = Segment(job_id=uuid.UUID(job_id), **data.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.put("/api/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def bulk_save_segments(
    job_id: str,
    data: BulkSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_job_for_user(db, job_id, current_user)
    job_uuid = uuid.UUID(job_id)

    existing_ids = {s.id for s in db.query(Segment.id).filter(Segment.job_id == job_uuid).all()}
    incoming_ids = {s.id for s in data.segments if s.id is not None}

    ids_to_delete = existing_ids - incoming_ids
    if ids_to_delete:
        db.query(Segment).filter(Segment.id.in_(ids_to_delete)).delete(synchronize_session=False)

    for seg_data in data.segments:
        if seg_data.id and seg_data.id in existing_ids:
            db.query(Segment).filter(Segment.id == seg_data.id).update({
                "speaker_id": seg_data.speaker_id,
                "start_time": seg_data.start_time,
                "end_time": seg_data.end_time,
                "text": seg_data.text,
                "position": seg_data.position,
            })
        else:
            segment = Segment(job_id=job_uuid, **seg_data.model_dump(exclude={"id"} if not seg_data.id else set()))
            db.add(segment)

    db.commit()
    return db.query(Segment).filter(Segment.job_id == job_uuid).order_by(Segment.position).all()


@router.patch("/api/segments/{segment_id}", response_model=SegmentResponse)
def update_segment(
    segment_id: str,
    data: SegmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    get_job_for_user(db, str(segment.job_id), current_user)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(segment, key, value)
    db.commit()
    db.refresh(segment)
    return segment


@router.delete("/api/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_segment(
    segment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    get_job_for_user(db, str(segment.job_id), current_user)
    db.delete(segment)
    db.commit()
