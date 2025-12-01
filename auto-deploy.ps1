# Auto Deploy Script for Emerald ERP
# This script uses plink (PuTTY) for SSH connection

$server = "147.45.146.149"
$user = "root"
$password = "qWyaS2A?zg,CBa"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "     EMERALD ERP - AUTOMATIC DEPLOYMENT" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if plink exists
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
if (-not (Test-Path $plinkPath)) {
    Write-Host "PuTTY не найден. Скачиваю plink..." -ForegroundColor Yellow
    $plinkUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe"
    $plinkPath = "$PSScriptRoot\plink.exe"
    Invoke-WebRequest -Uri $plinkUrl -OutFile $plinkPath
    Write-Host "plink скачан!" -ForegroundColor Green
}

Write-Host "Подключаюсь к серверу $server..." -ForegroundColor Yellow

# Commands to execute on server
$commands = @"
echo '🚀 Starting deployment...'
cd /root
rm -f deploy-initial.sh
wget -q https://raw.githubusercontent.com/NX-company/Emerald-ERP-/main/deploy-initial.sh
chmod +x deploy-initial.sh
./deploy-initial.sh
"@

# Execute commands via plink
echo "y" | & $plinkPath -ssh -pw $password ${user}@${server} $commands

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✅ ДЕПЛОЙ ЗАВЕРШЕН!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Приложение доступно по адресу:" -ForegroundColor Cyan
Write-Host "http://$server" -ForegroundColor White
Write-Host ""
Write-Host "Данные для входа:" -ForegroundColor Cyan
Write-Host "Логин: Admin" -ForegroundColor White
Write-Host "Пароль: Bereg2025" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Green