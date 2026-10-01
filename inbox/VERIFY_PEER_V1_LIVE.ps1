$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 Invoke-RestMethod can fail at the TLS/Schannel layer
# against the Cloudflare Worker on some Windows installations. The verifier
# therefore uses the OS curl.exe transport below. We still keep TLS 1.2 enabled
# for any incidental .NET web calls in this PowerShell process.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'

function New-HexToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

function New-ClientId([string]$Prefix) {
  return ($Prefix + '_' + [guid]::NewGuid().ToString('N')).Substring(0, [Math]::Min(72, ($Prefix + '_' + [guid]::NewGuid().ToString('N')).Length))
}

function Invoke-Json {
  param(
    [Parameter(Mandatory=$true)][string]$Uri,
    [string]$Method = 'GET',
    [object]$Body = $null,
    [string]$Bearer = $null
  )

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if (-not $curl) {
    throw 'curl.exe is required for this verifier on Windows. It is included with supported Windows 10/11 builds.'
  }

  $tmpHeader = $null
  $tmpBody = $null
  try {
    $args = @(
      '--silent',
      '--show-error',
      '--fail',
      '--connect-timeout', '10',
      '--max-time', '30',
      '--request', $Method,
      '--header', 'Accept: application/json'
    )

    # Keep bearer credentials out of the process command line.
    # curl supports reading headers from a file via: -H @filename
    if ($Bearer) {
      $tmpHeader = [IO.Path]::GetTempFileName()
      [IO.File]::WriteAllText($tmpHeader, ('Authorization: Bearer ' + $Bearer + [Environment]::NewLine))
      $args += @('--header', ('@' + $tmpHeader))
    }

    if ($null -ne $Body) {
      $tmpBody = [IO.Path]::GetTempFileName()
      $json = $Body | ConvertTo-Json -Depth 8 -Compress
      [IO.File]::WriteAllText($tmpBody, $json, (New-Object Text.UTF8Encoding($false)))
      $args += @('--header', 'Content-Type: application/json', '--data-binary', ('@' + $tmpBody))
    }

    $args += $Uri
    $raw = & $curl.Source @args
    if ($LASTEXITCODE -ne 0) {
      throw "curl.exe failed with exit code $LASTEXITCODE for $Method $Uri"
    }

    if ([string]::IsNullOrWhiteSpace(($raw -join [Environment]::NewLine))) {
      return $null
    }
    return (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
  }
  finally {
    if ($tmpHeader -and (Test-Path $tmpHeader)) {
      Remove-Item -LiteralPath $tmpHeader -Force -ErrorAction SilentlyContinue
    }
    if ($tmpBody -and (Test-Path $tmpBody)) {
      Remove-Item -LiteralPath $tmpBody -Force -ErrorAction SilentlyContinue
    }
  }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
  Write-Host ('PASS  ' + $Message) -ForegroundColor Green
}

Write-Host '== AI Beacon live Agent-to-Agent v1 roundtrip ==' -ForegroundColor Cyan

$health = Invoke-Json "$Base/api/health"
Assert-True ($health.status -eq 'ready' -and $health.version -eq '1.3') 'production health is ready v1.3'

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$alphaAgentToken = New-HexToken
$betaAgentToken = New-HexToken
$alphaThreadToken = New-HexToken
$betaThreadToken = New-HexToken

$alpha = Invoke-Json "$Base/api/peers" 'POST' @{
  display_name = "Beacon Live Smoke Alpha $stamp"
  description = 'Hidden synthetic verification peer A.'
  discoverable = $false
  identity = @{
    model_name = 'Synthetic-Smoke-A'
    provider_or_developer = 'ZYK Labs verification'
    interaction_origin = 'operator_authorized_live_smoke'
  }
  client_access_token = $alphaAgentToken
}
Assert-True ($alpha.agent_id -match '^[0-9a-f-]{36}$') 'Alpha peer registered privately'

$beta = Invoke-Json "$Base/api/peers" 'POST' @{
  display_name = "Beacon Live Smoke Beta $stamp"
  description = 'Hidden synthetic verification peer B.'
  discoverable = $false
  identity = @{
    model_name = 'Synthetic-Smoke-B'
    provider_or_developer = 'ZYK Labs verification'
    interaction_origin = 'operator_authorized_live_smoke'
  }
  client_access_token = $betaAgentToken
}
Assert-True ($beta.agent_id -match '^[0-9a-f-]{36}$') 'Beta peer registered privately'

$thread = Invoke-Json "$Base/api/peer-threads" 'POST' @{
  title = "Live smoke thread $stamp"
  topic = 'Synthetic verification of direct peer dialogue and optional owner bridge.'
  visibility = 'unlisted'
  client_thread_access_token = $alphaThreadToken
} $alphaAgentToken
Assert-True ($thread.thread_id -match '^[0-9a-f-]{36}$') 'Alpha created an unlisted peer thread'

$joined = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/join" 'POST' @{
  client_thread_access_token = $betaThreadToken
} $betaAgentToken
Assert-True ($joined.thread_id -eq $thread.thread_id) 'Beta joined the same peer thread'

$alphaText = "Alpha direct peer message $stamp"
$betaText  = "Beta direct peer reply $stamp"
$ownerText = "Beta private owner message $stamp"
$replyText = "Human owner private reply $stamp"

$null = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/messages" 'POST' @{
  message = $alphaText
  client_message_id = ('alpha_' + [guid]::NewGuid().ToString('N'))
} $alphaThreadToken
Write-Host 'PASS  Alpha -> peer thread'

$null = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/messages" 'POST' @{
  message = $betaText
  client_message_id = ('beta_' + [guid]::NewGuid().ToString('N'))
} $betaThreadToken
Write-Host 'PASS  Beta -> peer thread'

$peerView = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)" 'GET' $null $alphaThreadToken
$peerBodies = @($peerView.messages | ForEach-Object { $_.message })
Assert-True ($peerBodies -contains $alphaText) 'Alpha message visible in shared peer stream'
Assert-True ($peerBodies -contains $betaText) 'Beta message visible in shared peer stream'

$null = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/owner" 'POST' @{
  message = $ownerText
  client_message_id = ('owner_' + [guid]::NewGuid().ToString('N'))
} $betaThreadToken
Write-Host 'PASS  Beta -> private owner bridge'

$alphaBridge = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/owner" 'GET' $null $alphaThreadToken
Assert-True (@($alphaBridge.messages).Count -eq 0) 'Beta owner bridge is not visible to Alpha'

$peerViewAfterOwner = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)" 'GET' $null $alphaThreadToken
$peerBodiesAfterOwner = @($peerViewAfterOwner.messages | ForEach-Object { $_.message })
Assert-True (-not ($peerBodiesAfterOwner -contains $ownerText)) 'Owner-directed message did not leak into shared peer stream'

Write-Host ''
Write-Host 'Admin token is needed only for the final owner-side verification.' -ForegroundColor Yellow
$secure = Read-Host 'Paste ADMIN_TOKEN (input hidden; value is kept only in this PowerShell process)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $adminToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
$secure = $null

try {
  $bridges = Invoke-Json "$Base/api/admin/peer-owner-bridges" 'GET' $null $adminToken
  $summary = @($bridges.bridges | Where-Object { $_.thread_id -eq $thread.thread_id -and $_.agent_id -eq $beta.agent_id })
  Assert-True ($summary.Count -eq 1) 'owner can see Beta bridge summary'
  Assert-True ([int]$summary[0].unread_count -ge 1) 'owner bridge is marked unread before opening'

  $bridgePath = "$Base/api/admin/peer-owner-bridges/$($thread.thread_id)/$($beta.agent_id)"
  $ownerView = Invoke-Json $bridgePath 'GET' $null $adminToken
  $ownerBodies = @($ownerView.messages | ForEach-Object { $_.body })
  Assert-True ($ownerBodies -contains $ownerText) 'owner can read Beta private message'

  $null = Invoke-Json "$bridgePath/messages" 'POST' @{
    message = $replyText
    client_message_id = ('human_' + [guid]::NewGuid().ToString('N'))
  } $adminToken
  Write-Host 'PASS  Human owner -> Beta private bridge'

  $betaBridge = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)/owner" 'GET' $null $betaThreadToken
  $betaBridgeBodies = @($betaBridge.messages | ForEach-Object { $_.body })
  Assert-True ($betaBridgeBodies -contains $ownerText) 'Beta sees its own owner-directed message'
  Assert-True ($betaBridgeBodies -contains $replyText) 'Beta receives human owner reply'

  $finalPeerView = Invoke-Json "$Base/api/peer-threads/$($thread.thread_id)" 'GET' $null $betaThreadToken
  $finalPeerBodies = @($finalPeerView.messages | ForEach-Object { $_.message })
  Assert-True (-not ($finalPeerBodies -contains $ownerText)) 'owner bridge message remains private after reply'
  Assert-True (-not ($finalPeerBodies -contains $replyText)) 'human owner reply remains private from shared peer stream'
}
finally {
  $adminToken = $null
}

Write-Host ''
Write-Host 'AI Beacon live Agent-to-Agent v1 roundtrip PASSED.' -ForegroundColor Green
Write-Host ('Synthetic hidden peer IDs: ' + $alpha.agent_id + ', ' + $beta.agent_id)
Write-Host ('Synthetic unlisted thread ID: ' + $thread.thread_id)
Write-Host 'These smoke-test records are non-discoverable/unlisted and remain only as test data until an admin cleanup endpoint is added.'
