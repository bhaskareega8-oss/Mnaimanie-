import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  t: number;
  s: number;
  gold: boolean;
}

interface Shooter {
  x: number;
  y: number;
  l: number;
  v: number;
}

export const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let stars: Star[] = [];
    let shooters: Shooter[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.3 + 0.2,
        t: Math.random() * Math.PI * 2,
        s: Math.random() * 0.03 + 0.008,
        gold: Math.random() < 0.15,
      }));
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const s of stars) {
        s.t += s.s;
        const a = 0.25 + ((Math.sin(s.t) + 1) / 2) * 0.7;
        ctx.fillStyle = s.gold
          ? `rgba(245,200,107,${a})`
          : `rgba(220,235,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (Math.random() < 0.006 && shooters.length < 2) {
        shooters.push({
          x: Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.2,
          y: Math.random() * window.innerHeight * 0.4,
          l: 0,
          v: 7 + Math.random() * 4,
        });
      }

      shooters = shooters.filter((m) => m.l < 90);
      for (const m of shooters) {
        m.l += 1.6;
        m.x -= m.v;
        m.y += m.v * 0.45;
        const g = ctx.createLinearGradient(m.x, m.y, m.x + 90, m.y - 40);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(1, 'rgba(127,227,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + 90, m.y - 40);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} id="bg-canvas" />;
};
