# schemas/album.py
from pydantic import BaseModel, Field

class CreateAlbumSchema(BaseModel):
    album_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        strip_whitespace=True,
    )

class RenameAlbumSchema(BaseModel):
    album_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        strip_whitespace=True,
    )

class AddFileToAlbumSchema(BaseModel):
    file_id: str = Field(..., min_length=36, max_length=36)
