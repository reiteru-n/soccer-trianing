import { NextResponse } from 'next/server';
import { sendLineMessage, isLineConfigured } from '@/lib/line';
import { logChange, getIp, getUa, getDeviceId } from '@/lib/logger';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message: unknown = body?.message;
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 503 });
  }
  await sendLineMessage(message.trim());
  await logChange({
    ts: new Date().toISOString(),
    action: 'line_manual_notify',
    detail: `手動LINE通知: ${message.trim().slice(0, 80)}`,
    ip: getIp(req),
    ua: getUa(req),
    device_id: getDeviceId(req),
  });
  return NextResponse.json({ ok: true });
}
