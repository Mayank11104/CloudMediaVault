import os
import re
from fastapi import APIRouter, Depends, HTTPException, Path
from app.middleware.auth import get_current_user
from app.services import dynamo, s3

router = APIRouter()

# ── File ID validator ──────────────────────────────────────
FILE_ID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)

def validated_file_id(
    file_id: str = Path(..., description="UUID of the file")
) -> str:
    if not FILE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID format")
    return file_id

# ── GET /recycle-bin ───────────────────────────────────────
@router.get("")
def list_recycle_bin(user: dict = Depends(get_current_user)):
    """Return all soft-deleted files for the current user."""
    try:
        files = dynamo.get_deleted_files(user["sub"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch recycle bin")

    return {"files": files, "count": len(files)}

# ── POST /recycle-bin/{file_id}/restore ───────────────────
@router.post("/{file_id}/restore")
def restore_file(
    file_id: str  = Depends(validated_file_id),
    user:    dict = Depends(get_current_user),
):
    """Restore a soft-deleted file back to the library."""
    # ① Verify file exists and belongs to user
    file = dynamo.get_file(user["sub"], file_id)

    # ② Must actually be deleted to restore
    if not file.get("is_deleted"):
        raise HTTPException(
            status_code=400,
            detail="File is not in recycle bin"
        )

    try:
        dynamo.restore_file(user["sub"], file_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to restore file")

    return {"message": "File restored to library"}

# ── DELETE /recycle-bin/{file_id} — permanent delete ──────
@router.delete("/{file_id}")
def permanent_delete(
    file_id: str  = Depends(validated_file_id),
    user:    dict = Depends(get_current_user),
):
    """Permanently delete a file from S3 and DynamoDB."""
    # ① Verify file exists and belongs to user
    file = dynamo.get_file(user["sub"], file_id)

    # ② Must be in recycle bin before permanent delete
    if not file.get("is_deleted"):
        raise HTTPException(
            status_code=400,
            detail="File must be moved to recycle bin before permanent deletion"
        )

    # ③ Delete from S3
    try:
        s3.delete_file(file["s3_key"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete file from storage")

    # ④ Delete from DynamoDB
    try:
        dynamo.delete_file(user["sub"], file_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete file record")

    return {"message": "File permanently deleted"}

# ── DELETE /recycle-bin/empty — empty entire recycle bin ──
@router.delete("/empty")
def empty_recycle_bin(user: dict = Depends(get_current_user)):
    """Permanently delete ALL files in the recycle bin."""
    # ① Fetch all deleted files
    try:
        files = dynamo.get_deleted_files(user["sub"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch recycle bin")

    if not files:
        return {"message": "Recycle bin is already empty", "deleted_count": 0}

    # ② Delete each file from S3 + DynamoDB
    failed = []
    for file in files:
        try:
            s3.delete_file(file["s3_key"])
            dynamo.delete_file(user["sub"], file["file_id"])
        except Exception:
            failed.append(file["file_id"])

    if failed:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete {len(failed)} file(s). "
                   f"Partially emptied recycle bin."
        )

    return {
        "message": "Recycle bin emptied",
        "deleted_count": len(files),
    }
