import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users - Get all users (admin only)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    // Check if user is authenticated and is admin
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
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

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users - Update user role (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    // Check if user is authenticated and is admin
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId, role } = await request.json();

    if (!userId || !["ADMIN", "USER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Prevent admin from removing their own admin role
    if (userId === session.user.id && role === "USER") {
      return NextResponse.json(
        { error: "Cannot remove your own admin role" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
