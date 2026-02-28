import os
import base64
import re
import uuid
from typing import Optional

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Path,
    Form,
)
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.services import s3, dynamo
from app.models.file import FileDetailModel, FileListResponse


router = APIRouter()

# ── Constants ──────────────────────────────────────────────
ALLOWED_TYPES = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/gif": "image",
    "image/webp": "image",
    "image/heic": "image",
    "video/mp4": "video",
    "video/quicktime": "video",
    "video/x-msvideo": "video",
    "video/x-matroska": "video",
    "video/webm": "video",
    "application/pdf": "document",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "text/plain": "document",
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB

FILE_ID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)

# ── Pydantic Models ────────────────────────────────────────
class RenameBody(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255, strip_whitespace=True)

# ── Helpers ────────────────────────────────────────────────
def validated_file_id(
    file_id: str = Path(..., description="UUID of the file"),
) -> str:
    if not FILE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    return file_id


def sanitize_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r"[^\w\s.\-]", "_", name)
    return name[:200].strip() or "unnamed"

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    username = user.get("username")

    if not username:
        raise HTTPException(status_code=400, detail="Username missing for user")

    # Generate file_id ONCE
    file_id = str(uuid.uuid4())

    # ── Read file ───────────────────────────────────────────
    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    # ── MIME validation ─────────────────────────────────────
    real_mime = file.content_type
    if not real_mime or real_mime not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {real_mime}",
        )

    file_type = ALLOWED_TYPES[real_mime]

    # ── Storage prep ────────────────────────────────────────
    safe_filename = sanitize_filename(file.filename or "unnamed")

    s3_key = s3.make_s3_key(
        username=username,
        file_id=file_id,
        file_name=safe_filename,
    )

    # ── Upload to S3 (GET HASH) ─────────────────────────────
    try:
        file_hash = s3.upload_file(
            file_bytes=file_bytes,
            s3_key=s3_key,
            content_type=real_mime,
            user_id=user_id,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to upload file to storage",
        )

    s3_url = s3.get_public_url(s3_key)

    # ── Save metadata ───────────────────────────────────────
    try:
        item = dynamo.create_file(
            user_id=user_id,
            file_id=file_id,
            username=username,
            file_name=safe_filename,
            s3_key=s3_key,
            file_type=file_type,
            file_size=len(file_bytes),
            width=width,
            height=height,
            s3_url=s3_url,
            file_hash=file_hash,
        )
    except Exception:
        try:
            s3.delete_file(s3_key)
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail="Failed to save file metadata",
        )

    return {
        "message": "File uploaded successfully",
        "file": item,
    }

# ── GET /files ─────────────────────────────────────────────
@router.get("", response_model=FileListResponse)
def list_files(user: dict = Depends(get_current_user)):
    files = dynamo.get_user_files(user["sub"])
    return {"files": files, "count": len(files)}

# ── GET /files/photos ──────────────────────────────────────
@router.get("/photos", response_model=FileListResponse)
def list_photos(user: dict = Depends(get_current_user)):
    files = dynamo.get_files_by_type(user["sub"], "image")
    return {"files": files, "count": len(files)}

# ── GET /files/videos ──────────────────────────────────────
@router.get("/videos", response_model=FileListResponse)
def list_videos(user: dict = Depends(get_current_user)):
    files = dynamo.get_files_by_type(user["sub"], "video")
    return {"files": files, "count": len(files)}

# ── GET /files/documents ───────────────────────────────────
@router.get("/documents", response_model=FileListResponse)
def list_documents(user: dict = Depends(get_current_user)):
    files = dynamo.get_files_by_type(user["sub"], "document")
    return {"files": files, "count": len(files)}

# ── GET /files/recycle-bin ─────────────────────────────────
@router.get("/recycle-bin", response_model=FileListResponse)
def list_deleted(user: dict = Depends(get_current_user)):
    files = dynamo.get_deleted_files(user["sub"])
    return {"files": files, "count": len(files)}

# ── GET /files/stats ───────────────────────────────────────
@router.get("/stats")
def storage_stats(user: dict = Depends(get_current_user)):
    return dynamo.get_storage_stats(user["sub"])

# ── GET /files/{file_id} ───────────────────────────────────
@router.get("/{file_id}", response_model=FileDetailModel)
def get_file(
    file_id: str = Depends(validated_file_id),
    user: dict = Depends(get_current_user),
):
    file = dynamo.get_file(user["sub"], file_id)

    # Decrypt filename if encrypted
    try:
        if "file_name_enc" in file:
            file["file_name"] = base64.urlsafe_b64decode(
                file["file_name_enc"].encode()
            ).decode()
    except Exception:
        pass

    presigned_url = s3.get_presigned_url(file["s3_key"])
    return {**file, "presigned_url": presigned_url}

# ── PATCH /files/{file_id} ─────────────────────────────────
@router.patch("/{file_id}")
def rename_file(
    body: RenameBody,
    file_id: str = Depends(validated_file_id),
    user: dict = Depends(get_current_user),
):
    dynamo.get_file(user["sub"], file_id)
    return dynamo.update_file_name(user["sub"], file_id, body.file_name)

# ── DELETE /files/{file_id} (soft delete) ──────────────────
@router.delete("/{file_id}")
def delete_file(
    file_id: str = Depends(validated_file_id),
    user: dict = Depends(get_current_user),
):
    dynamo.get_file(user["sub"], file_id)
    return dynamo.soft_delete_file(user["sub"], file_id)

# ── POST /files/{file_id}/restore ──────────────────────────
@router.post("/{file_id}/restore")
def restore_file(
    file_id: str = Depends(validated_file_id),
    user: dict = Depends(get_current_user),
):
    dynamo.get_file(user["sub"], file_id)
    return dynamo.restore_file(user["sub"], file_id)

# ── DELETE /files/{file_id}/permanent ──────────────────────
@router.delete("/{file_id}/permanent")
def permanent_delete(
    file_id: str = Depends(validated_file_id),
    user: dict = Depends(get_current_user),
):
    file = dynamo.get_file(user["sub"], file_id)
    s3.delete_file(file["s3_key"])
    dynamo.delete_file(user["sub"], file_id)
    return {"message": "File permanently deleted"}