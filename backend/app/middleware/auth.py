# app/middleware/auth.py
import jwt
import time
from typing import Dict, Any
from fastapi import Cookie, HTTPException, Request

from app.routers.auth import decrypt_value


async def get_current_user(
    request: Request,
    id_token: str = Cookie(None),
    username: str = Cookie(None),
) -> Dict[str, Any]:
    """
    Extract user from httpOnly cookies (Cognito + app session).
    
    Args:
        request: FastAPI request object
        id_token: Cognito ID token from cookie
        username: Encrypted username from cookie
        
    Returns:
        dict: User information including sub, email, name, username
        
    Raises:
        HTTPException: If authentication fails
    """
    if not id_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Decode Cognito ID token (no signature verify, CloudFront trusted)
        payload = jwt.decode(
            id_token,
            options={"verify_signature": False}
        )

        # Exp check
        if payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token expired")

        user_id = payload.get("sub")
        email = payload.get("email")
        name = payload.get("name") or "Unknown"

        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Decrypt username (required for DynamoDB GSI)
        decrypted_username = None
        if username:
            try:
                decrypted_username = decrypt_value(username)
            except Exception:
                raise HTTPException(status_code=401, detail="Invalid username session")

        return {
            "sub": user_id,
            "email": email,
            "name": name,
            "username": decrypted_username,
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
