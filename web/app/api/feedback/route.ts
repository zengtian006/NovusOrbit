import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, message } = body;

        // Validate input
        if (!name || !email || !message) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400 }
            );
        }

        // Send email to backend API
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

        try {
            const response = await fetch(`${backendUrl}/api/feedback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                console.error("Backend API error:", await response.text());
                throw new Error("Backend API failed");
            }

            return NextResponse.json(
                { success: true, message: "Feedback sent successfully" },
                { status: 200 }
            );
        } catch (backendError) {
            console.error("Error calling backend API:", backendError);

            // Fallback: Log to console (in production, you might want to store this in a database)
            console.log("=== FEEDBACK RECEIVED ===");
            console.log(`From: ${name} <${email}>`);
            console.log(`Message: ${message}`);
            console.log(`Time: ${new Date().toISOString()}`);
            console.log("========================");

            return NextResponse.json(
                { success: true, message: "Feedback received" },
                { status: 200 }
            );
        }
    } catch (error) {
        console.error("Error processing feedback:", error);
        return NextResponse.json(
            { error: "Failed to process feedback" },
            { status: 500 }
        );
    }
}
