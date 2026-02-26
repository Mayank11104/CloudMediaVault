from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from app.services.cognito import verify_token
from app.models.user import UserProfileResponse
from app.database import cognito_client as cognito
from app.config import COOKIE_SECURE, COGNITO_CLIENT_ID, COOKIE_ENCRYPTION_KEY
from app.schemas.auth import CheckUsernameResponse
from app.services import users as user_service
from cryptography.fernet import Fernet
import re

router = APIRouter()

COOKIE_SAMESITE = "lax"

# ── Cookie Encryption ──────────────────────────────────────
fernet = Fernet(COOKIE_ENCRYPTION_KEY.encode())

def encrypt_value(value: str) -> str:
    """Encrypt a value using Fernet"""
    return fernet.encrypt(value.encode()).decode()

def decrypt_value(encrypted: str) -> str:
    """Decrypt a value using Fernet"""
    try:
        return fernet.decrypt(encrypted.encode()).decode()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

# ── Username Validation ────────────────────────────────────
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_\-]{3,50}$')  # ← Allows uppercase

def normalize_username(username: str) -> str:
    """
    Normalize username to lowercase
    Call this FIRST before any validation or storage
    """
    return username.lower().strip()

def validate_username_format(username: str) -> bool:
    """
    Validate username format (after normalization)
    Allows: letters, numbers, underscores, hyphens
    Length: 3-50 characters
    """
    return bool(USERNAME_REGEX.match(username))

# ── Pydantic models ────────────────────────────────────────
class TokenPayload(BaseModel):
    access_token: str
    id_token: str
    refresh_token: str
    username: Optional[str] = None

class UpdateProfileBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)

class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)

# ── Cookie helpers ─────────────────────────────────────────
def set_auth_cookies(response: Response, access_token: str,
                     id_token: str, refresh_token: Optional[str] = None,
                     username: Optional[str] = None):
    """Set httpOnly cookies - manual approach to ensure all 3 are set"""
    
    # Set access_token
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )
    
    # Set id_token
    response.set_cookie(
        key="id_token",
        value=id_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )
    
    # Set refresh_token
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
    
    # Set encrypted username cookie
    if username:
        encrypted_username = encrypt_value(username)
        response.set_cookie(
            key="username",
            value=encrypted_username,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=3600,
            path="/",
        )

def clear_auth_cookies(response: Response):
    """Clear all auth cookies"""
    for name in ("access_token", "id_token", "refresh_token", "username"):
        response.set_cookie(
            key=name,
            value="",
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=0,
            path="/",
        )

# ── GET /auth/check-username/{username} ────────────────────
@router.get("/check-username/{username}", response_model=CheckUsernameResponse)
def check_username_availability(username: str):
    """Check if username is available"""
    # ✨ STEP 1: Normalize FIRST (convert to lowercase)
    username = normalize_username(username)
    
    # STEP 2: Validate format
    if not validate_username_format(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-50 characters (letters, numbers, underscores, hyphens)"
        )
    
    # STEP 3: Check availability
    is_available = user_service.is_username_available(username)
    
    return CheckUsernameResponse(
        available=is_available,
        message="Username available" if is_available else "Username already taken"
    )

# ── POST /auth/login ───────────────────────────────────────
@router.post("/login")
def login(payload: TokenPayload):
    """Login endpoint - verifies Cognito tokens and sets httpOnly cookies"""
    # Verify access_token (for login validation)
    user = verify_token(payload.access_token, token_use="access")
    
    email = user.get("email")
    name = user.get("name")
    user_id = user.get("sub")
    username = None
    
    # Handle username logic
    if payload.username:
        # ✨ STEP 1: Normalize FIRST (convert to lowercase)
        username = normalize_username(payload.username)
        
        # STEP 2: Validate format
        if not validate_username_format(username):
            raise HTTPException(status_code=400, detail="Invalid username format")
        
        # STEP 3: Check availability
        if not user_service.is_username_available(username):
            raise HTTPException(status_code=400, detail="Username already taken")
        
        # STEP 4: Create user (username already lowercase)
        try:
            user_service.create_user(
                email=email,
                username=username,
                user_id=user_id,
                name=name
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")
    else:
        # Regular login - fetch username from database
        db_user = user_service.get_user_by_id(user_id)
        if db_user:
            username = db_user.get('username')
    
    response = JSONResponse(content={
        "message": "Logged in successfully",
        "user": {
            "email": email,
            "name": name,
            "sub": user_id,
            "username": username,
        },
    })
    
    set_auth_cookies(
        response,
        access_token=payload.access_token,
        id_token=payload.id_token,
        refresh_token=payload.refresh_token,
        username=username,
    )
    
    return response

# ── GET /auth/me ───────────────────────────────────────────
@router.get("/me", response_model=UserProfileResponse)
def me(request: Request):
    """Get current user from httpOnly cookies"""
    
    id_token = request.cookies.get("id_token")
    
    if not id_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify id_token (contains user profile data)
    user = verify_token(id_token, token_use="id")
    
    return UserProfileResponse(
        email=user.get("email", ""),
        name=user.get("name", ""),
        sub=user.get("sub", ""),
    )

# ── POST /auth/logout ──────────────────────────────────────
@router.post("/logout")
def logout():
    """Logout - clear all cookies"""
    response = JSONResponse(content={"message": "Logged out successfully"})
    clear_auth_cookies(response)
    return response

# ── POST /auth/refresh ─────────────────────────────────────
@router.post("/refresh")
def refresh(request: Request):
    """Refresh access token using refresh token"""
    refresh_token = request.cookies.get("refresh_token")
    encrypted_username = request.cookies.get("username")
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        result = cognito.initiate_auth(
            AuthFlow='REFRESH_TOKEN_AUTH',
            AuthParameters={'REFRESH_TOKEN': refresh_token},
            ClientId=COGNITO_CLIENT_ID,
        )
        tokens = result['AuthenticationResult']
        
        # Decrypt username to re-set in new cookie
        username = decrypt_value(encrypted_username) if encrypted_username else None
        
        response = JSONResponse(content={"message": "Token refreshed successfully"})
        set_auth_cookies(
            response,
            access_token=tokens['AccessToken'],
            id_token=tokens['IdToken'],
            username=username
        )
        return response

    except cognito.exceptions.NotAuthorizedException:
        response = JSONResponse(
            status_code=401,
            content={"detail": "Session expired, please login again"}
        )
        clear_auth_cookies(response)
        return response

    except Exception:
        raise HTTPException(status_code=500, detail="Token refresh failed")

# ── PATCH /auth/update-profile ─────────────────────────────
@router.patch("/update-profile")
def update_profile(request: Request, body: UpdateProfileBody):
    """Update user profile"""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        cognito.update_user_attributes(
            AccessToken=token,
            UserAttributes=[{'Name': 'name', 'Value': body.name}],
        )
        return {"message": "Profile updated"}

    except cognito.exceptions.NotAuthorizedException:
        raise HTTPException(status_code=401, detail="Not authenticated")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update profile")

# ── POST /auth/change-password ─────────────────────────────
@router.post("/change-password")
def change_password(request: Request, body: ChangePasswordBody):
    """Change password"""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        cognito.change_password(
            AccessToken=token,
            PreviousPassword=body.current_password,
            ProposedPassword=body.new_password,
        )
        return {"message": "Password updated"}

    except cognito.exceptions.NotAuthorizedException:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    except cognito.exceptions.InvalidPasswordException:
        raise HTTPException(status_code=400, detail="Password does not meet requirements")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to change password")
