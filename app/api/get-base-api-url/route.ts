import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ baseApiUrl: process.env.BASE_API_URL || 'https://api.heygen.com' });
}