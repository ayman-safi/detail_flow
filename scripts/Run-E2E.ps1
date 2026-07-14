[CmdletBinding()]
param(
    [string]$ConnectionString = "Host=127.0.0.1;Port=5432;Database=detailflow_e2e;Username=detailflow;Password=detailflow",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$databaseMatch = [regex]::Match($ConnectionString, "(?i)(?:^|;)\s*Database\s*=\s*([^;]+)")
if (-not $databaseMatch.Success) {
    throw "ConnectionString must contain a Database value."
}

$databaseName = $databaseMatch.Groups[1].Value.Trim()
if ($databaseName -notmatch "(?i)(e2e|test)") {
    throw "Refusing to reset '$databaseName'. The database name must contain 'e2e' or 'test'."
}

$root = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $root "DetailFlow.Api\DetailFlow.Api.csproj"
$webProject = Join-Path $root "detailflow-web"
$env:DB_CONNECTION_STRING = $ConnectionString
$env:E2E_DB_CONNECTION_STRING = $ConnectionString

function Invoke-Checked([scriptblock]$Command, [string]$Description) {
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

Push-Location $root
try {
    Invoke-Checked { dotnet restore .\DetailFlow.sln } "dotnet restore"
    Invoke-Checked { dotnet ef database update 0 --project $apiProject --startup-project $apiProject } "database schema reset"
    Invoke-Checked { dotnet ef database update --project $apiProject --startup-project $apiProject } "database migration"
    Invoke-Checked { dotnet build .\DetailFlow.sln --no-restore } "solution build"
    Invoke-Checked { dotnet test .\DetailFlow.sln --no-build --no-restore } ".NET test suite"

    Push-Location $webProject
    try {
        if (-not $SkipInstall) {
            Invoke-Checked { npm ci } "npm install"
            Invoke-Checked { npx playwright install chromium } "Chromium install"
        }
        Invoke-Checked { npm run build } "frontend build"
        Invoke-Checked { npm run test:e2e } "Playwright suite"
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
