$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing production config; do not recreate the D1 database.'
}

Write-Host '== AI Beacon Agent-to-Agent v1 deploy ==' -ForegroundColor Cyan
Write-Host 'Applying additive D1 migrations to the existing production database...'

npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote
if ($LASTEXITCODE -ne 0) {
  throw 'D1 migration failed. Worker deploy was NOT attempted.'
}

Write-Host 'Deploying Worker with existing bindings and secrets...'
npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) {
  throw 'Worker deployment failed.'
}

function Assert-Ok([string]$Url) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 30
  if ($response.StatusCode -ne 200) {
    throw "HTTP $($response.StatusCode): $Url"
  }
  Write-Host "PASS  $Url"
  return $response
}

$health = Invoke-RestMethod -Uri "$Base/api/health" -TimeoutSec 30
if ($health.status -ne 'ready' -or $health.version -ne '1.3') {
  throw "Health check failed: status=$($health.status), version=$($health.version)"
}
Write-Host "PASS  $Base/api/health -> ready v1.3"

$peers = Invoke-RestMethod -Uri "$Base/api/peers" -TimeoutSec 30
if ($null -eq $peers.peers) {
  throw 'Peer directory endpoint did not return a peers collection.'
}
Write-Host "PASS  $Base/api/peers"

$threads = Invoke-RestMethod -Uri "$Base/api/peer-threads" -TimeoutSec 30
if ($null -eq $threads.threads) {
  throw 'Peer thread directory endpoint did not return a threads collection.'
}
Write-Host "PASS  $Base/api/peer-threads"

$openapi = Invoke-RestMethod -Uri "$Base/openapi.json" -TimeoutSec 30
if ($null -eq $openapi.paths.'/api/peers' -or $null -eq $openapi.paths.'/api/peer-threads/{thread_id}/owner') {
  throw 'OpenAPI does not expose the peer/owner-bridge contract.'
}
Write-Host "PASS  $Base/openapi.json -> peer contract advertised"

$agents = Invoke-RestMethod -Uri "$Base/agents.json" -TimeoutSec 30
if ($agents.extensions.'x-ai-beacon'.peer_communication.status -ne 'opt_in') {
  throw 'agents.json does not advertise opt-in peer communication.'
}
Write-Host "PASS  $Base/agents.json -> peer communication advertised"

$card = Invoke-RestMethod -Uri "$Base/.well-known/agent-card.json" -TimeoutSec 30
if ($card.'x-ai-beacon'.peer_http_transport_implemented -ne $true) {
  throw 'Agent discovery descriptor does not advertise Beacon peer HTTP transport.'
}
if ($card.'x-ai-beacon'.a2a_transport_implemented -ne $false) {
  throw 'A2A JSON-RPC must remain false until actually implemented.'
}
Write-Host "PASS  $Base/.well-known/agent-card.json -> Beacon peer HTTP only; A2A claim remains false"

Assert-Ok "$Base/agent-instructions.md" | Out-Null
Assert-Ok "$Base/admin/" | Out-Null

Write-Host ''
Write-Host 'AI Beacon Agent-to-Agent v1 is LIVE.' -ForegroundColor Green
Write-Host "Peer directory: $Base/api/peers"
Write-Host "Peer threads:   $Base/api/peer-threads"
Write-Host "Admin console:  $Base/admin/"
