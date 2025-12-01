#!/bin/bash
set -e

echo "🚀 Starting safe deployment..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/emerald-erp"
BACKUP_DIR="/var/www/emerald-erp-backup-$(date +%Y%m%d-%H%M%S)"
HEALTH_URL="http://localhost:3000/api/users"

# Navigate to app directory
cd $APP_DIR

# 1. Check if git repo is clean
echo -e "${YELLOW}📋 Checking git status...${NC}"
git fetch origin

# 2. Backup current dist
echo -e "${YELLOW}💾 Creating backup...${NC}"
if [ -d "dist" ]; then
  mkdir -p $BACKUP_DIR
  cp -r dist $BACKUP_DIR/
  cp package.json $BACKUP_DIR/
  cp package-lock.json $BACKUP_DIR/
  echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
else
  echo -e "${YELLOW}⚠️  No dist directory to backup${NC}"
fi

# 3. Pull latest code
echo -e "${YELLOW}📥 Pulling latest code from Git...${NC}"
git pull origin main

# 4. Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --production=false

# 5. Build application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
  echo -e "${RED}❌ Build failed! dist/index.js not found${NC}"
  echo -e "${YELLOW}🔄 Rolling back...${NC}"
  if [ -d "$BACKUP_DIR/dist" ]; then
    rm -rf dist
    cp -r $BACKUP_DIR/dist .
  fi
  exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# 6. Test current app health (before restart)
echo -e "${YELLOW}🏥 Testing current app health...${NC}"
if curl -f $HEALTH_URL > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Current app is healthy${NC}"
  WAS_HEALTHY=true
else
  echo -e "${YELLOW}⚠️  Current app is down or unhealthy${NC}"
  WAS_HEALTHY=false
fi

# 7. Restart PM2
echo -e "${YELLOW}🔄 Restarting PM2...${NC}"
pm2 reload emerald-erp --update-env

# Wait for app to start
echo -e "${YELLOW}⏳ Waiting for app to start (10 seconds)...${NC}"
sleep 10

# 8. Health check new deployment
echo -e "${YELLOW}🏥 Testing new deployment health...${NC}"
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo -e "${GREEN}✓ New deployment is healthy!${NC}"

    # Clean up old backup
    if [ -d "$BACKUP_DIR" ]; then
      echo -e "${YELLOW}🧹 Cleaning up backup...${NC}"
      rm -rf $BACKUP_DIR
    fi

    # Show PM2 status
    pm2 status

    echo -e "${GREEN}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Deployment completed successfully!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"

    exit 0
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -e "${YELLOW}⚠️  Health check failed (attempt $RETRY_COUNT/$MAX_RETRIES)${NC}"
  sleep 5
done

# Health check failed - rollback
echo -e "${RED}❌ New deployment failed health check!${NC}"

if [ -d "$BACKUP_DIR/dist" ]; then
  echo -e "${YELLOW}🔄 Rolling back to previous version...${NC}"

  rm -rf dist
  cp -r $BACKUP_DIR/dist .

  pm2 reload emerald-erp

  sleep 5

  if curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Rollback successful - previous version restored${NC}"
  else
    echo -e "${RED}❌ Rollback failed - manual intervention required!${NC}"
    echo -e "${YELLOW}Backup location: $BACKUP_DIR${NC}"
  fi
else
  echo -e "${RED}❌ No backup available for rollback!${NC}"
  echo -e "${YELLOW}Manual intervention required!${NC}"
fi

exit 1
