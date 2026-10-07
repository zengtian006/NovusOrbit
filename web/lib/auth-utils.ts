import { Session } from "next-auth";
import { prisma } from "./prisma";

/**
 * Check if user is admin
 */
export function isAdmin(session: Session | null): boolean {
  return (session?.user as any)?.role === "ADMIN";
}

/**
 * Check if user ID is admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  role: "ADMIN" | "USER"
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

/**
 * Get all users with their roles
 */
export async function getAllUsers() {
  return await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get user role by ID
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role || null;
}
