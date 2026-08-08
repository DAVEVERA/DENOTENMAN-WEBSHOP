@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem  Project tree scaffold
rem  Creates folder structure and empty placeholder files.
rem  Idempotent: existing files are never overwritten.
rem ============================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Creating directory structure...

rem ---- Application (Next.js App Router, i18n root [locale]) ----
call :mkdir "app\[locale]"
call :mkdir "app\[locale]\collections\[collection]"
call :mkdir "app\[locale]\products\[product]"
call :mkdir "app\[locale]\pages\[slug]"
call :mkdir "app\[locale]\blogs\articles\[slug]"
call :mkdir "app\[locale]\cart"
call :mkdir "app\[locale]\account"
call :mkdir "app\api"

rem ---- Library / core logic ----
call :mkdir "lib"

rem ---- Data layer (Prisma) ----
call :mkdir "prisma"
call :mkdir "prisma\migrations"

rem ---- Reusable UI components ----
call :mkdir "components\ui"
call :mkdir "components\layout"
call :mkdir "components\product"
call :mkdir "components\collection"

rem ---- Translation dictionaries ----
call :mkdir "dictionaries"

rem ---- Static public assets ----
call :mkdir "public"

rem ---- Documentation (all prose lives here, never in code) ----
call :mkdir "docs"

rem ---- Environment / config ----
call :mkdir "config"

echo.
echo Creating placeholder files...

rem ---- App: layouts and pages (empty .tsx, filled later) ----
call :touch "app\[locale]\layout.tsx"
call :touch "app\[locale]\page.tsx"
call :touch "app\[locale]\collections\page.tsx"
call :touch "app\[locale]\collections\[collection]\page.tsx"
call :touch "app\[locale]\products\[product]\page.tsx"
call :touch "app\[locale]\pages\[slug]\page.tsx"
call :touch "app\[locale]\blogs\articles\page.tsx"
call :touch "app\[locale]\blogs\articles\[slug]\page.tsx"
call :touch "app\[locale]\cart\page.tsx"
call :touch "app\[locale]\account\page.tsx"
call :touch "app\sitemap.ts"
call :touch "app\robots.ts"
call :touch "middleware.ts"

rem ---- Library modules ----
call :touch "lib\i18n.ts"
call :touch "lib\routes.ts"
call :touch "lib\prisma.ts"
call :touch "lib\storage.ts"
call :touch "lib\queries.ts"
call :touch "lib\data.ts"

rem ---- Prisma ----
call :touch "prisma\schema.prisma"
call :touch "prisma\seed.ts"

rem ---- Dictionaries (i18n JSON) ----
call :touch "dictionaries\nl.json"
call :touch "dictionaries\en.json"
call :touch "dictionaries\fr.json"

rem ---- Config ----
call :touch "config\next.config.ts"

rem ---- Root config files ----
call :touch "package.json"
call :touch "tsconfig.json"
call :touch ".env.example"
call :touch ".gitignore"

rem ---- Documentation ----
call :touch "docs\IMPLEMENTATION_PLAN.md"
call :touch "docs\ARCHITECTURE.md"
call :touch "docs\STRUCTURE.md"
call :touch "README.md"

echo.
echo Done. Tree scaffold complete.
echo Review docs\STRUCTURE.md for the folder contract.
goto :eof

rem ============================================================
rem  Helpers
rem ============================================================
:mkdir
if not exist "%~1" (
    mkdir "%~1"
    echo   [dir ] %~1
) else (
    echo   [skip] %~1
)
goto :eof

:touch
if not exist "%~1" (
    type nul > "%~1"
    echo   [file] %~1
) else (
    echo   [skip] %~1
)
goto :eof