# schemas/auth.py
from pydantic import BaseModel, Field

class LoginSchema(BaseModel):
    access_token:  str = Field(..., min_length=1)
    id_token:      str = Field(..., min_length=1)
    refresh_token: str = Field(..., min_length=1)

class UpdateProfileSchema(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        strip_whitespace=True,
    )

class ChangePasswordSchema(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password:     str = Field(..., min_length=8, max_length=128)
