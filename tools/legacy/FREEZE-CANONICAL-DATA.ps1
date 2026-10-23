[CmdletBinding()]
param(
  [switch]$AllowTrash
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $ProjectRoot

function Get-Sha256Hex {
  param([Parameter(Mandatory=$true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = $sha.ComputeHash($stream) }
    finally { $sha.Dispose() }
  }
  finally { $stream.Dispose() }
  return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
}

function Assert-NoSqliteSidecars {
  param([Parameter(Mandatory=$true)][string]$DbPath)
  foreach ($suffix in @('-wal','-shm','-journal')) {
    $sidecar = $DbPath + $suffix
    if (Test-Path -LiteralPath $sidecar) {
      throw ('SQLite sidecar exists: {0}. Close Kinoteka cleanly and retry.' -f $sidecar)
    }
  }
}

function Invoke-SqliteVerify {
  param([Parameter(Mandatory=$true)][string]$DbPath)
  & node --no-warnings (Join-Path $ProjectRoot 'scripts\verify-sqlite-db.js') $DbPath
  if ($LASTEXITCODE -ne 0) { throw ('SQLite verifier failed for {0} (exit {1}).' -f $DbPath,$LASTEXITCODE) }
}

function Read-DbSummary {
  param([Parameter(Mandatory=$true)][string]$DbPath)
  $json = & node --no-warnings (Join-Path $ProjectRoot 'scripts\kinoteka-db-summary.js') $DbPath
  if ($LASTEXITCODE -ne 0) { throw ('DB summary failed for {0} (exit {1}).' -f $DbPath,$LASTEXITCODE) }
  return ($json | Out-String | ConvertFrom-Json)
}

$portableDb = Join-Path $ProjectRoot 'Portable\Kinoteka_Standalone_v1.2_Preview_1_DEV\data\kinoteka.sqlite3'
$liveDb = Join-Path $ProjectRoot 'data\kinoteka.sqlite3'
$seedDb = Join-Path $ProjectRoot 'seed-data\kinoteka.sqlite3'
$stageRoot = Join-Path $ProjectRoot '.canonical-freeze-stage'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $ProjectRoot ('CanonicalDataBackups\before-freeze-' + $stamp)
$backupCreated = $false

Write-Host '=== KINOTEKA CANONICAL DATA FREEZE ===' -ForegroundColor Magenta
Write-Host 'Source: confirmed Portable DEV live SQLite'
Write-Host 'Target: project data + seed-data (byte-identical canonical pair)'
Write-Host ''

foreach ($tool in @('node','npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw ($tool + ' was not found.') }
}
if (Get-Process -Name 'Kinoteka' -ErrorAction SilentlyContinue) {
  throw 'Kinoteka is still running. Close the application before freezing canonical data.'
}
foreach ($path in @($portableDb,$liveDb,$seedDb)) {
  if (-not (Test-Path -LiteralPath $path)) { throw ('Required SQLite file is missing: {0}' -f $path) }
  Assert-NoSqliteSidecars -DbPath $path
}

Write-Host '[1/6] Verifying Portable DEV source...' -ForegroundColor Cyan
Invoke-SqliteVerify -DbPath $portableDb
$summary = Read-DbSummary -DbPath $portableDb
if ([int]$summary.items -ne 0 -or [int]$summary.favorites -ne 0 -or [int]$summary.trash -ne 0 -or [int]$summary.revision -ne 0) {
  throw 'Privacy guard: a populated Portable DEV database must never be promoted to project data/seed-data. Only empty database templates are allowed.'
}
& node --no-warnings (Join-Path $ProjectRoot 'scripts\verify-empty-db.js') $portableDb
if ($LASTEXITCODE -ne 0) { throw 'Privacy guard rejected freeze source.' }
Write-Host ('Portable DEV: {0} items, {1} favorites, {2} trash, revision {3}' -f $summary.items,$summary.favorites,$summary.trash,$summary.revision)
if ([int]$summary.trash -gt 0 -and -not $AllowTrash) {
  throw ('Portable DEV Trash is not empty ({0} item(s)). Clean/restore Trash first, or intentionally rerun FREEZE-CANONICAL-DATA.ps1 -AllowTrash.' -f $summary.trash)
}

$sourceHash = Get-Sha256Hex -Path $portableDb
$liveHashBefore = Get-Sha256Hex -Path $liveDb
$seedHashBefore = Get-Sha256Hex -Path $seedDb
if ($sourceHash -eq $liveHashBefore -and $sourceHash -eq $seedHashBefore) {
  Write-Host '[2/6] Canonical pair already matches Portable DEV; no copy needed.' -ForegroundColor Yellow
  Write-Host '[3/6] Backup skipped (no data change).' -ForegroundColor Yellow
  Write-Host '[4/6] Canonical replacement skipped.' -ForegroundColor Yellow
  Write-Host '[5/6] Verifying canonical pair...' -ForegroundColor Cyan
  Invoke-SqliteVerify -DbPath $liveDb
  Invoke-SqliteVerify -DbPath $seedDb
  Write-Host '[6/6] Running full project verifier...' -ForegroundColor Cyan
  & npm.cmd run verify
  if ($LASTEXITCODE -ne 0) { throw ('Project verifier failed with exit code {0}.' -f $LASTEXITCODE) }
  Write-Host ''
  Write-Host '=== CANONICAL DATA ALREADY FROZEN / VERIFY OK ===' -ForegroundColor Green
  Write-Host ('SHA-256: ' + $sourceHash)
  exit 0
}

Write-Host '[2/6] Backing up current canonical pair...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path (Join-Path $backupRoot 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backupRoot 'seed-data') | Out-Null
Copy-Item -LiteralPath $liveDb -Destination (Join-Path $backupRoot 'data\kinoteka.sqlite3') -Force
Copy-Item -LiteralPath $seedDb -Destination (Join-Path $backupRoot 'seed-data\kinoteka.sqlite3') -Force
$backupCreated = $true

try {
  Write-Host '[3/6] Staging and verifying new canonical pair...' -ForegroundColor Cyan
  if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
  New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot 'data') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot 'seed-data') | Out-Null
  $stageLive = Join-Path $stageRoot 'data\kinoteka.sqlite3'
  $stageSeed = Join-Path $stageRoot 'seed-data\kinoteka.sqlite3'
  Copy-Item -LiteralPath $portableDb -Destination $stageLive -Force
  Copy-Item -LiteralPath $portableDb -Destination $stageSeed -Force
  Invoke-SqliteVerify -DbPath $stageLive
  Invoke-SqliteVerify -DbPath $stageSeed
  if ((Get-Sha256Hex -Path $stageLive) -ne (Get-Sha256Hex -Path $stageSeed)) { throw 'Staged live/seed copies are not byte-identical.' }

  Write-Host '[4/6] Replacing project live + seed canonical data...' -ForegroundColor Cyan
  Copy-Item -LiteralPath $stageLive -Destination $liveDb -Force
  Copy-Item -LiteralPath $stageSeed -Destination $seedDb -Force

  Write-Host '[5/6] Verifying canonical pair...' -ForegroundColor Cyan
  Assert-NoSqliteSidecars -DbPath $liveDb
  Assert-NoSqliteSidecars -DbPath $seedDb
  Invoke-SqliteVerify -DbPath $liveDb
  Invoke-SqliteVerify -DbPath $seedDb
  $liveHash = Get-Sha256Hex -Path $liveDb
  $seedHash = Get-Sha256Hex -Path $seedDb
  if ($liveHash -ne $seedHash -or $liveHash -ne $sourceHash) { throw 'Canonical live/seed/source SHA-256 mismatch after freeze.' }

  Write-Host '[6/6] Running full project verifier...' -ForegroundColor Cyan
  & npm.cmd run verify
  if ($LASTEXITCODE -ne 0) { throw ('Project verifier failed with exit code {0}.' -f $LASTEXITCODE) }

  Write-Host ''
  Write-Host '=== CANONICAL DATA FREEZE READY / VERIFY OK ===' -ForegroundColor Green
  Write-Host ('Items:     {0}' -f $summary.items)
  Write-Host ('Favorites: {0}' -f $summary.favorites)
  Write-Host ('Trash:     {0}' -f $summary.trash)
  Write-Host ('Revision:  {0}' -f $summary.revision)
  Write-Host ('SHA-256:   {0}' -f $sourceHash)
  Write-Host ('Backup:    {0}' -f $backupRoot)
}
catch {
  Write-Host ''
  Write-Host 'Freeze failed. Restoring previous canonical pair...' -ForegroundColor Red
  if ($backupCreated) {
    Copy-Item -LiteralPath (Join-Path $backupRoot 'data\kinoteka.sqlite3') -Destination $liveDb -Force
    Copy-Item -LiteralPath (Join-Path $backupRoot 'seed-data\kinoteka.sqlite3') -Destination $seedDb -Force
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
}
