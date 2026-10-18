param([switch]$SkipNpmCi)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Get-Sha256Hex {
  param([Parameter(Mandatory=$true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hash = $sha.ComputeHash($stream)
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
  return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
}

$releaseName = 'Kinoteka_Standalone_v1.2_Preview_1'
$out = Join-Path $PSScriptRoot ('Release\' + $releaseName)
$manifestPath = Join-Path $PSScriptRoot 'src-tauri\Cargo.toml'
$lockPath = Join-Path $PSScriptRoot 'src-tauri\Cargo.lock'
if (Test-Path -LiteralPath $out) { throw 'Release v1.2 Preview 1 output already exists. Refusing to overwrite a possibly used SQLite database. Use a fresh source folder.' }

Write-Host '=== KINOTEKA STANDALONE v1.2 PREVIEW 1 / RELEASE BUILD ===' -ForegroundColor Magenta

foreach ($tool in @('rustc','cargo','npm','node')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool was not found." }
}
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'src-tauri\Cargo.toml is required for release builds.' }
if (-not (Test-Path -LiteralPath $lockPath)) { throw 'Cargo.lock is required for release builds.' }

Write-Host "`n[1/5] Locked dependencies..." -ForegroundColor Cyan
if (-not $SkipNpmCi) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $LASTEXITCODE" }
} elseif (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
  throw 'node_modules is missing while -SkipNpmCi was requested.'
} else {
  Write-Host 'npm ci skipped; cached node_modules will be used.'
}
cargo metadata --locked --format-version 1 --no-deps --manifest-path $manifestPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "cargo metadata --locked failed: $LASTEXITCODE" }
$lockBefore = Get-Sha256Hex -Path $lockPath

Write-Host "`n[2/5] Verifying source..." -ForegroundColor Cyan
npm run verify
if ($LASTEXITCODE -ne 0) { throw "verify failed: $LASTEXITCODE" }

Write-Host "`n[3/5] Building release EXE..." -ForegroundColor Cyan
npm run build:release
if ($LASTEXITCODE -ne 0) { throw "build failed: $LASTEXITCODE" }
$lockAfter = Get-Sha256Hex -Path $lockPath
if ($lockBefore -ne $lockAfter) { throw 'Cargo.lock changed during release build.' }

Write-Host "`n[4/5] Creating clean portable directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $out | Out-Null

$exe = Join-Path $PSScriptRoot 'src-tauri\target\release\kinoteka.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "EXE not found: $exe" }
Copy-Item -LiteralPath $exe -Destination (Join-Path $out 'Kinoteka.exe') -Force

foreach ($kind in @('data','seed-data')) {
  $src = Join-Path $PSScriptRoot ($kind + '\kinoteka.sqlite3')
  $dstDir = Join-Path $out $kind
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  Copy-Item -LiteralPath $src -Destination (Join-Path $dstDir 'kinoteka.sqlite3') -Force
}

Write-Host "`n[5/5] Verifying portable artifact..." -ForegroundColor Cyan
node --no-warnings scripts\verify-release-artifact.js $out
if ($LASTEXITCODE -ne 0) { throw "release artifact verification failed: $LASTEXITCODE" }

$size = [math]::Round((Get-Item -LiteralPath (Join-Path $out 'Kinoteka.exe')).Length / 1MB, 2)
Write-Host "`n=== RELEASE PORTABLE READY ===" -ForegroundColor Green
Write-Host "Portable: $out"
Write-Host "EXE:      $size MB"
