import os
import urllib.parse
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.database import s3_client as _s3
from app.config import S3_BUCKET_NAME as BUCKET

# ── Upload File ────────────────────────────────────────────
def upload_file(
    file_bytes:   bytes,
    s3_key:       str,
    content_type: str,
) -> str:
    try:
        _s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
        return s3_key
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to upload file")

# ── Generate Presigned URL ─────────────────────────────────
def get_presigned_url(
    s3_key:     str,
    expires_in: int  = 900,          # ✅ 15 min default (was 1 hour)
    filename:   str  = None,
) -> str:
    try:
        params = {"Bucket": BUCKET, "Key": s3_key}
        if filename:
            encoded = urllib.parse.quote(filename)
            params["ResponseContentDisposition"] = (
                f'attachment; filename="{encoded}"'
            )
        return _s3.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires_in,
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

# ── Delete File ────────────────────────────────────────────
def delete_file(s3_key: str) -> None:
    try:
        _s3.delete_object(Bucket=BUCKET, Key=s3_key)
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to delete file from storage")

# ── Make S3 Key ────────────────────────────────────────────
def make_s3_key(user_id: str, file_id: str, file_name: str) -> str:
    # Sanitize filename — strip path separators, replace spaces
    safe_name = os.path.basename(file_name).replace(" ", "_")
    return f"users/{user_id}/{file_id}/{safe_name}"

# ── Get File Size ──────────────────────────────────────────
def get_file_size(s3_key: str) -> int:
    try:
        response = _s3.head_object(Bucket=BUCKET, Key=s3_key)
        return response["ContentLength"]
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to retrieve file info")
