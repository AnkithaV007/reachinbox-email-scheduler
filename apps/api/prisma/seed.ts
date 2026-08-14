import { prisma } from "../src/lib/prisma";
import { ensureSenders } from "../src/services/mailer";
import { hashPassword } from "../src/lib/crypto";

async function main() {
  await ensureSenders();
  const senders = await prisma.sender.findMany();
  console.table(senders.map((s) => ({ id: s.id, email: s.email, host: s.smtpHost })));

  // Seed demo user accounts
  const demoUsers = [
    { email: "demo@reachinbox.ai", name: "Demo User", password: "password123" },
    { email: "user@example.com", name: "Alex Johnson", password: "Password123!" },
  ];

  for (const u of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          password: hashPassword(u.password),
        },
      });
      console.log(`Seeded user: ${u.email} (password: ${u.password})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
