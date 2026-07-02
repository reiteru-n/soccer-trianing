const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';
const LINE_QUOTA_API = 'https://api.line.me/v2/bot/message/quota';
const LINE_CONSUMPTION_API = 'https://api.line.me/v2/bot/message/quota/consumption';

/**
 * 複数のLINE公式アカウント（ボット）を順に使うフォールバック構成。
 * - Bot 0: LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET / groupId=sch:line_group_id
 * - Bot n(2..): LINE_CHANNEL_ACCESS_TOKEN_n / LINE_CHANNEL_SECRET_n / groupId=sch:line_group_id_n
 * 無料枠(月200通)を使い切ったボットは 429 を返すので、次のボットへ自動フォールバックする。
 */
export interface LineBot {
  index: number;          // 1, 2, 3...（表示用）
  token: string;
  secret: string;
  groupIdKey: string;     // Redis key
  legacyEnvGroupId?: string; // LINE_GROUP_ID (bot1のみ後方互換)
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

/** 環境変数から設定済みのボット一覧を取得（Bot1 → Bot2 → ... の優先順） */
export function getLineBots(): LineBot[] {
  const bots: LineBot[] = [];
  const token1 = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (token1) {
    bots.push({
      index: 1,
      token: token1,
      secret: process.env.LINE_CHANNEL_SECRET ?? '',
      groupIdKey: 'sch:line_group_id',
      legacyEnvGroupId: process.env.LINE_GROUP_ID ?? undefined,
    });
  }
  // Bot2以降: LINE_CHANNEL_ACCESS_TOKEN_2, _3, ...
  for (let n = 2; n <= 5; n++) {
    const token = process.env[`LINE_CHANNEL_ACCESS_TOKEN_${n}`];
    if (!token) continue;
    bots.push({
      index: n,
      token,
      secret: process.env[`LINE_CHANNEL_SECRET_${n}`] ?? '',
      groupIdKey: `sch:line_group_id_${n}`,
    });
  }
  return bots;
}

export function isLineConfigured(): boolean {
  return getLineBots().length > 0;
}

async function getGroupIdForBot(bot: LineBot): Promise<string | null> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const redis = await getRedis();
      const id = await redis.get<string>(bot.groupIdKey);
      if (id) return id;
    } catch {
      // fall through
    }
  }
  return bot.legacyEnvGroupId ?? null;
}

/** Bot1のgroupId（後方互換のため個別export） */
export async function getLineGroupId(): Promise<string | null> {
  const bots = getLineBots();
  if (bots.length === 0) return null;
  return getGroupIdForBot(bots[0]);
}

/** 1つのボットからグループへpush。戻り値 status（送信不能時は0） */
async function pushViaBot(bot: LineBot, text: string): Promise<{ status: number; body: string; groupId: string | null }> {
  const groupId = await getGroupIdForBot(bot);
  if (!groupId) return { status: 0, body: 'groupId not found', groupId: null };
  const res = await fetch(LINE_PUSH_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bot.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }],
    }),
  });
  const body = await res.text();
  return { status: res.status, body, groupId };
}

/**
 * メッセージ送信。Bot1 → Bot2 → ... の順に試し、
 * 429（月間上限）や送信不能なら次のボットへフォールバックする。
 */
export async function sendLineMessage(text: string): Promise<void> {
  const logRedis = async (data: object) => {
    if (!process.env.UPSTASH_REDIS_REST_URL) return;
    const redis = await getRedis().catch(() => null);
    if (redis) await redis.set('sch:line_send_debug', data).catch(() => {});
  };

  const bots = getLineBots();
  if (bots.length === 0) {
    await logRedis({ ts: new Date().toISOString(), error: 'no LINE bot configured (LINE_CHANNEL_ACCESS_TOKEN not set)' });
    return;
  }

  const attempts: { bot: number; status: number; note?: string }[] = [];
  for (const bot of bots) {
    try {
      const { status, body, groupId } = await pushViaBot(bot, text);
      attempts.push({ bot: bot.index, status, note: status === 200 ? undefined : body.slice(0, 80) });
      if (status === 200) {
        await logRedis({ ts: new Date().toISOString(), sentBy: bot.index, status, groupId, attempts, tokenPrefix: bot.token.slice(0, 10) });
        return;
      }
      // 429（上限）やその他エラーは次のボットへフォールバック
    } catch (e) {
      attempts.push({ bot: bot.index, status: -1, note: String(e).slice(0, 80) });
    }
  }
  // 全ボット失敗
  await logRedis({ ts: new Date().toISOString(), error: 'all bots failed or exhausted', attempts });
}

/** 各ボットの残枠状況を取得（バッジ・デバッグ表示用） */
export interface LineBotQuota {
  index: number;
  totalUsage: number;
  limit: number;
  memberCount: number | null;
  hasGroup: boolean;
}

export async function getLineBotQuotas(): Promise<LineBotQuota[]> {
  const bots = getLineBots();
  return Promise.all(bots.map(async (bot) => {
    const headers = { Authorization: `Bearer ${bot.token}` };
    let totalUsage = 0;
    let limit = 200;
    let memberCount: number | null = null;
    let hasGroup = false;
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(LINE_QUOTA_API, { headers }),
        fetch(LINE_CONSUMPTION_API, { headers }),
      ]);
      const q = await qRes.json() as { type?: string; value?: number };
      const c = await cRes.json() as { totalUsage?: number };
      limit = q.value ?? 200;
      totalUsage = c.totalUsage ?? 0;
    } catch {
      // ignore
    }
    const groupId = await getGroupIdForBot(bot);
    hasGroup = !!groupId;
    if (groupId) {
      try {
        const cRes = await fetch(`https://api.line.me/v2/bot/group/${groupId}/members/count`, { headers: { Authorization: `Bearer ${bot.token}` } });
        if (cRes.ok) {
          const cd = await cRes.json() as { count?: number };
          memberCount = cd.count ?? null;
        }
      } catch {
        // ignore
      }
    }
    return { index: bot.index, totalUsage, limit, memberCount, hasGroup };
  }));
}

export async function verifyLineSignature(body: string, signature: string, secret?: string): Promise<boolean> {
  const key = secret ?? process.env.LINE_CHANNEL_SECRET;
  if (!key) return false;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(body));
  const arr = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const expected = btoa(binary);
  return expected === signature;
}

/**
 * Webhook署名を全ボットのsecretと照合し、一致したボットを返す。
 * 複数ボットが同じWebhook URLを共有しても、どのボット宛か判別できる。
 */
export async function matchBotBySignature(body: string, signature: string): Promise<LineBot | null> {
  for (const bot of getLineBots()) {
    if (bot.secret && await verifyLineSignature(body, signature, bot.secret)) {
      return bot;
    }
  }
  return null;
}

export async function storeLineGroupId(groupId: string, groupIdKey = 'sch:line_group_id'): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;
  try {
    const redis = await getRedis();
    await redis.set(groupIdKey, groupId);
  } catch {
    // ignore
  }
}
