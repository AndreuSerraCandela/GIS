# Script para probar web.config directamente
# Ejecutar en el SERVIDOR

Write-Host "🧪 Probando configuración de web.config..." -ForegroundColor Cyan
Write-Host ""

$webConfigPath = Join-Path $PSScriptRoot "web.config"
if (-not (Test-Path $webConfigPath)) {
    Write-Host "❌ web.config NO existe en: $webConfigPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Leyendo web.config..." -ForegroundColor Yellow
$content = Get-Content $webConfigPath -Raw

# Extraer processPath
$processPathMatch = [regex]::Match($content, 'processPath="([^"]+)"')
if (-not $processPathMatch.Success) {
    Write-Host "❌ No se encontró processPath en web.config" -ForegroundColor Red
    exit 1
}

$pythonPath = $processPathMatch.Groups[1].Value
Write-Host "   Ruta de Python: $pythonPath" -ForegroundColor Gray

if (-not (Test-Path $pythonPath)) {
    Write-Host "❌ Python NO existe en: $pythonPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  ACTUALIZA web.config con la ruta correcta" -ForegroundColor Yellow
    Write-Host "   Para encontrar Python, ejecuta: where python" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Python existe" -ForegroundColor Green

# Extraer arguments
$argumentsMatch = [regex]::Match($content, 'arguments="([^"]+)"')
if ($argumentsMatch.Success) {
    $arguments = $argumentsMatch.Groups[1].Value
    Write-Host "   Arguments: $arguments" -ForegroundColor Gray
}

# Probar ejecutar Python directamente
Write-Host ""
Write-Host "🧪 Probando ejecutar Python..." -ForegroundColor Yellow
try {
    $version = & $pythonPath --version 2>&1
    Write-Host "   ✅ Python funciona: $version" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Error ejecutando Python: $_" -ForegroundColor Red
    exit 1
}

# Probar ejecutar wsgi.py directamente
Write-Host ""
Write-Host "🧪 Probando ejecutar wsgi.py directamente..." -ForegroundColor Yellow
$wsgiPath = Join-Path $PSScriptRoot "wsgi.py"
if (-not (Test-Path $wsgiPath)) {
    Write-Host "   ❌ wsgi.py NO existe en: $wsgiPath" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ wsgi.py existe" -ForegroundColor Green

# Probar con test_proceso_simple.py primero
Write-Host ""
Write-Host "🧪 Probando con script simple..." -ForegroundColor Yellow
$testScript = Join-Path $PSScriptRoot "test_proceso_simple.py"
$env:HTTP_PLATFORM_PORT = "8086"

Write-Host "   Ejecutando: $pythonPath -u $testScript" -ForegroundColor Gray
Write-Host "   (Esto debería mostrar mensajes y quedarse ejecutándose)" -ForegroundColor Gray
Write-Host "   Presiona Ctrl+C después de ver los mensajes" -ForegroundColor Gray
Write-Host ""

try {
    & $pythonPath -u $testScript
}
catch {
    Write-Host ""
    Write-Host "   ❌ Error ejecutando script: $_" -ForegroundColor Red
    exit 1
}

