# Create an isolated Kinoteka REAL_PREVIEW from an existing CLEAN_DEV and a
# personally selected SQLite database. Never overwrite live or previous data.
# Example: .\PREPARE-REAL-PREVIEW.ps1 -SourceDb "D:\Backup\kinoteka.sqlite3"
# Or:      .\PREPARE-REAL-PREVIEW.ps1 -SourceArchive "D:\Backup\Kinoteka.zip"
[CmdletBinding(DefaultParameterSetName='SourceDb')]
param(
    [Parameter(Mandatory=$true,ParameterSetName='SourceDb')][string]$SourceDb,
    [Parameter(Mandatory=$true,ParameterSetName='SourceArchive')][string]$SourceArchive
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$clean=Join-Path $project 'Portable\Kinoteka_Standalone_v1.2_Preview_1_CLEAN_DEV'
$target=Join-Path $project 'Portable\Kinoteka_Standalone_v1.2_Preview_1_REAL_PREVIEW'
$stage=$target+'.stage.'+[guid]::NewGuid().ToString('N')
$tempDb=$null
$zip=$null

try {
    if (Get-Process -Name 'Kinoteka' -ErrorAction SilentlyContinue) {
        throw 'Close Kinoteka.exe before preparing REAL_PREVIEW.'
    }
    if (Test-Path -LiteralPath $target) {
        throw "REAL_PREVIEW already exists. Refusing to overwrite: $target"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $clean 'Kinoteka.exe') -PathType Leaf)) {
        throw 'CLEAN_DEV/Kinoteka.exe was not found. First run BUILD-DEV.cmd.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $clean 'data\kinoteka.sqlite3') -PathType Leaf)) {
        throw 'CLEAN_DEV is incomplete (data/kinoteka.sqlite3 is missing).'
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js 22+ is required to validate the source database.'
    }
    if ($PSCmdlet.ParameterSetName -eq 'SourceDb') {
        $chosen=(Resolve-Path -LiteralPath $SourceDb -ErrorAction Stop).Path
        if (-not (Test-Path -LiteralPath $chosen -PathType Leaf)) { throw "SourceDb is not a file: $chosen" }
        $dbPath=$chosen
    } else {
        if (-not (Test-Path -LiteralPath $SourceArchive -PathType Leaf)) {
            throw "SourceArchive not found: $SourceArchive"
        }
        Add-Type -AssemblyName System.IO.Compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archivePath=(Resolve-Path -LiteralPath $SourceArchive).Path
        $zip=[System.IO.Compression.ZipFile]::OpenRead($archivePath)
        $candidates=@($zip.Entries | Where-Object { $_.FullName.Replace('\','/') -eq 'data/kinoteka.sqlite3' })
        if ($candidates.Count -ne 1) {
            throw 'ZIP must contain exactly one data/kinoteka.sqlite3 file.'
        }
        $tempDb=Join-Path ([System.IO.Path]::GetTempPath()) ('kinoteka-real-preview-'+[guid]::NewGuid().ToString('N')+'.sqlite3')
        $entryStream=$candidates[0].Open()
        try {
            $fileStream=[System.IO.File]::Create($tempDb)
            try { $entryStream.CopyTo($fileStream) } finally { $fileStream.Dispose() }
        } finally { $entryStream.Dispose() }
        $dbPath=$tempDb
    }
    & node (Join-Path $project 'scripts\verify-sqlite-db.js') $dbPath
    if ($LASTEXITCODE -ne 0) { throw 'Source database validation failed; nothing was changed.' }
    Write-Host 'Selected DB (items/favorites/trash/revision):' -ForegroundColor Cyan
    & node (Join-Path $project 'scripts\kinoteka-db-summary.js') $dbPath
    if ($LASTEXITCODE -ne 0) { throw 'Source database summary failed.' }
    Write-Host ''

    # Copy a CLEAN_DEV snapshot into a unique staging folder. Never replace
    # installed databases, copy a historical catalog or create hidden data.
    Copy-Item -LiteralPath $clean -Destination $stage -Recurse -Force
    $stageDb=Join-Path $stage 'data\kinoteka.sqlite3'
    Copy-Item -LiteralPath $dbPath -Destination $stageDb -Force
    & node (Join-Path $project 'scripts\verify-sqlite-db.js') $stageDb
    if ($LASTEXITCODE -ne 0) { throw 'Staged REAL_PREVIEW database failed validation.' }
    if (Test-Path -LiteralPath $target) { throw 'REAL_PREVIEW appeared during preparation; refusing overwrite.' }
    Move-Item -LiteralPath $stage -Destination $target
    Write-Host "REAL_PREVIEW ready: $target" -ForegroundColor Green
    Write-Host 'Original SourceDb, SourceArchive and CLEAN_DEV are unchanged.'
} finally {
    if ($zip) { $zip.Dispose() }
    if ($tempDb -and (Test-Path -LiteralPath $tempDb)) { Remove-Item -LiteralPath $tempDb -Force }
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
