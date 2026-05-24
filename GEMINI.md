# FsusUI Project Context & Instructions

This document provides essential context and instructions for AI agents working on the FsusUI project.

## Project Overview

FsusUI is a high-performance Vue 3 component library workspace (pnpm monorepo) based on the Element Plus structure. It leverages modern web technologies to provide a robust and fast UI development experience.

- **Primary Technologies:** Vue 3.5, TypeScript 6.0, ES2022, WebAssembly (C++23 via Emscripten).
- **Package Manager:** pnpm 10.
- **Runtime Requirement:** Node.js >= 22.
- **Build Target:** ES2022 (Chrome 106+).

## Architecture & Monorepo Structure

The project is organized as a pnpm monorepo defined in `pnpm-workspace.yaml`.

### Core Packages (`packages/*`)

- `packages/element-plus`: The main entry point package (published as `element-plus`). It aggregates and re-exports all components, directives, hooks, and constants.
- `packages/components`: Source code for all UI components, organized by directory.
- `packages/theme-chalk`: The styling system using SCSS. It produces both SCSS and CSS outputs.
- `packages/wasm`: WebAssembly performance layer (`@element-plus/wasm`). Provides SIMD-accelerated logic for heavy tasks like sorting and calculations.
- `packages/demo-app`: A Vite-powered application for local development, documentation, and manual testing.
- `packages/hooks`, `packages/directives`, `packages/utils`, `packages/locale`: Supporting modules for composition logic, custom directives, internal utilities, and i18n resources.

### Internal Tooling (`internal/*`)

- `internal/build`: The core build orchestration logic using gulp, Rollup 4, and esbuild 0.28.
- `internal/eslint-config`: Shared ESLint 10 (Flat Config) definitions.
- `internal/metadata`: Tools for generating component metadata and manifests.

## Building and Running

Key commands to manage the project from the root directory:

| Task | Command |
| :--- | :--- |
| **Install Dependencies** | `pnpm install` |
| **Full Project Build** | `pnpm build` |
| **Start Demo App** | `pnpm -C packages/demo-app dev` |
| **Run Unit Tests** | `pnpm test` |
| **Type Check** | `pnpm typecheck` |
| **Lint & Format** | `pnpm lint` / `pnpm format` |
| **Build Theme** | `pnpm build:theme` |
| **Build WASM** | `pnpm build:wasm` (requires Emscripten `emsdk`) |

## Development Conventions

- **Modern Standards:** Prioritize ES2022 features (e.g., `at()`, `Object.hasOwn()`, Top-level await).
- **TypeScript:** Use strict TypeScript 6.0 features. Avoid `any` and prefer explicit typing.
- **Component Design:** Follow the existing Element Plus component patterns found in `packages/components`.
- **Performance:** For performance-critical computations, consider using or extending `@element-plus/wasm`.
- **Testing:** Add Vitest unit tests in `__tests__` directories within each package. Visual tests use Playwright.
- **Versioning:** This project uses `changesets`. Use `pnpm changeset` to document any changes that require a version bump.
- **Styling:** Use SCSS in `packages/theme-chalk`. Follow the BEM-like naming convention established in the project.

## Key Files for Reference

- `README.md`: High-level project summary and quick start.
- `docs/project-overview.md`: Detailed architectural overview.
- `docs/element-plus-integration.md`: Specifics on how this project differs from standard Element Plus and how to integrate it.
- `package.json`: Root dependencies and script definitions.
- `packages/element-plus/index.ts`: The primary export map for the entire library.
- `eslint.config.mjs`: The ESLint Flat Config entry point.
