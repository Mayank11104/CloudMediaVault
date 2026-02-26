# schemas/auth.py
from pydantic import BaseModel, Field
from typing import Optional  # ← ADD THIS IMPORT


class LoginSchema(BaseModel):
    access_token:  str = Field(..., min_length=1)
    id_token:      str = Field(..., min_length=1)
    refresh_token: str = Field(..., min_length=1)
    username: Optional[str] = Field(None, min_length=3, max_length=50)  # ← ADD THIS LINE


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


# ✨ ADD THESE 2 NEW MODELS
class CheckUsernameResponse(BaseModel):
    available: bool
    message: str


class UserResponseWithUsername(BaseModel):
    email: str
    name: str
    username: str
    sub: str
