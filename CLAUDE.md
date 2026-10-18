@AGENTS.md

## Project rules

- Next.js web and the real Expo/React Native iOS and Android apps are all first-class clients.
- iOS and Android widgets are first-class clients.
- Shared widget payload/action contracts belong in `@pulse/widget-contracts`; shared task semantics belong in `@pulse/domain`.
- Keep date-only due dates distinct from timed due datetimes, and reminder time distinct from due time.
- Preserve real multi-user ownership, soft deletion, and logical undo semantics.
- Clients go through the application API/service layer, never arbitrary database access.
