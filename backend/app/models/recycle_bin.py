# models/recycle_bin.py
from pydantic import BaseModel
from app.models.file import FileModel

class RecycleBinResponse(BaseModel):
    files: list[FileModel]
    count: int

class EmptyBinResponse(BaseModel):
    message:       str
    deleted_count: int
