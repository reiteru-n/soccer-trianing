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

// ─── Chart ───────────────────────────────────────────────

type ChartDay = { date: string; family: number; team: number; login: number; total: number };

function buildChartData(entries: AccessLogEntry[], excludedIps: string[]): ChartDay[] {
  const filtered = entries.filter(e => !excludedIps.includes(e.ip));
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
    .slice(-14);
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
          <span className="text-[10px] text-slate-500">{excludedIps.length}件のIPを除外中</span>
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
                {/* family: blue, bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-blue-500/70" style={{ height: `${familyH}px` }} />
                {/* team: green, middle */}
                <div className="absolute left-0 right-0 bg-green-500/70" style={{ bottom: `${familyH}px`, height: `${teamH}px` }} />
                {/* login: amber, top */}
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

// ─── Excluded IPs panel ──────────────────────────────────

function ExcludedIpsPanel({
  ips,
  saving,
  onUpdate,
}: {
  ips: string[];
  saving: boolean;
  onUpdate: (newIps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  function remove(ip: string) {
    onUpdate(ips.filter(x => x !== ip));
  }

  function add() {
    const v = input.trim();
    if (!v || ips.includes(v)) return;
    onUpdate([...ips, v]);
    setInput('');
  }

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
          {ips.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-3">
              除外IPなし。アクセス履歴のIPの横にある「除外」ボタンで登録できます。
            </p>
          ) : (
            <div className="space-y-1.5 mt-3 mb-3">
              {ips.map(ip => (
                <div key={ip} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-slate-300 flex-1">{ip}</span>
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

          {/* Manual input */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="IPアドレスを直接入力"
              className="flex-1 text-xs font-mono bg-slate-700/60 border border-white/10 rounded-lg px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500"
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
            />
            <button
              onClick={add}
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

// ─── Main page ───────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'access' | 'change'>('access');
  const [accessEntries, setAccessEntries] = useState<AccessLogEntry[]>([]);
  const [changeEntries, setChangeEntries] = useState<ChangeLogEntry[]>([]);
  const [excludedIps, setExcludedIps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, cRes, eRes] = await Promise.all([
        fetch('/api/admin/logs?type=access&limit=200'),
        fetch('/api/admin/logs?type=change&limit=100'),
        fetch('/api/admin/excluded-ips'),
      ]);
      if (!aRes.ok || !cRes.ok) throw new Error('ログ取得失敗');
      const [aData, cData, eData] = await Promise.all([aRes.json(), cRes.json(), eRes.json()]);
      setAccessEntries(aData.entries ?? []);
      setChangeEntries(cData.entries ?? []);
      setExcludedIps(eData.ips ?? []);
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
      // silent — local state is already updated
    } finally {
      setSaving(false);
    }
  }

  async function addExcludedIp(ip: string) {
    if (excludedIps.includes(ip)) return;
    await saveExcludedIps([...excludedIps, ip]);
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

        {/* Chart (access tab only) */}
        {tab === 'access' && accessEntries.length > 0 && (
          <AccessChart entries={accessEntries} excludedIps={excludedIps} />
        )}

        {/* Excluded IPs panel */}
        {tab === 'access' && (
          <ExcludedIpsPanel ips={excludedIps} saving={saving} onUpdate={saveExcludedIps} />
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

        {/* Access log */}
        {tab === 'access' && (
          <div className="space-y-2">
            {accessEntries.length === 0 && !loading && (
              <div className="text-center text-slate-500 text-sm py-12">記録がありません</div>
            )}
            {accessEntries.map((e, i) => {
              const isExcluded = excludedIps.includes(e.ip);
              return (
                <div key={i} className={`bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3 ${isExcluded ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-mono">{formatTs(e.ts)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${TYPE_BADGE[e.type] ?? 'bg-slate-600/40 text-slate-400'}`}>
                        {e.type}
                      </span>
                      <span className="text-xs text-white font-medium">{e.page}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-mono">{e.ip}</span>
                      <span className="text-[10px] text-slate-500">{shortUa(e.ua)}</span>
                      {isExcluded ? (
                        <span className="text-[9px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-700/40">除外中</span>
                      ) : (
                        <button
                          onClick={() => addExcludedIp(e.ip)}
                          className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded bg-slate-700/40 hover:bg-amber-900/20 transition-colors"
                        >
                          除外
                        </button>
                      )}
                    </div>
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
