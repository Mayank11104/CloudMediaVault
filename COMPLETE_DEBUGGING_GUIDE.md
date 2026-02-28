# Complete Debugging Guide - Username & Media Access Issue

## Problem Statement
Users cannot see their media after login because the username is not being properly retrieved from DynamoDB. The username is required to construct S3 paths: `users/{username}/{file_id}/{filename}`

## Root Cause Analysis

### Confirmed Facts
1. ✅ DynamoDB GSI `username-index` exists and is active (verified via AWS CLI)
2. ✅ Backend code expects username in user profiles
3. ✅ S3 storage structure requires username for file paths
4. ❓ **Most Likely Issue**: Existing user profiles in DynamoDB are missing the `username` field

### Why This Happens
- Users who signed up before the username feature was added don't have a `username` field in their DynamoDB profile
- When they log in, the backend tries to fetch the username but finds `null` or missing field
- Without username, S3 file paths cannot be constructed
- Result: Users can't access their media

## Changes Implemented

### Backend Changes (Already Done)

#### 1. Enhanced Error Handling (`backend/app/services/users.py`)
- Changed silent failures to explicit HTTPExceptions
- Clear error messages distinguish between "user not found" vs "username missing"

#### 2. Debug Logging Added
**File**: `backend/app/routers/auth.py` (lines ~195-199)
```python
print(f"[LOGIN DEBUG] User ID: {user_id}")
print(f"[LOGIN DEBUG] DB User found: {db_user is not None}")
if db_user:
    print(f"[LOGIN DEBUG] Username in DB: {db_user.get('username')}")
```

**File**: `backend/app/middleware/auth.py` (lines ~42-48)
```python
print(f"[AUTH DEBUG] User ID: {user_id}")
print(f"[AUTH DEBUG] Username cookie: {username}")
```

### Frontend Changes (Just Completed)

#### 1. Fixed Login Flow (`frontend/src/pages/Login.tsx`)
- **CRITICAL**: Now properly captures username from backend response
- Added comprehensive logging with `[SIGNIN]` and `[VERIFY]` prefixes
- Enhanced error handling with specific messages for different failure scenarios
- Validates username is present before proceeding to library

#### 2. Fixed Backend Login Service (`frontend/src/auth/cognitoService.ts`)
- **CRITICAL**: Changed return type to return username from backend
- Added detailed logging with `[LOGIN]` prefix
- Logs request/response data (with sensitive tokens redacted)
- Returns username to calling code

#### 3. Enhanced API Client (`frontend/src/lib/api.ts`)
- Added comprehensive logging with `[API]` and `[UPLOAD]` prefixes
- Logs all requests, responses, and errors
- Better visibility into token refresh flow

#### 4. Upload Queue Logging (`frontend/src/pages/Upload.tsx`)
- Added logging with `[UPLOAD QUEUE]` prefix
- Tracks each file's upload status
- Clear error messages for debugging

## Testing & Debugging Steps

### Step 1: Deploy Updated Code
```bash
# Backend (if not already deployed)
cd backend
# Deploy to EC2 (your deployment process)

# Frontend
cd frontend
npm run build
# Deploy to CloudFront (your deployment process)
```

### Step 2: Test Login Flow

1. Open browser DevTools Console (F12)
2. Navigate to your app
3. Attempt to log in with an existing user
4. Watch for log messages in console

#### Expected Logs - Successful Login
```
🔐 [SIGNIN] Starting sign in process...
🔐 [SIGNIN] Email: user@example.com
🔐 [SIGNIN] Step 1: Authenticating with Cognito...
✅ [SIGNIN] Cognito authentication successful
🔐 [SIGNIN] Step 2: Logging in to backend...
🔑 [LOGIN] Starting backend login...
🔑 [LOGIN] Username provided: (empty - will fetch from DB)
✅ [LOGIN] Backend login successful
✅ [LOGIN] Username from backend: john-cloudmediavault
✅ [SIGNIN] Sign in complete, navigating to library...
```

#### Expected Logs - Username Missing (THE ISSUE)
```
🔐 [SIGNIN] Starting sign in process...
✅ [SIGNIN] Cognito authentication successful
🔐 [SIGNIN] Step 2: Logging in to backend...
❌ [LOGIN] Backend login failed: Username not set for this account
❌ [SIGNIN] Sign in failed: Username not set for this account
```

### Step 3: Check Backend Logs

SSH into your EC2 instance and check backend logs:

```bash
# View recent logs
tail -f /path/to/your/backend/logs

# Or if using Docker
docker logs -f <container-name>

# Look for these patterns:
[LOGIN DEBUG] User ID: abc-123-def
[LOGIN DEBUG] DB User found: True
[LOGIN DEBUG] Username in DB: None  # ← THE PROBLEM
```

### Step 4: Identify the Issue

Based on the logs, you'll see one of these scenarios:

#### Scenario A: User Profile Doesn't Exist
```
[LOGIN DEBUG] User ID: abc-123-def
[LOGIN DEBUG] DB User found: False
```
**Solution**: User profile needs to be created in DynamoDB

#### Scenario B: User Profile Exists, Username Missing (MOST LIKELY)
```
[LOGIN DEBUG] User ID: abc-123-def
[LOGIN DEBUG] DB User found: True
[LOGIN DEBUG] Username in DB: None
```
**Solution**: Update existing user profiles to add username field

#### Scenario C: Username Exists But Not Returned
```
[LOGIN DEBUG] Username in DB: john-cloudmediavault
❌ [LOGIN] Backend login failed: [some other error]
```
**Solution**: Check backend code logic or cookie handling

## Fixing the Issue

### Solution 1: Update Existing User Profiles (Most Likely Needed)

If users exist but don't have usernames, you need to add the username field to their DynamoDB profiles.

#### Option A: Manual Update via AWS Console
1. Go to DynamoDB Console
2. Select `cloudmediavault-files` table
3. Find user profiles (items with `user_id` but no `username`)
4. Edit each item to add `username` field
5. Format: `{firstname}-cloudmediavault` (e.g., `john-cloudmediavault`)

#### Option B: Bulk Update Script (Python)
```python
import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
table = dynamodb.Table('cloudmediavault-files')

# Scan for users without username
response = table.scan(
    FilterExpression='attribute_not_exists(username)'
)

for item in response['Items']:
    user_id = item['user_id']
    email = item.get('email', '')
    name = item.get('name', '')
    
    # Generate username from name or email
    if name:
        username = f"{name.split()[0].lower()}-cloudmediavault"
    else:
        username = f"{email.split('@')[0].lower()}-cloudmediavault"
    
    # Update item
    table.update_item(
        Key={'user_id': user_id, 'file_id': item['file_id']},
        UpdateExpression='SET username = :username',
        ExpressionAttributeValues={':username': username}
    )
    print(f"Updated {user_id} with username: {username}")
```

### Solution 2: Create Missing User Profiles

If user profiles don't exist at all, they need to be created when users log in. The backend code already handles this for new signups with username, but existing users might need migration.

## After Fixing

### Step 1: Remove Debug Logging

Once the issue is resolved, remove debug logging from backend:

**File**: `backend/app/routers/auth.py`
- Remove lines with `[LOGIN DEBUG]` print statements

**File**: `backend/app/middleware/auth.py`
- Remove lines with `[AUTH DEBUG]` print statements

### Step 2: Verify Fix

1. Log in with a previously affected user
2. Check that username appears in logs
3. Navigate to library
4. Verify media files are visible
5. Try uploading a new file
6. Verify upload succeeds and file appears in library

### Step 3: Optional - Remove Frontend Logging

If you want cleaner console output in production, you can reduce frontend logging:
- Keep error logging (`console.error`)
- Remove or reduce info logging (`console.log`)
- Or use a logging library with log levels

## Quick Reference

### Log Prefixes
- `[SIGNIN]` - Frontend login flow
- `[VERIFY]` - Frontend signup verification
- `[LOGIN]` - Frontend backend login service
- `[API]` - Frontend API client
- `[UPLOAD]` - Frontend file upload
- `[UPLOAD QUEUE]` - Frontend upload queue
- `[LOGIN DEBUG]` - Backend login endpoint
- `[AUTH DEBUG]` - Backend auth middleware

### Key Files
**Backend**:
- `backend/app/routers/auth.py` - Login endpoint with debug logs
- `backend/app/middleware/auth.py` - Auth middleware with debug logs
- `backend/app/services/users.py` - User service with error handling

**Frontend**:
- `frontend/src/pages/Login.tsx` - Login UI with enhanced logging
- `frontend/src/auth/cognitoService.ts` - Backend login service (returns username)
- `frontend/src/lib/api.ts` - API client with logging
- `frontend/src/pages/Upload.tsx` - Upload with logging

### Documentation
- `backend/USERNAME_LOGIN_FIX.md` - Original diagnostic guide
- `backend/DEBUGGING_USERNAME_ISSUE.md` - Detailed debugging scenarios
- `backend/QUICK_FIX_CHECKLIST.md` - Fast action checklist
- `frontend/FRONTEND_LOGGING_ADDED.md` - Frontend changes summary
- `COMPLETE_DEBUGGING_GUIDE.md` - This file

## Support

If the issue persists after following this guide:
1. Collect frontend console logs
2. Collect backend server logs
3. Check DynamoDB table structure and sample items
4. Verify S3 bucket structure and permissions
5. Review the logs for any unexpected errors
