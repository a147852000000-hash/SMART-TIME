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

for (const file of files) {
  // الاستثناء المقصود فقط
  if (file.includes('storageAdapter.ts')) continue
  if (file.includes('storageKeys.ts')) continue
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
