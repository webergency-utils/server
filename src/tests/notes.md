# Testing Knowledge Base & Conventions

This document tracks observed rules, anti-patterns, and project-specific testing preferences to maintain high code quality and test resiliency across the `@webergency-utils/server` package.

## Rules

- **Exhaustive Branch Coverage:** Every execution path (conditional statement, default value fallback, error catch block) must be explicitly targeted by a named test.
- **Strict Isolation:** Ensure zero shared state between tests. Use `beforeEach` to instantiate fresh objects and `vi.clearAllMocks()` or `vi.resetAllMocks()` where appropriate.
- **Visual AAA structure:** Structure test cases clearly using Arrange, Act, and Assert comments separated by vertical whitespace.
- **Test Observable Behavior:** Focus on testing the public boundaries and interface behavior instead of private internals.

## Anti-Patterns

- **Mutating Shared State:** Avoid declaring variables at the module level in tests that get mutated within `it` blocks without being reset in `beforeEach`.
- **Accidental Coverage:** Do not count code paths executed as a side-effect of other tests as proper unit tests for those code paths. Each specific behavior should have dedicated assertions.
- **Using `any` for Mocks:** Prefer `unknown` or typed mocked helpers (e.g. `vi.fn()` properly typed) to preserve TypeScript compilation guarantees.

## Mocking Conventions

- **Simple Mocking:** Use `vi.fn()` for mock callbacks and functions.
- **External Interfaces/Complex Objects:** When mocking complex classes, mock their interface rather than inheriting or instantiating them directly.
