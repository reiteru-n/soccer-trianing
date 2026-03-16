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

export default function AdminPage() {
  const [tab, setTab] = useState<'access' | 'change'>('access');
  const [accessEntries, setAccessEntries] = useState<AccessLogEntry[]>([]);
  const [changeEntries, setChangeEntries] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, cRes] = await Promise.all([
        fetch('/api/admin/logs?type=access&limit=100'),
        fetch('/api/admin/logs?type=change&limit=100'),
      ]);
      if (!aRes.ok || !cRes.ok) throw new Error('取得失敗');
      const [aData, cData] = await Promise.all([aRes.json(), cRes.json()]);
      setAccessEntries(aData.entries ?? []);
      setChangeEntries(cData.entries ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

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
            {accessEntries.map((e, i) => (
              <div key={i} className="bg-slate-800/60 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
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
                  </div>
                </div>
              </div>
            ))}
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
