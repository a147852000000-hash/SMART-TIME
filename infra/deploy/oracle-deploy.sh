#!/usr/bin/env bash
# =============================================================================
# SMART-TIME — Oracle Free Tier deployment script (Ubuntu 22.04 / 24.04)
# =============================================================================
# يشغّل النسخة الموحدة الجديدة (server.ts يقدّم الواجهة + الـ API معًا) على
# الخادم المجاني من Oracle، ويستبدل خدمة auth القديمة بأمان (بدون حذف بياناتها).
#
# الاستخدام:
#   sudo REPO_URL=... GIT_TOKEN=... [متغيرات .env الاختيارية] ./oracle-deploy.sh
#
# متغيرات اختيارية تُمرَّر قبل السكريبت وتكتب داخل /opt/smart-time/.env:
#   GROQ_API_KEY, TURNSTILE_SECRET_KEY, RESEND_API_KEY,
#   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM,
#   EMAIL_PROVIDER, EMAIL_FROM, TOMTOM_API_KEY, GNEWS_API_KEY, RAPIDAPI_KEY,
#   API_FOOTBALL_KEY, TRIAL_MODE
#   VITE_TURNSTILE_SITE_KEY (يُبنى داخل الواجهة وقت البناء)
#
# ما لا يفعله السكريبت أبدًا:
#   - حذف مجلد الخدمة القديمة أو قاعدة بياناتها (نسخة احتياطية فقط ثم إيقافها)
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/smart-time}"
REPO_URL="${REPO_URL:-https://github.com/a147852000000-hash/SMART-TIME.git}"
GIT_TOKEN="${GIT_TOKEN:-}"
DOMAIN="${DOMAIN:-smart-time-ai.duckdns.org}"
SERVICE_PORT="${SERVICE_PORT:-3000}"
SERVICE_USER="${SERVICE_USER:-smarttime}"
NODE_MAJOR="${NODE_MAJOR:-24}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"

log() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33mتحذير: %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mفشل: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "شغّل السكريبت بالـ sudo: sudo ./oracle-deploy.sh"

# -----------------------------------------------------------------------------
# 1) الكشف عن الخدمة القديمة على 80/443 وإيقافها بأمان (مع نسخة احتياطية)
# -----------------------------------------------------------------------------
log "1/8 فحص الخدمة القديمة على البورتات 80/443"
if command -v pm2 >/dev/null 2>&1 && [[ $(pm2 jlist 2>/dev/null | grep -c '"name"') -gt 0 ]]; then
  log "إيقاف خدمات pm2 القديمة (بدون حذف الملفات)"
  pm2 stop all 2>/dev/null || true
  pm2 kill 2>/dev/null || true
fi
OLD_UNIT_NAME=$(systemctl list-units --type=service --state=running 2>/dev/null \
  | awk '{print $1}' | grep -viE 'systemd|ssh|nginx|dbus|cron|network|getty|oracle|resolv|polkit|unattended|snap|fstrim|logrotate|udev|multipath' \
  | grep -iE 'smart|time|ai|node' | head -1 || true)
if [[ -n "${OLD_UNIT_NAME:-}" ]]; then
  log "إيقاف الوحدة القديمة: ${OLD_UNIT_NAME%.service} (إيقاف فقط — لا حذف)"
  systemctl stop "$OLD_UNIT_NAME" || true
  systemctl disable "$OLD_UNIT_NAME" 2>/dev/null || true
fi

# نسخة احتياطية من أي .env قديم في المواقع الشائعة
mkdir -p /root/smart-time-legacy-backup
for f in /root/.env /home/ubuntu/.env /srv/*/.env /opt/*/.env; do
  [[ -f "$f" ]] && cp -n "$f" /root/smart-time-legacy-backup/ 2>/dev/null || true
done
warn "أي ملفات إعدادات قديمة تُنسخ إلى /root/smart-time-legacy-backup (لا تُحذف أبدًا)"

# -----------------------------------------------------------------------------
# 2) الحزم الأساسية + Node.js ${NODE_MAJOR} LTS (مطلوب 22.5+ لـ node:sqlite)
# -----------------------------------------------------------------------------
log "2/8 تنصيب الحزم و Node ${NODE_MAJOR}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq curl git nginx ca-certificates
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 22 ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
log "Node $(node -v) — npm $(npm -v)"

# -----------------------------------------------------------------------------
# 3) سحب الكود آخر main إلى ${APP_DIR}
# -----------------------------------------------------------------------------
log "3/8 سحب الكود إلى ${APP_DIR}"
CLONE_URL="$REPO_URL"
if [[ -n "$GIT_TOKEN" ]]; then
  CLONE_URL="${REPO_URL/https:\/\//https://x-access-token:${GIT_TOKEN}@}"
fi
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "${APP_DIR}.tmp"
  git clone --quiet "$CLONE_URL" "${APP_DIR}.tmp"
  mv "${APP_DIR}.tmp" "$APP_DIR"
fi

# -----------------------------------------------------------------------------
# 4) كتابة ملف البيئة .env (القيم التي مُرِّرت للسكريبت أو placeholders)
# -----------------------------------------------------------------------------
log "4/8 كتابة ${APP_DIR}/.env"
ENV_KEYS=(GROQ_API_KEY TURNSTILE_SECRET_KEY RESEND_API_KEY SMTP_HOST SMTP_PORT
          SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM EMAIL_PROVIDER EMAIL_FROM
          TOMTOM_API_KEY GNEWS_API_KEY RAPIDAPI_KEY API_FOOTBALL_KEY
          MESSAGECENTRAL_CUSTOMER_ID MESSAGECENTRAL_KEY SMS_PROVIDER
          SMS_WEBHOOK_URL SMS_WEBHOOK_SECRET TRIAL_MODE)
{
  echo "NODE_ENV=production"
  echo "PORT=${SERVICE_PORT}"
  echo "FRONTEND_URL=https://${DOMAIN}"
  for k in "${ENV_KEYS[@]}"; do
    v="${!k:-}"
    echo "$k=$v"
  done
} > "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
warn "أكمل قيم المفاتيح الفارغة في ${APP_DIR}/.env (خاصة البريد: SMTP_* أو RESEND_API_KEY) قبل الاعتماد على استعادة كلمات المرور"

# -----------------------------------------------------------------------------
# 5) بناء الواجهة (متغيرات VITE تُدمج وقت البناء) + بناء السيرفر
# -----------------------------------------------------------------------------
log "5/8 البناء (npm ci + build)"
if [[ -n "${VITE_TURNSTILE_SITE_KEY:-}" ]]; then
  echo "VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}" > "$APP_DIR/.env.local"
  warn "VITE_TURNSTILE_SITE_KEY كُتب في .env.local — أعد البناء إذا غيّرته"
else
  rm -f "$APP_DIR/.env.local"
fi
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build

# -----------------------------------------------------------------------------
# 6) مستخدم تشغيل مخصص + صلاحيات
# -----------------------------------------------------------------------------
log "6/8 مستخدم الخدمة والصلاحيات"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

# -----------------------------------------------------------------------------
# 7) خدمة systemd + nginx (TLS موجود يعاد استخدامه، وWebSocket عبر proxy)
# -----------------------------------------------------------------------------
log "7/8 خدمة systemd و nginx"
cat > /etc/systemd/system/smart-time.service <<UNIT
[Unit]
Description=SMART TIME unified server (SPA + API + chat WS)
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/dist/server.cjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable smart-time.service

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
TLS_LINES=""
if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
  log "شهادة Let's Encrypt موجودة لـ ${DOMAIN} — إعادة استخدامها"
  TLS_LINES="ssl_certificate ${CERT_DIR}/fullchain.pem; ssl_certificate_key ${CERT_DIR}/privkey.pem;"
else
  warn "لا توجد شهادة TLS للمجال — سيُنشر HTTP على 80 الآن؛ شغّل: sudo certbot --nginx -d ${DOMAIN} بعد التشغيل"
fi

cat > "$NGINX_SITE" <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl http2;
  server_name ${DOMAIN};
  ${TLS_LINES}

  client_max_body_size 64m;

  location / {
    proxy_pass http://127.0.0.1:${SERVICE_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
  }
}
NGINX
ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# -----------------------------------------------------------------------------
# 8) التشغيل والتحقق الصحي
# -----------------------------------------------------------------------------
log "8/8 تشغيل الخدمة والتحقق"
systemctl restart smart-time.service
HEALTH_OK=0
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${SERVICE_PORT}/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    log "الخدمة تعمل: /api/health OK"
    curl -s "http://127.0.0.1:${SERVICE_PORT}/api/health"; echo
    break
  fi
  sleep 1
done
if [[ "$HEALTH_OK" -eq 0 ]]; then
  journalctl -u smart-time -n 30 --no-pager || true
  die "الخدمة لم تستجب — راجع السجلات أعلاه"
fi
EXTERNAL=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/health" || echo "000")
if [[ "$EXTERNAL" == "200" ]]; then
  log "النشر مكتمل: https://${DOMAIN} — جاهز للمعاينة والاختبار"
else
  warn "الفحص الخارجي أعاد ${EXTERNAL} — لو 000: افتح البورتين 80/443 في Oracle Security List للـ VCN، ولو 404: انتظر دقيقة وأعد المحاولة"
fi

cat <<SUMMARY

------------------------------------------------------------
ملخص النشر
  التطبيق   : https://${DOMAIN}  (systemd: smart-time)
  المجلد    : ${APP_DIR}
  البيئة    : ${APP_DIR}/.env  ← أكمل مفاتيح البريد/AI الفارغة ثم:
              sudo systemctl restart smart-time
  السجلات   : journalctl -u smart-time -f
  تحديث     : cd ${APP_DIR} && sudo git pull && sudo npm ci && sudo npm run build && sudo systemctl restart smart-time
  التراجع   : الخدمة القديمة أُوقفت فقط — ملفاتها وقاعدتها في مكانها
------------------------------------------------------------
SUMMARY
