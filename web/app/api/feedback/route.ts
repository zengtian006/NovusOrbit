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

        // Call the backend directly. Frontend and backend run in the same
        // container, so use the internal address: NEXT_PUBLIC_API_BASE is the
        // public site URL in production, and the proxy sends /api/feedback back
        // to this route, so using it made the request call itself.
        const backendUrl =
            process.env.BACKEND_INTERNAL_URL ||
            `http://127.0.0.1:${process.env.BACKEND_PORT || "8001"}`;

        let response: Response;
        try {
            response = await fetch(`${backendUrl}/api/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                    timestamp: new Date().toISOString(),
                }),
                signal: AbortSignal.timeout(15000),
            });
        } catch (backendError) {
            console.error("Feedback: backend unreachable:", backendError);
            return NextResponse.json(
                { error: "Feedback service is unavailable. Please try again later." },
                { status: 502 }
            );
        }

        if (!response.ok) {
            console.error("Feedback: backend error:", response.status, await response.text());
            return NextResponse.json(
                { error: "Could not send feedback. Please try again later." },
                { status: 502 }
            );
        }

        return NextResponse.json(
            { success: true, message: "Feedback sent" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error processing feedback:", error);
        return NextResponse.json(
            { error: "Failed to process feedback" },
            { status: 500 }
        );
    }
}
