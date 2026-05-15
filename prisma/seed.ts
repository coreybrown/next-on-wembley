import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Dev placeholder passcodes — TODO: change before any deploy.
// Real values can be set via SEED_COREY_PASSCODE / SEED_JAIMIE_PASSCODE env vars.
const users = [
  {
    username: "corey",
    displayName: "Corey",
    passcode: process.env.SEED_COREY_PASSCODE ?? "corey-dev",
  },
  {
    username: "jaimie",
    displayName: "Jaimie",
    passcode: process.env.SEED_JAIMIE_PASSCODE ?? "jaimie-dev",
  },
];

async function main() {
  for (const u of users) {
    const passcodeHash = await bcrypt.hash(u.passcode, 12);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { displayName: u.displayName, passcodeHash },
      create: {
        username: u.username,
        displayName: u.displayName,
        passcodeHash,
      },
    });
    console.log(`Seeded ${u.displayName} (passcode: ${u.passcode})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
