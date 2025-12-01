$projectPath = Join-Path $env:USERPROFILE 'Desktop\Emerald ERP'
Set-Location $projectPath
$env:NODE_ENV = 'development'
$env:PORT = '5000'
Write-Host "Starting Emerald ERP on port 5000..."
Write-Host "Open http://localhost:5000 in your browser"
Write-Host "Working directory: $projectPath"
& npm run dev

