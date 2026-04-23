require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const demoUsers = [
  { id: 900001, username: 'DemoNewUser', email: 'new.user@empros.demo', password: 'DemoPass123', age: 24, gender: 'Female' },
  { id: 900002, username: 'DemoIntermediateUser', email: 'intermediate.user@empros.demo', password: 'DemoPass123', age: 31, gender: 'Male' },
];

(async () => {
  for (const u of demoUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    const data = { username: u.username, email: u.email, password: hash, age: u.age, gender: u.gender };
    await prisma.user.upsert({
      where: { id: u.id },
      update: data,
      create: { id: u.id, ...data },
    });
    console.log('✅ upserted', u.id, u.email);
  }
  // Sync sequence so new registrations don't collide
  try {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"','id'), GREATEST((SELECT MAX(id) FROM "User"), 1))`);
    console.log('✅ sequence synced');
  } catch (e) {
    console.warn('⚠️ sequence sync skipped:', e.message);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
