import fs from 'fs'
import path from 'path'

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

const srcDir = 'src'
const files = walk(srcDir)
let violations = []

// استثناءات موثقة — تخزين تفضيلات واجهة/بنية تحتية وليست بيانات مستخدم:
// - religious/*: ثيم القسم الديني (فاتح/داكن) تفضيل عرض محلي فقط.
// - apiConfig.ts: تجاوز عنوان السيرفر داخل غلاف الأندرويد (Capacitor) —
//   يجب أن يعمل قبل إقلاع التطبيق فلا يمكنه المرور عبر StorageAdapter.
const ALLOWED_DIRECT_STORAGE = [
  'src/components/religious/ReligiousChoice.tsx',
  'src/components/religious/ReligiousPwaSetup.tsx',
  'src/components/religious/components/KhatmaTracker.tsx',
  'src/components/religious/components/PrayerTimes.tsx',
  'src/components/religious/components/Tasbeeh.tsx',
  'src/services/apiConfig.ts',
]

for (const file of files) {
  // الاستثناء المقصود فقط
  if (file.includes('storageAdapter.ts')) continue
  if (file.includes('storageKeys.ts')) continue
  if (ALLOWED_DIRECT_STORAGE.some((allowed) => file.replaceAll('\\', '/').endsWith(allowed))) continue
  const content = fs.readFileSync(file, 'utf8')
  if (/localStorage\.setItem\s*\(/.test(content)) {
    violations.push(file)
  }
}

if (violations.length > 0) {
  console.error('Phase 4 FAILED - Direct localStorage.setItem found in:')
  violations.forEach(f => console.error(' -', f))
  process.exit(1)
}

console.log(`Phase 4 PASS - Zero direct localStorage.setItem in src (${files.length} files scanned, Adapter excluded)`)
