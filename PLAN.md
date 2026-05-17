# Zero-Reflection AOT Server Implementation Plan

This project aims to build a high-performance web server that eliminates the need for `reflect-metadata` and runtime decorators by using TypeScript code transformations (AOT).

## Core Philosophy
- **Zero Runtime Reflection**: All route discovery and type validation are performed at compile-time.
- **Microscopic Runtime**: The server runtime is just a thin wrapper around a fast router and the native `http` module.
- **Integrated Validation**: Leverages `@webergency-utils/typechecker` for zero-allocation, AOT-generated validators.

## Proposed Components

### 1. Core Runtime (`src/core`)
- **Router**: A high-speed, regex-based router that supports parameters and method-based dispatching.
- **Request/Response**: Lightweight wrappers around Node.js `IncomingMessage` and `ServerResponse`.
- **MetadataStore**: A global registry (populated by the transformer) that holds endpoint definitions.

### 2. Transformer (`src/transformer`)
- **Controller Scanner**: Detects `@Controller` classes.
- **Route Extractor**: Extracts `@Get`, `@Post`, etc., and generates static registration calls.
- **Param Resolver**: Detects `@Body`, `@Query`, `@Param` and generates the corresponding validation/extraction logic using the `types` engine.

### 3. Application Entry (`src/endpoint.ts`)
- The main `Endpoint` class that boots the server and registers routes from the `MetadataStore`.

## Roadmap

### Phase 1: Foundation
- [x] Initialize TypeScript project structure.
- [x] Define core types for Request, Response, and Metadata.
- [x] Implement the base Router logic.

### Phase 2: Transformer Integration
- [x] Create the AOT transformer to scan and register controllers.
- [x] Integrate `@webergency-utils/typechecker` to inject parameter validators.
- [x] Implement automatic "handler wrapping" (converting class methods into HTTP handlers).

### Phase 3: Runtime Execution
- [x] Build the `Endpoint` class to handle the HTTP server lifecycle.
- [x] Implement response serialization (JSON, HTML, Plain text).
- [x] Add basic middleware support (compiled-in).

## Verification Plan
- Create a test controller in `tests/fixtures/controller.ts`.
- Transform it and verify the generated JavaScript contains static registrations.
- Run a functional test asserting that the server correctly validates input and returns responses.
