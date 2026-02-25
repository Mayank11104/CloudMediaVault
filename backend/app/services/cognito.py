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

def _force_jwks_refresh():
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
    """
    
    print("=" * 60)
    print("VERIFYING TOKEN:")
    print(f"  Token (first 50): {token[:50]}...")
    print(f"  Expected token_use: {token_use or 'any'}")
    
    try:
        jwks = get_jwks()
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        
        print(f"  Token kid: {kid}")
        
        if not kid:
            print("  ❌ ERROR: No kid in token header")
            raise HTTPException(status_code=401, detail="Invalid token")

        # Find matching public key by kid
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            print("  ⚠️  kid not found, forcing JWKS refresh...")
            # kid not found — keys may have rotated, force refresh once
            _force_jwks_refresh()
            jwks = get_jwks()
            key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
            if not key:
                print("  ❌ ERROR: kid still not found after refresh")
                raise HTTPException(status_code=401, detail="Invalid token")

        # ✅ Decode and verify
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
        )
        
        actual_token_use = payload.get("token_use")
        print(f"  Actual token_use: {actual_token_use}")
        
        # ✅ Validate token_use if specified
        if token_use and actual_token_use != token_use:
            print(f"  ❌ ERROR: Expected token_use '{token_use}', got '{actual_token_use}'")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid token type. Expected {token_use}, got {actual_token_use}"
            )
        
        print(f"  ✅ Token verified successfully")
        print(f"  User sub: {payload.get('sub')}")
        print(f"  Email: {payload.get('email')}")
        print("=" * 60)

        return payload

    except HTTPException:
        print("=" * 60)
        raise
    except JWTError as e:
        print(f"  ❌ JWT ERROR: {str(e)}")
        print("=" * 60)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        print(f"  ❌ UNEXPECTED ERROR: {str(e)}")
        print("=" * 60)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
