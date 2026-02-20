"use client";
import { useRef } from "react";

const COLORS = ["#ff4757", "#ffd32a", "#ff6b81", "#7bed9f", "#70a1ff", "#ff6348", "#eccc68"];

export default function Confetti() {
  const pieces = useRef(
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 2,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 40,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute -top-3"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 1.4,
            borderRadius: 1,
            background: p.color,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: `translateX(${p.drift}px) rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
