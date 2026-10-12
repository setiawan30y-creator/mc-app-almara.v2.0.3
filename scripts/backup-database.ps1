param(
    [string]$Database = "almara_mc",
    [string]$User = "almara_user",
    [string]$BackupDir = "storage/app/backups"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $BackupDir "$Database-$stamp.sql"

mysqldump --single-transaction --routines --triggers -u $User -p $Database | Out-File -FilePath $target -Encoding utf8

Write-Host "Backup database selesai: $target"
