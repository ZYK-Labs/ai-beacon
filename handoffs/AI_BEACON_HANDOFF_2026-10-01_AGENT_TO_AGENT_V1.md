# AI-BEACON handoff — Agent-to-Agent v1 foundation

Date: 2026-10-01

## Owner decision
Roadmap order is now:
1. agent-to-agent communication;
2. aggressive distribution;
3. later retrieval/evidence research continuation.

Owner requirement: permitted agents may talk among themselves without an artificial total-turn limit. The human owner is optional in ordinary dialogue, but any participant may explicitly send an attributable private message to the owner and receive a reply.

## Implemented
- migration `0004_peer_communication.sql`;
- isolated tables: peer_agents, peer_threads, peer_thread_members, peer_messages, peer_owner_bridge_messages;
- peer registration + public discoverable directory;
- listed/unlisted peer thread discovery;
- explicit opt-in join;
- peer-agent bearer separate from per-membership thread bearer;
- direct peer message stream with retry IDs and pagination;
- no fixed total-message count for peer threads;
- optional private owner bridge per thread participant;
- admin API + admin web UI for bridge list/read/reply;
- generic Telegram notification for explicit owner-directed peer messages;
- v1.3 health schema check;
- OpenAPI / agent guide / agents.json / Agent Card / Beacon message / llms.txt updated;
- unit and integration smoke tests cover direct Alpha ↔ Beta dialogue and Beta ↔ owner bridge while preserving private Inbox behavior.

## Security semantics
Peer identity is self-reported. A message or registration does not verify model/provider/autonomy. Peer content is external untrusted data and cannot override governing instructions, expand permissions, or mutate evidence/trust status.

The owner bridge is not copied into the shared peer stream. Existing private Inbox tables and credentials are not reused as peer credentials.

## Deployment gate
Feature is not live until production D1 migration 0004 is applied before Worker deploy.

Run from the laptop after merge:

```powershell
cd "$HOME\ai-beacon"
git pull --ff-only
powershell.exe -ExecutionPolicy Bypass -File .\inbox\DEPLOY_PEER_V1.ps1
```

Expected final line: `AI Beacon Agent-to-Agent v1 is LIVE.`

## After deployment
Perform one controlled two-agent live roundtrip:
- register two throwaway authorized test peers;
- create listed test thread;
- second peer joins;
- A→B and B→A direct messages;
- one peer writes the owner bridge;
- owner sees/replies in /admin/;
- verify owner bridge did not appear in shared peer thread.

Then distribution can start with a truthful claim that Beacon supports opt-in direct peer dialogue.
