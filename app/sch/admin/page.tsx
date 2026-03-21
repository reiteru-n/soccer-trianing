'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccessLogEntry, ChangeLogEntry } from '@/lib/types';

const ACTION_LABEL: Record<string, string> = {
  events: '📅 イベント',
  announcements: '📢 お知らせ',
  members: '👥 メンバー',
  parkingRecords: '🅿️ 駐車場記録',
  parkingRotation: '🔄 ローテーション',
  nearbyParking: '🗺️ 近隣駐車場',
  teamLogo: '🖼️ チームロゴ',
  login: '🔑 ログイン',
};

const TYPE_BADGE: Record<string, string> = {
  family: 'bg-blue-500/20 text-blue-300',
  team: 'bg-green-500/20 text-green-300',
  login: 'bg-amber-500/20 text-amber-300',
};

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  } catch {
    return ts;
  }
}

function shortUa(ua: string): string {
  if (ua === 'unknown') return '不明';
  if (/iPhone|iPad/.test(ua)) return '📱 iOS';
  if (/Android/.test(ua)) return '📱 Android';
  if (/Mac/.test(ua)) return '💻 Mac';
  if (/Windows/.test(ua)) return '🖥️ Windows';
  return ua.slice(0, 20);
}

// ワイルドカード対応マッチング（"203.0.113.*" → 203.0.113.x を全て除外）
function isIpExcluded(ip: string, excludedList: string[]): boolean {
  return excludedList.some(pattern => {
    if (pattern.endsWith('.*')) {
      return ip.startsWith(pattern.slice(0, -1)); // "203.0.113.*" → "203.0.113." で前方一致
    }
    return ip === pattern;
  });
}

// IPv4かどうか（サブネット除外ボタン表示判定）
function isIPv4(ip: string): boolean {
  return !ip.includes(':') && /^\d/.test(ip);
}

// IPの第4オクテットをワイルドカードに変換（"203.0.113.45" → "203.0.113.*"）
function toSubnetPattern(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  return ip;
}

// ─── Chart ───────────────────────────────────────────────

type ChartDay = { date: string; family: number; team: number; login: number; total: number };

function buildChartData(entries: AccessLogEntry[], excludedIps: string[]): ChartDay[] {
  const filtered = entries.filter(e => !isIpExcluded(e.ip, excludedIps));
  const counts: Record<string, ChartDay> = {};
  for (const e of filtered) {
    const d = new Date(e.ts);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (!counts[key]) counts[key] = { date: key, family: 0, team: 0, login: 0, total: 0 };
    if (e.type === 'family') counts[key].family++;
    else if (e.type === 'team') counts[key].team++;
    else counts[key].login++;
    counts[key].total++;
  }
  return Object.values(counts)
    .sort((a, b) => {
      const [am, ad] = a.date.split('/').map(Number);
      const [bm, bd] = b.date.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    })
    .slice(-30);
}

function AccessChart({ entries, excludedIps }: { entries: AccessLogEntry[]; excludedIps: string[] }) {
  const data = buildChartData(entries, excludedIps);
  if (data.length === 0) return null;
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const MAX_H = 60;

  return (
    <div className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-slate-300">📊 アクセス頻度</h2>
        {excludedIps.length > 0 && (
          <span className="text-[10px] text-slate-500">{excludedIps.length}件を除外中</span>
        )}
      </div>
      <div className="flex items-end gap-1" style={{ height: `${MAX_H + 32}px` }}>
        {data.map((d) => {
          const barH = Math.max(3, (d.total / maxTotal) * MAX_H);
          const familyH = d.total > 0 ? (d.family / d.total) * barH : 0;
          const teamH   = d.total > 0 ? (d.team   / d.total) * barH : 0;
          const loginH  = d.total > 0 ? (d.login  / d.total) * barH : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center min-w-0">
              <span className="text-[9px] text-slate-400 leading-none mb-0.5">{d.total}</span>
              <div className="relative w-full rounded-t-sm overflow-hidden" style={{ height: `${barH}px` }}>
                <div className="absolute bottom-0 left-0 right-0 bg-blue-500/70" style={{ height: `${familyH}px` }} />
                <div className="absolute left-0 right-0 bg-green-500/70" style={{ bottom: `${familyH}px`, height: `${teamH}px` }} />
                <div className="absolute left-0 right-0 bg-amber-500/70" style={{ bottom: `${familyH + teamH}px`, height: `${loginH}px` }} />
              </div>
              <span className="text-[8px] text-slate-500 truncate w-full text-center mt-0.5">{d.date}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-blue-500/70" /><span className="text-[10px] text-slate-400">family</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-green-500/70" /><span className="text-[10px] text-slate-400">team</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-500/70" /><span className="text-[10px] text-slate-400">login</span></div>
      </div>
    </div>
  );
}

// ─── Unique users line chart ─────────────────────────────

function UniqueUsersChart({ entries, excludedIps }: { entries: AccessLogEntry[]; excludedIps: string[] }) {
  const filtered = entries.filter(e => !isIpExcluded(e.ip, excludedIps));
  const dayIps: Record<string, Set<string>> = {};
  for (const e of filtered) {
    const d = new Date(e.ts);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (!dayIps[key]) dayIps[key] = new Set();
    dayIps[key].add(e.ip);
  }
  const data = Object.entries(dayIps)
    .map(([date, ips]) => ({ date, count: ips.size }))
    .sort((a, b) => {
      const [am, ad] = a.date.split('/').map(Number);
      const [bm, bd] = b.date.split('/').map(Number);
      return am !== bm ? am - bm : ad - bd;
    })
    .slice(-30);

  if (data.length === 0) return null;

  const PAD = { top: 14, right: 8, bottom: 18, left: 8 };
  const VW = 300;
  const CH = 50; // chart area height
  const totalH = PAD.top + CH + PAD.bottom;
  const chartW = VW - PAD.left - PAD.right;
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const xPos = (i: number) =>
    data.length === 1 ? PAD.left + chartW / 2 : PAD.left + (i / (data.length - 1)) * chartW;
  const yPos = (c: number) => PAD.top + CH - (c / maxCount) * CH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${yPos(d.count)}`).join(' ');
  const areaPath = `${linePath} L${xPos(data.length - 1)},${PAD.top + CH} L${xPos(0)},${PAD.top + CH} Z`;

  return (
    <div className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-4 mb-4">
      <h2 className="text-xs font-bold text-slate-300 mb-2">👥 ユニークユーザー数（IP別）</h2>
      <svg viewBox={`0 0 ${VW} ${totalH}`} className="w-full overflow-visible">
        {/* area fill */}
        <path d={areaPath} fill="rgba(99,102,241,0.12)" />
        {/* line */}
        <path d={linePath} fill="none" stroke="rgba(99,102,241,0.75)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* dots + value labels + date labels */}
        {data.map((d, i) => (
          <g key={d.date}>
            <circle cx={xPos(i)} cy={yPos(d.count)} r="2.5" fill="rgb(99,102,241)" />
            <text x={xPos(i)} y={yPos(d.count) - 5} textAnchor="middle" fontSize="8" fill="rgb(148,163,184)">{d.count}</text>
            <text x={xPos(i)} y={totalH - 2} textAnchor="middle" fontSize="7" fill="rgb(100,116,139)">{d.date}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Excluded IPs panel ──────────────────────────────────

function ExcludedIpsPanel({
  ips,
  saving,
  entries,
  onUpdate,
}: {
  ips: string[];
  saving: boolean;
  entries: AccessLogEntry[];
  onUpdate: (newIps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  function remove(ip: string) {
    onUpdate(ips.filter(x => x !== ip));
  }

  function addPattern(pattern: string) {
    if (!pattern || ips.includes(pattern)) return;
    onUpdate([...ips, pattern]);
  }

  function addManual() {
    const v = input.trim();
    if (!v || ips.includes(v)) return;
    onUpdate([...ips, v]);
    setInput('');
  }

  // 未除外IPのアクセス回数トップ5
  const topUnexcluded: { ip: string; count: number }[] = (() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (!isIpExcluded(e.ip, ips)) counts[e.ip] = (counts[e.ip] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ip, count]) => ({ ip, count }));
  })();

  return (
    <div className="bg-slate-800/60 border border-white/5 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-700/40 transition-colors"
      >
        <span>🚫 グラフ除外IPリスト（{ips.length}件）{saving && <span className="ml-1 text-[10px] text-slate-500">保存中...</span>}</span>
        <span className="text-slate-500 text-[11px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5">

          {/* 登録済みリスト */}
          {ips.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-3">
              除外IPなし。アクセス履歴のIPの横にある「除外」ボタンで登録できます。
            </p>
          ) : (
            <div className="space-y-1.5 mt-3 mb-3">
              {ips.map(ip => (
                <div key={ip} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-slate-300 flex-1">{ip}</span>
                  {ip.endsWith('.*') && (
                    <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">🔀 サブネット</span>
                  )}
                  <button
                    onClick={() => remove(ip)}
                    className="text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-900/20 hover:bg-red-900/40 transition-colors"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 最近よく来るIP（未除外トップ5） */}
          {topUnexcluded.length > 0 && (
            <div className="mt-3 mb-3">
              <p className="text-[10px] text-slate-500 mb-2">最近のアクセス（未除外・多い順）</p>
              <div className="space-y-1">
                {topUnexcluded.map(({ ip, count }) => (
                  <div key={ip} className="flex items-center gap-2 bg-slate-700/20 rounded-lg px-3 py-2">
                    <span className="text-[11px] font-mono text-slate-400 flex-1">{ip}</span>
                    <span className="text-[10px] text-slate-600">{count}回</span>
                    <button
                      onClick={() => addPattern(ip)}
                      className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-amber-900/20 transition-colors"
                    >
                      除外
                    </button>
                    {isIPv4(ip) && (
                      <button
                        onClick={() => addPattern(toSubnetPattern(ip))}
                        className="text-[9px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                      >
                        {toSubnetPattern(ip)}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 手動入力 */}
          <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="直接入力（例: 203.0.113.*）"
              className="flex-1 text-xs font-mono bg-slate-700/60 border border-white/10 rounded-lg px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              onKeyDown={e => { if (e.key === 'Enter') addManual(); }}
            />
            <button
              onClick={addManual}
              disabled={!input.trim()}
              className="text-xs bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recent access summary (last 7 days) ─────────────────

function shortDevId(id: string | undefined): string {
  if (!id || id === 'unknown') return '?';
  return id.replace(/-/g, '').slice(-8);
}

function RecentAccessSummary({
  entries,
  excludedIps,
  myDeviceId,
  onExclude,
}: {
  entries: AccessLogEntry[];
  excludedIps: string[];
  myDeviceId: string | null;
  onExclude: (ip: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [viewMode, setViewMode] = useState<'device' | 'ip'>('device');
  const SHOW_DEFAULT = 3;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter(e => new Date(e.ts).getTime() > sevenDaysAgo);
  if (recent.length === 0) return null;

  // Group by device_id (fallback to ip)
  type GroupEntry = { key: string; keyType: 'device' | 'ip'; ip: string; count: number; lastTs: string; isMe: boolean; ua: string; excluded: boolean };
  const groups: Record<string, GroupEntry> = {};
  for (const e of recent) {
    const groupKey = viewMode === 'device' && e.device_id && e.device_id !== 'unknown' ? `dev:${e.device_id}` : `ip:${e.ip}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        keyType: viewMode === 'device' && e.device_id && e.device_id !== 'unknown' ? 'device' : 'ip',
        ip: e.ip,
        count: 0,
        lastTs: e.ts,
        isMe: !!(myDeviceId && myDeviceId !== 'unknown' && e.device_id === myDeviceId),
        ua: e.ua,
        excluded: isIpExcluded(e.ip, excludedIps),
      };
    }
    groups[groupKey].count++;
    if (new Date(e.ts) > new Date(groups[groupKey].lastTs)) {
      groups[groupKey].lastTs = e.ts;
      groups[groupKey].ip = e.ip;
    }
    if (!groups[groupKey].isMe && myDeviceId && myDeviceId !== 'unknown' && e.device_id === myDeviceId) {
      groups[groupKey].isMe = true;
    }
    if (!groups[groupKey].excluded && isIpExcluded(e.ip, excludedIps)) {
      groups[groupKey].excluded = true;
    }
  }

  const sorted = Object.values(groups)
    .sort((a, b) => b.count - a.count)
    .filter(g => showExcluded || !g.excluded);

  const hasExcluded = Object.values(groups).some(g => g.excluded);
  const visible = expanded ? sorted : sorted.slice(0, SHOW_DEFAULT);
  const hiddenCount = sorted.length - SHOW_DEFAULT;

  return (
    <div className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-xs font-bold text-slate-300">📅 7日以内のアクセス</h2>
        <div className="flex items-center gap-1.5">
          {/* device/ip toggle */}
          <div className="flex bg-slate-700/60 rounded-lg p-0.5">
            <button onClick={() => setViewMode('device')} className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-colors ${viewMode === 'device' ? 'bg-purple-600/60 text-white' : 'text-slate-400'}`}>デバイス</button>
            <button onClick={() => setViewMode('ip')} className={`text-[9px] px-2 py-0.5 rounded-md font-bold transition-colors ${viewMode === 'ip' ? 'bg-purple-600/60 text-white' : 'text-slate-400'}`}>IP</button>
          </div>
          {hasExcluded && (
            <button onClick={() => setShowExcluded(v => !v)} className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${showExcluded ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-800/60 border-white/10 text-slate-500 hover:text-slate-300'}`}>
              {showExcluded ? '🚫 除外を隠す' : '👁 除外も表示'}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {visible.map(g => {
          const devLabel = g.keyType === 'device' ? `#${shortDevId(g.key.slice(4))}` : g.ip;
          const subnetPattern = isIPv4(g.ip) ? toSubnetPattern(g.ip) : null;
          const subnetAlreadyExcluded = subnetPattern ? excludedIps.includes(subnetPattern) : false;
          return (
            <div key={g.key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${g.isMe ? 'bg-purple-900/30 border border-purple-500/30' : 'bg-slate-700/30'} ${g.excluded ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {g.isMe && <span className="text-[9px] font-bold text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">このデバイス</span>}
                  <span className="text-[11px] font-mono text-slate-300">{devLabel}</span>
                  {g.keyType === 'device' && <span className="text-[9px] text-slate-600 font-mono">{g.ip}</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{shortUa(g.ua)} · {formatTs(g.lastTs)}</p>
              </div>
              <span className="text-[11px] text-amber-300 font-bold tabular-nums flex-shrink-0">{g.count}回</span>
              {!g.excluded ? (
                <>
                  <button onClick={() => onExclude(g.ip)} className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-amber-900/20 transition-colors">除外</button>
                  {subnetPattern && !subnetAlreadyExcluded && (
                    <button onClick={() => onExclude(subnetPattern)} className="text-[9px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-blue-900/20 transition-colors whitespace-nowrap">{subnetPattern}</button>
                  )}
                </>
              ) : (
                <span className="text-[9px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-700/40">除外中</span>
              )}
            </div>
          );
        })}
      </div>
      {sorted.length > SHOW_DEFAULT && (
        <button onClick={() => setExpanded(v => !v)} className="mt-2 w-full text-[10px] text-slate-400 hover:text-slate-300 py-1.5 border-t border-white/5 transition-colors">
          {expanded ? '▲ 閉じる' : `▼ 残り ${hiddenCount} 件を見る`}
        </button>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'access' | 'change'>('access');
  const [accessEntries, setAccessEntries] = useState<AccessLogEntry[]>([]);
  const [changeEntries, setChangeEntries] = useState<ChangeLogEntry[]>([]);
  const [excludedIps, setExcludedIps] = useState<string[]>([]);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [showExcludedInChart, setShowExcludedInChart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, cRes, eRes, dRes] = await Promise.all([
        fetch('/api/admin/logs?type=access&limit=3000'),
        fetch('/api/admin/logs?type=change&limit=100'),
        fetch('/api/admin/excluded-ips'),
        fetch('/api/admin/my-device-id'),
      ]);
      if (!aRes.ok || !cRes.ok) throw new Error('ログ取得失敗');
      const [aData, cData, eData, dData] = await Promise.all([aRes.json(), cRes.json(), eRes.json(), dRes.json()]);
      setAccessEntries(aData.entries ?? []);
      setChangeEntries(cData.entries ?? []);
      setExcludedIps(eData.ips ?? []);
      setMyDeviceId(dData.deviceId ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function saveExcludedIps(newIps: string[]) {
    setExcludedIps(newIps);
    setSaving(true);
    try {
      await fetch('/api/admin/excluded-ips', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: newIps }),
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function addExcludedPattern(pattern: string) {
    if (excludedIps.includes(pattern)) return;
    await saveExcludedIps([...excludedIps, pattern]);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🔍</span>
          <div>
            <h1 className="text-lg font-bold text-white">管理者ページ</h1>
            <p className="text-xs text-slate-400">アクセス・変更履歴</p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="ml-auto text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loading ? '読込中...' : '↻ 更新'}
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Charts */}
        {tab === 'access' && accessEntries.length > 0 && (
          <>
            {excludedIps.length > 0 && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowExcludedInChart(v => !v)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showExcludedInChart ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-800/60 border-white/10 text-slate-500 hover:text-slate-300'}`}
                >
                  {showExcludedInChart ? '🚫 除外を反映' : '👁 除外を含めて表示'}
                </button>
              </div>
            )}
            <AccessChart entries={accessEntries} excludedIps={showExcludedInChart ? [] : excludedIps} />
            <UniqueUsersChart entries={accessEntries} excludedIps={showExcludedInChart ? [] : excludedIps} />
          </>
        )}

        {/* Excluded IPs panel */}
        {tab === 'access' && (
          <ExcludedIpsPanel
            ips={excludedIps}
            saving={saving}
            entries={accessEntries}
            onUpdate={saveExcludedIps}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-900/60 p-1 rounded-xl">
          <button
            onClick={() => setTab('access')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'access' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            📋 アクセス履歴
            {accessEntries.length > 0 && <span className="ml-1.5 text-[10px] bg-slate-600 px-1.5 py-0.5 rounded-full">{accessEntries.length}</span>}
          </button>
          <button
            onClick={() => setTab('change')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'change' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            ✏️ 変更履歴
            {changeEntries.length > 0 && <span className="ml-1.5 text-[10px] bg-slate-600 px-1.5 py-0.5 rounded-full">{changeEntries.length}</span>}
          </button>
        </div>

        {/* Recent access summary */}
        {tab === 'access' && (
          <RecentAccessSummary
            entries={accessEntries}
            excludedIps={excludedIps}
            myDeviceId={myDeviceId}
            onExclude={addExcludedPattern}
          />
        )}

        {/* Access log */}
        {tab === 'access' && (
          <div className="space-y-2">
            {accessEntries.length === 0 && !loading && (
              <div className="text-center text-slate-500 text-sm py-12">記録がありません</div>
            )}
            {accessEntries.length > 0 && excludedIps.length > 0 && (
              <div className="flex items-center justify-end mb-1">
                <button
                  onClick={() => setShowExcluded(v => !v)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${showExcluded ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-slate-800/60 border-white/10 text-slate-500 hover:text-slate-300'}`}
                >
                  {showExcluded ? '🚫 除外を隠す' : '👁 除外も表示'}
                </button>
              </div>
            )}
            {accessEntries.filter(e => showExcluded || !isIpExcluded(e.ip, excludedIps)).map((e, i) => {
              const excluded = isIpExcluded(e.ip, excludedIps);
              const subnetPattern = isIPv4(e.ip) ? toSubnetPattern(e.ip) : null;
              const subnetAlreadyExcluded = subnetPattern ? excludedIps.includes(subnetPattern) : false;
              const isMe = !!(myDeviceId && myDeviceId !== 'unknown' && e.device_id === myDeviceId);
              return (
                <div key={i} className={`border rounded-xl px-4 py-3 ${isMe ? 'bg-purple-900/20 border-purple-500/20' : 'bg-slate-800/60 border-white/5'} ${excluded ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-mono">{formatTs(e.ts)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${TYPE_BADGE[e.type] ?? 'bg-slate-600/40 text-slate-400'}`}>{e.type}</span>
                    <span className="text-xs text-white font-medium">{e.page}</span>
                    {isMe && <span className="text-[9px] font-bold text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">このデバイス</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{e.ip}</span>
                    {e.device_id && e.device_id !== 'unknown' && (
                      <span className="text-[10px] text-slate-600 font-mono">#{shortDevId(e.device_id)}</span>
                    )}
                    <span className="text-[10px] text-slate-500">{shortUa(e.ua)}</span>
                    {excluded ? (
                      <span className="text-[9px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-700/40">除外中</span>
                    ) : (
                      <>
                        <button onClick={() => addExcludedPattern(e.ip)} className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-amber-900/20 transition-colors">除外</button>
                        {subnetPattern && !subnetAlreadyExcluded && (
                          <button onClick={() => addExcludedPattern(subnetPattern)} className="text-[9px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-blue-900/20 transition-colors whitespace-nowrap">{subnetPattern}</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Change log */}
        {tab === 'change' && (
          <div className="space-y-2">
            {changeEntries.length === 0 && !loading && (
              <div className="text-center text-slate-500 text-sm py-12">記録がありません</div>
            )}
            {changeEntries.map((e, i) => (
              <div key={i} className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-mono">{formatTs(e.ts)}</span>
                  <span className="text-xs font-semibold text-white">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                </div>
                {e.detail && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{e.detail}</p>
                )}
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-mono">{e.ip}</span>
                  <span className="text-[10px] text-slate-500">{shortUa(e.ua)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
