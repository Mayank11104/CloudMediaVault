from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
import re
import time
import jwt

from cryptography.fernet import Fernet

from app.services.cognito import verify_token
from app.services import users as user_service
from app.database import cognito_client as cognito
from app.models.user import UserProfileResponse
from app.schemas.auth import CheckUsernameResponse
from app.config import (
    COOKIE_SECURE,
    COGNITO_CLIENT_ID,
    COOKIE_ENCRYPTION_KEY,
)

router = APIRouter()

# ───────────────────────────────────────────────────────────
# Cookie config
# ───────────────────────────────────────────────────────────
COOKIE_SAMESITE = "none"   # REQUIRED for CloudFront cross-site cookies

# ───────────────────────────────────────────────────────────
# Cookie encryption
# ───────────────────────────────────────────────────────────
fernet = Fernet(COOKIE_ENCRYPTION_KEY.encode())

def encrypt_value(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_value(value: str) -> str:
    try:
        return fernet.decrypt(value.encode()).decode()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

# ───────────────────────────────────────────────────────────
# Username helpers
# ───────────────────────────────────────────────────────────
USERNAME_REGEX = re.compile(r"^[a-z0-9_\-]{3,50}$")

def normalize_username(username: str) -> str:
    return username.lower().strip()

def validate_username(username: str) -> None:
    if not USERNAME_REGEX.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–50 chars (a-z, 0-9, _, -)"
        )

# ───────────────────────────────────────────────────────────
# Schemas
# ───────────────────────────────────────────────────────────
class TokenPayload(BaseModel):
    access_token: str
    id_token: str
    refresh_token: str
    username: Optional[str] = None

class UpdateProfileBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

# ───────────────────────────────────────────────────────────
# Cookie helpers
# ───────────────────────────────────────────────────────────
def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    id_token: str,
    refresh_token: Optional[str],
    username: str,
):
    """
    Username is REQUIRED here.
    If it's missing, that's a bug and we fail loudly.
    """
    if not username:
        raise RuntimeError("Attempted to set cookies without username")

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )

    response.set_cookie(
        key="id_token",
        value=id_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )

    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=30 * 24 * 3600,
            path="/",
        )

    response.set_cookie(
        key="username",
        value=encrypt_value(username),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=30 * 24 * 3600,
        path="/",
    )

def clear_auth_cookies(response: Response):
    for key in ("access_token", "id_token", "refresh_token", "username"):
        response.set_cookie(
            key=key,
            value="",
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=0,
            path="/",
        )

# ───────────────────────────────────────────────────────────
# Routes
# ───────────────────────────────────────────────────────────

@router.get("/check-username/{username}", response_model=CheckUsernameResponse)
def check_username(username: str):
    username = normalize_username(username)
    validate_username(username)

    available = user_service.is_username_available(username)
    return CheckUsernameResponse(
        available=available,
        message="Username available" if available else "Username already taken",
    )

# ───────────────────────────────────────────────────────────
# LOGIN
# ───────────────────────────────────────────────────────────
@router.post("/login")
def login(payload: TokenPayload):
    cognito_user = verify_token(payload.access_token, token_use="access")

    user_id = cognito_user["sub"]
    email = cognito_user.get("email")
    name = cognito_user.get("name")

    # ── Resolve username (ONE TRUE SOURCE) ──
    if payload.username:
        # First-time login with username provided
        username = normalize_username(payload.username)
        validate_username(username)

        if not user_service.is_username_available(username):
            raise HTTPException(status_code=400, detail="Username already taken")

        user_service.create_user(
            user_id=user_id,
            email=email,
            username=username,
            name=name,
        )
    else:
        # Returning user - fetch username from database
        db_user = user_service.get_user_by_id(user_id)
        
        # Debug logging - remove after fixing
        print(f"[LOGIN DEBUG] User ID: {user_id}")
        print(f"[LOGIN DEBUG] DB User found: {db_user is not None}")
        if db_user:
            print(f"[LOGIN DEBUG] Username in DB: {db_user.get('username')}")
        
        if not db_user:
            raise HTTPException(
                status_code=404,
                detail="User profile not found in database. Please contact support."
            )
        if not db_user.get("username"):
            raise HTTPException(
                status_code=400,
                detail="Username not set for this account. Please complete signup with username."
            )
        username = db_user["username"]

    response = JSONResponse(
        content={
            "message": "Logged in successfully",
            "user": {
                "sub": user_id,
                "email": email,
                "name": name,
                "username": username,
            },
        }
    )

    set_auth_cookies(
        response,
        access_token=payload.access_token,
        id_token=payload.id_token,
        refresh_token=payload.refresh_token,
        username=username,
    )

    return response

# ───────────────────────────────────────────────────────────
# ME
# ───────────────────────────────────────────────────────────
@router.get("/me", response_model=UserProfileResponse)
def me(request: Request):
    id_token = request.cookies.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = jwt.decode(id_token, options={"verify_signature": False})
    if payload.get("exp", 0) < time.time():
        raise HTTPException(status_code=401, detail="Token expired")

    return UserProfileResponse(
        sub=payload.get("sub"),
        email=payload.get("email"),
        name=payload.get("name"),
    )

# ───────────────────────────────────────────────────────────
# REFRESH
# ───────────────────────────────────────────────────────────
@router.post("/refresh")
def refresh(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    encrypted_username = request.cookies.get("username")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    if not encrypted_username:
        raise HTTPException(status_code=401, detail="Username session lost")

    username = decrypt_value(encrypted_username)

    result = cognito.initiate_auth(
        AuthFlow="REFRESH_TOKEN_AUTH",
        AuthParameters={"REFRESH_TOKEN": refresh_token},
        ClientId=COGNITO_CLIENT_ID,
    )

    tokens = result["AuthenticationResult"]

    response = JSONResponse({"message": "Token refreshed"})
    set_auth_cookies(
        response,
        access_token=tokens["AccessToken"],
        id_token=tokens["IdToken"],
        refresh_token=None,
        username=username,
    )
    return response

# ───────────────────────────────────────────────────────────
# LOGOUT
# ───────────────────────────────────────────────────────────
@router.post("/logout")
def logout():
    response = JSONResponse({"message": "Logged out"})
    clear_auth_cookies(response)
    return response
