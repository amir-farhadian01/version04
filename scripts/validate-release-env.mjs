const required = [
  'DATABASE_URL',
  'MEDIA_DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DB_PASSWORD',
  'MEDIA_DB_PASSWORD',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
  'GRAFANA_ADMIN_PASSWORD',
  'METRICS_TOKEN',
  'KYC_DOCUMENT_SIGNING_SECRET',
];

const insecure = /^(change_me|change-me|change_me_before_deploy|admin|minioadmin|replace-this-in-production|dev-secret-local)$/i;
const problems = [];

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) problems.push(`${name} is missing`);
  else if (insecure.test(value)) problems.push(`${name} uses an insecure placeholder`);
}

if (process.env.JWT_SECRET?.trim() && process.env.JWT_SECRET?.trim() === process.env.JWT_REFRESH_SECRET?.trim()) {
  problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
}

if (problems.length) {
  console.error('Release environment validation failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Release environment validation passed.');
