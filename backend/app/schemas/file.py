# schemas/file.py
from pydantic import BaseModel, Field

class RenameFileSchema(BaseModel):
    file_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        strip_whitespace=True,
    )

class AddToAlbumSchema(BaseModel):
    album_id: str = Field(..., min_length=36, max_length=36)
