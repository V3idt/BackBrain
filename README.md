# BackBrain

> AI-Powered Code Security & Quality Platform

**Vision**: Code that just works. No debugging marathons after vibe coding.

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck
```

## Project Structure

```
backbrain/
├── packages/
│   └── core/           # Business logic (portable, no UI deps)
│       └── src/
│           ├── ports/      # Interface contracts for swappable deps
│           ├── types/      # Domain types
│           ├── services/   # Business logic
│           ├── utils/      # Utilities (logger, Result type)
│           └── config/     # Configuration
├── tests/              # Test suites (unit, integration, e2e, security)
└── docs/               # Documentation
```

## Key Features (MVP)

- ✅ Security scanning with auto-fix + one-click revert
- ✅ Severity panel (separate window)
- ✅ "X issues fixed, 0 security risks" summary
- 🔲 Basic file-node visualization
- 🔲 Security report generation

## Architecture

All external dependencies are swappable via the ports/adapters pattern:

- `AIProvider` — Swap between OpenAI, Claude, Gemini, etc.
- `SecurityScanner` — Swap Semgrep, Trivy, etc.
- `FileSystem` — Works with VS Code API or native fs

## Development

Debug mode: `BACKBRAIN_DEBUG=true`
Verbose logging: `BACKBRAIN_VERBOSE=true`

## License

Proprietary © BackBrain
