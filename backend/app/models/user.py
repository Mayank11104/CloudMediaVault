# models/user.py
from pydantic import BaseModel
from typing import Optional

class UserModel(BaseModel):
    sub:   str              # Cognito user ID
    email: str
    name:  Optional[str] = None

class UserProfileResponse(BaseModel):
    email: str
    name:  Optional[str] = None
    sub:   str
