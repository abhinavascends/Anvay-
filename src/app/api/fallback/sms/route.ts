import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const from = body.from;
    const message = body.body;

    if (!from || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing 'from' or 'body'",
        },
        { status: 400 }
      );
    }

    console.log("SMS received:", {
      from,
      message,
    });

    return NextResponse.json({
      success: true,
      message: "SMS received successfully",
      data: {
        from,
        message,
      },
    });
  } catch (error) {
    console.error("SMS webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request",
      },
      { status: 400 }
    );
  }
}
