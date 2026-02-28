# Action Plan - Deploy Fixes

## Current Status

### ✅ Code Fixes Complete
1. **File List 500 Error** - Fixed in `backend/app/services/dynamo.py`
2. **Username Login Issue** - Debug logging added to backend and frontend
3. **Frontend Logging** - Comprehensive logging added throughout

### ⚠️ Deployment Blocked
Your CI/CD pipeline runs successfully, but the container still uses old code because of a volume mount in `docker-compose.yml`.

## The Problem

Your `docker-compose.yml` has this line:
```yaml
volumes:
  - .:/app
```

This mounts your local filesystem into the container, which overrides the Docker image code. So even though CI/CD builds a new image with the fixes, the running container uses the old code from the mounted directory.

## Solution: Remove Volume Mount

### Option 1: Push to Main Branch (Recommended)

1. **Remove the volume mount** from `docker-compose.yml`:

```yaml
version: '3.8'
services:
  fastapi:
    build: .
    container_name: cloudmediavault-backend
    ports:
      - "8000:80"
    restart: always
    env_file:
      - .env
    # volumes:
    #   - .:/app  # REMOVED - let Docker image code run
```

2. **Commit and push to main**:
```bash
git add backend/docker-compose.yml
git commit -m "fix: remove volume mount to use Docker image code"
git push origin main
```

3. **CI/CD will automatically deploy** - Your GitHub Actions workflow will:
   - Pull latest code
   - Stop containers
   - Build new image (with fixes)
   - Start containers (now using image code, not mounted files)

### Option 2: Quick Manual Fix (If Urgent)

If you need the fix immediately without waiting for CI/CD:

```bash
# SSH to EC2
ssh user@your-ec2-host

# Navigate to backend
cd ~/CloudMediaVault/backend

# Edit docker-compose.yml to remove volume mount
nano docker-compose.yml
# (comment out or remove the volumes section)

# Restart containers
docker-compose down
docker-compose build
docker-compose up -d

# Verify
docker logs cloudmediavault-backend --tail 50
```

## After Deployment

### 1. Test File List Fix
1. Open your app
2. Navigate to `/library`
3. Files should now load (no 500 error)
4. Filenames should be readable

### 2. Test Username Login Issue
1. Open browser console (F12)
2. Log in with an existing user
3. Look for these logs:

**Frontend Console:**
```
🔐 [SIGNIN] Starting sign in process...
✅ [SIGNIN] Cognito authentication successful
🔑 [LOGIN] Starting backend login...
✅ [LOGIN] Username from backend: [username]
```

**Backend Logs (SSH to EC2):**
```bash
docker logs cloudmediavault-backend | grep "LOGIN DEBUG"
```

Look for:
```
[LOGIN DEBUG] User ID: abc-123
[LOGIN DEBUG] DB User found: True
[LOGIN DEBUG] Username in DB: [username or None]
```

### 3. If Username is Missing

If logs show `Username in DB: None`, you need to update DynamoDB user profiles:

**Quick Fix via AWS Console:**
1. Go to DynamoDB Console
2. Select `cloudmediavault-files` table
3. Find user items (look for items with `user_id`)
4. Add `username` field to each user
5. Format: `{firstname}-cloudmediavault`

### 4. Clean Up Debug Logging

Once everything works, remove debug logging:
- `backend/app/routers/auth.py` - Remove `[LOGIN DEBUG]` print statements
- `backend/app/middleware/auth.py` - Remove `[AUTH DEBUG]` print statements

## Expected Results

After deployment:
- ✅ Library page loads files without 500 errors
- ✅ Filenames display correctly
- ✅ Login flow shows username in logs
- ✅ Users can access their media
- ✅ File uploads work correctly

## Need Help?

If issues persist:
1. Share frontend console logs (F12)
2. Share backend logs: `docker logs cloudmediavault-backend --tail 100`
3. Check if volume mount was actually removed: `docker inspect cloudmediavault-backend | grep Mounts`

## Files Changed

**Backend:**
- `backend/app/services/dynamo.py` - File decryption fix
- `backend/app/routers/auth.py` - Debug logging
- `backend/app/middleware/auth.py` - Debug logging
- `backend/docker-compose.yml` - Volume mount needs removal

**Frontend:**
- `frontend/src/pages/Login.tsx` - Enhanced logging
- `frontend/src/auth/cognitoService.ts` - Fixed username return
- `frontend/src/lib/api.ts` - API logging
- `frontend/src/pages/Upload.tsx` - Upload logging
