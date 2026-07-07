import subprocess
import sys
import os

project_dir = '/vercel/share/v0-project'

print('[v0] Checking available package managers...')

# Try pnpm first
for cmd in ['pnpm', 'npm', 'npx pnpm']:
    try:
        result = subprocess.run(
            cmd.split() + ['--version'],
            capture_output=True, text=True, cwd=project_dir
        )
        if result.returncode == 0:
            print(f'[v0] Found: {cmd} {result.stdout.strip()}')
            break
    except FileNotFoundError:
        print(f'[v0] Not found: {cmd}')
        continue

print('[v0] Attempting pnpm install --frozen-lockfile=false ...')
try:
    result = subprocess.run(
        ['pnpm', 'install', '--no-frozen-lockfile'],
        capture_output=True, text=True, cwd=project_dir
    )
    print('[v0] stdout:', result.stdout[:2000])
    print('[v0] stderr:', result.stderr[:2000])
    print('[v0] Return code:', result.returncode)
except FileNotFoundError as e:
    print(f'[v0] Error: {e}')
    sys.exit(1)
