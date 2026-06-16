import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check if admin exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash,
        role: 'admin'
      }
    });
    
    console.log('Admin user created: admin@example.com / admin123');
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
