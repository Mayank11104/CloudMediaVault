import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from app.middleware.auth import get_current_user
from app.services import s3
from app.database import get_table  # ✅ use shared singleton
from app.models.album import AlbumListResponse
import re

router = APIRouter()

# ── Helpers ────────────────────────────────────────────────
ALBUM_ID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _deserialize(item: dict) -> dict:
    return {
        k: int(v) if isinstance(v, Decimal) and v == v.to_integral_value()
           else float(v) if isinstance(v, Decimal)
           else v
        for k, v in item.items()
    }

def validated_album_id(
    album_id: str = Path(..., description="UUID of the album")
) -> str:
    if not ALBUM_ID_RE.match(album_id):
        raise HTTPException(status_code=400, detail="Invalid album ID format")
    return album_id

def _paginated_query(table, **kwargs) -> list:
    items = []
    while True:
        response = table.query(**kwargs)
        items   += [_deserialize(i) for i in response.get("Items", [])]
        if "LastEvaluatedKey" not in response:
            break
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
    return items

def _get_album_or_404(user_id: str, album_id: str) -> dict:
    """Fetch album and verify ownership — raises 404 if not found."""
    table = get_table()
    try:
        response = table.get_item(
            Key={"user_id": f"ALBUM#{user_id}", "file_id": album_id}
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Database error")
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Album not found")
    return _deserialize(item)

# ── Pydantic models ────────────────────────────────────────
class CreateAlbumBody(BaseModel):
    album_name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)

class RenameAlbumBody(BaseModel):
    album_name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)

class AddFileBody(BaseModel):
    file_id: str = Field(..., min_length=36, max_length=36)

# ── GET /albums ────────────────────────────────────────────
@router.get("", response_model=AlbumListResponse)  # ✅ response_model
def list_albums(user: dict = Depends(get_current_user)):
    """List all albums for the current user."""
    table  = get_table()
    items  = _paginated_query(
        table,
        KeyConditionExpression=Key("user_id").eq(f"ALBUM#{user['sub']}"),
    )
    albums = []
    for item in items:
        albums.append({
            "album_id":   item["file_id"],
            "album_name": item.get("album_name"),
            "cover_url":  item.get("cover_url"),
            "file_count": item.get("file_count", 0),
            "created_at": item.get("created_at"),
        })
    albums.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"albums": albums, "count": len(albums)}

# ── POST /albums ───────────────────────────────────────────
@router.post("")
def create_album(
    body: CreateAlbumBody,
    user: dict = Depends(get_current_user),
):
    """Create a new album."""
    table    = get_table()
    album_id = str(uuid.uuid4())
    now      = _now()

    item = {
        "user_id":    f"ALBUM#{user['sub']}",   # separate namespace from files
        "file_id":    album_id,                  # reusing sort key as album_id
        "album_name": body.album_name,
        "cover_url":  None,
        "file_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    try:
        table.put_item(Item=item)
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to create album")

    return {
        "message": "Album created",
        "album": {
            "album_id":   album_id,
            "album_name": body.album_name,
            "cover_url":  None,
            "file_count": 0,
            "created_at": now,
        },
    }

# ── PATCH /albums/{album_id} — rename ─────────────────────
@router.patch("/{album_id}")
def rename_album(
    body:     RenameAlbumBody,
    album_id: str  = Depends(validated_album_id),
    user:     dict = Depends(get_current_user),
):
    """Rename an album."""
    _get_album_or_404(user["sub"], album_id)     # ownership check

    table = get_table()
    try:
        table.update_item(
            Key={"user_id": f"ALBUM#{user['sub']}", "file_id": album_id},
            UpdateExpression="SET album_name = :n, updated_at = :u",
            ConditionExpression="attribute_exists(file_id)",
            ExpressionAttributeValues={
                ":n": body.album_name,
                ":u": _now(),
            },
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="Album not found")
        raise HTTPException(status_code=500, detail="Failed to rename album")

    return {"message": "Album renamed"}

# ── DELETE /albums/{album_id} ──────────────────────────────
@router.delete("/{album_id}")
def delete_album(
    album_id: str  = Depends(validated_album_id),
    user:     dict = Depends(get_current_user),
):
    """Delete an album. Files inside are NOT deleted — just unlinked."""
    _get_album_or_404(user["sub"], album_id)     # ownership check

    table = get_table()

    # ① Unlink all files from this album
    try:
        files_in_album = _paginated_query(
            table,
            KeyConditionExpression=Key("user_id").eq(user["sub"]),
            FilterExpression=Attr("album_id").eq(album_id),
        )
        for f in files_in_album:
            table.update_item(
                Key={"user_id": user["sub"], "file_id": f["file_id"]},
                UpdateExpression="SET album_id = :none, updated_at = :u",
                ExpressionAttributeValues={":none": "none", ":u": _now()},
            )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to unlink files from album")

    # ② Delete the album record
    try:
        table.delete_item(
            Key={"user_id": f"ALBUM#{user['sub']}", "file_id": album_id},
            ConditionExpression="attribute_exists(file_id)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="Album not found")
        raise HTTPException(status_code=500, detail="Failed to delete album")

    return {"message": "Album deleted"}

# ── POST /albums/{album_id}/files — add file to album ──────
@router.post("/{album_id}/files")
def add_file_to_album(
    body:     AddFileBody,
    album_id: str  = Depends(validated_album_id),
    user:     dict = Depends(get_current_user),
):
    """Add a file to an album."""
    _get_album_or_404(user["sub"], album_id)     # album ownership check

    table = get_table()

    # Verify file exists and belongs to user
    try:
        response = table.get_item(
            Key={"user_id": user["sub"], "file_id": body.file_id}
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Database error")

    file = response.get("Item")
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot add deleted file to album")

    # ① Link file to album
    try:
        table.update_item(
            Key={"user_id": user["sub"], "file_id": body.file_id},
            UpdateExpression="SET album_id = :a, updated_at = :u",
            ExpressionAttributeValues={":a": album_id, ":u": _now()},
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to add file to album")

    # ② Increment file_count on album + set cover if first file
    try:
        album = _get_album_or_404(user["sub"], album_id)
        update_expr   = "SET file_count = file_count + :inc, updated_at = :u"
        update_values = {":inc": 1, ":u": _now()}

        # Set cover_url from first file added (images only)
        if not album.get("cover_url") and _deserialize(file).get("file_type") == "image":
            presigned = s3.get_presigned_url(file["s3_key"], expires_in=86400)
            update_expr            += ", cover_url = :c"
            update_values[":c"]     = presigned

        table.update_item(
            Key={"user_id": f"ALBUM#{user['sub']}", "file_id": album_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=update_values,
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to update album")

    return {"message": "File added to album"}

# ── DELETE /albums/{album_id}/files/{file_id} ─────────────
@router.delete("/{album_id}/files/{file_id}")
def remove_file_from_album(
    album_id: str  = Depends(validated_album_id),
    file_id:  str  = Path(...),
    user:     dict = Depends(get_current_user),
):
    """Remove a file from an album without deleting the file."""
    _get_album_or_404(user["sub"], album_id)     # ownership check

    table = get_table()

    # Verify file belongs to user and is in this album
    try:
        response = table.get_item(
            Key={"user_id": user["sub"], "file_id": file_id}
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Database error")

    file = response.get("Item")
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if _deserialize(file).get("album_id") != album_id:
        raise HTTPException(status_code=400, detail="File is not in this album")

    # ① Unlink file
    try:
        table.update_item(
            Key={"user_id": user["sub"], "file_id": file_id},
            UpdateExpression="SET album_id = :none, updated_at = :u",
            ExpressionAttributeValues={":none": "none", ":u": _now()},
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to remove file from album")

    # ② Decrement file_count on album
    try:
        table.update_item(
            Key={"user_id": f"ALBUM#{user['sub']}", "file_id": album_id},
            UpdateExpression="SET file_count = if_not_exists(file_count, :zero) - :dec, updated_at = :u",
            ExpressionAttributeValues={":dec": 1, ":zero": 1, ":u": _now()},
        )
    except ClientError:
        raise HTTPException(status_code=500, detail="Failed to update album count")

    return {"message": "File removed from album"}
