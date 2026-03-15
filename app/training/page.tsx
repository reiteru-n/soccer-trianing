'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { TrainingMenuItem } from '@/lib/types';

function todayStr() {
  const d = new Date();
  return d.getFullYear()+"/"+(String(d.getMonth()+1).padStart(2,"0"))+"/"+(String(d.getDate()).padStart(2,"0"));
}

function prevDay(dateStr: string): string {
  const parts = dateStr.split("/");
  const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  d.setDate(d.getDate()-1);
  return d.getFullYear()+"/"+(String(d.getMonth()+1).padStart(2,"0"))+"/"+(String(d.getDate()).padStart(2,"0"));
}

function calcStreak(logs: {date:string;completedItemIds:string[]}[], menu: TrainingMenuItem[]): number {
  if (menu.length === 0) return 0;
  const completed = new Set(logs.filter(l => menu.every(m => l.completedItemIds.includes(m.id))).map(l => l.date));
  let streak = 0;
  let d = todayStr();
  while (completed.has(d)) { streak++; d = prevDay(d); }
  return streak;
}

interface MenuItemFormData { name: string; targetCount: string; isMinimum: boolean; estimatedMinutes: string; }
const emptyForm = (): MenuItemFormData => ({ name: "", targetCount: "10", isMinimum: false, estimatedMinutes: "3" });

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

export default function TrainingPage() {
  const router = useRouter();
  const { trainingMenu, addTrainingMenuItem, updateTrainingMenuItem, deleteTrainingMenuItem, trainingLogs, toggleTrainingLogItem, practiceNotes, addPracticeNote, isLoading } = useApp();
  const [tab, setTab] = useState<'check'|'edit'|'history'>('check');
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState<MenuItemFormData>(emptyForm());
  const [showAddForm, setShowAddForm] = useState(false);
  const today = todayStr();
  const sortedMenu = [...trainingMenu].sort((a,b) => a.order - b.order);
  const todayLog = trainingLogs.find(l => l.date === today);
  const completedIds = new Set(todayLog?.completedItemIds ?? []);
  const streak = useMemo(() => calcStreak(trainingLogs, sortedMenu), [trainingLogs, sortedMenu]);
  const totalMinutes = sortedMenu.reduce((s,m) => s+m.estimatedMinutes, 0);
  const todayDoneCount = sortedMenu.filter(m => completedIds.has(m.id)).length;
  const allDone = sortedMenu.length > 0 && todayDoneCount === sortedMenu.length;

  const handleSaveItem = () => {
    if (!form.name.trim()) return;
    const data = { name: form.name.trim(), targetCount: parseInt(form.targetCount)||1, isMinimum: form.isMinimum, estimatedMinutes: parseFloat(form.estimatedMinutes)||1 };
    if (editingId) { updateTrainingMenuItem(editingId, data); setEditingId(null); }
    else { addTrainingMenuItem(data); }
    setForm(emptyForm()); setShowAddForm(false);
  };

  const TABS: Array<[typeof tab, string]> = [['check','今日のチェック'],['edit','メニュー編集'],['history','履歴']];
  if (isLoading) return (<div className="flex items-center justify-center py-24 text-gray-400"><div className="text-center"><p className="text-4xl mb-3">🏃</p><p className="text-sm">読み込み中...</p></div></div>);
  return (
    <>
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold text-gray-800">🏃 自主練メニュー</h1>
        <div className="flex items-center gap-3 mt-1">
          {streak > 0 && <span className="bg-orange-100 text-orange-600 text-sm font-bold px-3 py-1 rounded-full">🔥 {streak}日連続達成中！</span>}
          <span className="text-xs text-gray-400">想定時間: {totalMinutes}分</span>
        </div>
      </header>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {TABS.map(([t,label])=>(

          <button key={t} onClick={()=>setTab(t)} className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-colors " + (tab===t ? "bg-white text-gray-800 shadow" : "text-gray-500")}>{label}</button>
        ))}
      </div>

      {tab === 'check' && (
        <div>
          {allDone && <div className="mb-4 bg-green-100 border border-green-300 rounded-2xl px-4 py-3 text-green-700 font-bold text-center">🎉 今日のメニュー完了！素晴らしい！</div>}
          <div className="space-y-2">
            {sortedMenu.length === 0 && <p className="text-sm text-gray-400 text-center py-8">メニューを追加してください</p>}
            {sortedMenu.map((item) => {
              const done = completedIds.has(item.id);
              return (
                <div key={item.id} className={"flex items-center gap-2 " + (done ? "" : "")}>
                  <button onClick={() => {
                    const newDone = !done;
                    toggleTrainingLogItem(today, item.id);
                    if (newDone) {
                      const newCompletedIds = new Set([...completedIds, item.id]);
                      const allCompleted = sortedMenu.every(m => newCompletedIds.has(m.id));
                      if (allCompleted) {
                        const alreadyRecorded = practiceNotes.some(
                          n => n.date === today && n.category === '自主練'
                        );
                        if (!alreadyRecorded && window.confirm('練習ノートに自主練を記録しますか？')) {
                          const id = addPracticeNote({
                            date: today,
                            location: '家',
                            category: '自主練',
                            teamName: '',
                            goodPoints: '自主練メニューを全部できた！',
                            improvements: [],
                          });
                          router.push(`/notes?scroll=${id}`);
                        }
                      }
                    }
                  }}
                    className={"flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors " + (done ? "bg-green-50 border-green-300" : "bg-white border-gray-200")}
                  >
                    <span className="text-2xl">{done ? "✅" : "⬜"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={"font-semibold text-sm " + (done ? "line-through text-gray-400" : "text-gray-800")}>{item.name}</p>
                      <p className="text-xs text-gray-400">{item.targetCount}{item.isMinimum ? "回以上" : "回"}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => speak(`${item.name}、${item.targetCount}${item.isMinimum ? "回以上" : "回"}`)}
                    className="text-2xl p-3 rounded-2xl bg-white border-2 border-gray-200 active:bg-blue-50"
                    aria-label="読み上げ"
                  >🔊</button>
                </div>
              );
            })}
          </div>
          {sortedMenu.length > 0 && (
            <p className="text-center text-sm text-gray-400 mt-4">{todayDoneCount}/{sortedMenu.length} 完了</p>
          )}
        </div>
      )}
      {tab === 'edit' && (
        <div>
          <div className="space-y-2 mb-4">
            {sortedMenu.map((item) => editingId === item.id ? (
              <div key={item.id} className="bg-white border-2 border-blue-300 rounded-2xl p-4 space-y-2">
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="メニュー名" />
                <div className="flex gap-2">
                  <input type="number" value={form.targetCount} onChange={e=>setForm({...form,targetCount:e.target.value})} className="w-24 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="回数" />
                  <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={form.isMinimum} onChange={e=>setForm({...form,isMinimum:e.target.checked})} className="rounded" />以上</label>
                  <input type="number" step="0.5" value={form.estimatedMinutes} onChange={e=>setForm({...form,estimatedMinutes:e.target.value})} className="w-20 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="分" />
                  <span className="text-xs text-gray-400 self-center">分</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveItem} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-sm">保存</button>
                  <button onClick={()=>{setEditingId(null);setForm(emptyForm());}} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm">キャンセル</button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.targetCount}{item.isMinimum?"回以上":"回"} · {item.estimatedMinutes}分</p>
                </div>
                <button onClick={()=>{setEditingId(item.id);setForm({name:item.name,targetCount:String(item.targetCount),isMinimum:item.isMinimum,estimatedMinutes:String(item.estimatedMinutes)});}} className="text-blue-400 hover:text-blue-600 text-sm px-2">✏️</button>
                <button onClick={()=>{if(window.confirm('このメニューを削除しますか？'))deleteTrainingMenuItem(item.id);}} className="text-gray-300 hover:text-red-400 text-lg px-1">×</button>
              </div>
            ))}
          </div>
          {showAddForm ? (
            <div className="bg-white border-2 border-green-300 rounded-2xl p-4 space-y-2">
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="メニュー名" />
              <div className="flex gap-2">
                <input type="number" value={form.targetCount} onChange={e=>setForm({...form,targetCount:e.target.value})} className="w-24 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="回数" />
                <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={form.isMinimum} onChange={e=>setForm({...form,isMinimum:e.target.checked})} className="rounded" />以上</label>
                <input type="number" step="0.5" value={form.estimatedMinutes} onChange={e=>setForm({...form,estimatedMinutes:e.target.value})} className="w-20 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="分" />
                <span className="text-xs text-gray-400 self-center">分</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveItem} className="flex-1 bg-green-600 text-white font-bold py-2 rounded-xl text-sm">追加</button>
                <button onClick={()=>{setShowAddForm(false);setForm(emptyForm());}} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm">キャンセル</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>{setShowAddForm(true);setEditingId(null);setForm(emptyForm());}} className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-3 text-gray-400 text-sm font-semibold hover:border-green-400 hover:text-green-500">＋ メニューを追加</button>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {trainingLogs.length === 0 && <p className="text-sm text-gray-400 text-center py-8">まだ記録がありません</p>}
          <div className="space-y-2">
            {[...trainingLogs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(log => {
              const total = sortedMenu.length;
              const done = log.completedItemIds.length;
              const allOk = total > 0 && done >= total;
              return (
                <div key={log.id} className={"flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border-2 " + (allOk ? "border-green-200" : "border-gray-100")}>
                  <span className="text-xl">{allOk ? "✅" : "📋"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">{log.date}</p>
                    <p className="text-xs text-gray-400">{done}/{total} 完了</p>
                  </div>
                  {allOk && <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full">達成</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
