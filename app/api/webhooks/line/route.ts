import { NextResponse } from 'next/server';
import { verifyLineSignature, storeLineGroupId } from '@/lib/line';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('x-line-signature') ?? '';

  if (!await verifyLineSignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const data = JSON.parse(body) as {
      events?: Array<{ source?: { type?: string; groupId?: string } }>;
    };
    for (const event of data.events ?? []) {
      if (event.source?.type === 'group' && event.source.groupId) {
        await storeLineGroupId(event.source.groupId);
        console.log('[LINE webhook] Group ID captured:', event.source.groupId);
        break;
      }
    }
  } catch {
    // ignore parse errors — still return 200 to LINE
  }

  return NextResponse.json({ ok: true });
}
