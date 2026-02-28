# Deploy Backend Fix - Step by Step

## Current Situation
Your Docker container is running the OLD code. The fix I made to `backend/app/services/dynamo.py` is not yet deployed.

## Quick Deploy Steps

### Option 1: Rebuild and Restart Docker (Recommended)
```bash
# SSH to your EC2 instance
cd ~/CloudMediaVault/backend

# Stop the current container
docker-compose down

# Rebuild the image with the new code
docker-compose build

# Start the container
docker-compose up -d

# Verify it's running
docker ps

# Check logs to confirm no errors
docker logs cloudmediavault-backend --tail 50
```

### Option 2: Quick Restart (if code is already on server)
```bash
cd ~/CloudMediaVault/backend

# Pull latest code from git (if you pushed changes)
git pull

# Restart container
docker-compose restart

# Check logs
docker logs cloudmediavault-backend --tail 50
```

### Option 3: Manual Docker Commands
```bash
cd ~/CloudMediaVault/backend

# Stop container
docker stop cloudmediavault-backend

# Remove container
docker rm cloudmediavault-backend

# Rebuild image
docker build -t backend-fastapi .

# Run new container
docker run -d \
  --name cloudmediavault-backend \
  -p 8000:80 \
  --env-file .env \
  backend-fastapi

# Check logs
docker logs cloudmediavault-backend --tail 50
```

## Verify the Fix

### 1. Check Container is Running
```bash
docker ps
```
Should show `cloudmediavault-backend` with status "Up"

### 2. Test the API Directly
```bash
# Test file list endpoint (replace with your actual API URL)
curl -X GET "http://localhost:8000/api/files" \
  -H "Cookie: access_token=YOUR_TOKEN" \
  -v
```

### 3. Check from Browser
1. Open your app
2. Navigate to `/library`
3. Open browser console (F12)
4. Look for:
   - ✅ `200 OK` response for `/api/files`
   - ✅ Files should load
   - ❌ No more `500 Internal Server Error`

## What Changed
The fix modifies `backend/app/services/dynamo.py`:
- The `_deserialize()` function now automatically decrypts `file_name_enc` → `file_name`
- This fixes all file listing endpoints

## Troubleshooting

### Container Won't Start
```bash
# Check logs for errors
docker logs cloudmediavault-backend

# Check if port 8000 is already in use
sudo lsof -i :8000

# If port is in use, kill the process
sudo kill -9 <PID>
```

### Still Getting 500 Error
```bash
# Verify the code change is in the container
docker exec cloudmediavault-backend cat /app/app/services/dynamo.py | grep "file_name_enc"

# Should see the decryption code in _deserialize function
```

### Environment Variables Missing
```bash
# Check .env file exists
ls -la ~/CloudMediaVault/backend/.env

# Verify container has env vars
docker exec cloudmediavault-backend env | grep AWS
```

## Expected Result
After deploying:
- ✅ `/api/files` returns 200 OK
- ✅ Files list shows with proper filenames
- ✅ Library page loads without errors
- ✅ No more `ResponseValidationError`

## Next Steps
Once backend is deployed and working:
1. Deploy frontend (for logging)
2. Test login flow
3. Check for username issues (if any)
