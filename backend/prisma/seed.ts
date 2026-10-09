import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@yirs-demo.test').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '12345';
const demoPassword = process.env.SEED_DEMO_PASSWORD ?? '12345';

async function upsertUser(input: { email: string; passwordHash: string; firstName: string; lastName: string; role: 'individual' | 'business' | 'admin' | 'super_admin' }) {
  return prisma.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: { passwordHash: input.passwordHash, firstName: input.firstName, lastName: input.lastName, role: input.role, isActive: true, emailVerifiedAt: new Date() },
    create: { email: input.email.toLowerCase(), passwordHash: input.passwordHash, firstName: input.firstName, lastName: input.lastName, role: input.role, isActive: true, emailVerifiedAt: new Date() },
  });
}

async function main() {
  const [adminHash, demoHash] = await Promise.all([bcrypt.hash(adminPassword, 12), bcrypt.hash(demoPassword, 12)]);
  const admin = await upsertUser({ email: adminEmail, passwordHash: adminHash, firstName: 'YIRS', lastName: 'Administrator', role: 'super_admin' });
  const taxpayer = await upsertUser({ email: 'taxpayer@yirs-demo.test', passwordHash: demoHash, firstName: 'Demo', lastName: 'Taxpayer', role: 'individual' });
  await prisma.taxpayerProfile.upsert({ where: { userId: taxpayer.id }, update: { tin: '10000000001', fullName: 'Demo Taxpayer', address: 'Damaturu, Yobe State', verified: true, complianceStatus: 'compliant' }, create: { userId: taxpayer.id, tin: '10000000001', fullName: 'Demo Taxpayer', address: 'Damaturu, Yobe State', verified: true, complianceStatus: 'compliant' } });
  const business = await upsertUser({ email: 'business@yirs-demo.test', passwordHash: demoHash, firstName: 'Demo', lastName: 'Business', role: 'business' });
  await prisma.businessProfile.upsert({ where: { userId: business.id }, update: { tin: '20000000002', businessName: 'Damaturu Demo Enterprise', category: 'service_provider', address: 'Damaturu, Yobe State', verified: true, complianceStatus: 'compliant' }, create: { userId: business.id, tin: '20000000002', businessName: 'Damaturu Demo Enterprise', category: 'service_provider', address: 'Damaturu, Yobe State', verified: true, complianceStatus: 'compliant' } });
  console.log(`Seeded administrator: ${admin.email}`);
  console.log('Seeded taxpayer: taxpayer@yirs-demo.test');
  console.log('Seeded business: business@yirs-demo.test');
  console.log('Default demo password: 12345');
}

main().finally(() => prisma.$disconnect());
