# Payana App Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a private company app portal with administrator-managed accounts, releases, company assignments, and secure downloads.

**Status:** Implemented and verified. See `docs/implementation-report.md` for verification results and decisions. All source remains in the supplied workspace; no Git repository was present.

**Architecture:** One Next.js App Router application with server-rendered pages and route handlers sharing authorization-aware server services. SQLite holds application and session data; a private disk directory holds uploaded binaries. Cookie authentication uses short-lived signed access tokens and rotating opaque refresh tokens, with mandatory admin TOTP.

**Tech Stack:** TypeScript, Next.js, React, Tailwind CSS, Prisma with SQLite, Zod, jose, a maintained TOTP library, Node password hashing and cryptography, Vitest, Playwright. Verify supported current releases and official APIs during setup; pin installed dependencies in the lockfile.

**Spec:** `docs/superpowers/specs/2026-10-02-payana-app-store-design.md`

## Global Constraints

- Visible product name: Payana App Store.
- One company per customer; one binary per release; no public signup.
- Viewers can browse all published apps and cannot download.
- Customers can access only their active company's assigned apps and all historical published versions.
- Admins require password plus authenticator-app MFA with recovery codes.
- Initial defaults are 15-minute access tokens, 7-day refresh sessions, and a configurable 250 MB upload limit.
- Private uploads remain outside public assets; deployment uses one Node.js server with persistent disk and HTTPS.
- Server-only validated environment configuration; no default administrator password or public demo credentials.
- No Git repository currently exists. Keep changes in this supplied workspace; commit checkpoints only if Git is initialized or available, without claiming nonexistent commits.

## Review Focus

1. Simultaneous refresh attempts must not silently break the active login; the client coordinates refresh, and token consumption is atomic (Task 3).
2. Company, role, or account changes must affect an already-issued token immediately (Tasks 2, 3, 5).
3. Filenames containing traversal, Unicode, or multiple extensions must never escape private storage or produce unsafe attachment headers (Task 6).
4. Interrupted upload or failed database write must not expose a release with a missing binary (Task 6).
5. An administrator with unfinished MFA enrollment or an exhausted recovery code must never get administrative access (Task 4).

## File Responsibilities

- `src/config/env.ts`: validated server configuration.
- `prisma/schema.prisma`, `prisma/migrations/`: schema and committed migrations.
- `src/server/db.ts`, `src/server/errors.ts`, `src/server/audit.ts`: persistence, typed errors, audit recording.
- `src/server/auth/{password,tokens,sessions,principal,throttle,mfa}.ts`: separate credential, token, session, permission, throttle, and MFA responsibilities.
- `src/server/services/{companies,users,apps,releases}.ts`: business operations with server authorization.
- `src/server/storage.ts`: bounded private-file operations.
- `src/server/http.ts`: route error mapping, origin/CSRF validation, and cookie handling.
- `src/lib/api-client.ts`: common browser API helper.
- `src/app/api/auth/**/route.ts`: login, MFA enrollment/challenge, refresh, logout, password change.
- `src/app/api/admin/**/route.ts`: company, user, app, assignment, release, and audit management.
- `src/app/api/releases/[id]/download/route.ts`: authorized streamed downloads.
- `src/app/(auth)/`, `src/app/(portal)/`, `src/app/admin/`: authentication, catalog, and administration pages.
- `src/components/`: shared navigation, forms, feedback, release lists, and upload controls.
- `scripts/bootstrap-admin.ts`, `tests/`, `.env.example`, `README.md`: setup, verification, and operating instructions.

## Task 1: Runnable application, configuration, and database

**Files:** Create package/tooling files, `.env.example`, `src/config/env.ts`, `prisma/schema.prisma`, initial migration, `src/server/db.ts`, `src/server/errors.ts`, `tests/config.test.ts`, `tests/schema.test.ts`.

**Interfaces:** Produce `getConfig(): Config`, `db` Prisma client, and `AppError(code: string, status: number, message: string)`. Config includes app origin, database/upload paths, allowed extensions, upload byte limit, token/MFA keys, and lifetime values. Schema implements every entity in the spec and indexes token hashes, company/app uniqueness, user email, and app/version uniqueness.

- [x] Scaffold Next.js with TypeScript, App Router, Tailwind, lint, test, and build scripts; verify current official dependency documentation before choosing versions.
- [x] Write configuration/schema tests: invalid keys/origin/limits are rejected; defaults equal 900 seconds, 604800 seconds, and 262144000 bytes; duplicate email, company/app assignment, and app/version fail.
- [x] Run `npm test -- tests/config.test.ts tests/schema.test.ts`; confirm failures reflect unimplemented configuration or constraints.
- [x] Implement validated configuration and schema, then generate and apply the initial SQLite migration against a temporary test database.
- [x] Re-run those tests; run `npm run lint` and `npm run build`; require successful output. Save a checkpoint if Git is available.

## Task 2: Principal, permissions, and audit foundations

**Files:** Create `src/server/auth/principal.ts`, `src/server/audit.ts`, `tests/permissions.test.ts`, `tests/audit.test.ts`.

**Interfaces:** Produce `Principal = { id: string; role: 'ADMIN' | 'CUSTOMER' | 'VIEWER'; companyId: string | null }`, `loadPrincipal(userId: string): Promise<Principal>`, `requireAdmin(principal: Principal): void`, `requireAppAccess(principal: Principal, appId: string, intent: 'browse' | 'download'): Promise<void>`, and `recordAudit(input: AuditInput): Promise<void>`. Load current account/company status from the database on every authenticated request.

- [x] Write tests proving customer company isolation, viewer browse/download distinction, admin access, unpublished/inactive denial, and immediate denial after company/user disabling or assignment removal. Verify audit metadata excludes secrets.
- [x] Run `npm test -- tests/permissions.test.ts tests/audit.test.ts`; require meaningful failures.
- [x] Implement the principal and permission functions and safe structured audit events.
- [x] Re-run tests and lint; save a checkpoint if Git is available.

## Task 3: Password login, refresh sessions, and common API

**Files:** Create auth password/tokens/sessions/throttle modules, `src/server/http.ts`, `src/lib/api-client.ts`, auth login/refresh/logout route handlers, `tests/sessions.test.ts`, `tests/http.test.ts`.

**Interfaces:** Produce `hashPassword(value: string): Promise<string>`, `verifyPassword(value: string, hash: string): Promise<boolean>`, `issueSession(userId: string): Promise<SessionTokens>`, `rotateSession(refreshToken: string): Promise<SessionTokens>`, `revokeSessions(userId: string): Promise<void>`, `getRequestPrincipal(): Promise<Principal>`, `assertMutationOrigin(request: Request): void`, and `api<T>(path: string, options?: RequestInit): Promise<T>`. SessionTokens holds access token, refresh token, and expiry values; never serialize these to ordinary API JSON. Non-admin login issues a session; admin password verification produces only a short-lived MFA/enrollment challenge. Forced-password-change users have restricted credential-change access until completed.

- [x] Write tests for password verification, token expiry, rotating refresh token, atomic single consumption, family revocation on reuse, logout, expired token, role/disable changes, persisted throttling, foreign-origin rejection, secure cookie flags, and coordinated client refresh.
- [x] Run `npm test -- tests/sessions.test.ts tests/http.test.ts`; confirm expected failures.
- [x] Implement tokens, hashed session storage, throttling, request guards, consistent JSON errors, cookie responses, and single-flight refresh helper. Enforce origin/CSRF protection for login and all other mutations. Provide an explicit session-renewal flow for expired cookies on server-rendered navigation.
- [x] Re-run tests and lint; save a checkpoint if Git is available.

## Task 4: Mandatory administrator MFA and first-login experience

**Files:** Create MFA module, enrollment/challenge/recovery/password-change routes, bootstrap script, auth pages and forms, `tests/mfa.test.ts`, `tests/bootstrap.test.ts`.

**Interfaces:** Produce `beginEnrollment(userId: string): Promise<{ secret: string; otpauthUrl: string }>`, `finishEnrollment(userId: string, code: string): Promise<{ recoveryCodes: string[] }>`, and `verifyAdminFactor(userId: string, input: { totp?: string; recoveryCode?: string }): Promise<void>`. All are reachable only through a verified restricted challenge or authorized reauthentication. Encrypt MFA secrets, hash recovery codes, reject TOTP replay, and atomically consume recovery codes.

- [x] Write tests asserting password-only and unfinished-enrollment admin requests are denied, invalid codes fail, a code cannot be reused, recovery codes display once/consume once, challenge expiry is enforced, and bootstrap fails without credentials or duplicates an existing admin.
- [x] Run `npm test -- tests/mfa.test.ts tests/bootstrap.test.ts`; require meaningful failures.
- [x] Implement enrollment/challenge/recovery, bootstrap, temporary-password change, and responsive login/MFA screens. Issue full sessions only after all required checks; revoke sessions on password/MFA reset.
- [x] Re-run tests and lint; verify bootstrap against a temporary database. Save a checkpoint if Git is available.

## Task 5: Company, user, app, and assignment management

**Files:** Create company/user/app services, admin route handlers, admin dashboard/company/user/app pages, shared admin forms, `tests/admin.test.ts`.

**Interfaces:** Produce `listCompanies(actor: Principal)`, `saveCompany(actor: Principal, input: CompanyInput)`, `saveUser(actor: Principal, input: UserInput)`, `resetUserPassword(actor: Principal, userId: string)`, `saveApp(actor: Principal, input: AppInput)`, `setCompanyApps(actor: Principal, companyId: string, appIds: string[])`. Each returns typed serializable records; password reset returns a temporary credential once. Mutations validate inputs, record audit events, and use transactions for last-active-admin protection.

- [x] Write tests for admin-only mutations, normalized unique emails, customer company requirement, invalid identifiers, duplicate assignment handling, session revocation after role/password changes, last-admin disable/demotion prevention, and concurrent last-admin edits.
- [x] Run `npm test -- tests/admin.test.ts`; confirm missing-service failures.
- [x] Implement services/routes and usable dashboard, company detail, user creation/edit/reset/disable, app edit/disable, and assignment forms. Do not place temporary credentials in URLs, logs, or persistent browser storage.
- [x] Re-run tests and lint; save a checkpoint if Git is available.

## Task 6: Private uploads, publishing, and downloads

**Files:** Create storage/release services, admin release routes/forms, download route, `tests/releases.test.ts`, `tests/storage.test.ts`.

**Interfaces:** Produce `storeUpload(file: File): Promise<StoredFile>`, `removeStoredFile(key: string): Promise<void>`, `createRelease(actor: Principal, appId: string, input: ReleaseInput, file: File)`, `setReleasePublished(actor: Principal, releaseId: string, published: boolean)`, and `openDownload(actor: Principal, releaseId: string): Promise<{ stream: ReadableStream; filename: string; size: number; contentType: string }>`. StoredFile includes generated key, sanitized original name, byte size, and checksum. Enforce upload bounds before and during writes; do not depend solely on a claimed Content-Length.

- [x] Write tests for admin-only upload; invalid, uppercase, and compound extensions; oversize and interrupted uploads; Unicode/traversal filenames; duplicate version rollback; missing file; foreign-company/unpublished denial; viewer denial; safe attachment headers; no-store response; and latest/previous published version downloads.
- [x] Run `npm test -- tests/releases.test.ts tests/storage.test.ts`; confirm expected failures.
- [x] Implement private staged file writes and cleanup on error, release draft/publication lifecycle, checksum recording, plain-text feature notes, and authenticated streaming downloads. Never expose storage paths or serve uploads from `public`.
- [x] Re-run tests and lint; save a checkpoint if Git is available.

## Task 7: Server-rendered catalog and release history

**Files:** Create catalog/detail pages, portal layout/navigation, release list components, admin audit page, `tests/releases.test.ts`, `tests/e2e/portal.spec.ts`.

**Interfaces:** Extend app/release services with `listCatalog(actor: Principal, filters: { search?: string; platform?: string })` and `getAppDetail(actor: Principal, appId: string)`, returning only authorized published records ordered by publication time. Pages call these services directly.

- [x] Write catalog tests for customer filtering, viewer visibility, drafts hidden, search/filter behavior, and publication order independent of version labels; write browser tests for login, customer history download, viewer absent download controls, and admin management.
- [x] Run `npm test -- tests/releases.test.ts`; require failures before implementing catalog queries.
- [x] Implement responsive server-rendered catalog/detail and admin company release views with latest release, version history, feature notes, access-aware controls, empty states, form errors, and audit browsing. Render feature notes as text to avoid stored HTML injection.
- [x] Re-run catalog tests; run `npm run test:e2e` and inspect login/catalog/admin screenshots at desktop and mobile widths. Save a checkpoint if Git is available.

## Task 8: Operational documentation and release verification

**Files:** Create/update `README.md`, `.gitignore`, `.env.example`, deployment notes, and test/setup scripts.

**Interfaces:** Expose `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm test`, `npm run test:e2e`, migration and bootstrap commands. Document exact supported Node version based on installed Next.js requirements.

- [x] Document install, environment secret generation, migrations, first-admin bootstrap/MFA, company/user/app setup, upload/download workflow, HTTPS/reverse-proxy body limits, persistent volume paths, SQLite/file backup and restoration, and recovery procedures. Explain single-server limitations and configurable file policy.
- [x] Run a clean migration/bootstrap smoke check against a disposable database; confirm no committed credentials, private binaries, or database files.
- [x] Run `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build`; record actual results and resolve failures before claiming completion.
- [x] Review source against the approved spec, especially permission checks, refresh rotation, MFA gating, upload cleanup, and no public file exposure. Use an independent reviewer if the selected execution method authorizes one; address material findings and rerun affected checks.
- [x] Deliver the working project with concise startup instructions and any genuinely unverified deployment limitations. Save a final checkpoint if Git is available.

