import os
from dotenv import load_dotenv

load_dotenv()

# ── AWS ────────────────────────────────────────────────────
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
DYNAMO_TABLE_NAME = os.getenv("DYNAMO_TABLE_NAME")

# ── Cognito ────────────────────────────────────────────────
COGNITO_REGION = os.getenv("COGNITO_REGION")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID")

# ── App ────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "False") == "True"

# ── Validate all required vars on startup ──────────────────
_REQUIRED = [
    "AWS_REGION",
    "S3_BUCKET_NAME",
    "DYNAMO_TABLE_NAME",
    "COGNITO_REGION",
    "COGNITO_USER_POOL_ID",
    "COGNITO_CLIENT_ID",
]

for _var in _REQUIRED:
    if not os.getenv(_var):
        raise RuntimeError(f"Missing required environment variable: {_var}")
