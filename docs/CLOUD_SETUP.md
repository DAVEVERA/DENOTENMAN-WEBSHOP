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
  `.env.example`: `DATABASE_URL`, `GCS_BUCKET`, `CDN_BASE_URL`,
  `DEFAULT_LOCALE`.
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

## Out of scope

Provisioning steps, console clicks, and command-line invocations are
intentionally not documented here. This checklist only defines what
must exist and the minimal access each identity needs; the person
performing setup chooses the exact provisioning method.
