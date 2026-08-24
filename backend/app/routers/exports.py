import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.export import Export
from app.models.job import Job
from app.models.user import User
from app.schemas.export import ExportRequest, ExportResponse
from app.services.export import GENERATORS, save_export_file

router = APIRouter(tags=["exports"])


@router.post("/api/jobs/{job_id}/export", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
def create_export(
    job_id: str,
    data: ExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if data.format not in GENERATORS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {data.format}. Use: txt, srt, vtt")

    generator = GENERATORS[data.format]
    content = generator(db, job.id)
    file_path = save_export_file(content, current_user.id, job.id, data.format)

    export = Export(job_id=job.id, format=data.format, file_path=file_path)
    db.add(export)
    db.commit()
    db.refresh(export)
    return export


@router.get("/api/exports/{export_id}/download")
def download_export(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    export = db.query(Export).filter(Export.id == export_id).first()
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    job = db.query(Job).filter(Job.id == export.job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Export not found")

    if not os.path.exists(export.file_path):
        raise HTTPException(status_code=404, detail="Export file not found")

    ext_to_media = {"txt": "text/plain", "srt": "text/plain", "vtt": "text/vtt"}
    media_type = ext_to_media.get(export.format, "application/octet-stream")
    filename = f"{job.title}.{export.format}"
    return FileResponse(export.file_path, media_type=media_type, filename=filename)
