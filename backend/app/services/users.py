# app/services/users.py
from decimal import Decimal
from typing import Dict, Any, Optional
from boto3.dynamodb.conditions import Key
from fastapi import HTTPException
from botocore.exceptions import ClientError
from app.database import get_table
import time

def _now() -> int:
    """
    Return current timestamp as integer.
    
    Returns:
        int: Current Unix timestamp
    """
    return int(time.time())

def _deserialize(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DynamoDB Decimal → int/float for JSON serialization.
    
    Args:
        item: DynamoDB item with potential Decimal values
        
    Returns:
        dict: Item with Decimals converted to int/float
    """
    result = {}
    for k, v in item.items():
        if isinstance(v, Decimal):
            result[k] = int(v) if v == v.to_integral_value() else float(v)
        else:
            result[k] = v
    return result

# ── Create User ────────────────────────────────────────────
def create_user(email: str, username: str, user_id: str, name: str) -> Dict[str, Any]:
    """
    Create user profile in DynamoDB.
    Single-table design: PK=user_id, SK=USER#PROFILE
    
    Args:
        email: User's email address
        username: Unique username
        user_id: Cognito sub (user ID)
        name: User's display name
        
    Returns:
        dict: Created user profile
        
    Raises:
        HTTPException: If user already exists or database error
    """
    table = get_table()
    item = {
        'user_id': user_id,
        'file_id': 'USER#PROFILE',
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
def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user profile by user_id (Cognito sub).
    
    Args:
        user_id: Cognito sub (user ID)
        
    Returns:
        dict or None: User profile if found, None otherwise
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
def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """
    Query user by username using GSI.
    
    Args:
        username: Username to search for
        
    Returns:
        dict or None: User profile if found, None otherwise
    """
    table = get_table()
    
    try:
        response = table.query(
            IndexName='username-index',
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
    Check if username is available (not taken).
    
    Args:
        username: Username to check
        
    Returns:
        bool: True if available, False if taken
    """
    user = get_user_by_username(username)
    return user is None
