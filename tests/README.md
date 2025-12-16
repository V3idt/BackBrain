# Tests Directory

This directory contains all tests for BackBrain.

## Structure

```
tests/
├── unit/           # Fast, isolated unit tests
├── integration/    # Component interaction tests
├── e2e/            # End-to-end user flow tests
├── security/       # Security-specific tests
└── fixtures/       # Test data and mocks
```

## Running Tests

```bash
# Run all tests
bun test

# Run specific test suite
bun test tests/unit

# Run with coverage
bun test --coverage
```

## Writing Tests

Use Bun's built-in test runner:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```
