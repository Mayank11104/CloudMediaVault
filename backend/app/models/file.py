# models/file.py
from pydantic import BaseModel
from typing import Optional


class FileModel(BaseModel):
    file_id:     str
    file_name:   str
    file_type:   str            # image | video | document
    file_size:   int            # bytes
    s3_key:      str
    album_id:    str            # "none" if not in any album
    is_deleted:  bool
    uploaded_at: str            # ISO 8601
    updated_at:  str
    width:       Optional[int] = None   # ✅ Add this
    height:      Optional[int] = None   # ✅ Add this
    s3_url:      Optional[str] = None   # ✅ Add this


class FileDetailModel(FileModel):
    presigned_url: str          # added when fetching single file


class FileListResponse(BaseModel):
    files: list[FileModel]
    count: int
