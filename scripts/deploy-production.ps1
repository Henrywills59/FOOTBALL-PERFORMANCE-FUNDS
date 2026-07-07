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

$results = [ordered]@{}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
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

  if ($Passed) {
    Write-Host "PASS $Name" -ForegroundColor Green
  } else {
    Write-Host "FAIL $Name" -ForegroundColor Red
  }

  if (-not [string]::IsNullOrWhiteSpace($Detail)) {
    Write-Host "     $Detail"
  }
}

function Invoke-CheckedCommand {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  try {
    & $Command
    Set-Result $Name $true
  } catch {
    Set-Result $Name $false $_.Exception.Message
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

    if ($linkedProject -ne $Project) {
      Write-Host "Linking Vercel project '$Project' for $Name..."
      npx vercel link --project $Project --yes
    }

    npx vercel --prod
  } finally {
    Pop-Location
  }
}

Write-Step "Checking required tools"
Invoke-CheckedCommand "Git available" { git --version | Out-Null }
Invoke-CheckedCommand "Node available" { node --version | Out-Null }
Invoke-CheckedCommand "npm/npx available" { npm --version | Out-Null; npx --version | Out-Null }

Write-Step "Verifying repository state"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $Branch) {
  Set-Result "On branch $Branch" $false "Current branch is '$currentBranch'."
  throw "Switch to '$Branch' before deploying."
}
Set-Result "On branch $Branch" $true

$statusBefore = Get-GitStatusShort
if ($statusBefore.Count -gt 0) {
  Write-Host "Pending changes:"
  $statusBefore | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "Working tree is clean."
}
Set-Result "Git status checked" $true

Write-Step "Committing local fixes when needed"
if ($statusBefore.Count -gt 0) {
  Invoke-CheckedCommand "Stage changes" { git add -A }
  $staged = @(git diff --cached --name-only)
  if ($staged.Count -gt 0) {
    Invoke-CheckedCommand "Commit changes" { git commit -m $CommitMessage }
  } else {
    Set-Result "Commit changes" $true "No staged changes after git add."
  }
} else {
  Set-Result "Stage changes" $true "Skipped; working tree already clean."
  Set-Result "Commit changes" $true "Skipped; no local changes."
}

Write-Step "Pushing to origin/$Branch"
Invoke-CheckedCommand "Push to origin/$Branch" { git push origin $Branch }

Write-Step "Deploying backend"
Invoke-CheckedCommand "Backend deploy" {
  Invoke-VercelDeploy -Name "backend" -Path $root -Project $BackendProject
}

Write-Step "Testing backend health"
$healthUri = "$BackendUrl/health"
try {
  $health = Invoke-RestMethod -Uri $healthUri -Method Get -TimeoutSec 30
  if ($health.status -eq "ok") {
    Set-Result "Backend /health" $true "$healthUri returned status ok."
  } else {
    Set-Result "Backend /health" $false "$healthUri returned unexpected status '$($health.status)'."
    throw "Backend health did not return status ok."
  }
} catch {
  Set-Result "Backend /health" $false $_.Exception.Message
  throw
}

Write-Step "Testing production login endpoint"
$loginUri = "$BackendUrl/api/auth/login"
try {
  $loginBody = @{
    email = $AdminEmail
    password = $AdminPassword
    rememberMe = $false
  } | ConvertTo-Json

  $login = Invoke-RestMethod -Uri $loginUri -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 30
  if ($login.token -and $login.user -and $login.user.email -eq $AdminEmail) {
    Set-Result "Backend login" $true "$loginUri returned a token for $AdminEmail."
  } else {
    Set-Result "Backend login" $false "$loginUri responded, but token/user payload was not as expected."
    throw "Login response was not valid."
  }
} catch {
  Set-Result "Backend login" $false $_.Exception.Message
  Write-Host "Login failed. Checking safe debug endpoint before stopping..." -ForegroundColor Yellow

  try {
    $debugUri = "$BackendUrl/api/debug/login"
    $debugBody = @{
      email = $AdminEmail
      password = $AdminPassword
      rememberMe = $false
    } | ConvertTo-Json

    $debug = Invoke-RestMethod -Uri $debugUri -Method Post -ContentType "application/json" -Body $debugBody -TimeoutSec 30
    $debugSummary = $debug | ConvertTo-Json -Depth 8
    Set-Result "Backend debug login" $true $debugSummary
  } catch {
    Set-Result "Backend debug login" $false $_.Exception.Message
  }

  throw "Production login failed. See PASS/FAIL summary above."
}

Write-Step "Deploying frontend"
Invoke-CheckedCommand "Frontend deploy" {
  Invoke-VercelDeploy -Name "frontend" -Path (Join-Path $root "frontend") -Project $FrontendProject
}

Write-Step "Deployment summary"
$failed = @()
foreach ($key in $results.Keys) {
  $result = $results[$key]
  if ($result.Passed) {
    Write-Host "PASS $key" -ForegroundColor Green
  } else {
    Write-Host "FAIL $key" -ForegroundColor Red
    if (-not [string]::IsNullOrWhiteSpace($result.Detail)) {
      Write-Host "     $($result.Detail)"
    }
    $failed += $key
  }
}

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Deployment finished with failures: $($failed -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Production deployment completed successfully." -ForegroundColor Green
