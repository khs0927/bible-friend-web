# Growth v1 production validation gate

This commit intentionally triggers the Git-connected Vercel production pipeline after the Growth v1 squash merge.

Expected production surfaces after a successful build:
- `/growth-game`
- tRPC `growth.profile`
- tRPC `growth.claimActivity`
- tRPC `growth.upgradeEquipment`
- tRPC `growth.equip`

Runtime DB bootstrap is additive and idempotent (`CREATE TABLE IF NOT EXISTS`) for the two Growth-only tables. Existing Bible Friend data is not modified.

Acceptance checks:
1. production Vite build reaches READY;
2. `/growth-game` returns the app shell and Growth route bundle;
3. no new Growth-related runtime 5xx cluster appears;
4. existing root `/` stays healthy;
5. signed-out Growth mode remains read-only/non-persistent;
6. authenticated growth operations create/use Growth tables without affecting existing tables.
