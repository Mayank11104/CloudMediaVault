# Quick Fix Checklist - Username Login Issue

## ✅ What's Already Done

1. **DynamoDB GSI exists** - `username-index` is configured correctly
2. **Code improvements** - Better error handling added
3. **Debug logging** - Added to identify the exact issue

## 🔧 What You Need To Do Now

### Step 1: Redeploy Backend (5 minutes)

```bash
# Navigate to backend directory
cd backend

# If using Docker:
docker-compose down
docker-compose up --build -d

# If running directly:
# Kill the current process and restart
uvicorn app.main:app --reload
```

### Step 2: Test Login & Check Logs (2 minutes)

1. **Clear browser cookies** completely
2. **Login** to your application
3. **Check backend logs** for these messages:

```
[LOGIN DEBUG] User ID: <your-cognito-sub>
[LOGIN DEBUG] DB User found: True/False
[LOGIN DEBUG] Username in DB: <username or None>
```

### Step 3: Identify Your Scenario

Based on the logs, you'll see one of these:

#### Scenario A: `DB User found: False`
**Problem**: User profile doesn't exist in DynamoDB

**Fix**: 
```bash
# Check if profile exists
aws dynamodb get-item \
  --table-name cloudmediavault-files \
  --region eu-west-1 \
  --key '{"user_id": {"S": "YOUR_COGNITO_SUB"}, "file_id": {"S": "USER#PROFILE"}}'

# If not found, user needs to signup again with username
```

#### Scenario B: `DB User found: True` but `Username in DB: None`
**Problem**: Profile exists but username field is missing

**Fix**: Update the user profile in DynamoDB
```bash
aws dynamodb update-item \
  --table-name cloudmediavault-files \
  --region eu-west-1 \
  --key '{"user_id": {"S": "YOUR_COGNITO_SUB"}, "file_id": {"S": "USER#PROFILE"}}' \
  --update-expression "SET username = :u" \
  --expression-attribute-values '{":u": {"S": "your-desired-username"}}'
```

#### Scenario C: Everything looks good in logs
**Problem**: Username cookie not being set or retrieved

**Fix**: Check browser DevTools → Application → Cookies
- Should see `username` cookie with encrypted value
- If missing, check CORS and cookie settings

### Step 4: Test File Access (1 minute)

After fixing:
1. **Logout** completely
2. **Clear cookies** again
3. **Login** with the account
4. **Try to access files** or **upload a new file**
5. **Check if files are visible**

### Step 5: Verify S3 Structure (Optional)

Check your S3 bucket structure:
```bash
aws s3 ls s3://YOUR_BUCKET_NAME/users/ --recursive | head -20
```

Should see paths like:
```
users/johndoe/abc-123-uuid/photo.jpg
users/janedoe/def-456-uuid/video.mp4
```

NOT like:
```
users/None/abc-123-uuid/photo.jpg  ❌ Wrong!
```

## 🎯 Most Likely Issue

Based on your description, the most likely scenario is **Scenario B**:
- User profile exists in DynamoDB
- But `username` field is missing or `None`
- This happens if users signed up before username feature was added

## 🚀 Quick Fix for Scenario B

If you have existing users without usernames, run this script:

```python
import boto3

dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
table = dynamodb.Table('cloudmediavault-files')

# Get your user ID from Cognito
user_id = "YOUR_COGNITO_SUB"  # Replace with actual value

# Update with username
table.update_item(
    Key={'user_id': user_id, 'file_id': 'USER#PROFILE'},
    UpdateExpression='SET username = :u',
    ExpressionAttributeValues={':u': 'your-username'}  # Choose a username
)

print("✅ Username updated!")
```

## 📊 Expected Results After Fix

### Login Response:
```json
{
  "message": "Logged in successfully",
  "user": {
    "sub": "abc123...",
    "email": "user@example.com",
    "name": "John Doe",
    "username": "johndoe"  ← Should be present
  }
}
```

### Browser Cookies:
- `access_token` ✅
- `id_token` ✅
- `refresh_token` ✅
- `username` ✅ (encrypted value)

### File Upload:
- S3 path: `users/johndoe/{file-id}/filename.jpg` ✅
- DynamoDB record includes `username: "johndoe"` ✅

### File Retrieval:
- Files visible in UI ✅
- Presigned URLs work ✅

## ⚠️ Important Notes

1. **Username must be unique** - Check if username is already taken before updating
2. **Username format** - Must match regex: `^[a-z0-9_\-]{3,50}$`
3. **Existing files** - If user already uploaded files with a different username, you may need to migrate them
4. **Cookie encryption** - Don't change `COOKIE_ENCRYPTION_KEY` after users have logged in

## 🔍 Still Not Working?

If the issue persists:

1. **Share backend logs** showing the `[LOGIN DEBUG]` messages
2. **Share browser cookies** (screenshot from DevTools)
3. **Share DynamoDB user profile** (with sensitive data redacted)
4. **Share any error messages** from frontend or backend

Then refer to `DEBUGGING_USERNAME_ISSUE.md` for detailed troubleshooting.

## 📝 After Everything Works

1. **Remove debug logging** from code (see `DEBUGGING_USERNAME_ISSUE.md` Step 9)
2. **Test with multiple users** to ensure it works consistently
3. **Update any existing users** who don't have usernames
4. **Document the username requirement** for new signups

## 🎉 Success Criteria

- ✅ Login succeeds without errors
- ✅ Username appears in login response
- ✅ Username cookie is set in browser
- ✅ Files can be uploaded successfully
- ✅ Uploaded files are visible in UI
- ✅ S3 paths include correct username
- ✅ No "Username missing" errors
