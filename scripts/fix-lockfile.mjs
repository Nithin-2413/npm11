import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';

// Delete the stale lock file
if (existsSync('/vercel/share/v0-project/package-lock.json')) {
  unlinkSync('/vercel/share/v0-project/package-lock.json');
  console.log('Deleted old package-lock.json');
}

// Regenerate the lock file
console.log('Regenerating package-lock.json...');
execSync('npm install --package-lock-only', {
  cwd: '/vercel/share/v0-project',
  stdio: 'inherit'
});
console.log('Done! Lock file regenerated.');
