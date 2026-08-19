# Pulse Agent Guide

Pulse is a multi-client task platform. Treat web, React Native mobile, Telegram/Hermes, iOS widgets, and Android widgets as first-class clients of the same domain/API.

## Repository

- `apps/web`: Next.js web app and HTTP API surface.
- `apps/mobile`: Expo / React Native app for iOS and Android.
- `packages/domain`: platform-neutral task semantics and types.
- `packages/api-client`: shared typed client used by web/mobile.
- `packages/db`: Prisma/PostgreSQL only; server-side code only.
- `packages/widget-contracts`: serializable widget snapshots/actions shared with native widget adapters.

## Domain invariants

- Natural language like “tomorrow” means a **date-only** due date unless the user explicitly supplies a time.
- `dueDate` and `dueAt` are different concepts. Never synthesize midnight for a date-only task.
- `reminderAt` is distinct from due date/time.
- Deletes are soft by default (`deletedAt`).
- One bulk user intent is one logical operation for undo/history.
- Preserve enough operation data to support undo of the last three user-visible operations.
- Multi-user ownership is mandatory on every task/tag mutation.

## Architecture boundaries

- Clients and Hermes never access PostgreSQL directly; go through application/domain APIs.
- Keep business rules out of React components, route handlers, Prisma models, and widget views.
- Widgets consume small versioned snapshots and emit narrow actions; they do not become independent task engines.
- Shared packages must not import Next.js, React Native, Expo, Prisma, Swift/Kotlin APIs, or platform UI frameworks unless the package is explicitly platform-specific.
- Prefer deterministic parsing/rules for dates, recurrence, undo, and bulk mutations; use LLM reasoning only at the intent layer.

## Hermes / automation safety

- Hermes works only in its dedicated worktree/branch unless explicitly told otherwise.
- Do not merge to `main` automatically.
- Do not push, deploy, migrate production data, delete data, rotate secrets, or modify auth/infra without explicit user approval.
- Never read or commit `.env`, credentials, signing keys, provisioning profiles, or production database dumps.
- Run relevant lint/typecheck/tests before committing.
- Keep commits scoped to one user-visible task.

## Mobile and widgets

- Mobile is Expo SDK 57 / React Native and must remain a real native iOS/Android app, not a web wrapper.
- iOS widget support uses `expo-widgets` where suitable; use development builds, not Expo Go, for widget work.
- Android widgets use a native Expo-module/config-plugin adapter while sharing `@pulse/widget-contracts` with iOS.
- Widget state must be derived from canonical server/app state and tolerate stale/offline snapshots.
