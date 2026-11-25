import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [emailArg, nameArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const fullName = nameArg?.trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName || fullName.length < 2) {
  throw new Error('Penggunaan: npm run auth:bootstrap -- admin@example.com "Nama Admin"');
}
const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Konfigurasi lingkungan belum lengkap');
}
const db = postgres(DATABASE_URL, { prepare: false, max: 1 });
try {
  const existing = await db`SELECT 1 FROM user_roles WHERE role = 'SUPER_ADMIN' LIMIT 1`;
  if (existing.length) throw new Error('Super Admin sudah ada. Bootstrap hanya boleh sekali.');
  const password = `${randomBytes(24).toString('base64url')}!aA1`;
  const credentialDir = mkdtempSync(join(tmpdir(), 'sebakul-super-admin-'));
  const credentialFile = join(credentialDir, 'credentials.txt');
  writeFileSync(credentialFile, `Email: ${email}\nKata sandi sementara: ${password}\nGanti kata sandi setelah login pertama.\n`, { mode: 0o600, flag: 'wx' });
  const removeCredentials = () => { unlinkSync(credentialFile); rmdirSync(credentialDir); };
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (result.error || !result.data.user) {
    removeCredentials();
    throw new Error('Gagal membuat akun Super Admin di Supabase Auth');
  }
  try {
    await db.begin(async tx => {
      await tx`INSERT INTO users (id, email, full_name, is_active) VALUES (${result.data.user.id}, ${email}, ${fullName}, true)`;
      await tx`INSERT INTO user_roles (user_id, role, warung_id) VALUES (${result.data.user.id}, 'SUPER_ADMIN', NULL)`;
    });
  } catch (error) {
    await supabase.auth.admin.deleteUser(result.data.user.id);
    removeCredentials();
    throw error;
  }
  process.stdout.write(`Super Admin dibuat. Berkas kredensial sementara: ${credentialFile}\n`);
} finally {
  await db.end();
}
