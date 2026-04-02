# Rust Security Prototype Handoff

This document records the security-scanning work done across the Rust/Codex prototype branches so another agent can reuse the useful parts without needing to rediscover the branch history.

It is a handoff/reference document, not a product spec. The current direction is to build the real project in TypeScript in `../BackBrain`, using this repo mainly as a prototype and behavior reference.

## Context

- Branch used for this work: `security-features`
- Main goal in this repo: add deterministic security-scan entrypoints to `codex`
- Product direction at the time:
  - start with Semgrep
  - add Gitleaks, Trivy, and dependency-vulnerability tooling
  - keep per-tool testing possible from the CLI
  - preserve raw tool JSON
  - use AI later for orchestration/triage rather than replacing scanners
- Later project decision:
  - the university project should be built as a TypeScript codebase
  - this Rust repo should be treated as a prototype/reference, not the final product

## Source Branches Reviewed

These are the security-related branches that were actually present in this Rust repo when this document was prepared:

| Branch | Tip commit | Summary |
|---|---|---|
| `security-features` | `a27dc048e` | main working branch for the prototype; includes Semgrep command, dependency planner history, docs, and later handoff notes |
| `security-feature-aiscanner` | `15364289f` | agentic security scanner workflow branch; adds repo-context gathering, prompts, and agent-driven scan orchestration around Semgrep |
| `security-scan-dependencies` | `0e1b398bb` | dependency-vulnerability planning work for `osv-scanner`, `cargo-audit`, and `npm audit` |
| `security-scan-gitleaks` | `59a87bacc` | Gitleaks integration branch |
| `security-scan-trivy` | `531db47ab` | stale branch; despite the name, it does not contain real Trivy implementation |

Related TypeScript codebase:

| Repo/branch | State | Summary |
|---|---|---|
| `../BackBrain` `main` | active TypeScript codebase | contains the TypeScript monorepo, extension scaffold, AI analysis services, and the project shape that now better matches the university deliverable |

Important note:

- There is a Rust branch explicitly focused on AI-assisted security scanning: `origin/security-feature-aiscanner`.
- The AI-related implementation that now matters most for the final product is still in `../BackBrain`, especially its `packages/core` and `packages/extension` code.

## High-Level Lessons

These design conclusions were reached during the work here:

- Use real external scanners instead of reimplementing their logic.
- Keep raw tool JSON as the canonical machine output.
- Let AI sit above the scanners for triage, explanation, fix suggestions, installation help, and retries.
- Keep each scanner individually runnable from the CLI.
- Prefer explicit command contracts over vague prompt-only behavior.
- Avoid local-demo-only implementations, hardcoded absolute paths, and toy rule packs as the product path.

## Implemented And Committed

The following work is already committed on `security-features`.

### 1. Semgrep CLI Integration

Committed by:

- `56aa1e76b` `feat: add production semgrep scan workflow`
- `854f70647` `feat: add semgrep security scan command`
- `531db47ab` `fix: resolve semgrep cli flag collision`

What exists:

- A `codex security-scan semgrep` command in the CLI
- A production-shaped Semgrep workflow/skill
- A documented Semgrep command path in `docs/security-scan.md`

What behavior was intended and implemented in the committed slice:

- call the real `semgrep` executable
- preserve raw Semgrep JSON
- default to `p/security-audit`
- support scanning a target repo via `-C`
- avoid custom local rules as the core path

Representative usage:

```bash
cd codex-rs
cargo run --bin codex -- security-scan semgrep -C /path/to/target-repo
```

### 2. Dependency Vulnerability Planning

Committed by:

- `8a3134211` `security-scan: plan dependency vulnerability tools`
- `7e0e6eeba` `fix: update security scan cli test coverage`

What exists:

- a planner, not a scanner executor
- exposed as `codex security-scan dependency-vulns`
- text and JSON output modes

What the planner does:

- inspects the target repo for dependency manifests and lockfiles
- identifies Rust and npm targets
- prepares suggested commands for:
  - `osv-scanner`
  - `cargo-audit`
  - `npm audit`
- reports tool availability and install hints

Representative usage:

```bash
cd codex-rs
cargo run --bin codex -- security-scan dependency-vulns -C /path/to/target-repo
cargo run --bin codex -- security-scan dependency-vulns -C /path/to/target-repo --format json
```

### 3. Project-Level Workflow Guidance

Committed by:

- `697238985` `docs: update local agent workflow instructions`
- `635a6b248` `docs: reinforce production-first implementation guidance`

What was added to `AGENTS.md`:

- build in small, verifiable slices
- make milestone commits without waiting for reminders
- avoid temporary “show it works” implementations
- prefer production-level designs even when moving incrementally

## Other Branch Work By Area

This section exists so another agent can quickly understand what each branch contributed, even if that work was not merged cleanly into `security-features`.

### `security-features`

What this branch became:

- the main integration branch for the Rust prototype
- the place where Semgrep became a real CLI path
- the place where dependency-vulnerability planning was kept
- the place where handoff and design decisions were documented

What is meaningful on this branch:

- Semgrep command path
- dependency-vulnerability planner
- scanner-oriented docs
- workflow guidance about production-first incremental work

### `security-scan-dependencies`

Primary contribution:

- planned dependency-focused scanning rather than directly executing all dependency tools

Important behavior from this branch:

- inspect repo contents first
- detect ecosystems from manifests and lockfiles
- decide which tools are relevant before invoking them
- include install hints and availability reporting

Files/features associated with it:

- `codex-rs/security-scan/src/dependency_vulnerability_scan.rs`
- `docs/security-scan-dependency-vulns.md`
- CLI support for `security-scan dependency-vulns`

### `security-scan-gitleaks`

Primary contribution:

- first real Gitleaks integration pass

Useful ideas from this branch:

- use the real `gitleaks` executable
- preserve raw JSON
- add a dedicated CLI path for secrets scanning

### `security-feature-aiscanner`

Primary contribution:

- an agentic security-scanner workflow layered on top of deterministic Semgrep execution

Main pieces added on that branch:

- `codex-rs/security-scan/src/agentic.rs`
- `codex-rs/security-scan/src/prompts.rs`
- `codex-rs/security-scan/src/repo_context.rs`
- `codex-rs/security-scan/src/types.rs`
- a refactored `codex-rs/security-scan/src/semgrep.rs`

What that branch was trying to do:

- gather repository context before scanning
- define prompts and types for AI-assisted security analysis
- keep Semgrep as the underlying deterministic scanner
- add an agent-driven layer for orchestration and interpretation

Why it matters:

- it is the clearest prototype of the “deterministic scanners first, AI triage second” direction
- it should influence the TypeScript rewrite even if the Rust implementation itself is not the final product

Why it was not merged wholesale:

- it reintroduced the in-repo `security-fixtures/` directory after the user had asked to remove that approach
- it needed CLI flag cleanup
- the better default scan mode was adapted later to `gitleaks dir`

### `security-scan-trivy`

What was discovered:

- the branch name suggests Trivy work, but the branch tip is only `531db47ab` and does not contain actual Trivy integration
- it mostly reflects earlier Semgrep-era prototype state plus the flag-collision fix

Conclusion:

- Trivy still needed to be implemented separately
- the branch is useful as history context, not as the source of real Trivy code

### BackBrain TypeScript Codebase

This is not one of the Rust branches, but it now matters for the rewrite more than the Rust prototype itself.

Relevant implemented areas in `../BackBrain`:

- portable scanner/provider interfaces in `packages/core/src/ports`
- `SecurityService` orchestration in `packages/core/src/services/security-service.ts`
- AI analysis service in `packages/core/src/services/ai-analysis-service.ts`
- auto-fix/revert service in `packages/core/src/services/autofix-service.ts`
- scanner adapters including Semgrep and “vibe-code” detection
- VS Code extension scaffolding in `packages/extension`

So for future work:

- Rust branches describe the prototype scanner behavior
- BackBrain describes the product architecture that should carry forward

## Local In-Progress Work Present In The Working Tree

At the time this document was written, the repo also contains uncommitted local work that has not yet been finalized or committed.

Current modified/untracked files:

- `codex-rs/cli/src/main.rs`
- `codex-rs/security-scan/src/lib.rs`
- `codex-rs/security-scan/src/semgrep.rs`
- `codex-rs/security-scan/src/gitleaks.rs`
- `codex-rs/security-scan/src/trivy.rs`
- `docs/security-scan.md`

This work is important because it shows the intended next step, but it should be treated as in-progress rather than stable history.

### 1. Semgrep Refactor And Hardening

The in-progress version extracts Semgrep into its own module and adds:

- default exclude patterns for common agent/editor state directories:
  - `.agent`
  - `.agents`
  - `.backbrain`
  - `.cursor`
  - `.kiro`
  - `.kluster`
  - `.ralphy`
- repeated `--exclude` support
- retry logic using temp-backed `XDG_CONFIG_HOME` and `XDG_CACHE_HOME`
- stricter raw JSON extraction and error reporting

This is the best Semgrep behavior discovered in this prototype and should be carried into the TypeScript rewrite.

### 2. Gitleaks Integration

The in-progress implementation adds:

- `codex security-scan gitleaks`
- a dedicated `--gitleaks-config` flag
- raw JSON output
- `gitleaks dir` as the default scan mode

Why `dir` was chosen:

- it maps better to “scan this target workspace/path”
- it keeps behavior aligned with the Semgrep per-tool CLI testing pattern
- it avoids over-coupling the scan to git history shape

### 3. Trivy Integration

The in-progress implementation adds:

- `codex security-scan trivy`
- raw JSON output
- `trivy fs` as the default scan mode
- default scanners:
  - `vuln`
  - `misconfig`
  - `secret`
- retry logic using a temp-backed `TRIVY_CACHE_DIR`

### 4. Documentation Update

The in-progress `docs/security-scan.md` expands the docs so each tool can be run individually:

- Semgrep
- Gitleaks
- Trivy
- dependency planner

That individual-tool testing model should be preserved in the new TypeScript project.

## Branch And Merge Findings

Some work came from other security-related branches and was reviewed during integration.

### `security-scan-dependencies`

- This branch contained the dependency-vulnerability planner work.
- It was effectively integrated.

### `security-scan-gitleaks`

- This branch had useful Gitleaks logic.
- It was not merged wholesale.

Reasons it was not merged directly:

- it reintroduced an in-repo `security-fixtures/` workspace after the user had asked for that to be removed
- it used a generic `--config` flag that would collide with existing Clap/config handling
- it needed adaptation to the chosen `gitleaks dir` direction

Useful part to keep:

- Gitleaks subprocess execution and raw JSON preservation

### `security-scan-trivy`

- This branch was stale.
- It did not contain real Trivy integration beyond older Semgrep-era commits.
- Trivy support was therefore implemented locally instead of merged from that branch.

### AI-Related Work

- There is a separate Rust branch dedicated to AI scan orchestration: `origin/security-feature-aiscanner` at `15364289f`.
- That branch adds an agentic workflow on top of Semgrep rather than replacing deterministic scanning.
- The meaningful AI implementation that should influence future work is in `../BackBrain`.
- In practice, the TypeScript rewrite should combine:
  - deterministic scanners inspired by the Rust prototype
  - AI explanation/fix/orchestration capabilities already sketched or implemented in BackBrain

## Things Explicitly Removed Or Rejected

These choices were tried or discussed and then rejected.

### 1. Local Toy Semgrep Rules As The Main Path

Rejected because:

- they were local-demo behavior, not product behavior
- they were not portable
- they drifted away from the real requirement to use maintained scanner rules

### 2. Hardcoded Machine-Specific Paths

Rejected because:

- they were not releasable
- they were only useful for local sandbox validation

### 3. In-Repo Vulnerable Test Workspace

There was a temporary `security-fixtures/` directory in this repo, but the user explicitly asked for it to be removed.

Current expectation:

- vulnerable test repos should live outside this Rust workspace
- scanners should target them via `-C /path/to/repo`

### 4. Prompt-Only Scanner Runtime

This was discussed heavily.

Conclusion reached:

- agent instructions are good for orchestration
- real scanner executables should still be the source of truth for findings
- raw JSON should come directly from the tools

## Operational Contracts Discovered Here

These are the concrete behaviors worth preserving in the rewrite.

### Semgrep

- default config: `p/security-audit`
- output: raw JSON
- scan target: target repo path, not current codex repo
- fallback:
  - if writable state under home/config/cache fails, retry with temp-backed `XDG_CONFIG_HOME` and `XDG_CACHE_HOME`
- allow explicit config override
- allow extra exclude patterns

### Gitleaks

- mode: `gitleaks dir`
- output: raw JSON
- scan target: target repo path
- allow dedicated config override flag

### Trivy

- mode: `trivy fs`
- output: raw JSON
- default scanners: `vuln,misconfig,secret`
- fallback:
  - if cache writes fail, retry with temp-backed `TRIVY_CACHE_DIR`

### Dependency Vulnerability Planning

- scan manifests/lockfiles first
- decide which dependency tools make sense from repo contents
- report install hints and availability instead of assuming the tools exist

## What Should Be Reused In The TypeScript Rewrite

The following ideas are worth carrying into `../BackBrain`.

### Reuse Directly As Product Behavior

- per-tool CLI entrypoints
- raw JSON preservation
- explicit subprocess invocation
- missing-binary detection with install guidance
- writable-state/cache fallback behavior
- target-repo scanning via an explicit path

### Reuse As Product Direction

- deterministic scanners first, AI triage second
- support one tool at a time and `scan all`
- keep human-readable summaries separate from machine-readable tool output
- keep each scanner independently testable
- keep the scanner behavior informed by the Rust prototype branches while using the TypeScript architecture from BackBrain

### Reuse As Documentation/Architecture Ideas

- a dedicated handoff/spec document for scanner command contracts
- small, verifiable milestones rather than large one-shot rewrites

## What Should Not Be Reused In The TypeScript Rewrite

- this Rust repo as the final product shell
- `codex review` as the primary user-facing security product
- local-only fixture repos inside the product workspace
- local handcrafted scanner rule packs as the default product behavior

## Recommended Porting Order For `../BackBrain`

If another agent is using this prototype as reference for the TypeScript project, the safest order is:

1. Build a reusable scanner interface in TypeScript.
2. Port Semgrep first with raw JSON output and writable-state fallback.
3. Add Gitleaks with `dir` mode and raw JSON output.
4. Add Trivy with `fs` mode, default scanners, and cache fallback.
5. Add dependency vulnerability scanning or planning.
6. Add AI explanation, fix suggestions, and aggregation on top of the deterministic outputs.

## Status Summary

Committed and usable in this repo:

- Semgrep CLI path
- dependency vulnerability planner
- supporting docs and workflow instructions

Implemented locally but not finalized/committed:

- stronger Semgrep module shape
- Gitleaks CLI path
- Trivy CLI path
- expanded multi-tool docs

Final product decision:

- use this repo as reference only
- build the actual university project in TypeScript in `../BackBrain`
