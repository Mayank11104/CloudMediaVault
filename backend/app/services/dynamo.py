from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from fastapi import HTTPException
from botocore.exceptions import ClientError
import uuid
from app.database import get_table  # ✅ import shared singleton

# ── Helpers ────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _deserialize(item: dict) -> dict:
    """Convert DynamoDB Decimal → int/float for JSON serialization."""
    result = {}
    for k, v in item.items():
        if isinstance(v, Decimal):
            result[k] = int(v) if v == v.to_integral_value() else float(v)
        else:
            result[k] = v
    return result

def _paginated_query(table, **kwargs) -> list:
    """Paginate through all DynamoDB results (handles > 1 MB responses)."""
    items = []
    while True:
        response = table.query(**kwargs)
        items   += [_deserialize(i) for i in response.get("Items", [])]
        if "LastEvaluatedKey" not in response:
            break
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
    return items

# ── Create File Record ─────────────────────────────────────
def create_file(
    user_id:   str,
    file_name: str,
    s3_key:    str,
    file_type: str,
    file_size: int,
    album_id:  str = None,
) -> dict:
    table   = get_table()
    file_id = str(uuid.uuid4())
    now     = _now()

    item = {
        "user_id":     user_id,
        "file_id":     file_id,
        "file_name":   file_name,
        "s3_key":      s3_key,
        "file_type":   file_type,
        "file_size":   file_size,
        "album_id":    album_id or "none",
        "is_deleted":  False,
        "uploaded_at": now,
        "updated_at":  now,
    }
    try:
        table.put_item(Item=item)
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to save file record")
    return item

# ── Get All Files for User ─────────────────────────────────
def get_user_files(user_id: str, include_deleted: bool = False) -> list:
    table = get_table()
    items = _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(user_id),
        **({"FilterExpression": Attr("is_deleted").eq(False)}
           if not include_deleted else {}),
    )
    items.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return items

# ── Get Single File ────────────────────────────────────────
def get_file(user_id: str, file_id: str) -> dict:
    table    = get_table()
    try:
        response = table.get_item(Key={"user_id": user_id, "file_id": file_id})
    except ClientError:
        raise HTTPException(status_code=500, detail="Database error")

    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="File not found")
    return _deserialize(item)

# ── Get Files by Type ──────────────────────────────────────
def get_files_by_type(user_id: str, file_type: str) -> list:
    table = get_table()
    return _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("file_type").eq(file_type) & Attr("is_deleted").eq(False),
    )

# ── Get Deleted Files (Recycle Bin) ────────────────────────
def get_deleted_files(user_id: str) -> list:
    table = get_table()
    return _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(user_id),
        FilterExpression=Attr("is_deleted").eq(True),
    )

# ── Soft Delete ────────────────────────────────────────────
def soft_delete_file(user_id: str, file_id: str) -> dict:
    table = get_table()
    try:
        table.update_item(
            Key={"user_id": user_id, "file_id": file_id},
            UpdateExpression="SET is_deleted = :d, updated_at = :u",
            ConditionExpression="attribute_exists(file_id)",
            ExpressionAttributeValues={":d": True, ":u": _now()},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to delete file")
    return {"message": "File moved to recycle bin"}

# ── Restore from Recycle Bin ───────────────────────────────
def restore_file(user_id: str, file_id: str) -> dict:
    table = get_table()
    try:
        table.update_item(
            Key={"user_id": user_id, "file_id": file_id},
            UpdateExpression="SET is_deleted = :d, updated_at = :u",
            ConditionExpression="attribute_exists(file_id)",
            ExpressionAttributeValues={":d": False, ":u": _now()},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail="Failed to restore file")
    return {"message": "File restored"}

# ── Permanent Delete ───────────────────────────────────────
def delete_file(user_id: str, file_id: str) -> dict:
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

# ── Update File Name ───────────────────────────────────────
def update_file_name(user_id: str, file_id: str, new_name: str) -> dict:
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
            raise HTTPException(status_code=404, detail="File not found or already deleted")
        raise HTTPException(status_code=500, detail="Failed to rename file")
    return {"message": "File renamed"}

# ── Get Storage Stats ──────────────────────────────────────
def get_storage_stats(user_id: str) -> dict:
    files  = get_user_files(user_id)   # already excludes deleted
    total  = sum(f.get("file_size", 0) for f in files)
    images = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "image")
    videos = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "video")
    docs   = sum(f.get("file_size", 0) for f in files if f.get("file_type") == "document")

    return {
        "total_bytes":      total,
        "total_gb":         round(total / (1024 ** 3), 2),
        "images_bytes":     images,
        "videos_bytes":     videos,
        "documents_bytes":  docs,
        "file_count":       len(files),
    }
