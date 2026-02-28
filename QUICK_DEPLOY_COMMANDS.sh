#!/bin/bash
# Quick Deploy Commands for Backend Fix

echo "🚀 Deploying Backend Fix..."
echo ""

# Navigate to backend directory
cd ~/CloudMediaVault/backend

echo "📦 Stopping current container..."
docker-compose down

echo "🔨 Rebuilding with new code..."
docker-compose build

echo "▶️  Starting container..."
docker-compose up -d

echo "✅ Checking status..."
docker ps | grep cloudmediavault-backend

echo ""
echo "📋 Recent logs:"
docker logs cloudmediavault-backend --tail 20

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test by visiting your app and going to /library"
echo "   Files should now load without 500 errors"
