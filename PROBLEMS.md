# Problems log

Running notes from the implementing agent. Sandbox permissions, command failures, ergonomics.

## 2026-09-03

- PLAN.md says installs are human tasks because the sandbox has no egress. In practice the agent sandbox routes through a filtering proxy that allows the npm registry, so `pnpm install` works from inside the loop. Kept the plan's human-task list as-is; noting the discrepancy.
- Repo is not lazyspec-backed (no `.lazyspec.toml`). Global instructions say plan via lazyspec; `PLAN.md` was handed over explicitly, so it was used as the plan of record.
