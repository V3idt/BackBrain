---
trigger: always_on
---

- **Maintainability is Paramount**: The codebase must not grow chaotic. Avoid "god files" that do everything, but also avoid excessive, unnecessary fragmentation.
- **Do Things Right, Not Easy**: Prefer durable implementations that hold up over time rather than shortcuts that create future rework.
- **Design for Scale**: Think through how features, abstractions, and operational behavior will hold up as the project grows.
- **Security-First**: Security must be integrated into the design and implementation from day one, not added as an afterthought.
- **Robust Testing & Debugging**: Implement detailed testing and verbose error logging from the start. Logging should be easy to toggle on/off.
- **Leverage Existing Tools**: Use high-quality libraries, frameworks, and open-source projects (with commercial-friendly licenses) to ensure stability and reduce maintenance overhead.
- **Use Existing Patterns First**: Prefer established codebase patterns and abstractions before introducing new structures or bespoke workflows.
- **Keep Changes Intentional**: Keep implementations focused and minimal; avoid unnecessary complexity, duplication, and churn.
