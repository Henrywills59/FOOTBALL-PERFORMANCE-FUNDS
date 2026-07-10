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
if (Test-Path Variable:\PSNativeCommandUseErrorActionPreference) {
  $PSNativeCommandUseErrorActionPreference = $false
}

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
  $AdminPassword = "ChooseAStrongPassword123!"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$reportPath = Join-Path $root "docs\latest-deploy-result.txt"
$results = [ordered]@{}
$warnings = New-Object System.Collections.Generic.List[string]
$script:FatalError = $null
$script:FatalErrorDetail = $null
$script:CurrentStage = "startup"
$script:FailedStage = $null
$script:NextAction = "Review the terminal summary."
$script:LastCommandDiagnostic = $null
$script:DebugFailedStage = $null
$script:AdminSeedToken = $null

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
  try {
    Add-Content -Path $reportPath -Value $Line -Encoding UTF8
  } catch {
    Write-Host "REPORT WRITE FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $Line
  }
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

function Format-CommandOutputLine {
  param($Line)

  if ($null -eq $Line) {
    return ""
  }

  if ($Line -is [System.Management.Automation.ErrorRecord]) {
    $parts = @()
    if ($Line.Exception.Message) {
      $parts += $Line.Exception.Message
    }
    if ($Line.ErrorDetails -and $Line.ErrorDetails.Message) {
      $parts += $Line.ErrorDetails.Message
    }
    if ($Line.InvocationInfo -and $Line.InvocationInfo.PositionMessage) {
      $parts += $Line.InvocationInfo.PositionMessage
    }

    if ($parts.Count -gt 0) {
      return ($parts -join "`n")
    }
  }

  return [string]$Line
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
  $script:CurrentStage = $Message
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
  Add-ReportSection $Message
}

function Get-LastFailedStage {
  if ($results.Keys.Count -gt 0) {
    foreach ($key in @($results.Keys)[($results.Keys.Count - 1)..0]) {
      if ($null -ne $key -and -not $results[$key].Passed) {
        return $key
      }
    }
  }

  if ($script:DebugFailedStage) {
    return $script:DebugFailedStage
  }

  if ($script:FailedStage) {
    return $script:FailedStage
  }

  return $script:CurrentStage
}

function Get-ExactError {
  if ($script:DebugFailedStage) {
    return "Debug login failed at stage: $script:DebugFailedStage"
  }

  if ($script:LastCommandDiagnostic -and -not $script:LastCommandDiagnostic.Passed) {
    $allOutput = @($script:LastCommandDiagnostic.Stderr + $script:LastCommandDiagnostic.Stdout)
    $meaningfulLine = $allOutput |
      Where-Object {
        -not [string]::IsNullOrWhiteSpace($_) -and
        $_ -notmatch '^Vercel CLI\s' -and
        $_ -notmatch '^\s*$'
      } |
      Select-Object -First 1

    if (-not [string]::IsNullOrWhiteSpace($meaningfulLine)) {
      return $meaningfulLine
    }

    return "$($script:LastCommandDiagnostic.Command) exited with code $($script:LastCommandDiagnostic.ExitCode)."
  }

  if ($script:FatalError) {
    return $script:FatalError
  }

  if ($results.Keys.Count -gt 0) {
    foreach ($key in @($results.Keys)[($results.Keys.Count - 1)..0]) {
      if ($null -ne $key -and -not $results[$key].Passed) {
        $detail = $results[$key].Detail
        if (-not [string]::IsNullOrWhiteSpace($detail)) {
          return $detail
        }
        return "$key failed."
      }
    }
  }

  return "<none>"
}

function Get-NextAction {
  param(
    [string]$FailedStage,
    [string]$ExactError
  )

  if ($script:NextAction -and $script:NextAction -ne "Review the terminal summary.") {
    return $script:NextAction
  }

  if ($FailedStage -match "backend project link|remote production admin seed|ADMIN_SEED_TOKEN") {
    if ($script:LastCommandDiagnostic) {
      return "Fix the Vercel command failure shown above for '$($script:LastCommandDiagnostic.Command)', then rerun the same one-command script."
    }
    return "Fix the Vercel CLI command error shown above, then rerun the same one-command script."
  }

  if ($FailedStage -match "Backend deploy") {
    return "Fix the backend deploy error shown above, then rerun the same one-command script."
  }

  if ($FailedStage -match "admin password hash sync|seed-default-admin|adminSeed") {
    return "Check the /api/admin/seed-default-admin response above; it should name the failed seed stage. Fix that backend seed error, then rerun the script."
  }

  if ($FailedStage -match "auth/login|debug/login|passwordHashVerification") {
    return "Use the debug login stage printed above to fix the login path, then rerun the script."
  }

  if ($FailedStage -match "Push|Commit|Stage|Git") {
    return "Fix the Git error shown above, then rerun the same one-command script."
  }

  if ($FailedStage -match "health") {
    return "Fix the backend health route or deployment routing error shown above, then rerun the script."
  }

  if ($ExactError -match "Vercel") {
    return "Fix the Vercel CLI/project access error shown above, then rerun the same one-command script."
  }

  return "Read the exact error above, fix that single failing stage, then rerun the same one-command script."
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

  if (-not $Passed) {
    $script:FailedStage = $Name
    if (-not [string]::IsNullOrWhiteSpace($Detail)) {
      $script:FatalError = $Detail
    }
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
    [scriptblock]$Command,
    [int[]]$AllowedExitCodes = @(0)
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
        $line = Format-CommandOutputLine $_
        foreach ($textLine in ($line -split "`r?`n")) {
          Add-ReportLine $textLine
          if ($textLine -match '^\s*warning:|^\s*WARN(ING)?:') {
            Add-Warning $textLine
          }
        }
      }
    } else {
      Add-ReportLine "<no output>"
    }

    if ($AllowedExitCodes -notcontains $exitCode) {
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

function Invoke-LoggedNativeCommand {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$Stdin = $null,
    [int[]]$AllowedExitCodes = @(0)
  )

  $displayArguments = @(
    foreach ($argument in $Arguments) {
      if ($argument -match '^(.*(?:TOKEN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL).*)=(.*)$') {
        "$($matches[1])=<redacted>"
      } else {
        $argument
      }
    }
  )

  $commandText = if ($displayArguments.Count -gt 0) {
    "$FilePath $($displayArguments -join ' ')"
  } else {
    $FilePath
  }

  Add-ReportLine ""
  Add-ReportLine "### Command: $Name"
  Add-ReportLine "Exact command: $commandText"

  $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) "fpf-$([guid]::NewGuid())-stdout.txt"
  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) "fpf-$([guid]::NewGuid())-stderr.txt"
  $stdinPath = $null

  try {
    if ($null -ne $Stdin) {
      $stdinPath = Join-Path ([System.IO.Path]::GetTempPath()) "fpf-$([guid]::NewGuid())-stdin.txt"
      Set-Content -Path $stdinPath -Value $Stdin -Encoding UTF8 -NoNewline
      $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -RedirectStandardInput $stdinPath -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -NoNewWindow -Wait -PassThru
    } else {
      $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -NoNewWindow -Wait -PassThru
    }

    $stdout = if (Test-Path $stdoutPath) { @(Get-Content $stdoutPath) } else { @() }
    $stderr = if (Test-Path $stderrPath) { @(Get-Content $stderrPath) } else { @() }
    $exitCode = [int]$process.ExitCode

    Add-ReportLine "Exit code: $exitCode"
    Add-ReportLine "Stdout:"
    if ($stdout.Count -gt 0) {
      foreach ($line in $stdout) {
        Add-ReportLine $line
      }
    } else {
      Add-ReportLine "<empty>"
    }

    Add-ReportLine "Stderr:"
    if ($stderr.Count -gt 0) {
      foreach ($line in $stderr) {
        Add-ReportLine $line
        if ($line -match '^\s*warning:|^\s*WARN(ING)?:') {
          Add-Warning $line
        }
      }
    } else {
      Add-ReportLine "<empty>"
    }

    $passed = $AllowedExitCodes -contains $exitCode
    $script:LastCommandDiagnostic = [pscustomobject]@{
      Name = $Name
      Command = $commandText
      Stdout = $stdout
      Stderr = $stderr
      ExitCode = $exitCode
      Passed = $passed
    }

    if (-not $passed) {
      $errorText = (($stderr + $stdout) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
      if ([string]::IsNullOrWhiteSpace($errorText)) {
        $errorText = "$commandText exited with code $exitCode."
      }
      Set-Result $Name $false $errorText
      throw "$commandText exited with code $exitCode."
    }

    Set-Result $Name $true "Exit code $exitCode."
    return $script:LastCommandDiagnostic
  } finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    if ($stdinPath) {
      Remove-Item -LiteralPath $stdinPath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-GitStatusShort {
  return @(git status --short)
}

function Ensure-VercelProjectLink {
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
      Invoke-LoggedNativeCommand `
        -Name "$Name backend project link" `
        -FilePath "npx.cmd" `
        -Arguments @("vercel", "link", "--project", $Project, "--yes")
    }
  } finally {
    Pop-Location
  }
}

function Invoke-VercelDeploy {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Project,
    [hashtable]$Environment = @{}
  )

  Ensure-VercelProjectLink -Name $Name -Path $Path -Project $Project

  Push-Location $Path
  try {
    $arguments = @("vercel", "--prod")
    foreach ($key in $Environment.Keys) {
      $arguments += "--env"
      $arguments += "$key=$($Environment[$key])"
    }
    Invoke-LoggedNativeCommand `
      -Name "$Name deploy result" `
      -FilePath "npx.cmd" `
      -Arguments $arguments
  } finally {
    Pop-Location
  }
}

function New-DeploymentToken {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }

  return ([Convert]::ToBase64String($bytes)).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Configure-RemoteAdminSeed {
  $script:AdminSeedToken = New-DeploymentToken
  Add-ReportLine "Generated deployment-scoped admin seed token."
  Add-ReportLine "The token will be passed to the backend deploy with a non-interactive Vercel --env flag."
}

function Sync-DefaultAdminPassword {
  Add-ReportLine "Admin email to seed: $AdminEmail"
  $passwordSource = if ($env:FPF_ADMIN_PASSWORD) { "FPF_ADMIN_PASSWORD" } else { "script default" }
  Add-ReportLine "Admin password source: $passwordSource"

  if ([string]::IsNullOrWhiteSpace($script:AdminSeedToken)) {
    throw "ADMIN_SEED_TOKEN was not configured before backend deployment."
  }

  $seedBody = @{
    email = $AdminEmail
    password = $AdminPassword
    name = "FPF Admin"
  }

  $seedResult = Invoke-JsonRequest `
    -Name "/api/admin/seed-default-admin result" `
    -Uri "$BackendUrl/api/admin/seed-default-admin" `
    -Method "Post" `
    -Body $seedBody `
    -Headers @{ "x-admin-seed-token" = $script:AdminSeedToken } `
    -TimeoutSec 120

  if (-not $seedResult.Ok -or $seedResult.Response.ok -ne $true) {
    $detail = if ($seedResult.Ok) {
      To-ReportJson $seedResult.Response
    } else {
      To-ReportJson $seedResult.Error
    }
    throw "Remote admin password hash sync failed. $detail"
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Name,
    [string]$Uri,
    [string]$Method = "Get",
    [object]$Body = $null,
    [hashtable]$Headers = @{},
    [int]$TimeoutSec = 30
  )

  Add-ReportLine ""
  Add-ReportLine "### Request: $Name"
  Add-ReportLine "$Method $Uri"

  try {
    $parameters = @{
      Uri = $Uri
      Method = $Method
      TimeoutSec = $TimeoutSec
    }

    if ($Headers.Count -gt 0) {
      $parameters.Headers = $Headers
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
  $finalFailedStage = Get-LastFailedStage
  $finalExactError = Get-ExactError
  $finalNextAction = Get-NextAction -FailedStage $finalFailedStage -ExactError $finalExactError
  $finalResult = if ($failed.Count -gt 0 -or $script:FatalError) { "FAIL" } else { "PASS" }

  Add-ReportLine "FINAL RESULT: $finalResult"
  Add-ReportLine "Failed stage: $(if ($finalResult -eq 'PASS') { '<none>' } else { $finalFailedStage })"
  if ($finalResult -eq "FAIL" -and $script:LastCommandDiagnostic -and -not $script:LastCommandDiagnostic.Passed) {
    Add-ReportLine "Command: $($script:LastCommandDiagnostic.Command)"
    Add-ReportLine "Exit code: $($script:LastCommandDiagnostic.ExitCode)"
    Add-ReportLine "Stdout:"
    if ($script:LastCommandDiagnostic.Stdout.Count -gt 0) {
      foreach ($line in $script:LastCommandDiagnostic.Stdout) {
        Add-ReportLine "  $line"
      }
    } else {
      Add-ReportLine "  <empty>"
    }
    Add-ReportLine "Stderr:"
    if ($script:LastCommandDiagnostic.Stderr.Count -gt 0) {
      foreach ($line in $script:LastCommandDiagnostic.Stderr) {
        Add-ReportLine "  $line"
      }
    } else {
      Add-ReportLine "  <empty>"
    }
  }
  Add-ReportLine "Exact error: $(if ($finalResult -eq 'PASS') { '<none>' } else { $finalExactError })"
  Add-ReportLine "Next action: $(if ($finalResult -eq 'PASS') { 'No action needed.' } else { $finalNextAction })"

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

  if ($finalResult -eq "FAIL") {
    Write-Host ""
    Write-Host "================ DEPLOYMENT SUMMARY ================" -ForegroundColor DarkGray
    Write-Host "FINAL RESULT : FAIL" -ForegroundColor Red
    Write-Host "Failed stage : $finalFailedStage" -ForegroundColor Yellow
    if ($script:LastCommandDiagnostic -and -not $script:LastCommandDiagnostic.Passed) {
      Write-Host "Command      : $($script:LastCommandDiagnostic.Command)" -ForegroundColor Yellow
      Write-Host "Exit code    : $($script:LastCommandDiagnostic.ExitCode)" -ForegroundColor Yellow
      Write-Host "Stdout       :" -ForegroundColor Yellow
      if ($script:LastCommandDiagnostic.Stdout.Count -gt 0) {
        foreach ($line in $script:LastCommandDiagnostic.Stdout) {
          Write-Host "  $line" -ForegroundColor Yellow
        }
      } else {
        Write-Host "  <empty>" -ForegroundColor Yellow
      }
      Write-Host "Stderr       :" -ForegroundColor Yellow
      if ($script:LastCommandDiagnostic.Stderr.Count -gt 0) {
        foreach ($line in $script:LastCommandDiagnostic.Stderr) {
          Write-Host "  $line" -ForegroundColor Yellow
        }
      } else {
        Write-Host "  <empty>" -ForegroundColor Yellow
      }
    }
    Write-Host "Exact error  : $finalExactError" -ForegroundColor Yellow
    Write-Host "Next action  : $finalNextAction" -ForegroundColor Cyan
    Write-Host "Report file  : $reportPath" -ForegroundColor DarkGray
    Write-Host "====================================================" -ForegroundColor DarkGray
  } else {
    Write-Host ""
    Write-Host "================ DEPLOYMENT SUMMARY ================" -ForegroundColor DarkGray
    Write-Host "FINAL RESULT : PASS" -ForegroundColor Green
    Write-Host "Failed stage : <none>" -ForegroundColor Green
    Write-Host "Exact error  : <none>" -ForegroundColor Green
    Write-Host "Next action  : No action needed." -ForegroundColor Green
    Write-Host "Report file  : $reportPath" -ForegroundColor DarkGray
    Write-Host "====================================================" -ForegroundColor DarkGray
  }
}

try {
  Initialize-Report
} catch {
  $fallbackReportPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "docs\latest-deploy-result.txt"
  $fallbackReportDir = Split-Path $fallbackReportPath -Parent
  if (-not (Test-Path $fallbackReportDir)) {
    New-Item -ItemType Directory -Path $fallbackReportDir -Force | Out-Null
  }

  $fallback = @(
    "Football Performance Fund Production Deploy Result",
    "Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "FINAL RESULT: FAIL",
    "Failed stage: report initialization",
    "Exact error: $($_.Exception.Message)",
    "Next action: Close any program locking docs/latest-deploy-result.txt, then rerun the same one-command script.",
    "",
    "The deployment script failed before the normal report could be initialized.",
    "Fatal error: $($_.Exception.Message)"
  )
  Set-Content -Path $fallbackReportPath -Value $fallback -Encoding UTF8
  Write-Host ""
  Write-Host "================ DEPLOYMENT SUMMARY ================" -ForegroundColor DarkGray
  Write-Host "FINAL RESULT : FAIL" -ForegroundColor Red
  Write-Host "Failed stage : report initialization" -ForegroundColor Yellow
  Write-Host "Exact error  : $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "Next action  : Close any program locking docs/latest-deploy-result.txt, then rerun the same one-command script." -ForegroundColor Cyan
  Write-Host "Report file  : $fallbackReportPath" -ForegroundColor DarkGray
  Write-Host "====================================================" -ForegroundColor DarkGray
  exit 1
}

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

  Write-Step "Configuring remote production admin seed"
  Configure-RemoteAdminSeed
  Set-Result "Remote production admin seed token" $true "A fresh deployment-scoped token was generated locally. No Vercel env mutation is required."

  Write-Step "Deploying backend"
  Invoke-VercelDeploy `
    -Name "backend" `
    -Path $root `
    -Project $BackendProject `
    -Environment @{ ADMIN_SEED_TOKEN = $script:AdminSeedToken }

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
        $script:DebugFailedStage = "authLoginFunctionInvocationFailed"
        $script:FailedStage = "/api/auth/login result"
        $script:FatalError = "/api/debug/login passed all stages, but /api/auth/login returned FUNCTION_INVOCATION_FAILED. The production login route is crashing outside the credential/database/JWT flow."
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
  Invoke-VercelDeploy -Name "frontend" -Path (Join-Path $root "frontend") -Project $FrontendProject
} catch {
  $script:FatalError = $_.Exception.Message
  $fatalDetail = Get-ErrorDetail $_
  $script:FatalErrorDetail = $fatalDetail
  if (-not $script:FailedStage) {
    $script:FailedStage = $script:CurrentStage
  }
  Add-ReportLine ""
  Add-ReportLine "Caught fatal error:"
  Add-ReportLine $script:FatalError
  Add-ReportLine ""
  Add-ReportLine "Fatal error details:"
  Add-ReportLine (To-ReportJson $fatalDetail)
  if ($_.ScriptStackTrace) {
    Add-ReportLine ""
    Add-ReportLine "Script stack trace:"
    Add-ReportLine $_.ScriptStackTrace
  }
} finally {
  Write-FinalSummary
}

if ($script:FatalError) {
  exit 1
}
