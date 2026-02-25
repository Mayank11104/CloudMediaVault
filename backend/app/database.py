# app/database.py
import boto3
from app.config import AWS_REGION, DYNAMO_TABLE_NAME, COGNITO_REGION


# ── DynamoDB ───────────────────────────────────────────────
_dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def get_table():
    """Returns the main DynamoDB table singleton."""
    return _dynamodb.Table(DYNAMO_TABLE_NAME)

# ── S3 ─────────────────────────────────────────────────────
s3_client = boto3.client('s3', region_name=AWS_REGION)

# ── Cognito ────────────────────────────────────────────────
from app.config import COGNITO_REGION
cognito_client = boto3.client('cognito-idp', region_name=COGNITO_REGION)
