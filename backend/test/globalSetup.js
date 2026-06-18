const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  const cwd = path.resolve(__dirname, '..');
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'Please set TEST_DATABASE_URL (or DATABASE_URL) before running tests.'
    );
  }

  process.env.DATABASE_URL = databaseUrl;

  execSync(
    'npx prisma migrate reset --force --skip-generate --skip-seed --config=./prisma.config.ts',
    {
      stdio: 'inherit',
      cwd,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    }
  );
};
