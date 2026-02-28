# Username Login Issue - Diagnosis & Fix

## Problem Description

After login, users cannot see their media files because the username is not being retrieved from DynamoDB, which is required to construct the S3 key path for fetching files.

## Root Cause Analysis

### Architecture Overview

Your system uses a **username-based S3 storage structure**:
```
S3 Path: users/{username}/{file_id}/{filename}
```

This requires the username to be available in every request that accesses files.

### Authentication Flow

#### 1. **Signup/First Login** (Working ✅)
```
User → Provides username → Stored in DynamoDB → Encrypted in cookie
```

**File**: `backend/app/routers/auth.py` (lines 186-210)
```python
if payload.username:
    username = normalize_username(payload.username)
    validate_username(username)
    user_service.create_user(user_id, email, username, name)
```

#### 2. **Subsequent Login** (BROKEN ❌)
```
User → Login → Fetch username from DynamoDB → Should be in cookie
```

**File**: `backend/app/routers/auth.py` (lines 211-218)
```python
else:
    db_user = user_service.get_user_by_id(user_id)
    if not db_user or not db_user.get("username"):
        raise HTTPException(...)
    username = db_user["username"]
```

### The Issues

#### Issue 1: Silent Error Handling in `get_user_by_username()`

**File**: `backend/app/services/users.py` (lines 84-102)

**Problem**: The function catches database errors silently and just prints them:
```python
except ClientError as e:
    print(f"Error querying username: {e}")
    return None  # ❌ Silently fails
```

**Impact**: If the DynamoDB GSI doesn't exist or has issues, the error is hidden and login appears to work but username is None.

#### Issue 2: Missing DynamoDB GSI

**Required GSI**: `username-index`
- **Partition Key**: `username` (String)
- **Purpose**: Allow querying user profiles by username

**Check if GSI exists**:
```bash
aws dynamodb describe-table --table-name YOUR_TABLE_NAME --region YOUR_REGION
```

Look for `GlobalSecondaryIndexes` section with an index named `username-index`.

#### Issue 3: Data Model Confusion

Your DynamoDB table uses a **single-table design** with two entity types:

**User Profiles**:
- PK: `user_id` (Cognito sub)
- SK: `USER#PROFILE`
- Attributes: email, username, name, vault_setup, created_at

**Files**:
- PK: `user_id` (Cognito sub)
- SK: `file_id` (UUID)
- Attributes: file_name_enc, s3_key, file_type, etc.

## The Fix

### Step 1: Improve Error Handling (COMPLETED ✅)

**File**: `backend/app/services/users.py`

Changed from silent failure to explicit error:
```python
except ClientError as e:
    error_code = e.response['Error']['Code']
    if error_code == 'ResourceNotFoundException':
        raise HTTPException(
            status_code=500,
            detail="Database configuration error: username-index GSI not found"
        )
    raise HTTPException(
        status_code=500,
        detail=f"Database error while querying username: {str(e)}"
    )
```

**File**: `backend/app/routers/auth.py`

Improved error messages to distinguish between different failure scenarios:
```python
if not db_user:
    raise HTTPException(status_code=404, detail="User profile not found")
if not db_user.get("username"):
    raise HTTPException(status_code=400, detail="Username not set")
```

### Step 2: Create DynamoDB GSI (ACTION REQUIRED ⚠️)

You need to create a Global Secondary Index on your DynamoDB table.

#### Option A: Using AWS Console

1. Go to AWS DynamoDB Console
2. Select your table (check `DYNAMO_TABLE_NAME` in your `.env`)
3. Go to "Indexes" tab
4. Click "Create index"
5. Configure:
   - **Partition key**: `username` (String)
   - **Index name**: `username-index`
   - **Projected attributes**: All
6. Click "Create index"
7. Wait for index to become ACTIVE (may take a few minutes)

#### Option B: Using AWS CLI

```bash
aws dynamodb update-table \
  --table-name YOUR_TABLE_NAME \
  --attribute-definitions AttributeName=username,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"username-index\",\"KeySchema\":[{\"AttributeName\":\"username\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"},\"ProvisionedThroughput\":{\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}}}]"
```

**Note**: Replace `YOUR_TABLE_NAME` with your actual table name from `.env` file.

#### Option C: Using Terraform/CloudFormation

If you're using Infrastructure as Code, add the GSI to your table definition:

**Terraform**:
```hcl
resource "aws_dynamodb_table" "main" {
  # ... existing configuration ...
  
  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5
  }
}
```

### Step 3: Verify the Fix

#### Test 1: Check GSI Exists
```bash
aws dynamodb describe-table \
  --table-name YOUR_TABLE_NAME \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`username-index`]'
```

Should return the GSI configuration.

#### Test 2: Test Login Flow

1. **Clear cookies** in your browser
2. **Login** with existing account
3. **Check browser console** for any errors
4. **Check backend logs** for error messages
5. **Try to access files** - should now work

#### Test 3: Verify Username in Cookie

After login, check cookies in browser DevTools:
- Cookie name: `username`
- Value: Should be encrypted (base64-like string)
- HttpOnly: true
- Secure: true (in production)

### Step 4: Verify Data Integrity

Check that all existing users have usernames:

```python
# Run this script to check
import boto3

dynamodb = boto3.resource('dynamodb', region_name='YOUR_REGION')
table = dynamodb.Table('YOUR_TABLE_NAME')

response = table.scan(
    FilterExpression='file_id = :profile',
    ExpressionAttributeValues={':profile': 'USER#PROFILE'}
)

for item in response['Items']:
    user_id = item.get('user_id')
    username = item.get('username')
    print(f"User {user_id}: username = {username}")
    if not username:
        print(f"  ⚠️  WARNING: User {user_id} has no username!")
```

## Alternative Solution (If GSI Cannot Be Created)

If you cannot create a GSI for some reason, you can modify the login flow to scan the table:

**⚠️ WARNING**: This is NOT recommended for production as it's slow and expensive.

```python
def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile by user_id (Cognito sub)."""
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
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
```

This function already exists and should work! The issue is likely that:
1. The user profile wasn't created during signup
2. The username field is missing from the profile

## Debugging Steps

### 1. Check if User Profile Exists

Add temporary logging to `auth.py` login function:

```python
else:
    db_user = user_service.get_user_by_id(user_id)
    print(f"DEBUG: Retrieved user profile: {db_user}")  # Add this
    if not db_user:
        raise HTTPException(...)
```

### 2. Check DynamoDB Directly

Use AWS Console or CLI to verify user profile:

```bash
aws dynamodb get-item \
  --table-name YOUR_TABLE_NAME \
  --key '{"user_id": {"S": "COGNITO_USER_ID"}, "file_id": {"S": "USER#PROFILE"}}'
```

### 3. Check Cookie Encryption

Verify the username cookie can be decrypted:

```python
# In auth.py, add logging
username = decrypt_value(encrypted_username)
print(f"DEBUG: Decrypted username: {username}")  # Add this
```

## Expected Behavior After Fix

### Signup Flow
1. User provides username → ✅
2. Username stored in DynamoDB → ✅
3. Username encrypted in cookie → ✅
4. Files uploaded to `users/{username}/{file_id}/` → ✅

### Login Flow
1. User logs in with Cognito → ✅
2. Backend fetches username from DynamoDB → ✅ (FIXED)
3. Username encrypted in cookie → ✅
4. Files fetched from `users/{username}/{file_id}/` → ✅

### File Access Flow
1. Request includes encrypted username cookie → ✅
2. Middleware decrypts username → ✅
3. S3 key constructed: `users/{username}/{file_id}/` → ✅
4. File retrieved from S3 → ✅

## Summary

**Root Cause**: Missing or misconfigured DynamoDB GSI (`username-index`)

**Immediate Fix**: 
1. ✅ Improved error handling (code changes applied)
2. ⚠️ Create DynamoDB GSI (requires AWS configuration)

**Testing**: After creating GSI, test login → file access flow

**Monitoring**: Check backend logs for any "username-index GSI not found" errors

## Files Modified

1. `backend/app/services/users.py` - Better error handling
2. `backend/app/routers/auth.py` - Better error messages

## Next Steps

1. **Create the DynamoDB GSI** using one of the methods above
2. **Redeploy backend** with the code changes
3. **Test login flow** with existing user
4. **Verify files are accessible** after login
5. **Monitor logs** for any remaining issues
