# AnalystAI Platform - Clean Start Script
# Run this script from the Rag-Data-Analysis project root directory
# This script:
# 1. Stops any running Docker containers
# 2. Clears the corrupted Next.js .next build cache
# 3. Rebuilds all Docker images from scratch
# 4. Starts the full platform

Write-Host "==> Stopping Docker containers..." -ForegroundColor Cyan
docker-compose down --remove-orphans 2>&1

Write-Host "==> Clearing corrupted .next build cache..." -ForegroundColor Cyan
if (Test-Path "frontend\.next") {
    Remove-Item -Recurse -Force "frontend\.next"
    Write-Host "    .next directory removed." -ForegroundColor Green
} else {
    Write-Host "    No .next directory found (clean state)." -ForegroundColor Green
}

Write-Host "==> Building and starting Docker containers (this may take a few minutes)..." -ForegroundColor Cyan
docker-compose up --build

Write-Host "==> Done! Platform should be running at:" -ForegroundColor Green
Write-Host "    Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "    Backend API: http://localhost:8000" -ForegroundColor Yellow
Write-Host "    API Docs: http://localhost:8000/docs" -ForegroundColor Yellow
