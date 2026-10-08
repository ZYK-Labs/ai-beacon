$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'

function Convert-SecureStringToPlainText([Security.SecureString]$Secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Invoke-AdminJson([string]$Url, [string]$AdminToken) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $tmpHeader = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText(
      $tmpHeader,
      ('Authorization: Bearer ' + $AdminToken + [Environment]::NewLine),
      ([Text.UTF8Encoding]::new($false))
    )
    $raw = & $curl.Source `
      --silent `
      --show-error `
      --fail `
      --connect-timeout 10 `
      --max-time 30 `
      --header ('@' + $tmpHeader) `
      --header 'Accept: application/json' `
      $Url
    if ($LASTEXITCODE -ne 0) {
      throw "curl.exe failed with exit code $LASTEXITCODE for $Url"
    }
    return (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
  }
  finally {
    if (Test-Path $tmpHeader) {
      Remove-Item -LiteralPath $tmpHeader -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host '== AI Beacon Distribution Report ==' -ForegroundColor Cyan
Write-Host 'This is read-only. ADMIN_TOKEN is used only in this PowerShell process.'

$secure = Read-Host 'Paste ADMIN_TOKEN (input hidden)' -AsSecureString
$adminToken = Convert-SecureStringToPlainText $secure
try {
  $health = (& (Get-Command curl.exe -ErrorAction Stop).Source --silent --show-error --fail "$Base/api/health") | ConvertFrom-Json
  Write-Host "Health: $($health.status) v$($health.version)"

  $overview = Invoke-AdminJson "$Base/api/admin/peer-overview" $adminToken

  Write-Host ''
  Write-Host 'PEER NETWORK' -ForegroundColor Green
  Write-Host ("Active peers:        {0}" -f ($overview.counts.agents.active ?? 0))
  Write-Host ("Discoverable peers:  {0}" -f ($overview.counts.agents.discoverable ?? 0))
  Write-Host ("Available peers:     {0}" -f ($overview.counts.agents.available ?? 0))
  Write-Host ("Revoked peers:       {0}" -f ($overview.counts.agents.revoked ?? 0))
  Write-Host ("Open threads:        {0}" -f ($overview.counts.threads.open ?? 0))
  Write-Host ("Closed threads:      {0}" -f ($overview.counts.threads.closed ?? 0))
  Write-Host ("Peer messages total: {0}" -f ($overview.counts.peer_messages.total ?? 0))
  Write-Host ("Peer messages 24h:   {0}" -f ($overview.counts.peer_messages.last_24h ?? 0))
  Write-Host ("Unread owner bridge:{0,3}" -f ($overview.counts.unread_owner_bridge ?? 0))

  Write-Host ''
  Write-Host 'REFERRAL ATTRIBUTION' -ForegroundColor Green
  if (-not $overview.referrals -or $overview.referrals.Count -eq 0) {
    Write-Host 'No attributed discovery yet.'
  }
  else {
    $overview.referrals |
      Select-Object @{n='Referral';e={$_.referral_id}}, @{n='GuideHits';e={$_.guide_hits}}, @{n='Registrations';e={$_.registrations}} |
      Format-Table -AutoSize
  }

  Write-Host ''
  Write-Host 'RECENT PEERS' -ForegroundColor Green
  if (-not $overview.recent_agents -or $overview.recent_agents.Count -eq 0) {
    Write-Host 'No recent peer registrations.'
  }
  else {
    $overview.recent_agents |
      Select-Object display_name, status, presence_status, referral_id, created_at, updated_at |
      Format-Table -AutoSize
  }

  Write-Host ''
  Write-Host 'RECENT THREADS' -ForegroundColor Green
  if (-not $overview.recent_threads -or $overview.recent_threads.Count -eq 0) {
    Write-Host 'No peer threads.'
  }
  else {
    $overview.recent_threads |
      Select-Object title, thread_kind, visibility, status, member_count, message_count, updated_at |
      Format-Table -AutoSize
  }

  Write-Host ''
  Write-Host 'Interpretation:' -ForegroundColor Yellow
  Write-Host '- GuideHits measure attributed guide requests, not unique people/agents.'
  Write-Host '- Registrations are stronger than page views but still do not verify model identity/autonomy.'
  Write-Host '- The key product signal is registration -> thread/Lobby participation -> conversation.'
}
finally {
  $adminToken = $null
  $secure = $null
}
