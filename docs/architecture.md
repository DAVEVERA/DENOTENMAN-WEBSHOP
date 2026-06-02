# Architectuur

De webshop bestaat uit een pnpm monorepo met drie apps en gedeelde packages.

## Apps

- `apps/storefront`: publieke Next.js webshop.
- `apps/admin`: Next.js beheeromgeving voor catalogus, orders en instellingen.
- `apps/worker`: achtergrondtaken voor e-mail, images, voorraad, verzending en onderhoud.

## Packages

- `@denotenman/db`: Supabase clients, types en queryhelpers.
- `@denotenman/commerce`: pure domeinlogica voor cart, pricing, inventory, orders en B2B.
- `@denotenman/validation`: inputvalidatie zonder framework-lock-in.
- `@denotenman/config`: routes, constants, env-readers en permissies.
- `@denotenman/media`: image upload/optimalisatie-plannen.
- `@denotenman/analytics`: consent, sessies, attribution en funnel events.

## Data

Supabase is de primaire database en storage-laag. Publieke storefront reads gebruiken een publishable key. Admin writes en uploads lopen server-side via service-role. Productafbeeldingen staan in de publieke Storage bucket `product-images`; admin uploads registreren objecten in `media_assets`, koppelen ze aan producten via `product_media`, en synchroniseren de primaire foto naar `products.image`.

## Security

Adminroutes zijn beschermd met een gesigneerde httpOnly sessie-cookie. Supabase RLS staat aan op catalogus- en private tabellen. Private backup/order-tabellen hebben geen browserrollen.
