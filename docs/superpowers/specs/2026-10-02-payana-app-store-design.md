# Payana App Store design

## Purpose and agreed requirements
Provide a private app download portal for customers using individual accounts supplied by an administrator. Each customer belongs to one company. Administrators assign apps to companies and publish downloadable releases with feature notes. Customers can download the latest and previous published versions of assigned apps. Viewers can browse all published apps, versions, and feature notes but cannot download. Administrators manage all data and must use password plus authenticator-app MFA with recovery codes.

## Architecture and deployment
One Next.js application using TypeScript and the App Router. Authenticated catalog and administration pages are server rendered; interactive forms use client components. Route handlers expose a common JSON API. Server services enforce authorization and are shared by route handlers and server-rendered pages; pages do not make HTTP calls back to their own server. A common client API helper handles JSON, errors, and a single coordinated refresh attempt.

SQLite is the local database, accessed through migrations and a typed data layer. App binaries live in a configurable private directory outside public assets. Target deployment is one Node.js server with persistent disk and HTTPS. Database and upload directory must be backed up together. Serverless ephemeral storage and multiple replicas are outside the initial scope.

## Configuration
A validated server-only configuration module reads environment variables. An example environment file documents database location, upload directory, upload size and allowed extensions, application origin, token signing secret, MFA encryption key, access-token lifetime, refresh-session lifetime, and bootstrap-admin credentials. Fail startup on invalid or missing security configuration. Never expose secrets through NEXT_PUBLIC variables. Initial defaults are 15-minute access tokens, 7-day refresh sessions, and a configurable 250 MB upload limit.

## Data model
- Company: name, unique slug, active status, timestamps.
- User: unique normalized email, display name, password hash, role (ADMIN, CUSTOMER, VIEWER), optional company, active status, forced password-change flag, encrypted MFA secret, MFA enrollment state, timestamps. CUSTOMER requires a company; ADMIN and VIEWER need no company.
- App: name, slug, description, platform, active status, timestamps. An app can be assigned to multiple companies.
- CompanyApp: unique company/app assignment.
- Release: app, unique version label within the app, feature notes as plain text, private storage key, original filename, content type, byte size, checksum, publication status, publication timestamp, uploader. The latest release is the most recently published release, not a lexical version comparison.
- RefreshSession: user, authentication security version, hashed opaque refresh token, token family, expiry, revocation state, timestamps. Rotated tokens remain identifiable until expiry for reuse detection. Restricted authentication challenges also bind to the security version, so resets invalidate in-flight credential proofs.
- RecoveryCode: user, hashed code, consumption timestamp.
- LoginThrottle: persisted attempt counters with expiry for account/IP throttling.
- AuditEvent: actor, action, target identifiers, timestamp, relevant safe metadata. Record account changes, assignments, release publication, downloads, and authentication security events; never record passwords, tokens, or MFA secrets.

## Permissions
Admins can manage companies, users, roles, app assignments, app metadata, and releases; they can download all releases. Customers can browse and download only published releases of active apps assigned to their active company. Viewers can browse all active apps and published releases and cannot download binaries. Anonymous visitors see only login. Enforce these rules in server services and every route, including direct download URLs. Hiding a button is not authorization.

Disabled users or companies immediately lose access. Removing an assignment immediately removes a customer's access to that app and all versions. Role changes and password resets revoke sessions. Prevent disabling, deleting, or demoting the last active administrator. Prefer disabling records to deletion so audit and release history remain available.

## Authentication and admin security
Hash passwords using an established password-hashing library. Use signed short-lived access tokens and cryptographically random opaque refresh tokens in HttpOnly cookies; production cookies are Secure and SameSite. Store only refresh-token hashes. Check current user/company state server-side even when an access token remains valid.

Rotate refresh tokens atomically on use. A reused token revokes its session family. Logout revokes the session and clears cookies. Reject cross-origin mutation requests using the configured origin; use cookie settings and CSRF protection for state changes. Apply persisted login throttling and generic credential errors.

Bootstrap the first administrator through an explicit setup command using environment credentials, with no default password. Admin enrollment requires password verification and successful TOTP verification before an authenticated administrative session is issued. Encrypt TOTP secrets at rest. Display recovery codes once and store hashes; consume each code atomically. Never issue full admin access from password-only verification or unfinished MFA enrollment. Admins create customer/viewer accounts with temporary passwords and mandatory password change at first login; password reset produces a new temporary credential and revokes existing sessions. MFA recovery and resets revoke administrative sessions.

## User experience
Login page with password, admin MFA challenge/enrollment, recovery-code entry, and required password change. Responsive catalog with search and platform filtering. App details show latest release, feature notes, and version history. Customers and admins have download controls; viewers do not.

Admin dashboard shows companies, users, apps, and releases. Company details show assigned apps and versions. User management supports creation, role/company changes, disabling, and credential reset. App management supports metadata, company assignment, release upload, feature notes, draft/published state, and unpublishing. Audit view shows relevant security and management events.

## Upload and download behavior
Only admins upload. Validate size, extension, filename, and metadata server-side; use generated storage keys and safe attachment filenames. Default installer/archive extensions: apk, aab, ipa, exe, msi, dmg, pkg, zip, and tar.gz; configurable per deployment. Never execute uploaded files. Handle failed writes without leaving a published release with no file. Metadata and binaries are private; serve binaries only after authentication and authorization, with attachment disposition and private/no-store caching. Stream downloads. Return useful errors for missing files and inaccessible releases without revealing another company's data. Security scanning integration is outside initial scope.

## Verification and delivery
Deliver source code, migrations, setup/seed commands, environment example, and a README with local start, initial-admin enrollment, backup, and production deployment instructions. No publicly exposed demo credentials.

Verify clean database setup, production build, configuration validation, password authentication, required admin MFA, recovery-code single use, refresh rotation/reuse rejection, logout and revocation, company isolation including direct downloads, viewer download denial, latest/older-version access, disabled-account behavior, upload validation, and last-admin protection. Include automated integration coverage for authorization and authentication boundaries and inspect the main login/catalog/admin flows in a browser when available.

## Scope assumptions
One company per customer; one binary per release; no public signup; all historical published versions of an assigned app are available; company assignments apply to the whole app, not individual versions. Email delivery, app-store signing, automatic malware scanning, billing, and multi-server deployment are deferred. The visible product name is Payana App Store; the existing workspace folder name stays as supplied.
