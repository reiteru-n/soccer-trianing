import { NextResponse } from 'next/server';
import { addSubscription, removeSubscription, vapidPublicKey, isWebPushConfigured } from '@/lib/webpush';
import type { PushSubscription } from 'web-push';

/** GET /api/sch/push — VAPID公開鍵を返す */
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'Web Push not configured' }, { status: 501 });
  }
  return NextResponse.json({ publicKey: vapidPublicKey });
}

/** POST /api/sch/push — 購読登録 */
export async function POST(req: Request) {
  try {
    const { subscription } = await req.json() as { subscription: PushSubscription };
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }
    await addSubscription(subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE /api/sch/push — 購読解除 */
export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json() as { endpoint: string };
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
