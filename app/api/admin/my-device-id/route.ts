import { NextResponse } from 'next/server';
import { getDeviceId } from '@/lib/logger';

export async function GET(req: Request) {
  const deviceId = getDeviceId(req);
  return NextResponse.json({ deviceId });
}
