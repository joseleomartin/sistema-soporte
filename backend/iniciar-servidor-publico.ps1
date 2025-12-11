# Script PowerShell para iniciar servidor y exponerlo públicamente
# Uso: .\iniciar-servidor-publico.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " SERVIDOR DE EXTRACTORES - ACCESO PUBLICO" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si cloudflared está instalado
$cloudflaredInstalled = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflaredInstalled) {
    Write-Host "ERROR: cloudflared no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instálalo con:" -ForegroundColor Yellow
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor White
    Write-Host ""
    Write-Host "O descarga desde:" -ForegroundColor Yellow
    Write-Host "  https://github.com/cloudflare/cloudflared/releases" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Configurar puerto
$env:PORT = 5000

# Activar entorno virtual si existe
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activando entorno virtual..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

Write-Host ""
Write-Host "Iniciando servidor Flask en puerto $env:PORT..." -ForegroundColor Green
Write-Host "URL Local: http://localhost:$env:PORT" -ForegroundColor White
Write-Host ""

# Iniciar servidor en background
$serverJob = Start-Job -ScriptBlock {
    param($port)
    $env:PORT = $port
    python server.py
} -ArgumentList $env:PORT

Write-Host "Servidor iniciado (Job ID: $($serverJob.Id))" -ForegroundColor Green

# Esperar a que el servidor inicie
Write-Host "Esperando a que el servidor inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verificar que el servidor responda
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$env:PORT/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Servidor respondiendo correctamente" -ForegroundColor Green
} catch {
    Write-Host "⚠ Advertencia: El servidor podría no estar respondiendo aún" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " INICIANDO TUNEL CLOUDFLARE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tu servidor estará disponible en una URL pública" -ForegroundColor White
Write-Host "La URL aparecerá a continuación..." -ForegroundColor White
Write-Host ""
Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Iniciar túnel de Cloudflare
try {
    cloudflared tunnel --url "http://localhost:$env:PORT"
} finally {
    # Limpiar: detener el servidor cuando se cierre el túnel
    Write-Host ""
    Write-Host "Deteniendo servidor..." -ForegroundColor Yellow
    Stop-Job -Id $serverJob.Id
    Remove-Job -Id $serverJob.Id
    Write-Host "Servidor detenido" -ForegroundColor Green
}


















