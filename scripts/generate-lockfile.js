import { execSync } from 'child_process'

const root = '/vercel/share/v0-project'

console.log('[v0] Project root:', root)
console.log('[v0] Running npm install --package-lock-only ...')
execSync('npm install --package-lock-only', { cwd: root, stdio: 'inherit' })
console.log('[v0] Done. package-lock.json has been generated.')
