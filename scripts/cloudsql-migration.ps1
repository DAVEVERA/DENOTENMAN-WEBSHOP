# Starts the one-off Neon -> Cloud SQL migration job in Cloud Build.
#   powershell -File scripts/cloudsql-migration.ps1 -Mode rehearsal
#   powershell -File scripts/cloudsql-migration.ps1 -Mode cutover
# Only the files the job needs are uploaded; the commit hash is recorded as
# DEPLOYMENT_VERSION so the production guard accepts the job as a release step.
param(
  [Parameter(Mandatory = $true)][ValidateSet("rehearsal", "cutover", "unfreeze")][string]$Mode,
  # Non-interactive confirmation for cutover and unfreeze; without it the script asks.
  [switch]$Confirmed
)

$repo = Split-Path -Parent $PSScriptRoot
$commit = (& git -C $repo rev-parse HEAD).Trim()
if ($commit -notmatch "^[0-9a-f]{40}$") { throw "Geen geldige commit-hash gevonden." }
$target = if ($Mode -eq "rehearsal") { "neondb_rehearsal" } else { "neondb" }

if ($Mode -ne "rehearsal" -and -not $Confirmed) {
  $warning = if ($Mode -eq "cutover") {
    "Cutover BEVRIEST productie-Neon en kopieert naar de PRODUCTIEdatabase neondb."
  } else {
    "Unfreeze maakt productie-Neon weer beschrijfbaar (alleen bij terugdraaien)."
  }
  $answer = Read-Host "$warning Typ $($Mode.ToUpper()) om door te gaan"
  if ($answer -ne $Mode.ToUpper()) { throw "Afgebroken." }
}

$stage = Join-Path ([IO.Path]::GetTempPath()) ("cloudsql-migration-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force (Join-Path $stage "scripts/ci"), (Join-Path $stage "lib") | Out-Null
Copy-Item (Join-Path $repo "cloudbuild-migrate-to-cloudsql.yaml") $stage
Copy-Item (Join-Path $repo "scripts/ci/cloudsql-url.sh") (Join-Path $stage "scripts/ci")
Copy-Item (Join-Path $repo "scripts/compare-databases.cjs") (Join-Path $stage "scripts")
Copy-Item (Join-Path $repo "lib/database-access.cjs") (Join-Path $stage "lib")
$config = Join-Path $stage "cloudbuild-migrate-to-cloudsql.yaml"
try {
  & gcloud builds submit $stage `
    --project=project-5dc79156-4200-4528-bfc `
    "--config=$config" `
    "--substitutions=_MODE=$Mode,_TARGET_DATABASE=$target,_DEPLOYMENT_VERSION=$commit"
  if ($LASTEXITCODE -ne 0) { throw "Migratiejob mislukt (exitcode $LASTEXITCODE)." }
} finally {
  Remove-Item -Recurse -Force $stage
}
