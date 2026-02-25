from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from app.services.cognito import verify_token
from app.models.user import UserProfileResponse
from app.database import cognito_client as cognito
from app.config import COOKIE_SECURE, COGNITO_CLIENT_ID

router = APIRouter()

COOKIE_SAMESITE = "lax"

# ── Pydantic models ────────────────────────────────────────
class TokenPayload(BaseModel):
    access_token: str
    id_token: str
    refresh_token: str

class UpdateProfileBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)

class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)

# ── Cookie helpers ─────────────────────────────────────────
def set_auth_cookies(response: Response, access_token: str,
                     id_token: str, refresh_token: Optional[str] = None):
    """Set httpOnly cookies - manual approach to ensure all 3 are set"""
    
    # ✅ Set access_token
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )
    
    # ✅ Set id_token
    response.set_cookie(
        key="id_token",
        value=id_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=3600,
        path="/",
    )
    
    # ✅ Set refresh_token
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

def clear_auth_cookies(response: Response):
    """Clear all auth cookies"""
    for name in ("access_token", "id_token", "refresh_token"):
        response.set_cookie(
            key=name,
            value="",
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=0,
            path="/",
        )

@router.post("/login")
def login(payload: TokenPayload):
    """Login endpoint - verifies Cognito tokens and sets httpOnly cookies"""
    # ✅ Verify access_token (for login validation)
    user = verify_token(payload.access_token, token_use="access")
    
    response = JSONResponse(content={
        "message": "Logged in successfully",
        "user": {
            "email": user.get("email"),
            "name": user.get("name"),
            "sub": user.get("sub"),
        },
    })
    
    set_auth_cookies(
        response,
        access_token=payload.access_token,
        id_token=payload.id_token,
        refresh_token=payload.refresh_token,
    )
    
    return response

@router.get("/me", response_model=UserProfileResponse)
def me(request: Request):
    """Get current user from httpOnly cookies"""
    
    id_token = request.cookies.get("id_token")
    
    if not id_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # ✅ Verify id_token (contains user profile data)
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
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        result = cognito.initiate_auth(
            AuthFlow='REFRESH_TOKEN_AUTH',
            AuthParameters={'REFRESH_TOKEN': refresh_token},
            ClientId=COGNITO_CLIENT_ID,
        )
        tokens = result['AuthenticationResult']
        
        response = JSONResponse(content={"message": "Token refreshed successfully"})
        set_auth_cookies(
            response,
            access_token=tokens['AccessToken'],
            id_token=tokens['IdToken'],
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
