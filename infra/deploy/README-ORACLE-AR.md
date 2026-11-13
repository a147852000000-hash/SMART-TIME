# دليل النشر على Oracle Free Tier — خطوة بخطوة

> الحالة الفعلية المُتحقق منها (13 نوفمبر 2026): خادم Oracle **موجود وشغال** على
> `smart-time-ai.duckdns.org` (IP: `130.162.241.22`) بشهادة HTTPS سليمة، لكنه يشغّل
> خدمة auth **قديمة** فقط. النسخة الجديدة الموحدة (الواجهة + الـ API كاملة) لم تُنشر
> بعد. هذا الدليل ينشرها على نفس الخادم ويستبدل القديمة بأمان.

## معلومة مهمة قبل البدء
الواجهة الأمامية الحالية على main مستقلة تمامًا عن الخدمة القديمة: التسجيل والدخول
واستعادة كلمة المرور كلها تذهب لنفس الخادم الذي يخدمها (`apiUrl` = same-origin).
النداء القديم المضمن في `authService.ts` نحو `API_BASE` أصبح كودًا ميتًا بلا أي
متصل — لذلك النشر لا يحتاج أي تعديل في الكود.

## الخطوات

### الخطوة 1 — الاتصال بالخادم
```bash
ssh ubuntu@130.162.241.22     # أو المستخدم الموجود لديك (opc في بعض صور Oracle)
```
لو الاتصال يعمل، تخطَّ إلى الخطوة 3 مباشرة.

### الخطوة 2 — فقط لو ملف صورة جديدة أو السيرفر وقع
1. Oracle Console → Compute → Instance → إنشاء:
   - Image: **Ubuntu 24.04** — Shape: **VM.Standard.A1.Flex** (ARM، حتى 4 OCPU/24GB مجانًا) أو **VM.Standard.E2.1.Micro**
   - أثناء الإنشاء: نزّل مفتاح SSH الخاص واحتفظ به (لا ترسله لأحد)
2. Networking → VCN → Security Lists → Add Ingress Rule:
   - TCP **80** من `0.0.0.0/0`
   - TCP **443** من `0.0.0.0/0`
   - TCP **22** موجود افتراضيًا
3. حدّث سجل DuckDNS ليشير للـ IP الجديد (لو تغيّر).

### الخطوة 3 — نشر التطبيق (أمر واحد)
انسخ السكريبت من المستودع وشغّله:
```bash
sudo apt-get install -y git curl
curl -fsSL https://raw.githubusercontent.com/a147852000000-hash/SMART-TIME/main/infra/deploy/oracle-deploy.sh -o deploy.sh
chmod +x deploy.sh

# أدخل مفاتيحك الاختيارية في نفس السطر (المفاتيح الفارغة تظل placeholders في .env):
sudo GIT_TOKEN=<توكن جيت هاب> \
     GROQ_API_KEY=<مفتاح groq إن وجد> \
     TRIAL_MODE=true \
     sudo -E ./deploy.sh
```
السكريبت تلقائيًا:
- يوقف الخدمة القديمة بأمان **ويحفظ نسخة احتياطية** من إعداداتها في
  `/root/smart-time-legacy-backup` (لا يحذف أي ملف أو قاعدة بيانات)
- ينصب Node 24 LTS + nginx، يسحب آخر main، يبني الواجهة والسيرفر
- ينشئ خدمة `systemd` باسم `smart-time` على البورت 3000
- يضبط nginx مع **دعم WebSocket** للدردشة وشهادة TLS الموجودة يعاد استخدامها
- يتحقق من `/api/health` محليًا وخارجيًا ويطبع ملخصًا

### الخطوة 4 — أكمل مفاتيح البريد (مهم لاستعادة كلمات المرور)
```bash
sudo nano /opt/smart-time/.env     # SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM أو RESEND_API_KEY
sudo systemctl restart smart-time
```
> بيانات البريد القديمة كانت تعمل على الخادم القديم — انسخها من ملف الإعدادات
> الاحتياطي في `/root/smart-time-legacy-backup` إن وجد.

### الخطوة 5 — (اختياري) شهادة TLS إن لم توجد
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d smart-time-ai.duckdns.org
```

### الخطوة 6 — المعاينة والاختبار
افتح `https://smart-time-ai.duckdns.org` وجرّب: التسجيل → الدخول → المصروفات
والميزانية → النسخ الاحتياطي/الاستعادة → الدردشة → القرآن offline.

## أوامر التشغيل اليومية
```bash
journalctl -u smart-time -f                 # السجلات المباشرة
sudo systemctl restart smart-time           # إعادة التشغيل
# التحديث لآخر main:
cd /opt/smart-time && sudo git pull && sudo npm ci && sudo npm run build && sudo systemctl restart smart-time
```

## التراجع (Rollback)
الخدمة القديمة لم تُحذف:
```bash
# استعادة وحدة systemd القديمة إن وجدت (استبدل الاسم بالفعل):
sudo systemctl enable --now <old-unit-name>
sudo systemctl disable --now smart-time
```

## الأمان قبل البدء الفعلي
- مفاتيح المزودين تُكتب في `/opt/smart-time/.env` فقط (صلاحية 600) — لا مفتاح داخل الكود.
- بعد النشر: أعد توليد توكن GitHub المستخدم في السحب واحذف أي توكن تمت مشاركته في محادثة.
