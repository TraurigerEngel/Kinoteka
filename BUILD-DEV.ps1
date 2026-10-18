param([switch]$SkipNpmCi)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '=== KINOTEKA STANDALONE v1.2 PREVIEW 1 / DEV BUILD ===' -ForegroundColor Magenta
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { throw 'Rust/rustc was not found.' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Cargo was not found.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found.' }
Write-Host ('Rust: ' + (& rustc --version))

Write-Host "`n[1/4] Dependencies..." -ForegroundColor Cyan
if (-not $SkipNpmCi -and -not (Test-Path 'node_modules')) { npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $LASTEXITCODE" } }
elseif (Test-Path 'node_modules') { Write-Host 'npm dependencies: cached' }
else { Write-Host 'npm ci skipped' }

Write-Host "`n[2/4] Verifying standalone..." -ForegroundColor Cyan
npm run verify
if ($LASTEXITCODE -ne 0) { throw "verify failed: $LASTEXITCODE" }

Write-Host "`n[3/4] Building DEV EXE..." -ForegroundColor Cyan
npm run build:dev
if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" }

Write-Host "`n[4/4] Refreshing portable DEV copy..." -ForegroundColor Cyan
# Separate clean profile: do not overwrite the existing personal DEV collection.
$portable = Join-Path $PSScriptRoot 'Portable\Kinoteka_Standalone_v1.2_Preview_1_CLEAN_DEV'
$previousClean = $null
if (Test-Path -LiteralPath $portable) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  $previous = $portable + '_previous_' + $stamp
  Move-Item -LiteralPath $portable -Destination $previous
  $previousClean = $previous
  Write-Host ('Previous CLEAN_DEV preserved at: ' + $previous)
}
New-Item -ItemType Directory -Force -Path $portable | Out-Null
$exe = Join-Path $PSScriptRoot 'src-tauri\target\release\kinoteka.exe'
if (-not (Test-Path $exe)) { throw "EXE not found: $exe" }
Copy-Item $exe (Join-Path $portable 'Kinoteka.exe') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $portable 'seed-data') | Out-Null
Copy-Item 'seed-data\kinoteka.sqlite3' (Join-Path $portable 'seed-data\kinoteka.sqlite3') -Force
$dataDir = Join-Path $portable 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$portableDb = Join-Path $dataDir 'kinoteka.sqlite3'
Copy-Item 'data\kinoteka.sqlite3' $portableDb -Force
# An old public IMDb catalog is deliberately not carried into a new build.
# Personal kinoteka.sqlite3 remains isolated in DEV/REAL_PREVIEW.
$size = [math]::Round((Get-Item (Join-Path $portable 'Kinoteka.exe')).Length / 1MB, 2)
Write-Host "Portable: $portable"
Write-Host "EXE:      $size MB"
Write-Host "`n=== DEV BUILD READY ===" -ForegroundColor Green
Write-Host 'New isolated empty CLEAN_DEV created. Existing DEV data/backups were not changed.'
