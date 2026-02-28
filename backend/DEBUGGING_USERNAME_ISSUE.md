# Debugging Username Login Issue

## Good News! ✅

Your DynamoDB table structure is **correct**:
- ✅ GSI `username-index` exists
- ✅ Primary keys configured properly
- ✅ Username attribute defined

## The Real Problem

Since the database is configured correctly, the issue is in the **data or flow**. Here's how to debug:

## Step 1: Check Backend Logs

I've added debug logging to help identify the issue. After redeploying, check your backend logs for these messages:

### During Login:
```
[LOGIN DEBUG] User ID: <cognito-sub>
[LOGIN DEBUG] DB User found: True/False
[LOGIN DEBUG] Username in DB: <username or None>
```

### During File Access:
```
[AUTH DEBUG] User ID: <cognito-sub>
[AUTH DEBUG] Username cookie exists: True/False
[AUTH DEBUG] Decrypted username: <username or None>
```

## Step 2: Identify the Scenario

Based on the logs, you'll see one of these scenarios:

### Scenario A: User Profile Not Found
```
[LOGIN DEBUG] User ID: abc123
[LOGIN DEBUG] DB User found: False
```

**Cause**: User profile was never created in DynamoDB during signup.

**Solution**: User needs to sign up again with username, or you need to manually create their profile.

### Scenario B: Username Missing from Profile
```
[LOGIN DEBUG] User ID: abc123
[LOGIN DEBUG] DB User found: True
[LOGIN DEBUG] Username in DB: None
```

**Cause**: User profile exists but username field is empty.

**Solution**: Update existing user profiles to add username (see Step 3).

### Scenario C: Username Cookie Not Set
```
[AUTH DEBUG] User ID: abc123
[AUTH DEBUG] Username cookie exists: False
```

**Cause**: Login succeeded but username cookie wasn't set.

**Solution**: Check cookie settings (domain, secure flag, samesite).

### Scenario D: Username Cookie Can't Be Decrypted
```
[AUTH DEBUG] User ID: abc123
[AUTH DEBUG] Username cookie exists: True
[AUTH DEBUG] Failed to decrypt username: <error>
```

**Cause**: Cookie encryption key changed or cookie corrupted.

**Solution**: Clear cookies and login again.

## Step 3: Fix Existing Users Without Usernames

If you have users who signed up before the username feature was added, you need to update their profiles.

### Option 1: Manual Update via AWS Console

1. Go to DynamoDB Console
2. Select table: `cloudmediavault-files`
3. Click "Explore table items"
4. Filter: `file_id = USER#PROFILE`
5. For each user without username:
   - Click "Edit"
   - Add attribute: `username` (String)
   - Set value to desired username
   - Save

### Option 2: Bulk Update Script

Create a Python script to update all users:

```python
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
table = dynamodb.Table('cloudmediavault-files')

# Find all user profiles without username
response = table.scan(
    FilterExpression=Attr('file_id').eq('USER#PROFILE') & Attr('username').not_exists()
)

print(f"Found {len(response['Items'])} users without username")

for user in response['Items']:
    user_id = user['user_id']
    email = user.get('email', 'unknown')
    
    # Generate username from email (or ask user to provide)
    suggested_username = email.split('@')[0].lower().replace('.', '_')
    
    print(f"\nUser: {email}")
    print(f"  User ID: {user_id}")
    print(f"  Suggested username: {suggested_username}")
    
    # Uncomment to actually update:
    # username = input("Enter username (or press Enter to use suggested): ").strip()
    # if not username:
    #     username = suggested_username
    # 
    # table.update_item(
    #     Key={'user_id': user_id, 'file_id': 'USER#PROFILE'},
    #     UpdateExpression='SET username = :u',
    #     ExpressionAttributeValues={':u': username}
    # )
    # print(f"  ✅ Updated with username: {username}")
```

### Option 3: Force Re-signup

Ask users to:
1. Logout completely
2. Clear browser cookies
3. Sign up again with username

## Step 4: Verify User Profile Structure

Check a user profile in DynamoDB should look like this:

```json
{
  "user_id": "abc123-cognito-sub",
  "file_id": "USER#PROFILE",
  "email": "user@example.com",
  "username": "johndoe",
  "name": "John Doe",
  "vault_setup": false,
  "created_at": 1234567890
}
```

**Check via AWS CLI**:
```bash
aws dynamodb get-item \
  --table-name cloudmediavault-files \
  --region eu-west-1 \
  --key '{"user_id": {"S": "YOUR_COGNITO_SUB"}, "file_id": {"S": "USER#PROFILE"}}'
```

## Step 5: Test the Complete Flow

### Test 1: New User Signup
1. Create new Cognito user
2. Login with username provided
3. Check DynamoDB - profile should exist with username
4. Upload a file
5. Logout and login again
6. Verify file is visible

### Test 2: Existing User Login
1. Login with existing account
2. Check backend logs for debug messages
3. Check browser cookies - should have encrypted username
4. Try to access files
5. Check if S3 key is constructed correctly

### Test 3: File Upload
1. Login
2. Upload a file
3. Check S3 - file should be at: `users/{username}/{file_id}/{filename}`
4. Check DynamoDB - file record should have username field

## Step 6: Check Cookie Configuration

Verify cookies are being set correctly:

### In Browser DevTools (Application → Cookies):

**Expected cookies after login**:
1. `access_token` - HttpOnly, Secure (prod), SameSite=None
2. `id_token` - HttpOnly, Secure (prod), SameSite=None
3. `refresh_token` - HttpOnly, Secure (prod), SameSite=None
4. `username` - HttpOnly, Secure (prod), SameSite=None, **encrypted value**

### Common Cookie Issues:

**Issue**: Cookies not being set
- Check `COOKIE_SECURE` in `.env` (should be `True` in production)
- Check domain matches between frontend and backend
- Check CORS configuration in `main.py`

**Issue**: Cookies being cleared
- Check cookie `max_age` settings
- Check if browser is blocking third-party cookies
- Check SameSite policy

## Step 7: Check S3 Key Construction

When files are uploaded, the S3 key should be:
```
users/{username}/{file_id}/{filename}
```

**Verify in `files.py` upload endpoint**:
```python
s3_key = s3.make_s3_key(
    username=username,  # ← This must not be None
    file_id=file_id,
    file_name=safe_filename,
)
```

If `username` is `None`, the S3 key will be:
```
users/None/{file_id}/{filename}  # ❌ Wrong!
```

## Step 8: Common Issues & Solutions

### Issue 1: "Username missing for user" Error

**Symptom**: Error during file upload
```
HTTPException: Username missing for user
```

**Cause**: `get_current_user()` returned `username=None`

**Debug**:
1. Check if username cookie exists in browser
2. Check backend logs for `[AUTH DEBUG]` messages
3. Verify cookie can be decrypted

**Solution**:
- If cookie missing: User needs to logout and login again
- If decryption fails: Check `COOKIE_ENCRYPTION_KEY` hasn't changed

### Issue 2: "User profile not found" Error

**Symptom**: Error during login
```
HTTPException: User profile not found in database
```

**Cause**: No DynamoDB record with `file_id=USER#PROFILE` for this user

**Solution**:
- User needs to complete signup with username
- Or manually create profile in DynamoDB

### Issue 3: Files Not Visible After Login

**Symptom**: Login succeeds but no files shown

**Debug**:
1. Check if files exist in S3 under `users/{username}/`
2. Check if username in cookie matches username in S3 path
3. Check DynamoDB file records have correct `username` field

**Possible Causes**:
- Files uploaded with different username
- Username changed after files were uploaded
- S3 key mismatch

**Solution**:
- Check S3 bucket structure
- Verify file records in DynamoDB
- May need to migrate files to new username path

### Issue 4: CORS Errors

**Symptom**: Cookies not being sent from frontend

**Check `main.py` CORS config**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://d2zi12cq7o7ep8.cloudfront.net",
    ],
    allow_credentials=True,  # ← Must be True
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 9: Remove Debug Logging (After Fixing)

Once the issue is resolved, remove the debug print statements:

**In `auth.py`** (lines ~195-199):
```python
# Remove these lines:
print(f"[LOGIN DEBUG] User ID: {user_id}")
print(f"[LOGIN DEBUG] DB User found: {db_user is not None}")
if db_user:
    print(f"[LOGIN DEBUG] Username in DB: {db_user.get('username')}")
```

**In `middleware/auth.py`** (lines ~42-48):
```python
# Remove these lines:
print(f"[AUTH DEBUG] User ID: {user_id}")
print(f"[AUTH DEBUG] Username cookie exists: True")
print(f"[AUTH DEBUG] Decrypted username: {decrypted_username}")
# ... and the else block
```

## Quick Checklist

- [ ] DynamoDB GSI `username-index` exists ✅ (Already confirmed)
- [ ] User profile exists in DynamoDB with `file_id=USER#PROFILE`
- [ ] User profile has `username` field populated
- [ ] Login sets username cookie (check browser DevTools)
- [ ] Username cookie can be decrypted
- [ ] File upload receives username from `get_current_user()`
- [ ] S3 files stored at `users/{username}/{file_id}/`
- [ ] File records in DynamoDB have `username` field
- [ ] CORS allows credentials
- [ ] Cookie settings correct (HttpOnly, Secure, SameSite)

## Next Steps

1. **Redeploy backend** with debug logging
2. **Login** and check backend logs
3. **Identify scenario** from logs
4. **Apply appropriate fix** from above
5. **Test file upload/access**
6. **Remove debug logging** once fixed

## Need More Help?

If the issue persists after following these steps, provide:
1. Backend logs showing `[LOGIN DEBUG]` and `[AUTH DEBUG]` messages
2. Browser DevTools screenshot showing cookies after login
3. DynamoDB item for user profile (with sensitive data redacted)
4. S3 bucket structure showing file paths
