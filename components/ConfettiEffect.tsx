'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface Props {
  trigger: boolean;
  onDone: () => void;
}

export default function ConfettiEffect({ trigger, onDone }: Props) {
  useEffect(() => {
    if (!trigger) return;
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#2E86C1', '#27AE60', '#F39C12', '#E74C3C', '#9B59B6'],
    });
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [trigger, onDone]);

  return null;
}
