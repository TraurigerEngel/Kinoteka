Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

Add-Type -AssemblyName System.IO.Compression.FileSystem

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

function New-ZipFromDirectory {
  param(
    [Parameter(Mandatory=$true)][string]$SourceDir,
    [Parameter(Mandatory=$true)][string]$DestinationZip
  )
  if (Test-Path -LiteralPath $DestinationZip) {
    Remove-Item -LiteralPath $DestinationZip -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $SourceDir,
    $DestinationZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
}

function Expand-ZipToDirectory {
  param(
    [Parameter(Mandatory=$true)][string]$ZipPath,
    [Parameter(Mandatory=$true)][string]$DestinationDir
  )
  if (Test-Path -LiteralPath $DestinationDir) {
    Remove-Item -LiteralPath $DestinationDir -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationDir)
}

$releaseName = 'Kinoteka_Standalone_v1.2.1_Stable'
$portable = Join-Path $PSScriptRoot ('Release\' + $releaseName)
$artifacts = Join-Path $PSScriptRoot 'Artifacts\Kinoteka_v1.2.1_Stable'
$portableZip = Join-Path $artifacts ($releaseName + '_Portable.zip')
$sourceZip = Join-Path $artifacts ($releaseName + '_Source.zip')
$sourceStage = Join-Path $PSScriptRoot '.stable-v121-release-source-stage'
$verifyStage = Join-Path $PSScriptRoot '.stable-v121-release-verify-stage'
$sourceVerifyStage = Join-Path $PSScriptRoot '.stable-v121-release-source-verify-stage'

if (Test-Path -LiteralPath $artifacts) { throw 'Artifacts directory already exists. Refusing to overwrite archives. Use a fresh source folder.' }
if (Test-Path -LiteralPath $portable) { throw 'Release directory already exists. Refusing to overwrite SQLite. Use a fresh source folder.' }
Write-Host '=== KINOTEKA STANDALONE v1.2.1 STABLE / FINAL RELEASE ===' -ForegroundColor Magenta

& (Join-Path $PSScriptRoot 'BUILD-RELEASE-v1.2.1.ps1') -SkipNpmCi
if ($LASTEXITCODE -ne 0) { throw "BUILD-RELEASE-v1.2.1 failed: $LASTEXITCODE" }

New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
foreach ($tmp in @($sourceStage,$verifyStage,$sourceVerifyStage)) {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
}

Write-Host "`n[1/4] Packing portable ZIP..." -ForegroundColor Cyan
New-ZipFromDirectory -SourceDir $portable -DestinationZip $portableZip

Write-Host "`n[2/4] Packing clean source ZIP..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null
foreach ($dir in @('app','scripts','test-data','docs','tools')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $dir) -Destination (Join-Path $sourceStage $dir) -Recurse -Force
}
foreach ($dbdir in @('data','seed-data')) {
  $d = Join-Path $sourceStage $dbdir
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot ($dbdir + '\kinoteka.sqlite3')) -Destination (Join-Path $d 'kinoteka.sqlite3') -Force
}
$srcTauriStage = Join-Path $sourceStage 'src-tauri'
New-Item -ItemType Directory -Force -Path $srcTauriStage | Out-Null
foreach ($file in @('build.rs','Cargo.toml','Cargo.lock','tauri.conf.json','tauri.release.conf.json')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('src-tauri\' + $file)) -Destination (Join-Path $srcTauriStage $file) -Force
}
foreach ($dir in @('src','icons','gen')) {
  $src = Join-Path $PSScriptRoot ('src-tauri\' + $dir)
  if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $srcTauriStage $dir) -Recurse -Force }
}

$rootFiles = @(
  '.gitignore','package.json','package-lock.json',
  'BUILD-DEV.cmd','BUILD-DEV.ps1',
  'BUILD-RELEASE-v1.2.1.ps1','MAKE-FINAL-RELEASE-v1.2.1.ps1',
  'BUILD-RELEASE-v1.2.1.cmd','MAKE-FINAL-RELEASE-v1.2.1.cmd',
  'START-HERE.txt','README.md','CHANGELOG.md',
  'RELEASE_NOTES_v1.2.1_STABLE.md','RELEASE-CHECKLIST.md',
  'LICENSE','THIRD_PARTY_NOTICES.md','GITHUB_PRIVACY_RU.md','README-PORTABLE.txt'
)
foreach ($file in $rootFiles) {
  $src = Join-Path $PSScriptRoot $file
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw "Required source file missing: $file" }
  Copy-Item -LiteralPath $src -Destination (Join-Path $sourceStage $file)
}
Push-Location -LiteralPath $sourceStage
try {
  npm run verify
  if ($LASTEXITCODE -ne 0) { throw "source staging full verification failed: $LASTEXITCODE" }
} finally { Pop-Location }
New-ZipFromDirectory -SourceDir $sourceStage -DestinationZip $sourceZip

Write-Host "`n[3/4] Re-extracting and verifying ZIPs..." -ForegroundColor Cyan
Expand-ZipToDirectory -ZipPath $portableZip -DestinationDir $verifyStage
node --no-warnings scripts\verify-release-artifact.js $verifyStage --with-docs
if ($LASTEXITCODE -ne 0) { throw "re-extracted portable verification failed: $LASTEXITCODE" }

Expand-ZipToDirectory -ZipPath $sourceZip -DestinationDir $sourceVerifyStage
Push-Location -LiteralPath $sourceVerifyStage
try {
  npm run verify
  if ($LASTEXITCODE -ne 0) { throw "re-extracted source full verification failed: $LASTEXITCODE" }
} finally { Pop-Location }

Write-Host "`n[4/4] Writing hashes and metadata..." -ForegroundColor Cyan
$portableHash = Get-Sha256Hex -Path $portableZip
$sourceHash = Get-Sha256Hex -Path $sourceZip
$exeHash = Get-Sha256Hex -Path (Join-Path $portable 'Kinoteka.exe')
$reextractedExeHash = Get-Sha256Hex -Path (Join-Path $verifyStage 'Kinoteka.exe')
if ($exeHash -ne $reextractedExeHash) { throw 'EXE hash mismatch after ZIP re-extraction.' }
@(
  "$portableHash  $([IO.Path]::GetFileName($portableZip))",
  "$sourceHash  $([IO.Path]::GetFileName($sourceZip))"
) | Set-Content -LiteralPath (Join-Path $artifacts 'SHA256SUMS.txt') -Encoding ASCII

$meta = [ordered]@{
  product = 'Kinoteka Standalone'
  version = '1.2.1'
  channel = 'Stable'
  packaging_revision = 2
  release = 'v1.2.1 Stable (HF60)'
  generated_at = (Get-Date).ToString('o')
  portable_sha256 = $portableHash
  source_sha256 = $sourceHash
  exe_sha256 = $exeHash
}
$meta | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $artifacts 'RELEASE-METADATA.json') -Encoding UTF8

foreach ($tmp in @($sourceStage,$verifyStage,$sourceVerifyStage)) {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
}

Write-Host "`n=== FINAL RELEASE READY ===" -ForegroundColor Green
Write-Host "Portable ZIP: $portableZip"
Write-Host "Source ZIP:   $sourceZip"
Write-Host "SHA256SUMS:   $(Join-Path $artifacts 'SHA256SUMS.txt')"
