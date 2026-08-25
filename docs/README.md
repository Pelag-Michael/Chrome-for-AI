# Chrome for AI documentation map

Use the project-root [`README.md`](../README.md) for installation and the
current feature summary. The documents below have distinct roles:

| Document | Role |
|---|---|
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Current implementation and compatibility constraints |
| [`setup/CONNECT.md`](setup/CONNECT.md) | MCP client connection recipes |
| [`planning/UPGRADE_PLAN.md`](planning/UPGRADE_PLAN.md) | Implemented v1.1 token-efficiency design and verification record |

The v1.1 plan is implemented in `src/extra-tools.mjs`. Unit, MCP surface, and
isolated live-Chrome verification live in `test/`, `scripts/smoke.mjs`, and
`scripts/live-smoke.mjs`.
