param(
  [string]$Branch = "main",
  [string]$CommitMessage = "Prepare backend login deployment package",
  [string]$BackendProject = "football-performance-funds-backend",
  [string]$FrontendProject = "football-performance-fund-frontend",
  [string]$BackendUrl = "https://football-performance-funds-backend.vercel.app",
  [string]$AdminEmail = "admin@footballperformancefund.com",
  [string]$AdminPassword = $env:FPF_ADMIN_PASSWORD
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
  $AdminPassword = "ChooseAStrongPassword123!"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$reportPath = Join-Path $root "docs\latest-deploy-result.txt"
$results = [ordered]@{}
$warnings = New-Object System.Collections.Generic.List[string]
$script:FatalError = $null
$script:DebugFailedStage = $null
$backendEnvFile = Join-Path $root ".env.production.local"

function Initialize-Report {
  $reportDir = Split-Path $reportPath -Parent
  if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
  }

  $header = @(
    "Football Performance Fund Production Deploy Result",
    "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "Project root: $root",
    "Backend URL: $BackendUrl",
    "Admin email tested: $AdminEmail",
    "",
    "IMPORTANT: This file intentionally does not print passwords or secret values.",
    ""
  )

  Set-Content -Path $reportPath -Value $header -Encoding UTF8
}

function Add-ReportLine {
  param([string]$Line = "")
  Add-Content -Path $reportPath -Value $Line -Encoding UTF8
}

function Add-ReportSection {
  param([string]$Title)
  Add-ReportLine ""
  Add-ReportLine "## $Title"
}

function Add-Warning {
  param([string]$Warning)

  if ([string]::IsNullOrWhiteSpace($Warning)) {
    return
  }

  $warnings.Add($Warning) | Out-Null
  Add-ReportLine "WARNING: $Warning"
}

function To-ReportJson {
  param($Value)
  if ($null -eq $Value) {
    return "<null>"
  }

  try {
    return ($Value | ConvertTo-Json -Depth 12)
  } catch {
    return [string]$Value
  }
}

function Get-ErrorDetail {
  param($ErrorRecord)

  $details = [ordered]@{
    message = $ErrorRecord.Exception.Message
    errorDetails = $ErrorRecord.ErrorDetails.Message
    responseBody = $null
    statusCode = $null
  }

  try {
    if ($ErrorRecord.Exception.Response) {
      $details.statusCode = [int]$ErrorRecord.Exception.Response.StatusCode
      $stream = $ErrorRecord.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $details.responseBody = $reader.ReadToEnd()
      }
    }
  } catch {
    $details.responseBody = "Unable to read response body: $($_.Exception.Message)"
  }

  return [pscustomobject]$details
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
  Add-ReportSection $Message
}

function Set-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ""
  )

  $results[$Name] = [pscustomobject]@{
    Passed = $Passed
    Detail = $Detail
  }

  $status = if ($Passed) { "PASS" } else { "FAIL" }
  $color = if ($Passed) { "Green" } else { "Red" }

  Write-Host "$status $Name" -ForegroundColor $color
  Add-ReportLine "$status $Name"

  if (-not [string]::IsNullOrWhiteSpace($Detail)) {
    Write-Host "     $Detail"
    Add-ReportLine $Detail
  }
}

function Invoke-LoggedCommand {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Add-ReportLine ""
  Add-ReportLine "### Command: $Name"

  try {
    $global:LASTEXITCODE = 0
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $output = @(& $Command 2>&1)
      $exitCode = $global:LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($output.Count -gt 0) {
      $output | ForEach-Object {
        $line = [string]$_
        Add-ReportLine $line
        if ($line -match '^\s*warning:|^\s*WARN(ING)?:') {
          Add-Warning $line
        }
      }
    } else {
      Add-ReportLine "<no output>"
    }

    if ($exitCode -ne 0) {
      throw "$Name exited with code $exitCode."
    }

    Set-Result $Name $true
    return $output
  } catch {
    $errorDetail = Get-ErrorDetail $_
    Add-ReportLine "ERROR:"
    Add-ReportLine (To-ReportJson $errorDetail)
    Set-Result $Name $false $errorDetail.message
    throw
  }
}

function Get-GitStatusShort {
  return @(git status --short)
}

function Invoke-VercelDeploy {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Project
  )

  Push-Location $Path
  try {
    $projectFile = Join-Path (Get-Location) ".vercel\project.json"
    $linkedProject = $null

    if (Test-Path $projectFile) {
      try {
        $linkedProject = (Get-Content $projectFile -Raw | ConvertFrom-Json).projectName
      } catch {
        $linkedProject = $null
      }
    }

    Add-ReportLine "$Name path: $(Get-Location)"
    Add-ReportLine "$Name linked project before deploy: $linkedProject"
    Add-ReportLine "$Name target project: $Project"

    if ($linkedProject -ne $Project) {
      Add-ReportLine "Linking Vercel project '$Project'..."
      npx vercel link --project $Project --yes
      if ($LASTEXITCODE -ne 0) {
        throw "Vercel link failed for project '$Project' with exit code $LASTEXITCODE."
      }
    }

    npx vercel --prod
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel production deploy failed for project '$Project' with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Import-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Environment file not found: $Path"
  }

  $imported = New-Object System.Collections.Generic.List[string]
  foreach ($rawLine in Get-Content $Path) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
    $imported.Add($name) | Out-Null
  }

  Add-ReportLine "Imported environment variables from ${Path}:"
  foreach ($name in $imported) {
    Add-ReportLine "  $name=<configured>"
  }
}

function Ensure-BackendProductionEnvironment {
  if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    Add-ReportLine "DATABASE_URL already available in the current PowerShell process."
    return
  }

  Add-ReportLine "DATABASE_URL is not available locally. Pulling backend production env from Vercel."
  Invoke-LoggedCommand "Pull backend production env" {
    npx vercel env pull $backendEnvFile --environment=production --yes
  }

  Import-DotEnvFile -Path $backendEnvFile

  if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    throw "DATABASE_URL is still missing after pulling backend production environment variables."
  }
}

function Sync-DefaultAdminPassword {
  Add-ReportLine "Admin email to seed: $AdminEmail"
  $passwordSource = if ($env:FPF_ADMIN_PASSWORD) { "FPF_ADMIN_PASSWORD" } else { "script default" }
  Add-ReportLine "Admin password source: $passwordSource"

  Ensure-BackendProductionEnvironment

  $previousDefaultAdminEmail = $env:DEFAULT_ADMIN_EMAIL
  $previousDefaultAdminPassword = $env:DEFAULT_ADMIN_PASSWORD
  try {
    $env:DEFAULT_ADMIN_EMAIL = $AdminEmail
    $env:DEFAULT_ADMIN_PASSWORD = $AdminPassword

    Invoke-LoggedCommand "Seed default admin password hash" {
      npm run seed:admin -w backend
    }
  } finally {
    $env:DEFAULT_ADMIN_EMAIL = $previousDefaultAdminEmail
    $env:DEFAULT_ADMIN_PASSWORD = $previousDefaultAdminPassword
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Name,
    [string]$Uri,
    [string]$Method = "Get",
    [object]$Body = $null
  )

  Add-ReportLine ""
  Add-ReportLine "### Request: $Name"
  Add-ReportLine "$Method $Uri"

  try {
    $parameters = @{
      Uri = $Uri
      Method = $Method
      TimeoutSec = 30
    }

    if ($null -ne $Body) {
      $parameters.ContentType = "application/json"
      $parameters.Body = ($Body | ConvertTo-Json -Depth 8)
    }

    $response = Invoke-RestMethod @parameters
    Add-ReportLine "Response:"
    Add-ReportLine (To-ReportJson $response)
    return [pscustomobject]@{
      Ok = $true
      Response = $response
      Error = $null
    }
  } catch {
    $errorDetail = Get-ErrorDetail $_
    Add-ReportLine "ERROR:"
    Add-ReportLine (To-ReportJson $errorDetail)
    return [pscustomobject]@{
      Ok = $false
      Response = $null
      Error = $errorDetail
    }
  }
}

function Write-FinalSummary {
  Add-ReportSection "Final PASS/FAIL Summary"

  $failed = @()
  foreach ($key in $results.Keys) {
    $result = $results[$key]
    $status = if ($result.Passed) { "PASS" } else { "FAIL" }
    Add-ReportLine "$status $key"
    if (-not [string]::IsNullOrWhiteSpace($result.Detail)) {
      Add-ReportLine $result.Detail
    }
    if (-not $result.Passed) {
      $failed += $key
    }
  }

  Add-ReportLine ""
  if ($script:DebugFailedStage) {
    Add-ReportLine "Exact failedStage: $script:DebugFailedStage"
  } else {
    Add-ReportLine "Exact failedStage: <not reported>"
  }

  Add-ReportLine ""
  Add-ReportLine "Warnings:"
  if ($warnings.Count -gt 0) {
    foreach ($warning in $warnings) {
      Add-ReportLine "- $warning"
    }
  } else {
    Add-ReportLine "- <none>"
  }

  if ($script:FatalError) {
    Add-ReportLine "Fatal error: $script:FatalError"
  }

  if ($failed.Count -gt 0 -or $script:FatalError) {
    Add-ReportLine "FINAL RESULT: FAIL"
    Write-Host ""
    Write-Host "FINAL RESULT: FAIL" -ForegroundColor Red
  } else {
    Add-ReportLine "FINAL RESULT: PASS"
    Write-Host ""
    Write-Host "FINAL RESULT: PASS" -ForegroundColor Green
  }

  Write-Host "Full report saved to $reportPath" -ForegroundColor Cyan
}

Initialize-Report

try {
  Write-Step "Checking required tools"
  Invoke-LoggedCommand "Git available" { git --version | Out-Null }
  Invoke-LoggedCommand "Node available" { node --version | Out-Null }
  Invoke-LoggedCommand "npm/npx available" { npm --version | Out-Null; npx --version | Out-Null }

  Write-Step "Verifying repository state"
  $currentBranch = (git branch --show-current).Trim()
  Add-ReportLine "Current branch: $currentBranch"
  if ($currentBranch -ne $Branch) {
    Set-Result "On branch $Branch" $false "Current branch is '$currentBranch'."
    throw "Switch to '$Branch' before deploying."
  }
  Set-Result "On branch $Branch" $true

  $statusBefore = Get-GitStatusShort
  Add-ReportLine ""
  Add-ReportLine "Git status before commit:"
  if ($statusBefore.Count -gt 0) {
    $statusBefore | ForEach-Object { Add-ReportLine "  $_" }
    Write-Host "Pending changes:"
    $statusBefore | ForEach-Object { Write-Host "  $_" }
  } else {
    Add-ReportLine "  <clean>"
    Write-Host "Working tree is clean."
  }
  Set-Result "Git status checked" $true

  Write-Step "Committing local fixes when needed"
  if ($statusBefore.Count -gt 0) {
    Invoke-LoggedCommand "Stage changes" { git add -A }
    $staged = @(git diff --cached --name-only)
    Add-ReportLine ""
    Add-ReportLine "Staged files:"
    if ($staged.Count -gt 0) {
      $staged | ForEach-Object { Add-ReportLine "  $_" }
      Invoke-LoggedCommand "Commit changes" { git commit -m $CommitMessage }
    } else {
      Add-ReportLine "  <none>"
      Set-Result "Commit changes" $true "No staged changes after git add."
    }
  } else {
    Set-Result "Stage changes" $true "Skipped; working tree already clean."
    Set-Result "Commit changes" $true "Skipped; no local changes."
  }

  Add-ReportLine ""
  Add-ReportLine "Git status after commit:"
  $statusAfterCommit = Get-GitStatusShort
  if ($statusAfterCommit.Count -gt 0) {
    $statusAfterCommit | ForEach-Object { Add-ReportLine "  $_" }
  } else {
    Add-ReportLine "  <clean>"
  }

  Write-Step "Pushing to origin/$Branch"
  Invoke-LoggedCommand "Push to origin/$Branch" { git push origin $Branch }

  Write-Step "Deploying backend"
  Invoke-LoggedCommand "Backend deploy result" {
    Invoke-VercelDeploy -Name "backend" -Path $root -Project $BackendProject
  }

  Write-Step "Synchronizing production admin password hash"
  Sync-DefaultAdminPassword
  Set-Result "Production admin password hash sync" $true "Seeded $AdminEmail with the password used by this deployment script."

  Write-Step "Testing production backend health"
  $apiHealthResult = Invoke-JsonRequest -Name "/api/health result" -Uri "$BackendUrl/api/health"
  if ($apiHealthResult.Ok -and $apiHealthResult.Response.status -eq "ok") {
    Set-Result "/api/health result" $true "$BackendUrl/api/health returned status ok."
  } else {
    $detail = if ($apiHealthResult.Ok) {
      "Unexpected status '$($apiHealthResult.Response.status)'."
    } else {
      To-ReportJson $apiHealthResult.Error
    }
    Set-Result "/api/health result" $false $detail
    throw "/api/health did not return status ok."
  }

  $rootHealthResult = Invoke-JsonRequest -Name "/health result" -Uri "$BackendUrl/health"
  if ($rootHealthResult.Ok -and $rootHealthResult.Response.status -eq "ok") {
    Set-Result "/health result" $true "$BackendUrl/health returned status ok."
  } else {
    $detail = if ($rootHealthResult.Ok) {
      "Unexpected status '$($rootHealthResult.Response.status)'."
    } else {
      To-ReportJson $rootHealthResult.Error
    }
    Set-Result "/health result" $false $detail
  }

  Write-Step "Testing production login endpoint"
  $loginBody = @{
    email = $AdminEmail
    password = $AdminPassword
    rememberMe = $false
  }

  $loginResult = Invoke-JsonRequest -Name "/api/auth/login result" -Uri "$BackendUrl/api/auth/login" -Method "Post" -Body $loginBody
  if ($loginResult.Ok -and $loginResult.Response.token -and $loginResult.Response.user -and $loginResult.Response.user.email -eq $AdminEmail) {
    Set-Result "/api/auth/login result" $true "$BackendUrl/api/auth/login returned a token for $AdminEmail."
  } else {
    $detail = if ($loginResult.Ok) {
      "Login responded, but token/user payload was not as expected."
    } else {
      To-ReportJson $loginResult.Error
    }
    Set-Result "/api/auth/login result" $false $detail

    Write-Step "Testing safe debug login endpoint"
    $debugResult = Invoke-JsonRequest -Name "/api/debug/login result" -Uri "$BackendUrl/api/debug/login" -Method "Post" -Body $loginBody
    if ($debugResult.Ok) {
      if ($debugResult.Response.failedStage) {
        $script:DebugFailedStage = [string]$debugResult.Response.failedStage
      }

      if ($debugResult.Response.ok -eq $true) {
        Set-Result "/api/debug/login result" $true "Debug login returned ok: true."
      } else {
        $stageDetail = if ($script:DebugFailedStage) {
          "failedStage: $script:DebugFailedStage"
        } else {
          "Debug login returned JSON but no failedStage."
        }
        Set-Result "/api/debug/login result" $false $stageDetail
      }
    } else {
      Set-Result "/api/debug/login result" $false (To-ReportJson $debugResult.Error)
    }

    throw "Production login failed. Read docs/latest-deploy-result.txt for details."
  }

  Write-Step "Deploying frontend"
  Invoke-LoggedCommand "Frontend deploy result" {
    Invoke-VercelDeploy -Name "frontend" -Path (Join-Path $root "frontend") -Project $FrontendProject
  }
} catch {
  $script:FatalError = $_.Exception.Message
  Add-ReportLine ""
  Add-ReportLine "Caught fatal error:"
  Add-ReportLine $script:FatalError
} finally {
  Write-FinalSummary
}

if ($script:FatalError) {
  exit 1
}
