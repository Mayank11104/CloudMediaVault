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
                # Debug logging - remove after fixing
                print(f"[AUTH DEBUG] User ID: {user_id}")
                print(f"[AUTH DEBUG] Username cookie exists: True")
                print(f"[AUTH DEBUG] Decrypted username: {decrypted_username}")
            except Exception as e:
                print(f"[AUTH DEBUG] Failed to decrypt username: {str(e)}")
                raise HTTPException(status_code=401, detail="Invalid username session")
        else:
            print(f"[AUTH DEBUG] User ID: {user_id}")
            print(f"[AUTH DEBUG] Username cookie exists: False")

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
