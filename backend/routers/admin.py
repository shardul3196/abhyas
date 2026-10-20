from datetime import datetime, timezone
from pathlib import Path
import re
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlmodel import Session

try:
    from backend.database import DB_PATH, UPLOADS_DIR, get_session
    from backend.schemas import CheckpointResponse, ImageUploadResponse
except ImportError:
    from database import DB_PATH, UPLOADS_DIR, get_session
    from schemas import CheckpointResponse, ImageUploadResponse

router = APIRouter(prefix="/api/admin", tags=["Admin"])

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


@router.post("/checkpoint", response_model=CheckpointResponse)
def checkpoint_database(session: Session = Depends(get_session)):
    """
    Commits any pending session state and executes `PRAGMA wal_checkpoint(TRUNCATE);`
    so `cgl_prep.db` is completely flushed and safe to commit to Git.
    """
    session.commit()
    result_row = session.exec(text("PRAGMA wal_checkpoint(TRUNCATE);")).first()
    wal_result = list(result_row) if result_row is not None else None

    db_size_bytes = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    now_iso = datetime.now(timezone.utc).isoformat()

    return CheckpointResponse(
        status="ok",
        db_size_bytes=db_size_bytes,
        timestamp=now_iso,
        wal_checkpoint_result=wal_result,
    )


@router.post("/upload-image", response_model=ImageUploadResponse)
async def upload_question_image(file: UploadFile = File(...)):
    """
    Saves an uploaded question image into `/uploads` and returns its static path `/uploads/<filename>`.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image extension '{ext}'. Allowed: {sorted(ALLOWED_IMAGE_EXTENSIONS)}",
        )

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", Path(file.filename).stem).strip("_") or "image"
    unique_filename = f"{safe_stem}_{uuid.uuid4().hex[:8]}{ext}"
    target_path = UPLOADS_DIR / unique_filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    target_path.write_bytes(content)
    rel_path = f"/uploads/{unique_filename}"

    return ImageUploadResponse(
        filename=unique_filename,
        image_path=rel_path,
        url=rel_path,
        size_bytes=len(content),
    )
