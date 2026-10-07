#!/usr/bin/env node

/**
 * User management script for promoting users to admin
 * Usage:
 *   npx tsx scripts/manage-users.ts list              # List all users
 *   npx tsx scripts/manage-users.ts promote <email>   # Make user admin
 *   npx tsx scripts/manage-users.ts demote <email>    # Remove admin role
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listUsers() {
  console.log("\n📋 All Users:\n");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  users.forEach((user: typeof users[number]) => {
    const badge = user.role === "ADMIN" ? "👑" : "👤";
    console.log(
      `${badge} ${user.name || "Unknown"} (${user.email || "No email"})\n   Role: ${user.role} | Created: ${user.createdAt.toLocaleDateString()}`
    );
  });
  console.log();
}

async function promoteUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log(`❌ User with email "${email}" not found.`);
    return;
  }

  if (user.role === "ADMIN") {
    console.log(`⚠️  User "${user.name}" is already an admin.`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`✅ User "${user.name}" (${email}) is now an ADMIN.`);
}

async function demoteUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log(`❌ User with email "${email}" not found.`);
    return;
  }

  if (user.role === "USER") {
    console.log(`⚠️  User "${user.name}" is already a regular user.`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { role: "USER" },
  });

  console.log(`✅ User "${user.name}" (${email}) is now a USER.`);
}

async function main() {
  const command = process.argv[2];
  const argument = process.argv[3];

  if (!command) {
    console.log(
      "\nUsage: npx tsx scripts/manage-users.ts <command> [email]\n"
    );
    console.log("Commands:");
    console.log("  list              - List all users with their roles");
    console.log("  promote <email>   - Make user an admin");
    console.log("  demote <email>    - Remove admin role from user\n");
    return;
  }

  try {
    if (command === "list") {
      await listUsers();
    } else if (command === "promote") {
      if (!argument) {
        console.log("❌ Please provide an email address.\n");
        console.log("Usage: npx tsx scripts/manage-users.ts promote <email>\n");
        return;
      }
      await promoteUser(argument);
    } else if (command === "demote") {
      if (!argument) {
        console.log("❌ Please provide an email address.\n");
        console.log("Usage: npx tsx scripts/manage-users.ts demote <email>\n");
        return;
      }
      await demoteUser(argument);
    } else {
      console.log(`❌ Unknown command: "${command}"\n`);
      console.log("Valid commands: list, promote, demote\n");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
