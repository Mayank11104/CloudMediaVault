from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional
from boto3.dynamodb.conditions import Key, Attr
from fastapi import HTTPException
from botocore.exceptions import ClientError
import base64

from app.database import get_table


# ── Helpers ────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _deserialize(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DynamoDB Decimal → int/float for JSON serialization.
    
    Args:
        item: DynamoDB item with potential Decimal values
        
    Returns:
        dict: Item with Decimals converted to int/float
    """
    result = {}
    for k, v in item.items():
        if isinstance(v, Decimal):
            result[k] = int(v) if v == v.to_integral_value() else float(v)
        else:
            result[k] = v
    return result


def _paginated_query(table, **kwargs) -> List[Dict[str, Any]]:
    """
    Paginate through all DynamoDB results (>1MB safe).
    
    Args:
        table: DynamoDB table resource
        **kwargs: Query parameters
        
    Returns:
        list: All items from paginated query results
    """
    items = []
    while True:
        response = table.query(**kwargs)
        items += [_deserialize(i) for i in response.get("Items", [])]

        if "LastEvaluatedKey" not in response:
            break

        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return items


# ── CREATE FILE ────────────────────────────────────────────
def create_file(
    *,
    user_id: str,
    file_id: str,
    username: str,
    file_name: str,
    s3_key: str,
    file_type: str,
    file_size: int,
    album_id: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    s3_url: Optional[str] = None,
    file_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new file record in DynamoDB.
    
    Args:
        user_id: User's Cognito sub
        file_id: Unique file identifier (UUID)
        username: Username for GSI
        file_name: Original filename
        s3_key: S3 object key
        file_type: File type (image/video/document)
        file_size: File size in bytes
        album_id: Optional album ID
        width: Optional image/video width
        height: Optional image/video height
        s3_url: Optional public S3 URL
        file_hash: Optional SHA256 hash
        
    Returns:
        dict: Created file item
        
    Raises:
        HTTPException: If database operation fails
    """
    table = get_table()
    now = _now()

    # Encode filename (simple + reversible)
    file_name_enc = base64.urlsafe_b64encode(file_name.encode()).decode()

    item = {
        "user_id": user_id,
        "file_id": file_id,
        "username": username,
        "file_name_enc": file_name_enc,
        "s3_key": s3_key,
        "file_type": file_type,
        "file_size": file_size,
        "file_hash": file_hash,
        "album_id": album_id or "none",
        "is_deleted": False,
        "uploaded_at": now,
        "updated_at": now,
    }

    if width is not None:
        item["width"] = width
    if height is not None:
        item["height"] = height
    if s3_url is not None:
        item["s3_url"] = s3_url

    try:
        table.put_item(Item=item)
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"DynamoDB put_item failed: {e.response['Error']['Message']}",
        )

    return _deserialize(item)


# ── GET ALL FILES ──────────────────────────────────────────
def get_user_files(user_id: str, include_deleted: bool = False) -> List[Dict[str, Any]]:
    """
    Get all files for a user.
    
    Args:
        user_id: User's Cognito sub
        include_deleted: Whether to include soft-deleted files
        
    Returns:
        list: User's files sorted by upload date (newest first)
    """
    table = get_table()

    kwargs = {
        "KeyConditionExpression": Key("user_id").eq(user_id),
    }

    if not include_deleted:
        kwargs["FilterExpression"] = Attr("is_deleted").eq(False)

    items = _paginated_query(table, **kwargs)
    items.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return items


# ── GET SINGLE FILE ────────────────────────────────────────
def get_file(user_id: str, file_id: str) -> Dict[str, Any]:
    """
    Get a single file by ID.
    
    Args:
        user_id: User's Cognito sub
        file_id: File's unique identifier
        
    Returns:
        dict: File item
        
    Raises:
        HTTPException: If file not found or database error
    """
    table = get_table()

    try:
        response = table.get_item(
            Key={"user_id": user_id, "file_id": file_id}
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Database error")

    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    return _deserialize(item)


# ── GET FILES BY TYPE ──────────────────────────────────────
def get_files_by_type(user_id: str, file_type: str) -> List[Dict[str, Any]]:
    """
    Get all files of a specific type for a user.
    
    Args:
        user_id: User's Cognito sub
        file_type: File type (image/video/document)
        
    Returns:
        list: Files of specified type
    """
    table = get_table()

    return _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=(
            Attr("file_type").eq(file_type) &
            Attr("is_deleted").eq(False)
        ),
    )


# ── RECYCLE BIN ────────────────────────────────────────────
def get_deleted_files(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all soft-deleted files for a user.
    
    Args:
        user_id: User's Cognito sub
        
    Returns:
        list: Soft-deleted files
    """
    table = get_table()

    return _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("is_deleted").eq(True),
    )


# ── SOFT DELETE ────────────────────────────────────────────
def soft_delete_file(user_id: str, file_id: str) -> Dict[str, str]:
    """
    Soft delete a file (mark as deleted without removing from storage).
    
    Args:
        user_id: User's Cognito sub
        file_id: File's unique identifier
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If file not found or database error
    """
    table = get_table()

    try:
        table.update_item(
            Key={"user_id": user_id, "file_id": file_id},
            UpdateExpression="SET is_deleted = :d, updated_at = :u",
            ConditionExpression="attribute_exists(file_id)",
            ExpressionAttributeValues={
                ":d": True,
                ":u": _now(),
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to delete file")

    return {"message": "File moved to recycle bin"}


# ── RESTORE ────────────────────────────────────────────────
def restore_file(user_id: str, file_id: str) -> Dict[str, str]:
    """
    Restore a soft-deleted file.
    
    Args:
        user_id: User's Cognito sub
        file_id: File's unique identifier
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If file not found or database error
    """
    table = get_table()

    try:
        table.update_item(
            Key={"user_id": user_id, "file_id": file_id},
            UpdateExpression="SET is_deleted = :d, updated_at = :u",
            ConditionExpression="attribute_exists(file_id)",
            ExpressionAttributeValues={
                ":d": False,
                ":u": _now(),
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to restore file")

    return {"message": "File restored"}


# ── PERMANENT DELETE ───────────────────────────────────────
def delete_file(user_id: str, file_id: str) -> Dict[str, str]:
    """
    Permanently delete a file record from DynamoDB.
    
    Args:
        user_id: User's Cognito sub
        file_id: File's unique identifier
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If file not found or database error
    """
    table = get_table()

    try:
        table.delete_item(
            Key={"user_id": user_id, "file_id": file_id},
            ConditionExpression="attribute_exists(file_id)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to delete file")

    return {"message": "File permanently deleted"}


# ── RENAME FILE ────────────────────────────────────────────
def update_file_name(user_id: str, file_id: str, new_name: str) -> Dict[str, str]:
    """
    Update a file's name.
    
    Args:
        user_id: User's Cognito sub
        file_id: File's unique identifier
        new_name: New filename
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If file not found, already deleted, or database error
    """
    table = get_table()

    try:
        table.update_item(
            Key={"user_id": user_id, "file_id": file_id},
            UpdateExpression="SET file_name = :n, updated_at = :u",
            ConditionExpression="attribute_exists(file_id) AND is_deleted = :f",
            ExpressionAttributeValues={
                ":n": new_name,
                ":u": _now(),
                ":f": False,
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(
                status_code=404,
                detail="File not found or already deleted",
            )
        raise HTTPException(status_code=500, detail="Failed to rename file")

    return {"message": "File renamed"}


# ── STORAGE STATS ──────────────────────────────────────────
def get_storage_stats(user_id: str) -> Dict[str, Any]:
    """
    Calculate storage statistics for a user.
    
    Args:
        user_id: User's Cognito sub
        
    Returns:
        dict: Storage statistics including total bytes, file counts by type
    """
    files = get_user_files(user_id)

    total = sum(f.get("file_size", 0) for f in files)
    images = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "image")
    videos = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "video")
    docs = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "document")

    return {
        "total_bytes": total,
        "total_gb": round(total / (1024 ** 3), 2),
        "images_bytes": images,
        "videos_bytes": videos,
        "documents_bytes": docs,
        "file_count": len(files),
    }