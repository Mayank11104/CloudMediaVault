import os
import urllib.parse
from typing import Optional
from botocore.exceptions import ClientError
from fastapi import HTTPException
from app.database import s3_client as _s3
from app.config import S3_BUCKET_NAME as BUCKET, AWS_REGION



# ── Upload File (ENCRYPTED) ─────────────────────────────────
def upload_file(
    file_bytes: bytes,
    s3_key: str,
    content_type: str,
    user_id: str,
) -> str:
    """
    Upload and encrypt a file to S3.

    Args:
        file_bytes: Raw file content
        s3_key: S3 object key
        content_type: MIME type
        user_id: User's Cognito sub for encryption

    Returns:
        str: SHA256 hash of the original file

    Raises:
        HTTPException: If S3 upload fails
    """
    from .encryption import FileEncryption

    # Encrypt file + compute hash
    encrypted_bytes, file_hash = FileEncryption.encrypt_file(
        file_bytes, user_id
    )

    try:
        _s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=encrypted_bytes,
            ContentType=content_type,
            ServerSideEncryption="AES256",
            Metadata={
                "sha256-hash": file_hash,
                "encryption": "aesgcm-v1",
            },
        )
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"S3 upload failed: {e.response['Error']['Message']}",
        )

    return file_hash


# ── Download File (RAW ENCRYPTED BYTES) ────────────────────
def download_file(s3_key: str) -> bytes:
    """
    Download raw encrypted bytes from S3.
    Decryption is handled by the caller (FileEncryption.decrypt_file).

    Args:
        s3_key: S3 object key

    Returns:
        bytes: Raw encrypted file content

    Raises:
        HTTPException: If file not found or download fails
    """
    try:
        response = _s3.get_object(Bucket=BUCKET, Key=s3_key)
        return response["Body"].read()
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(
            status_code=500,
            detail="Failed to download file from storage",
        )


# ── Generate Presigned URL ─────────────────────────────────
def get_presigned_url(
    s3_key: str,
    expires_in: int = 900,
    filename: Optional[str] = None,
) -> str:
    """
    Generate a presigned URL for downloading a file.

    Args:
        s3_key: S3 object key
        expires_in: URL expiration time in seconds (default 15 minutes)
        filename: Optional filename for Content-Disposition header

    Returns:
        str: Presigned URL

    Raises:
        HTTPException: If URL generation fails
    """
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
        raise HTTPException(
            status_code=500,
            detail="Failed to generate download URL",
        )


# ── Public URL (CloudFront preferred) ──────────────────────
def get_public_url(s3_key: str) -> str:
    """
    Get public URL for a file (CloudFront if configured, otherwise S3).

    Args:
        s3_key: S3 object key

    Returns:
        str: Public URL
    """
    from app.config import CLOUDFRONT_DOMAIN

    if CLOUDFRONT_DOMAIN:
        return f"https://{CLOUDFRONT_DOMAIN}/{s3_key}"

    return f"https://{BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"


# ── Delete File ────────────────────────────────────────────
def delete_file(s3_key: str) -> None:
    """
    Delete a file from S3.

    Args:
        s3_key: S3 object key

    Raises:
        HTTPException: If deletion fails
    """
    try:
        _s3.delete_object(Bucket=BUCKET, Key=s3_key)
    except ClientError:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete file from storage",
        )


# ── Make S3 Key (USERNAME-BASED) ───────────────────────────
def make_s3_key(username: str, file_id: str, file_name: str) -> str:
    """
    Generate S3 key for a file.

    Args:
        username: User's username
        file_id: File's unique identifier
        file_name: Original filename

    Returns:
        str: S3 object key in format: users/{username}/{file_id}/{filename}
    """
    safe_name = os.path.basename(file_name).replace(" ", "_")
    return f"users/{username}/{file_id}/{safe_name}"


# ── Get File Size ──────────────────────────────────────────
def get_file_size(s3_key: str) -> int:
    """
    Get the size of a file in S3.

    Args:
        s3_key: S3 object key

    Returns:
        int: File size in bytes

    Raises:
        HTTPException: If file not found or retrieval fails
    """
    try:
        response = _s3.head_object(Bucket=BUCKET, Key=s3_key)
        return response["ContentLength"]
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve file info",
        )
