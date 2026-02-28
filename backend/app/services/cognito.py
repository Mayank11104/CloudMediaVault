import os
import time
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

# ── Config ─────────────────────────────────────────────────
REGION = os.getenv("COGNITO_REGION")
POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
CLIENT_ID = os.getenv("COGNITO_CLIENT_ID")

# ── Fail fast on missing config ────────────────────────────
for _var in ("COGNITO_REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"):
    if not os.getenv(_var):
        raise RuntimeError(f"Missing required env var: {_var}")

JWKS_URL = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL_ID}/.well-known/jwks.json"
ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL_ID}"

# ── JWKS cache with TTL ────────────────────────────────────
_jwks = None
_jwks_expiry = 0.0
JWKS_TTL = 3600  # re-fetch keys every 1 hour

def get_jwks() -> dict:
    """
    Fetch and cache Cognito JWKS (JSON Web Key Set).
    
    Returns:
        dict: JWKS containing public keys for token verification
        
    Raises:
        HTTPException: If JWKS cannot be fetched and no cache exists
    """
    global _jwks, _jwks_expiry
    if _jwks is None or time.time() > _jwks_expiry:
        try:
            response = httpx.get(JWKS_URL, timeout=5)
            response.raise_for_status()
            _jwks = response.json()
            _jwks_expiry = time.time() + JWKS_TTL
        except Exception:
            # If refresh fails but we have a cached copy, use it
            if _jwks is not None:
                return _jwks
            raise HTTPException(
                status_code=503,
                detail="Auth service temporarily unavailable",
            )
    return _jwks

def _force_jwks_refresh() -> None:
    """Force JWKS cache to expire on next get_jwks() call."""
    global _jwks_expiry
    _jwks_expiry = 0.0

# ── Token verification ─────────────────────────────────────
def verify_token(token: str, token_use: str = None) -> dict:
    """
    Verify a Cognito JWT token.
    
    Args:
        token: JWT token string
        token_use: Expected token_use value ('access' or 'id'). If None, accepts both.
    
    Returns:
        dict: Decoded JWT payload
        
    Raises:
        HTTPException: If token is invalid, expired, or verification fails
    """
    try:
        jwks = get_jwks()
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        
        if not kid:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Find matching public key by kid
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            # kid not found — keys may have rotated, force refresh once
            _force_jwks_refresh()
            jwks = get_jwks()
            key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token")

        # Decode and verify
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
        )
        
        # Validate token_use if specified
        if token_use:
            actual_token_use = payload.get("token_use")
            if actual_token_use != token_use:
                raise HTTPException(
                    status_code=401, 
                    detail=f"Invalid token type. Expected {token_use}, got {actual_token_use}"
                )

        return payload

    except HTTPException:
        raise
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
