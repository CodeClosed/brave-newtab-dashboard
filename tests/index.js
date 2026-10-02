import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Directory entry point for Node on Windows when 'node --test tests/' resolves directory as an entry point
if (process.argv[1] && process.argv[1].endsWith('tests')) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('NODE_TEST_')) delete env[k];
  }
  const result = spawnSync(process.execPath, ['--test'], { stdio: 'inherit', env });
  process.exit(result.status ?? 0);
}
