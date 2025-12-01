param(
    [int]$Port = 5000
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Emerald ERP Development Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = Join-Path $env:USERPROFILE 'Desktop\Emerald ERP'

if (-not (Test-Path $projectPath)) {
    Write-Host "ERROR: Project directory not found at: $projectPath" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Set-Location $projectPath
Write-Host "Working directory: $projectPath" -ForegroundColor Green
Write-Host ""

$env:NODE_ENV = 'development'
$env:PORT = $Port.ToString()

Write-Host "Starting server on port $Port..." -ForegroundColor Yellow
Write-Host "URL: http://localhost:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

try {
    & npm run dev
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to start server" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

