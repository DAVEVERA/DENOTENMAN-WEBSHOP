#!/bin/sh
# Eerste keer SSL-certificaten aanvragen bij Let's Encrypt.
# Éénmalig uitvoeren nadat DNS van alle subdomeinen naar dit server-IP wijst.
# Gebruik: ./scripts/init-ssl.sh

set -e

DOMAIN="denotenman.com"
EMAIL="info@denotenman.com"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo "Stap 1: Nginx starten met tijdelijke HTTP-config (voor certbot challenge)..."
docker run -d --name nginx-bootstrap \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx.http.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v certbot_www:/var/www/certbot \
  nginx:alpine

echo "Stap 2: Certificaat aanvragen voor $DOMAIN en subdomeinen..."
docker run --rm \
  -v certbot_certs:/etc/letsencrypt \
  -v certbot_www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  -d "api.$DOMAIN" \
  -d "admin.$DOMAIN"

echo "Stap 3: Tijdelijke nginx stoppen..."
docker stop nginx-bootstrap && docker rm nginx-bootstrap

echo "Stap 4: Volledige stack starten met HTTPS..."
$COMPOSE up -d

echo ""
echo "Klaar! De webshop draait op https://$DOMAIN"
echo "Admin panel: https://admin.$DOMAIN"
echo "API: https://api.$DOMAIN"
echo "Certificaten worden elke 12 uur automatisch verlengd."
