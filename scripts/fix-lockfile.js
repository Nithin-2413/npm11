import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const projectDir = '/vercel/share/v0-project';
const lockFile = join(projectDir, 'package-lock.json');

// Delete stale lock file
if (existsSync(lockFile)) {
  unlinkSync(lockFile);
  console.log('Deleted old package-lock.json');
}

// Regenerate the lock file
try {
  execSync('npm install --package-lock-only', { cwd: projectDir, stdio: 'inherit' });
  console.log('Successfully regenerated package-lock.json');
} catch (err) {
  console.error('Failed to regenerate lock file:', err.message);
  process.exit(1);
}
