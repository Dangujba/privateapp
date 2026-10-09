$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "YIRS Blockchain Revenue System - Windows setup" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

$backendEnv = Join-Path $ProjectRoot 'backend\.env'
$backendExample = Join-Path $ProjectRoot 'backend\.env.example'
$frontendEnv = Join-Path $ProjectRoot 'frontend\.env'
$frontendExample = Join-Path $ProjectRoot 'frontend\.env.example'
$contractsEnv = Join-Path $ProjectRoot 'contracts\.env'
$contractsExample = Join-Path $ProjectRoot 'contracts\.env.example'

if (!(Test-Path $backendEnv)) { Copy-Item $backendExample $backendEnv }
if (!(Test-Path $frontendEnv)) { Copy-Item $frontendExample $frontendEnv }
if (!(Test-Path $contractsEnv)) { Copy-Item $contractsExample $contractsEnv }

function New-RandomSecret {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes)
}

$securePassword = Read-Host 'PostgreSQL password for user postgres' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ([string]::IsNullOrWhiteSpace($dbPassword)) { throw 'PostgreSQL password cannot be empty.' }

$encodedPassword = [uri]::EscapeDataString($dbPassword)
$accessSecret = New-RandomSecret
$refreshSecret = New-RandomSecret

$backend = Get-Content $backendEnv -Raw
$backend = [regex]::Replace($backend, '(?m)^DATABASE_URL=.*$', 'DATABASE_URL="postgresql://postgres:' + $encodedPassword + '@127.0.0.1:5432/yirs_revenue?schema=public"')
$backend = [regex]::Replace($backend, '(?m)^JWT_ACCESS_SECRET=.*$', 'JWT_ACCESS_SECRET=' + $accessSecret)
$backend = [regex]::Replace($backend, '(?m)^JWT_REFRESH_SECRET=.*$', 'JWT_REFRESH_SECRET=' + $refreshSecret)
Set-Content -Path $backendEnv -Value $backend -Encoding UTF8

$psqlCandidates = @()
$pgRoot = 'C:\Program Files\PostgreSQL'
if (Test-Path $pgRoot) {
    $psqlCandidates = Get-ChildItem $pgRoot -Directory | ForEach-Object {
        $candidate = Join-Path $_.FullName 'bin\psql.exe'
        if (Test-Path $candidate) { [PSCustomObject]@{ Version = $_.Name; Path = $candidate } }
    } | Sort-Object { try { [version]$_.Version } catch { [version]'0.0' } } -Descending
}
if (!$psqlCandidates -or $psqlCandidates.Count -eq 0) {
    throw 'PostgreSQL psql.exe was not found under C:\Program Files\PostgreSQL. Install PostgreSQL Command Line Tools.'
}

$psql = $psqlCandidates[0].Path
Write-Host "Using PostgreSQL $($psqlCandidates[0].Version): $psql" -ForegroundColor DarkGray

$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $dbPassword
try {
    $exists = (& $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='yirs_revenue';" 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Could not connect to PostgreSQL as postgres.`n$exists" }
    if ($exists -notmatch '1') {
        Write-Host "Creating PostgreSQL database 'yirs_revenue'..." -ForegroundColor Yellow
        & $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "yirs_revenue";'
        if ($LASTEXITCODE -ne 0) { throw "Failed to create database 'yirs_revenue'." }
    } else { Write-Host "Database 'yirs_revenue' already exists." -ForegroundColor Green }
}
finally { $env:PGPASSWORD = $oldPgPassword }

Write-Host 'Installing Node dependencies...' -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

Write-Host 'Creating/updating database tables...' -ForegroundColor Yellow
npm run db:setup
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed.' }

Write-Host 'Seeding YIRS demo accounts...' -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -ne 0) { throw 'Database seed failed.' }

Write-Host 'Building RevenueCollector contract...' -ForegroundColor Yellow
npm run build -w contracts
if ($LASTEXITCODE -ne 0) { throw 'RevenueCollector build failed.' }

Write-Host ''
Write-Host 'Setup completed.' -ForegroundColor Green
Write-Host 'Demo logins (password for all: 12345):'
Write-Host '  Admin:      admin@yirs-demo.test'
Write-Host '  Individual: taxpayer@yirs-demo.test'
Write-Host '  Business:   business@yirs-demo.test'
Write-Host ''
Write-Host 'Next: fund a TON testnet wallet, then run:' -ForegroundColor Cyan
Write-Host '  npm run deploy:yirs:testnet'
Write-Host 'After deployment, the new contract address will be written automatically to backend\.env.'
Write-Host 'Then start the application with: npm run dev'
