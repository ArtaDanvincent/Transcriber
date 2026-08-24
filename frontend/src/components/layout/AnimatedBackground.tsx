"use client";

const HEXAGON = "M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z";
const TRIANGLE = "M50 5 L95 90 L5 90 Z";
const DIAMOND = "M50 0 L100 50 L50 100 L0 50 Z";
const SQUARE = "M10 10 L90 10 L90 90 L10 90 Z";
const CROSS = "M40 0 L60 0 L60 40 L100 40 L100 60 L60 60 L60 100 L40 100 L40 60 L0 60 L0 40 L40 40 Z";

interface ShapeProps {
  path: string;
  size: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
  reverse?: boolean;
}

function FloatingShape({ path, size, top, left, duration, delay, opacity, color, reverse }: ShapeProps) {
  return (
    <div
      className="absolute"
      style={{
        top,
        left,
        width: size,
        height: size,
        animation: `spin-slow ${duration}s linear infinite ${reverse ? "reverse" : "normal"}`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ opacity }}>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}

function GridNode({ top, left, delay, index }: { top: string; left: string; delay: number; index: number }) {
  const paths = [
    { ndx1: "30px", ndy1: "-25px", ndx2: "-20px", ndy2: "35px", ndx3: "25px", ndy3: "15px", ndx4: "-30px", ndy4: "-20px" },
    { ndx1: "-25px", ndy1: "30px", ndx2: "35px", ndy2: "-15px", ndx3: "-15px", ndy3: "25px", ndx4: "20px", ndy4: "-35px" },
    { ndx1: "20px", ndy1: "20px", ndx2: "-30px", ndy2: "-25px", ndx3: "35px", ndy3: "10px", ndx4: "-10px", ndy4: "30px" },
    { ndx1: "-35px", ndy1: "-15px", ndx2: "15px", ndy2: "30px", ndx3: "-25px", ndy3: "-30px", ndx4: "30px", ndy4: "20px" },
    { ndx1: "15px", ndy1: "-35px", ndx2: "-25px", ndy2: "20px", ndx3: "30px", ndy3: "25px", ndx4: "-20px", ndy4: "-15px" },
  ];
  const p = paths[index % paths.length];
  const duration = 18 + (index % 5) * 4;

  return (
    <div
      className="absolute w-1.5 h-1.5 rounded-full"
      style={{
        top,
        left,
        background: "rgba(99, 102, 241, 0.4)",
        boxShadow: "0 0 8px rgba(99, 102, 241, 0.3)",
        animation: `node-drift ${duration}s ease-in-out infinite ${delay}s, pulse-glow 4s ease-in-out infinite ${delay}s`,
        "--ndx1": p.ndx1, "--ndy1": p.ndy1,
        "--ndx2": p.ndx2, "--ndy2": p.ndy2,
        "--ndx3": p.ndx3, "--ndy3": p.ndy3,
        "--ndx4": p.ndx4, "--ndy4": p.ndy4,
      } as React.CSSProperties}
    />
  );
}

export function AnimatedBackground() {
  const shapes: ShapeProps[] = [
    { path: HEXAGON, size: 120, top: "8%", left: "75%", duration: 35, delay: 0, opacity: 0.06, color: "#6366f1" },
    { path: HEXAGON, size: 80, top: "60%", left: "5%", duration: 45, delay: 5, opacity: 0.05, color: "#8b5cf6", reverse: true },
    { path: TRIANGLE, size: 90, top: "20%", left: "15%", duration: 30, delay: 2, opacity: 0.05, color: "#3b82f6" },
    { path: TRIANGLE, size: 60, top: "70%", left: "80%", duration: 40, delay: 8, opacity: 0.04, color: "#06b6d4", reverse: true },
    { path: DIAMOND, size: 70, top: "45%", left: "85%", duration: 25, delay: 3, opacity: 0.05, color: "#6366f1" },
    { path: DIAMOND, size: 100, top: "80%", left: "40%", duration: 50, delay: 10, opacity: 0.04, color: "#8b5cf6", reverse: true },
    { path: SQUARE, size: 55, top: "15%", left: "50%", duration: 28, delay: 6, opacity: 0.04, color: "#3b82f6", reverse: true },
    { path: SQUARE, size: 85, top: "55%", left: "30%", duration: 38, delay: 0, opacity: 0.05, color: "#06b6d4" },
    { path: CROSS, size: 45, top: "35%", left: "65%", duration: 32, delay: 4, opacity: 0.03, color: "#6366f1" },
    { path: HEXAGON, size: 150, top: "40%", left: "45%", duration: 55, delay: 7, opacity: 0.03, color: "#3b82f6" },
    { path: TRIANGLE, size: 40, top: "85%", left: "15%", duration: 22, delay: 1, opacity: 0.05, color: "#8b5cf6" },
    { path: DIAMOND, size: 35, top: "5%", left: "35%", duration: 20, delay: 9, opacity: 0.04, color: "#06b6d4", reverse: true },
  ];

  const nodes = [
    { top: "12%", left: "20%", delay: 0 },
    { top: "25%", left: "70%", delay: 1.5 },
    { top: "40%", left: "10%", delay: 0.8 },
    { top: "55%", left: "55%", delay: 2.2 },
    { top: "68%", left: "35%", delay: 1.0 },
    { top: "78%", left: "75%", delay: 3.0 },
    { top: "30%", left: "90%", delay: 0.5 },
    { top: "90%", left: "50%", delay: 2.5 },
    { top: "50%", left: "25%", delay: 1.8 },
    { top: "18%", left: "45%", delay: 3.5 },
  ];

  const lines: { x1: string; y1: string; x2: string; y2: string; delay: number }[] = [
    { x1: "20%", y1: "12%", x2: "45%", y2: "18%", delay: 0 },
    { x1: "45%", y1: "18%", x2: "70%", y2: "25%", delay: 0.5 },
    { x1: "10%", y1: "40%", x2: "25%", y2: "50%", delay: 1.0 },
    { x1: "25%", y1: "50%", x2: "55%", y2: "55%", delay: 1.5 },
    { x1: "55%", y1: "55%", x2: "75%", y2: "78%", delay: 2.0 },
    { x1: "35%", y1: "68%", x2: "50%", y2: "90%", delay: 2.5 },
    { x1: "70%", y1: "25%", x2: "90%", y2: "30%", delay: 0.8 },
    { x1: "20%", y1: "12%", x2: "10%", y2: "40%", delay: 1.2 },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          animation: "grid-fade 8s ease-in-out infinite, grid-scroll 60s linear infinite",
        }}
      />

      {/* Connecting lines between nodes */}
      <svg className="absolute inset-0 w-full h-full">
        {lines.map((line, i) => (
          <line
            key={`conn-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(99,102,241,0.04)"
            strokeWidth="1"
            strokeDasharray="4 8"
            style={{
              animation: `pulse-glow 5s ease-in-out infinite ${line.delay}s`,
            }}
          />
        ))}
      </svg>

      {/* Geometric shapes */}
      {shapes.map((s, i) => (
        <FloatingShape key={`shape-${i}`} {...s} />
      ))}

      {/* Grid nodes */}
      {nodes.map((n, i) => (
        <GridNode key={`node-${i}`} {...n} index={i} />
      ))}

      {/* Travelling line */}
      {[0, 1, 2].map((i) => (
        <div
          key={`trav-${i}`}
          className="absolute"
          style={{
            left: `${20 + i * 25}%`,
            top: 0,
            width: "1px",
            height: "120px",
            background: "linear-gradient(to bottom, transparent, rgba(99,102,241,0.06), transparent)",
            animation: `line-move ${14 + i * 4}s linear infinite ${i * 4}s`,
            ["--line-angle" as string]: `${12 + i * 8}deg`,
          }}
        />
      ))}
    </div>
  );
}
