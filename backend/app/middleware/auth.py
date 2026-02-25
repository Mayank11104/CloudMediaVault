# app/middleware/auth.py
import jwt
import time
from fastapi import Cookie, HTTPException

async def get_current_user(
    id_token: str = Cookie(None),
):
    """Extract user from httpOnly ID token"""
    
    if not id_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Decode without signature verification
        payload = jwt.decode(
            id_token,
            options={"verify_signature": False}
        )
        
        # Check expiration
        if payload.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Extract claims
        user_id = payload.get("sub")
        email = payload.get("email")
        name = payload.get("name")
        
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {
            "sub": user_id,      # ✅ Use "sub" instead of "user_id"
            "email": email,
            "name": name or "Unknown",
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
