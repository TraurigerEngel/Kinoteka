Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$seed = Join-Path $root 'seed-data\kinoteka.sqlite3'
$live = Join-Path $root 'data\kinoteka.sqlite3'
$expected = '772905b6dac60f266bbc0ea131e085802dcf0b3f41b8f20b5bf23d4bfb90d436'
if (-not (Test-Path -LiteralPath $seed -PathType Leaf)) { throw 'Clean Kinoteka demo seed is missing.' }
$actual = (Get-FileHash -LiteralPath $seed -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Clean demo seed SHA mismatch: refusing initialization.' }
if (Test-Path -LiteralPath $live) {
  Write-Host 'An existing local Kinoteka database was NOT modified.' -ForegroundColor Green
  exit 0
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $live) | Out-Null
Copy-Item -LiteralPath $seed -Destination $live -ErrorAction Stop
Write-Host 'Kinoteka demo database initialized (0 movies, 0 favorites).' -ForegroundColor Green
