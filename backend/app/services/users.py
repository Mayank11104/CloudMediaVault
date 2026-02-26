# app/services/users.py
from decimal import Decimal
from boto3.dynamodb.conditions import Key
from fastapi import HTTPException
from botocore.exceptions import ClientError
from app.database import get_table
import time

def _now() -> int:
    """Return current timestamp as integer"""
    return int(time.time())

def _deserialize(item: dict) -> dict:
    """Convert DynamoDB Decimal → int/float for JSON serialization."""
    result = {}
    for k, v in item.items():
        if isinstance(v, Decimal):
            result[k] = int(v) if v == v.to_integral_value() else float(v)
        else:
            result[k] = v
    return result

# ── Create User ────────────────────────────────────────────
def create_user(email: str, username: str, user_id: str, name: str) -> dict:
    """
    Create user profile in same table as files
    Single-table design: PK=user_id, SK=USER#PROFILE
    """
    table = get_table()
    item = {
        'user_id': user_id,         # PK (Cognito sub)
        'file_id': 'USER#PROFILE',  # SK (distinguishes from files)
        'email': email,
        'username': username,
        'name': name,
        'vault_setup': False,
        'created_at': _now(),
    }
    
    try:
        table.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(user_id) AND attribute_not_exists(file_id)'
        )
        return _deserialize(item)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            raise HTTPException(status_code=400, detail="User already exists")
        raise HTTPException(status_code=500, detail="Failed to create user")

# ── Get User by ID ─────────────────────────────────────────
def get_user_by_id(user_id: str) -> dict | None:
    """
    Get user profile by user_id (Cognito sub)
    """
    table = get_table()
    
    try:
        response = table.get_item(
            Key={
                'user_id': user_id,
                'file_id': 'USER#PROFILE'
            }
        )
        item = response.get('Item')
        return _deserialize(item) if item else None
    except ClientError:
        return None

# ── Get User by Username (GSI) ─────────────────────────────
def get_user_by_username(username: str) -> dict | None:
    """
    Query user by username using GSI
    Returns user dict if found, None otherwise
    """
    table = get_table()
    
    try:
        response = table.query(
            IndexName='username-index',  # GSI name (needs to be created)
            KeyConditionExpression=Key('username').eq(username)
        )
        
        items = response.get('Items', [])
        return _deserialize(items[0]) if items else None
    except ClientError as e:
        # If GSI doesn't exist yet, return None
        print(f"Error querying username: {e}")
        return None

# ── Check Username Availability ────────────────────────────
def is_username_available(username: str) -> bool:
    """
    Check if username is available (not taken)
    """
    user = get_user_by_username(username)
    return user is None
