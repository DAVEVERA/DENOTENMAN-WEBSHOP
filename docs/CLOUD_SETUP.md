# Cloud Setup Checklist

This checklist covers the Google Cloud resources that a human operator
provisions manually before the application can run against real
infrastructure. Nothing here is provisioned by code, and no project
names, identifiers, or secret values belong in this repository.

## 1. GCP project

- Purpose: isolates billing, IAM, and all resources for this
  application from other workloads.
- Minimal setup: a dedicated project, not a shared or personal project.
- Access: project-level Owner is limited to the person or small group
  responsible for initial setup. Day-to-day work uses the narrower
  roles described below, not project Owner.

## 2. Cloud SQL instance (PostgreSQL)

- Purpose: hosts the application database that Prisma connects to via
  `DATABASE_URL`.
- Minimal setup: private IP or authorized-networks access only, not a
  publicly reachable instance without IP restrictions. Automated
  backups enabled.
- Access: the application connects with a dedicated database user that
  has privileges scoped to the application's own database and schema,
  not the Cloud SQL instance's administrative user.

## 3. Cloud Storage bucket

- Purpose: stores product and content images referenced by
  `GCS_BUCKET` and served publicly through `CDN_BASE_URL`.
- Minimal setup: uniform bucket-level access enabled. Public read
  access is granted at the bucket or CDN layer, not through
  per-object ACLs. Write access is never granted directly to clients;
  all writes go through v4 signed URLs issued by the application.
- Access: no end-user or browser credential can write to this bucket
  directly.

## 4. Service accounts and IAM roles

- Application service account
  - Purpose: identity the deployed application runs as; used to reach
    Cloud SQL and to generate signed upload URLs for the Storage
    bucket.
  - Minimal roles: Cloud SQL Client on the Cloud SQL instance, and
    Storage Object Admin scoped to the single application bucket only
    (not project-wide Storage Admin).
  - Credentials: no key file is generated or stored in the repository
    or in application configuration. The application relies on
    Application Default Credentials from the runtime environment
    (for example, the workload identity of the hosting platform).

- Deploy/CI service account (if deployments are automated)
  - Purpose: identity used by the deployment pipeline to release new
    application versions.
  - Minimal roles: the smallest role set the deployment target
    requires (for example, a deploy role on the specific hosting
    service), never project Owner or Editor.

## 5. Secret Manager entries

- Purpose: holds runtime configuration values that must not appear in
  the repository, matching the keys already declared in
  `.env.example`: `DATABASE_URL`, `GCS_BUCKET`, `SPREADSHEET_ID`,
  `CDN_BASE_URL`, `SITE_URL`, `DEFAULT_LOCALE`. `SPREADSHEET_ID`
  identifies the master product spreadsheet the catalog import reads
  from; like every other value in this list, the identifier itself
  lives only in the runtime environment, never in the repository.
- Minimal setup: one secret per configuration value, versioned, with
  older versions disabled rather than deleted after rotation.
- Access: the application service account is granted Secret Manager
  Secret Accessor only on the specific secrets it needs, not on the
  project's full secret list. No human operator's personal account
  should be a long-term consumer of these secrets.

## 6. CDN in front of the Storage bucket

- Purpose: serves images publicly at the host referenced by
  `CDN_BASE_URL`, so the bucket name itself never appears in a public
  URL.
- Minimal setup: the CDN's origin is restricted to the application's
  Storage bucket only.
- Access: read-only from the public internet; no write path is
  exposed through the CDN.
- `CDN_BASE_URL` and `SITE_URL` are two distinct hosts and must not be
  set to the same value: `CDN_BASE_URL` is the image CDN configured
  here, while `SITE_URL` is the storefront's own public domain, used
  for canonical links, hreflang alternates, the sitemap, and robots.txt.

## 7. Google Sheets API read access

- Purpose: lets `prisma/seed.ts` read the product catalog spreadsheet
  maintained by the site owner as the source of truth for the import
  described in `docs/ARCHITECTURE.md`.
- Minimal setup: the source spreadsheet must be a native spreadsheet in
  the operator's account, not an uploaded Office file — the Sheets API
  cannot read the contents of an uploaded file, only a spreadsheet
  actually created in or converted to the native format. The
  spreadsheet is shared with the service account below at Viewer level
  only; no write access is granted.
- Access: a dedicated service account is granted read access to the
  spreadsheet directly (via spreadsheet sharing, not a project-level
  IAM role) and no other Sheets or Drive scope. The application relies
  on Application Default Credentials, consistent with the credential
  approach already used for Storage above: no key file is committed to
  the repository. For local development, a key file for this service
  account is generated and referenced through
  `GOOGLE_APPLICATION_CREDENTIALS` in the local environment only; the
  key file itself is excluded from version control by a dedicated
  `.gitignore` pattern and never distributed outside the machine that
  needs it.

## 8. Google Cloud Translation API

- Purpose: lets `prisma/seed.ts` translate the spreadsheet's Dutch
  source text into English and French once, at import time, as
  documented in `docs/ARCHITECTURE.md`. Nothing at request time depends
  on this API.
- Minimal setup: the Cloud Translation API is enabled on the project.
  No translation glossary, custom model, or additional configuration is
  required beyond the base API.
- Access: the same dedicated service account used for Sheets access is
  granted the Cloud Translation API User role (or an equivalent minimal
  role scoped to issuing translation requests), not a broader
  Translation admin role. Credentials follow the same Application
  Default Credentials pattern: no key file in the repository, and the
  same local-development key file and `GOOGLE_APPLICATION_CREDENTIALS`
  reference used for Sheets access above.

## Out of scope

Provisioning steps, console clicks, and command-line invocations are
intentionally not documented here. This checklist only defines what
must exist and the minimal access each identity needs; the person
performing setup chooses the exact provisioning method.
