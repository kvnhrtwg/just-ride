# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What This Is

A cycling training dashboard ("Just Ride") that connects to smart trainers and heart rate monitors via Web Bluetooth, streams live power/HR data, and provides ERG mode control. Requires a Chromium-based browser with Web Bluetooth over HTTPS or localhost.

## Commands

```bash
bun run dev          # Start Convex + Vite dev servers (port 3000)
bun run build        # Production build
bun run test         # Run tests (vitest)
bun run lint         # ESLint
bun run typecheck    # tsc --noEmit
bun run check        # Prettier + ESLint fix
```

## Tech Stack

- **TanStack Start** (React 19, SSR) with **TanStack Router** (file-based) and **TanStack Query**
- **Convex** serverless backend (real-time queries/mutations, schema in `convex/schema.ts`)
- **better-auth** for email/password auth, running on both Convex HTTP layer and TanStack Start server
- **Vite 7**, **TypeScript 5.7** (strict), **Bun** package manager
- **SCSS** for styling (no Tailwind, no CSS modules)

## Architecture

### Frontend (`src/`)

- **Routes** (`src/routes/`): File-based routing. `__root.tsx` handles auth guard and providers. `routeTree.gen.ts` is auto-generated — never edit.
- **Components** (`src/components/`): Functional components with co-located `.scss` files. All data/callbacks passed as props; no internal data fetching.
- **Hooks** (`src/hooks/`): `useTrainerBluetooth.ts` contains all Web Bluetooth/BLE logic for trainer and HR monitor connections.
- **Router** (`src/router.tsx`): Factory function creating router with Convex + TanStack Query integration for SSR.

### Backend (`convex/`)

- `schema.ts`: Database schema (currently one `userData` table for FTP storage)
- `auth.ts`: Auth setup + `getCurrentUser` query
- `userData.ts`: Queries/mutations for user FTP data
- `http.ts`: HTTP router for better-auth endpoints
- `_generated/`: Auto-generated types — never edit

### State Management

- **Server state**: Convex real-time subscriptions bridged through TanStack Query (`convexQuery()` + `ConvexQueryClient`)
- **Local state**: React `useState`/`useRef` for BLE device state, live readings, ERG target in `useTrainerBluetooth`
- **Router context**: `queryClient` and `convexQueryClient` passed via TanStack Router context for route loaders

### Data Fetching Pattern

Route `loader` functions call `context.queryClient.ensureQueryData()` for SSR prefetch. Components consume with `useSuspenseQuery()`. Convex mutations via `useMutation`, followed by manual `queryClient.invalidateQueries()`.

### Auth Flow

Server-side `getToken()` in `__root.tsx` `beforeLoad` → token injected into `convexQueryClient` for SSR. Auth guard redirects unauthenticated users to `/login`. Client-side auth uses `authClient.signIn.email()` / `signUp` / `signOut`.

## Conventions

- **CSS classes**: All prefixed with `cp-` (e.g., `cp-card`, `cp-panel`). BEM modifiers with double-dash (`cp-badge--connected`).
- **SCSS variables**: Defined in `src/styles.scss`, exposed as CSS custom properties (`--cp-*`).
- **SCSS units**: Use `rem` for sizing and spacing in `0.125rem` steps. Only `1px` and `2px` are allowed where thin pixel borders are needed.
- **Formatting**: No semicolons, single quotes, trailing commas (Prettier).
- **Path alias**: `@/*` maps to `src/*`.
- **Props**: Typed with `type` declarations (not `interface`).

## Environment Setup

Requires `.env.local` with `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL`. Convex env vars (`BETTER_AUTH_SECRET`, `SITE_URL`) set via `npx convex env set`.
