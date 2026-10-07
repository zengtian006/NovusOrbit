import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/analytics/track - Track user analytics event
 */
export async function POST(request: Request) {
    try {
        const session = await auth();

        // Check if user is authenticated
        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { action, feature, metadata } = body;

        if (!action || !feature) {
            return NextResponse.json(
                { error: "Missing required fields: action and feature" },
                { status: 400 }
            );
        }

        // Create analytics record
        const analytics = await prisma.userAnalytics.create({
            data: {
                userId: session.user.id!,
                userEmail: session.user.email,
                action,
                feature,
                metadata: metadata || {},
            },
        });

        return NextResponse.json({ success: true, id: analytics.id });
    } catch (error) {
        console.error("Error tracking analytics:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
