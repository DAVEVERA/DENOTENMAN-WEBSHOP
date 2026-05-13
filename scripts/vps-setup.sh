#!/bin/bash
# ============================================================
# DeNotenman — Éénmalige VPS bootstrap (Hetzner / Ubuntu 22.04)
# Gebruik: bash scripts/vps-setup.sh
# Voer uit als root op de VPS.
# ============================================================
set -euo pipefail

REPO_URL="git@github.com:MNRV/denotenman-webshop.git"
DEPLOY_DIR="/opt/denotenman"
DEPLOY_USER="deploy"

echo "=== [1/6] Systeem updaten ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== [2/6] Docker installeren ==="
if ! command -v docker &>/dev/null; then
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "Docker geïnstalleerd: $(docker --version)"
else
  echo "Docker al aanwezig: $(docker --version)"
fi

echo "=== [3/6] Deploy-gebruiker aanmaken ==="
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  echo "Gebruiker '$DEPLOY_USER' aangemaakt en toegevoegd aan docker-groep."
else
  echo "Gebruiker '$DEPLOY_USER' bestaat al."
fi

# SSH-sleutel voor deploy-gebruiker (zet je eigen public key hier neer)
mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
touch /home/$DEPLOY_USER/.ssh/authorized_keys
chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
echo "Zet je SSH public key in /home/$DEPLOY_USER/.ssh/authorized_keys"

echo "=== [4/6] Repository klonen ==="
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone "$REPO_URL" "$DEPLOY_DIR"
  chown -R $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_DIR"
  echo "Repository gekloon naar $DEPLOY_DIR"
else
  echo "Repository al aanwezig in $DEPLOY_DIR"
fi

echo "=== [5/6] Omgevingsbestand controleren ==="
if [ ! -f "$DEPLOY_DIR/.env.prod" ]; then
  cat <<'EOF'

  !! LET OP: $DEPLOY_DIR/.env.prod ontbreekt!
  Kopieer je lokale .env.prod naar de VPS:
    scp .env.prod deploy@46.224.186.177:/opt/denotenman/.env.prod

EOF
else
  echo ".env.prod gevonden."
fi

echo "=== [6/6] Firewall (UFW) instellen ==="
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp   comment 'SSH'
  ufw allow 80/tcp   comment 'HTTP'
  ufw allow 443/tcp  comment 'HTTPS'
  ufw --force enable
  ufw status
fi

echo ""
echo "======================================================"
echo " VPS bootstrap klaar!"
echo ""
echo " Volgende stappen:"
echo "  1. Zet SSH public key in /home/deploy/.ssh/authorized_keys"
echo "  2. Kopieer .env.prod naar $DEPLOY_DIR/.env.prod"
echo "  3. Zorg dat DNS van denotenman.com → 46.224.186.177 wijst"
echo "     (ook api. en admin. subdomeinen)"
echo "  4. Voer uit: cd $DEPLOY_DIR && bash scripts/init-ssl.sh"
echo "======================================================"
