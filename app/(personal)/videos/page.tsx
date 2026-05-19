'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { VideoCategory, VideoItem, VideoViewStat } from '@/lib/types';

// --- helpers ---
function getYoutubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function useThumbnail(url: string): string | null | 'loading' {
  const ytThumb = getYoutubeThumbnail(url);
  const [thumb, setThumb] = useState<string | null | 'loading'>(ytThumb ?? 'loading');
  useEffect(() => {
    if (ytThumb) { setThumb(ytThumb); return; }
    let cancelled = false;
    fetch(`/api/og-thumbnail?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((d: { url: string | null }) => { if (!cancelled) setThumb(d.url); })
      .catch(() => { if (!cancelled) setThumb(null); });
    return () => { cancelled = true; };
  }, [url, ytThumb]);
  return thumb;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

// --- SCH match videos fetch (YouTubeのSCHチームプレイリストに限定) ---
interface SchMatchVideo {
  url: string;
  description: string;
  date: string;
}

interface YtPlaylistVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

function useSchMatchVideos(enabled: boolean): SchMatchVideo[] {
  const [videos, setVideos] = useState<SchMatchVideo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/sch/yt-playlist?limit=50').then(r => r.ok ? r.json() : null).then((d: YtPlaylistVideo[] | null) => {
      if (cancelled || !d) return;
      const collected: SchMatchVideo[] = d.map(v => ({
        url: v.url,
        description: v.title,
        date: v.publishedAt,
      }));
      setVideos(collected);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return videos;
}

// --- 1行ぶんのサムネ ---
function VideoThumb({ url }: { url: string }) {
  const thumb = useThumbnail(url);
  if (thumb === 'loading') {
    return <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-400 animate-pulse text-xl">🎬</div>;
  }
  if (thumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb} alt="" className="w-full h-full object-cover" />;
  }
  return <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-400 text-xl">🎬</div>;
}

// --- 視聴UI 行 ---
function VideoRow({
  url, description, stat, pinned, onView, editMode, onEdit, onDelete, onTogglePin,
  readOnly,
}: {
  url: string;
  description: string;
  stat?: VideoViewStat;
  pinned?: boolean;
  onView: () => void;
  editMode: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className={"relative rounded-2xl shadow-md overflow-hidden flex " +
      (pinned
        ? "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 border-2 border-amber-300 shadow-amber-200/60"
        : "bg-gradient-to-br from-white via-sky-50 to-blue-100 border border-white/40 shadow-blue-900/20")
    }>
      {pinned && (
        <span className="absolute top-1.5 right-1.5 z-10 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow shadow-amber-300/70 flex items-center gap-0.5">📌 PIN</span>
      )}
      {/* 左：サムネ 1/4 */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onView}
        className="w-1/4 aspect-video flex-shrink-0 bg-slate-700 relative group"
        aria-label="動画を再生"
      >
        <VideoThumb url={url} />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
          <span className="text-white text-2xl">▶</span>
        </div>
      </a>
      {/* 右：説明 + メタ */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onView}
            className="flex-1 min-w-0 px-3 py-2 text-left"
          >
            <p className="text-sm font-semibold text-gray-800 line-clamp-2 break-words">{description}</p>
          </a>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); speak(description); }}
            className="flex-shrink-0 text-lg p-2 rounded-lg hover:bg-blue-100 active:bg-blue-200 mt-0.5 mr-1"
            aria-label="読み上げ"
          >🔊</button>
        </div>
        <div className="px-3 pb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-500">
            {stat?.lastViewedDate ? `最終視聴: ${stat.lastViewedDate}` : '未視聴'}
          </span>
          {stat?.viewCount ? (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm shadow-orange-300/60">
              {stat.viewCount}<span className="text-[9px] font-bold opacity-90">回</span>
            </span>
          ) : (
            <span className="text-[10px] text-blue-400 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">NEW</span>
          )}
        </div>
        {editMode && !readOnly && (
          <div className="px-2 pb-2 flex items-center gap-1 border-t border-blue-100/60 pt-1.5">
            <button
              onClick={onTogglePin}
              className={
                "text-xs font-bold px-2 py-1 rounded-lg border " +
                (pinned
                  ? "bg-amber-500 text-white border-amber-400"
                  : "bg-white/70 text-amber-600 border-amber-200 hover:bg-amber-50")
              }
            >
              📌 {pinned ? 'ピン解除' : 'ピン留め'}
            </button>
            <div className="flex-1" />
            <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1">✏️</button>
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500 text-lg px-1.5">×</button>
          </div>
        )}
        {editMode && readOnly && (
          <div className="px-3 pb-2 text-[10px] text-blue-500 border-t border-blue-100/60 pt-1.5">📺 SCHチームページの動画（編集はチームページから）</div>
        )}
      </div>
    </div>
  );
}

// --- カテゴリブロック ---
function CategoryBlock({
  category, items, stats, onView, editMode, onAdd, onEdit, onDelete, onTogglePin,
  onRenameCategory, onDeleteCategory, onMoveCategoryUp, onMoveCategoryDown, canMoveCatUp, canMoveCatDown,
  matchVideos,
}: {
  category: VideoCategory;
  items: VideoItem[];
  stats: VideoViewStat[];
  onView: (url: string) => void;
  editMode: boolean;
  onAdd: (categoryId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onMoveCategoryUp: () => void;
  onMoveCategoryDown: () => void;
  canMoveCatUp: boolean;
  canMoveCatDown: boolean;
  matchVideos: SchMatchVideo[];
}) {
  const [open, setOpen] = useState(true);
  // ピン留め優先 + 追加日時の新しい順（createdAtない場合はorderで代用）
  const sortedItems = useMemo(() => {
    const sortKey = (v: VideoItem) => v.createdAt ?? `0000-${String(v.order).padStart(10, '0')}`;
    return [...items].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return sortKey(b).localeCompare(sortKey(a));
    });
  }, [items]);
  const statByUrl = useMemo(() => {
    const m = new Map<string, VideoViewStat>();
    for (const s of stats) m.set(s.url, s);
    return m;
  }, [stats]);

  const isMatch = category.isMatchCategory;
  const totalCount = sortedItems.length + (isMatch ? matchVideos.length : 0);

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        {editMode && (
          <div className="flex flex-col gap-0.5">
            <button onClick={onMoveCategoryUp} disabled={!canMoveCatUp} className="w-6 h-6 flex items-center justify-center rounded text-blue-200 hover:text-white hover:bg-white/10 disabled:opacity-20 text-xs">▲</button>
            <button onClick={onMoveCategoryDown} disabled={!canMoveCatDown} className="w-6 h-6 flex items-center justify-center rounded text-blue-200 hover:text-white hover:bg-white/10 disabled:opacity-20 text-xs">▼</button>
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-blue-200 text-xs">{open ? '▼' : '▶'}</span>
          <h2 className="text-base font-bold text-white">{category.name}</h2>
          <span className="text-xs text-blue-300/70">({totalCount})</span>
        </button>
        {editMode && (
          <>
            <button onClick={() => onRenameCategory(category.id)} className="text-xs text-blue-200 hover:text-white px-2">✏️</button>
            {!isMatch && (
              <button onClick={() => onDeleteCategory(category.id)} className="text-sm text-blue-200 hover:text-red-300 px-1.5">×</button>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="space-y-2 landscape:md:grid landscape:md:grid-cols-2 landscape:md:gap-3 landscape:md:space-y-0">
          {sortedItems.map((item) => (
            <VideoRow
              key={item.id}
              url={item.url}
              description={item.description}
              stat={statByUrl.get(item.url)}
              pinned={item.pinned}
              onView={() => onView(item.url)}
              editMode={editMode}
              onEdit={() => onEdit(item.id)}
              onDelete={() => onDelete(item.id)}
              onTogglePin={() => onTogglePin(item.id)}
            />
          ))}
          {isMatch && matchVideos.map((mv) => (
            <VideoRow
              key={`sch_${mv.url}`}
              url={mv.url}
              description={mv.description}
              stat={statByUrl.get(mv.url)}
              onView={() => onView(mv.url)}
              editMode={editMode}
              readOnly
            />
          ))}
          {sortedItems.length === 0 && (!isMatch || matchVideos.length === 0) && (
            <p className="text-xs text-blue-200/50 text-center py-4">まだ動画がありません</p>
          )}
          {editMode && !isMatch && (
            <button
              onClick={() => onAdd(category.id)}
              className="w-full border-2 border-dashed border-blue-300/30 rounded-2xl py-2.5 text-blue-200/70 text-xs font-semibold hover:border-blue-300 hover:text-blue-200"
            >＋ 動画を追加</button>
          )}
        </div>
      )}
    </section>
  );
}

// --- 動画 追加/編集 フォーム ---
function VideoFormModal({
  initial, categoryId, categories, onSave, onClose,
}: {
  initial?: VideoItem | null;
  categoryId?: string;
  categories: VideoCategory[];
  onSave: (data: { categoryId: string; url: string; description: string }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [catId, setCatId] = useState(initial?.categoryId ?? categoryId ?? categories[0]?.id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !description.trim() || !catId) return;
    onSave({ categoryId: catId, url: url.trim(), description: description.trim() });
  };

  const editableCategories = categories.filter(c => !c.isMatchCategory);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">🎬 {initial ? '動画を編集' : '動画を追加'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">カテゴリ</label>
              <select
                value={catId}
                onChange={e => setCatId(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              >
                {editableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">URL (YouTube推奨)</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">説明</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例: ロングキックの基本"
                rows={3}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 active:bg-blue-700 text-white font-bold py-3 rounded-xl text-base">
              💾 {initial ? '更新する' : '追加する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- カテゴリ追加/名前変更 モーダル ---
function CategoryFormModal({
  initialName, title, onSave, onClose,
}: {
  initialName?: string;
  title: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl mb-16 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="カテゴリ名"
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-blue-400 focus:outline-none"
              autoFocus
            />
            <button type="submit" className="w-full bg-blue-600 active:bg-blue-700 text-white font-bold py-3 rounded-xl text-base">💾 保存</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function VideosPage() {
  const {
    videoCategories, addVideoCategory, updateVideoCategory, deleteVideoCategory, reorderVideoCategories,
    videos, addVideo, updateVideo, deleteVideo, toggleVideoPin,
    videoStats, recordVideoView,
    isLoading,
  } = useApp();

  const [editMode, setEditMode] = useState(false);
  const [videoFormState, setVideoFormState] = useState<{ mode: 'add' | 'edit'; categoryId?: string; item?: VideoItem | null } | null>(null);
  const [categoryFormState, setCategoryFormState] = useState<{ mode: 'add' | 'edit'; id?: string; name?: string } | null>(null);

  const sortedCategories = useMemo(
    () => [...videoCategories].sort((a, b) => a.order - b.order),
    [videoCategories]
  );

  const hasMatchCategory = sortedCategories.some(c => c.isMatchCategory);
  const schMatchVideos = useSchMatchVideos(hasMatchCategory);

  const moveCategory = (id: string, dir: -1 | 1) => {
    const idx = sortedCategories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sortedCategories.length) return;
    const reordered = [...sortedCategories];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderVideoCategories(reordered.map((c, i) => ({ ...c, order: i + 1 })));
  };

  const handleView = useCallback((url: string) => {
    recordVideoView(url);
  }, [recordVideoView]);

  const handleSaveVideo = (data: { categoryId: string; url: string; description: string }) => {
    if (videoFormState?.mode === 'edit' && videoFormState.item) {
      updateVideo(videoFormState.item.id, data);
    } else {
      addVideo(data);
    }
    setVideoFormState(null);
  };

  const handleSaveCategory = (name: string) => {
    if (categoryFormState?.mode === 'edit' && categoryFormState.id) {
      updateVideoCategory(categoryFormState.id, name);
    } else {
      addVideoCategory(name);
    }
    setCategoryFormState(null);
  };

  if (isLoading) return (<div className="flex items-center justify-center py-24 text-blue-200"><div className="text-center"><p className="text-4xl mb-3">🎬</p><p className="text-sm">読み込み中...</p></div></div>);

  return (
    <>
      <header className="mb-4 pt-1 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-blue-200 text-xs hover:text-white">← ホーム</Link>
          </div>
          <h1 className="text-2xl font-extrabold text-white drop-shadow mt-1">🎬 学習動画</h1>
          <p className="text-xs text-blue-200 mt-0.5">目標達成に近づくために観る</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={
            "text-xs font-bold px-3 py-2 rounded-xl border " +
            (editMode
              ? "bg-amber-500 text-white border-amber-300"
              : "bg-white/10 text-blue-100 border-white/20")
          }
        >
          {editMode ? '✓ 編集中' : '✏️ 編集'}
        </button>
      </header>

      <div className="space-y-4">
        {sortedCategories.map((cat, idx) => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            items={videos.filter(v => v.categoryId === cat.id)}
            stats={videoStats}
            onView={handleView}
            editMode={editMode}
            onAdd={(categoryId) => setVideoFormState({ mode: 'add', categoryId })}
            onEdit={(id) => {
              const item = videos.find(v => v.id === id);
              if (item) setVideoFormState({ mode: 'edit', item });
            }}
            onDelete={(id) => {
              if (window.confirm('この動画を削除しますか？')) deleteVideo(id);
            }}
            onTogglePin={toggleVideoPin}
            onRenameCategory={(id) => {
              const c = videoCategories.find(x => x.id === id);
              if (c) setCategoryFormState({ mode: 'edit', id, name: c.name });
            }}
            onDeleteCategory={(id) => {
              if (window.confirm('このカテゴリを削除しますか？\n(中の動画も削除されます)')) deleteVideoCategory(id);
            }}
            onMoveCategoryUp={() => moveCategory(cat.id, -1)}
            onMoveCategoryDown={() => moveCategory(cat.id, 1)}
            canMoveCatUp={idx > 0}
            canMoveCatDown={idx < sortedCategories.length - 1}
            matchVideos={cat.isMatchCategory ? schMatchVideos : []}
          />
        ))}
      </div>

      {editMode && (
        <button
          onClick={() => setCategoryFormState({ mode: 'add' })}
          className="w-full mt-4 border-2 border-dashed border-blue-300/50 rounded-2xl py-3 text-blue-200 text-sm font-semibold hover:border-blue-200 hover:text-white"
        >＋ カテゴリを追加</button>
      )}

      {videoFormState && (
        <VideoFormModal
          initial={videoFormState.item ?? null}
          categoryId={videoFormState.categoryId}
          categories={sortedCategories}
          onSave={handleSaveVideo}
          onClose={() => setVideoFormState(null)}
        />
      )}
      {categoryFormState && (
        <CategoryFormModal
          initialName={categoryFormState.name}
          title={categoryFormState.mode === 'edit' ? 'カテゴリ名を変更' : 'カテゴリを追加'}
          onSave={handleSaveCategory}
          onClose={() => setCategoryFormState(null)}
        />
      )}
    </>
  );
}
