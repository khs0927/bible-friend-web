# Mobile Work deployment bridge
Existing Cloudflare deployment Secrets stay in this repository and are never exported.
The isolated workflows deploy khs0927/jev-browser-control-plane at reviewed commit be90100d5ebcdaa4750e1b2fcc4f32ebfa49e141.

2026-10-03 evidence:
- Credential readiness run 37117596402 succeeded.
- D1 f2addd52-6ebd-4d13-a6bc-ce4e9fc01a47 and OAuth KV 876ab2d9d2a440ecb8757a332a084643 created; schema applied.
- Worker deployment run 37117929201 uploaded and deployed successfully, but its public acceptance step failed with HTTP 403 / Cloudflare error 1010. Overall run is failure.
- Browser public endpoint navigation returned ERR_BLOCKED_BY_CLIENT; this is a separate browser failure.
- No public health success, OAuth success, authenticated MCP success or mobile E2E success is claimed.
- Free-plan CPU override error 100328 was corrected by removing the override; the account is on Free.

Remaining owner setup:
1. Register dedicated Mobile Work Gateway OAuth app: homepage https://mobile-work-gateway.hscad-kangyu.workers.dev/health; exact callback https://mobile-work-gateway.hscad-kangyu.workers.dev/callback; no wildcard or device flow.
2. In this repository's Secrets, save MWG_GITHUB_CLIENT_ID, MWG_GITHUB_CLIENT_SECRET and MWG_GITHUB_TOKEN. The token should be fine-grained, only khs0927/jev-browser-control-plane, Contents read and Actions read/write, with expiry.
3. After the owner approves supplying those credentials to the dedicated Cloudflare Worker, run Configure Mobile Work Gateway Authentication.
4. Resolve the public endpoint block through account/site-owner review. Do not bypass signature checks, change browser fingerprints, disable global protections or assume authenticated MCP will work.
5. Verify live OAuth, denied unauthenticated MCP, exact six tools, task registration, callback/artifact agreement and actual iOS Plugin invocation.

Updating JEV main invalidates the pinned main SHA. Review and update deployment pins together before further task dispatch.
