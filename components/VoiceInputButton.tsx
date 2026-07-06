'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicIcon } from '@/components/AppIcons';

interface Props {
  onResult: (text: string) => void;
  className?: string;
}

interface TranscribeEvent {
  type?: string;
  text?: string;
  error?: string;
}

/**
 * マイクボタン（トグル式）。録音 → /api/transcribe（自宅PCのWhisperデーモンへTailscale経由で中継）
 * で文字起こしし、結果を onResult で返す。
 * Web Speech API は iOS Safari で不安定なため使わない（外部脳 voice-input-recipe.md 準拠）。
 */
export default function VoiceInputButton({ onResult, className = '' }: Props) {
  const [hasMic, setHasMic] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sttStage, setSttStage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setHasMic(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }, []);

  const stopMicStream = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, []);

  // アンマウント時にマイクを確実に解放
  useEffect(() => () => stopMicStream(), [stopMicStream]);

  const handleClick = useCallback(async () => {
    if (transcribing) return;
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!hasMic) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      // Safari(mp4/aac)・Chrome(webm/opus) の両対応。上から順にisTypeSupportedを試す
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stopMicStream();
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) return;

        setTranscribing(true);
        setSttStage('アップロード中…');
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'application/octet-stream' },
            body: blob,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({} as TranscribeEvent));
            if (data.error === 'daemon_unreachable') {
              alert('音声入力は現在利用できません（自宅PCがオンラインのときだけ使えます）');
            } else {
              console.error('[transcribe] failed', res.status, data);
              alert('文字起こしに失敗しました');
            }
            return;
          }

          let finalText = '';
          let sawError = '';
          if (res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let acc = '';
            setSttStage('文字起こし中…');
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              acc += decoder.decode(value, { stream: true });
              const lines = acc.split('\n');
              acc = lines.pop() || ''; // 未完了行は次チャンクへ持ち越す
              for (const line of lines) {
                const s = line.trim();
                if (!s) continue;
                let ev: TranscribeEvent;
                try { ev = JSON.parse(s); } catch { continue; }
                if (ev.type === 'done') finalText = ev.text || '';
                else if (ev.type === 'error') sawError = ev.error || 'error';
              }
            }
          } else {
            const data = await res.json().catch(() => ({} as TranscribeEvent));
            finalText = data.text || '';
            if (data.error) sawError = data.error;
          }

          if (finalText) {
            onResult(finalText);
          } else if (sawError) {
            console.error('[transcribe]', sawError);
            alert('文字起こしに失敗しました');
          }
        } catch (err) {
          console.error('[transcribe] request failed', err);
          alert('音声入力は現在利用できません（自宅PCがオンラインのときだけ使えます）');
        } finally {
          setTranscribing(false);
          setSttStage('');
        }
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error('[mic] getUserMedia failed', err);
      stopMicStream();
      setRecording(false);
    }
  }, [recording, transcribing, hasMic, onResult, stopMicStream]);

  // HTTPでのアクセス等でマイクAPIが使えない環境では、押しても失敗するボタンを出さない
  if (!hasMic) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={transcribing}
      className={`flex-shrink-0 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${recording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${className}`}
      aria-label={recording ? '音声入力を停止して文字起こし' : transcribing ? '文字起こし中' : '音声入力で追加'}
      title={recording ? '停止して文字起こし' : transcribing ? sttStage : '音声入力で追加'}
    >
      <MicIcon size={14} />
    </button>
  );
}
