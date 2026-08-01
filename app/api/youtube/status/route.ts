import { NextResponse } from 'next/server';
import { hasRefreshToken } from '@/lib/youtubeAuth';

export async function GET() {
  try {
    return NextResponse.json({ connected: await hasRefreshToken() });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
