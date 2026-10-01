$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing local production config; do not recreate the D1 database.'
}

Write-Host '== AI Beacon Discovery v3 deploy ==' -ForegroundColor Cyan
Write-Host 'Running production Worker deploy with the existing D1 binding and secrets...'

npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) {
  throw 'Wrangler deployment failed.'
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
if ($health.status -ne 'ready') {
  throw "Health check failed: status=$($health.status)"
}
Write-Host "PASS  $Base/api/health -> ready"

$agents = Invoke-RestMethod -Uri "$Base/agents.json" -TimeoutSec 30
if (-not ($agents.extensions.'x-ai-beacon'.requested_metadata -contains 'model_identifier')) {
  throw 'agents.json is reachable but does not contain Discovery v3 requested metadata.'
}
Write-Host "PASS  $Base/agents.json -> model_identifier advertised"

$message = Invoke-RestMethod -Uri "$Base/beacon/message.json" -TimeoutSec 30
if (-not ($message.requested_identity_metadata -contains 'model_identifier')) {
  throw 'beacon/message.json is reachable but does not contain Discovery v3 identity metadata.'
}
Write-Host "PASS  $Base/beacon/message.json -> voluntary identity request advertised"

$card = Invoke-RestMethod -Uri "$Base/.well-known/agent-card.json" -TimeoutSec 30
if (-not ($card.'x-ai-beacon'.requested_metadata -contains 'model_identifier')) {
  throw '.well-known/agent-card.json is reachable but does not contain Discovery v3 requested metadata.'
}
if ($card.'x-ai-beacon'.a2a_transport_implemented -ne $false) {
  throw 'Agent Card must remain discovery-only until A2A transport is actually implemented.'
}
Write-Host "PASS  $Base/.well-known/agent-card.json -> discovery-only descriptor"

Assert-Ok "$Base/beacon/" | Out-Null
Assert-Ok "$Base/agents.txt" | Out-Null
Assert-Ok "$Base/llms.txt" | Out-Null
Assert-Ok "$Base/openapi.json" | Out-Null
Assert-Ok "$Base/sitemap.xml" | Out-Null

$robots = (Invoke-WebRequest -UseBasicParsing -Uri "$Base/robots.txt" -TimeoutSec 30).Content
if ($robots -notmatch 'OAI-SearchBot' -or $robots -notmatch '/agents.json') {
  throw 'robots.txt does not advertise the expected AI discovery paths.'
}
Write-Host "PASS  $Base/robots.txt -> AI discovery paths allowed"

Write-Host ''
Write-Host 'AI Beacon Discovery v3 is LIVE.' -ForegroundColor Green
Write-Host "Beacon hub: $Base/beacon/"
Write-Host "Discovery JSON: $Base/agents.json"
Write-Host "Signal JSON: $Base/beacon/message.json"
