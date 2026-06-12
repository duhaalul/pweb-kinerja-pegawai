require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seed() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Koneksi DB berhasil...');

  // 1. Buat roles
  await db.query(`INSERT IGNORE INTO roles (id, name, guard_name, created_at, updated_at) VALUES
    (1, 'pimpinan', 'web', NOW(), NOW()),
    (2, 'pegawai', 'web', NOW(), NOW())`);
  console.log('✅ Roles dibuat');

  // 2. Buat employment_status (wajib ada karena FK di employees)
  await db.query(`INSERT IGNORE INTO employment_statuses (id, name, created_at, updated_at) VALUES
    (1, 'Tetap', NOW(), NOW())`);

  // 3. Buat organization_unit (wajib ada karena FK di employees)
  await db.query(`INSERT IGNORE INTO organization_units (id, name, code, type, organization_unit_id, created_at, updated_at) VALUES
    (1, 'Fakultas Informatika', 'FIF', 'faculty', 1, NOW(), NOW())`);

  // 4. Hash password
  const hashPimpinan = await bcrypt.hash('pimpinan123', 10);
  const hashPegawai1 = await bcrypt.hash('pegawai123', 10);
  const hashPegawai2 = await bcrypt.hash('pegawai123', 10);

  // 5. Insert users
  await db.query(`INSERT IGNORE INTO users (id, name, email, password, created_at, updated_at) VALUES
    (1, 'Budi Santoso', 'pimpinan@example.com', ?, NOW(), NOW()),
    (2, 'Ani Rahayu', 'pegawai1@example.com', ?, NOW(), NOW()),
    (3, 'Doni Setiawan', 'pegawai2@example.com', ?, NOW(), NOW())`,
    [hashPimpinan, hashPegawai1, hashPegawai2]
  );
  console.log('✅ Users dibuat');

  // 6. Insert employees (id sama dengan users karena FK)
  await db.query(`INSERT IGNORE INTO employees (id, employee_number, name, birth_place, birth_date, gender, marital_status, address, organization_unit_id, hire_date, employment_status_id, status, created_at, updated_at) VALUES
    (1, 'EMP001', 'Budi Santoso', 'Jakarta', '1980-01-01', 'male', 'married', 'Jl. Contoh No.1', 1, '2020-01-01', 1, 'active', NOW(), NOW()),
    (2, 'EMP002', 'Ani Rahayu', 'Bandung', '1990-05-10', 'female', 'single', 'Jl. Contoh No.2', 1, '2021-01-01', 1, 'active', NOW(), NOW()),
    (3, 'EMP003', 'Doni Setiawan', 'Surabaya', '1992-08-20', 'male', 'single', 'Jl. Contoh No.3', 1, '2021-06-01', 1, 'active', NOW(), NOW())`,
  );
  console.log('✅ Employees dibuat');

  // 7. Assign roles ke users
  await db.query(`INSERT IGNORE INTO model_has_roles (role_id, model_type, model_id) VALUES
    (1, 'App\\\\Models\\\\User', 1),
    (2, 'App\\\\Models\\\\User', 2),
    (2, 'App\\\\Models\\\\User', 3)`);
  console.log('✅ Roles di-assign ke users');

  await db.end();
  console.log('\n🎉 Seeder selesai! Akun tersedia:\n');
  console.log('👑 PIMPINAN');
  console.log('   Email    : pimpinan@example.com');
  console.log('   Password : pimpinan123\n');
  console.log('👷 PEGAWAI 1');
  console.log('   Email    : pegawai1@example.com');
  console.log('   Password : pegawai123\n');
  console.log('👷 PEGAWAI 2');
  console.log('   Email    : pegawai2@example.com');
  console.log('   Password : pegawai123');
}

seed().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});