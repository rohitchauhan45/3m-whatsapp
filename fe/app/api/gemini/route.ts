import { NextRequest, NextResponse } from 'next/server';

// This API route is kept for future use
// All previous actions have been removed

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    return NextResponse.json(
      { error: `Action '${action}' is not available. This endpoint is reserved for future use.` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request.' },
      { status: 500 }
    );
  }
}

