# models/album.py
from pydantic import BaseModel
from typing import Optional

class AlbumModel(BaseModel):
    album_id:   str
    album_name: str
    cover_url:  Optional[str] = None   # presigned URL of first image
    file_count: int
    created_at: str
    updated_at: Optional[str] = None

class AlbumListResponse(BaseModel):
    albums: list[AlbumModel]
    count:  int
