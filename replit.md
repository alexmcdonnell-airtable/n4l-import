# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **PDF generation**: pdfkit (server-side, manifest PDFs)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Features

### Schools & Staff
- School roster management with private portal links (token-based access)
- Staff roles: `admin`, `staff`, `warehouse`, `driver`
- Per-school default menus and weekly order management

### Delivery Logistics (Task #18)
- **Trucks**: CRUD for delivery trucks (`/api/trucks`)
- **Routes**: Default weekly delivery schedule — route name, truck, day of week, default driver, ordered school stops (`/api/routes`)
- **Route instances**: Per-week materializations of the default schedule, with overrides for truck/driver/day and stop-level skip/unskip (`/api/route-instances`)
- **Manifests**: JSON and PDF manifest generation per route instance (`/api/route-instances/:id/manifest`, `/api/route-instances/:id/manifest.pdf`)
- **Orders**: `weekly_orders.route_week_instance_id` binds each order to a route instance; orders list shows route/truck columns and "Unrouted" badge
- **Frontend**: "Routes & Trucks" page in sidebar (Default schedule tab + This week tab with PDF download)

### DB Schema (new tables)
- `trucks` — delivery trucks
- `routes` — default route schedule (truck FK, day of week, driver FK, active flag)
- `route_stops` — ordered school stops for each default route
- `route_week_instances` — per-week materializations with override fields
- `route_week_stops` — per-instance ordered school stops with skipped flag
- `schools.route_id` — FK to routes for default assignment

## Security Notes

- **School access tokens**: Plain-text tokens are stored in the `schools.access_token` DB column so staff can always copy the real portal link from the list view. The SHA-256 hash (`access_token_hash`) is still stored and used for portal token lookup/validation. Treat `access_token` as a low-sensitivity secret (read-only school profile access); rotate via the reset-link action if a token is compromised.
