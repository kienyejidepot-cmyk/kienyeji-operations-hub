# Kienyeji Slaughter Shop Management System - Architectural Plan

## Technology Stack
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js/Express + TypeScript (artifacts/api-server)
- Database: PostgreSQL with Drizzle ORM
- Auth: Clerk
- Money: Decimal.js (never use floating point)
- Validation: Zod

## Core Principles
1. Double-entry accounting with immutable posted records (use reversals)
2. All monetary values use decimal precision
3. Full audit trail
4. Branch-scoped from day one (multi-branch ready)
5. Kenyan context: KES, Africa/Nairobi, M-Pesa support
6. Batch traceability from live birds to sales
7. Joint product costing for by-products
8. Period locking and reconciliation
