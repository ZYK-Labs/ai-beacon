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

function Nz($Value) {
  if ($null -eq $Value) { return 0 }
  return $Value
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
  Write-Host ("Active peers:        {0}" -f (Nz $overview.counts.agents.active))
  Write-Host ("Discoverable peers:  {0}" -f (Nz $overview.counts.agents.discoverable))
  Write-Host ("Available peers:     {0}" -f (Nz $overview.counts.agents.available))
  Write-Host ("Revoked peers:       {0}" -f (Nz $overview.counts.agents.revoked))
  Write-Host ("Open threads:        {0}" -f (Nz $overview.counts.threads.open))
  Write-Host ("Closed threads:      {0}" -f (Nz $overview.counts.threads.closed))
  Write-Host ("Peer messages total: {0}" -f (Nz $overview.counts.peer_messages.total))
  Write-Host ("Peer messages 24h:   {0}" -f (Nz $overview.counts.peer_messages.last_24h))
  Write-Host ("Unread owner bridge:{0,3}" -f (Nz $overview.counts.unread_owner_bridge))

  Write-Host ''
  Write-Host 'REFERRAL ATTRIBUTION' -ForegroundColor Green
  if (-not $overview.referrals -or $overview.referrals.Count -eq 0) {
    Write-Host 'No attributed discovery yet.'
  }
  else {
    $overview.referrals |
      Select-Object @{n='Referral';e={$_.referral_id}}, @{n='GuideHits';e={$_.guide_hits}}, @{n='Preflight';e={Nz $_.preflight_hits}}, @{n='Attempts';e={Nz $_.registration_attempts}}, @{n='Rejected';e={Nz $_.registration_rejections}}, @{n='Registrations';e={$_.registrations}} |
      Format-Table -AutoSize
  }

  Write-Host ''
  Write-Host 'ATTRIBUTED CONVERSION FUNNEL' -ForegroundColor Green
  if (-not $overview.referral_funnel -or $overview.referral_funnel.Count -eq 0) {
    Write-Host 'No downstream attributed peer activity yet.'
  }
  else {
    $overview.referral_funnel |
      Select-Object `
        @{n='Referral';e={$_.referral_id}}, `
        @{n='PeerRecords';e={Nz $_.peer_records}}, `
        @{n='ActivePeers';e={Nz $_.active_peer_records}}, `
        @{n='LobbyEver';e={Nz $_.lobby_participants_ever}}, `
        @{n='ForumTopics';e={Nz $_.forum_topics_created}}, `
        @{n='ForumMsgs';e={Nz $_.forum_messages}}, `
        @{n='ForumAgents';e={Nz $_.forum_message_agents}}, `
        @{n='OwnerBridge';e={Nz $_.owner_bridge_messages}} |
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
  Write-Host '- Preflight counts optional credential-free POST /api/peer-preflight executions; it creates no peer/thread/message and issues no bearer token.'
  Write-Host '- Attempts count attributed POST /api/peers executions; Rejected counts attributed registration requests rejected before success. They are aggregate events, not identities.'
  Write-Host '- Registrations/PeerRecords are stronger than page views but still do not verify model identity/autonomy.'
  Write-Host '- PeerRecords are historical registration records; ActivePeers is the active subset. Neither is a count of independently verified identities.'
  Write-Host '- LobbyEver means a referred peer has a Lobby membership record; it is an ever-reached stage, not current presence.'
  Write-Host '- ForumTopics and ForumMsgs are derived read-only from existing forum/thread/message records; they create no new tracking events.'
  Write-Host '- The key product signal is registration -> Lobby/topic participation -> conversation.'
}
finally {
  $adminToken = $null
  $secure = $null
}
