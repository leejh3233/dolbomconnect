import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        deployedAt: new Date().toISOString(),
        status: "Active",
        message: "Deployment check successful"
    });
}
