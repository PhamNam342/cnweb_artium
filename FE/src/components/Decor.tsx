/** Họa tiết vector nền cho khối đen bên trái màn đăng nhập / đăng ký (thuần trang trí). */
export function LoginDecor() {
  return (
    <svg
      className="auth__decor"
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="610" cy="120" r="210" stroke="#1F1F1F" strokeWidth="1.5" />
      <circle cx="610" cy="120" r="150" stroke="#262626" strokeWidth="1.5" />
      <circle
        cx="610"
        cy="120"
        r="90"
        stroke="#0F6BFF"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeDasharray="4 8"
      />
      <path
        d="M-40 700 C 120 600, 240 820, 400 720 S 640 620, 760 760"
        stroke="#0F6BFF"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
      <path
        d="M-40 740 C 120 640, 240 860, 400 760 S 640 660, 760 800"
        stroke="#2A2A2A"
        strokeWidth="1.5"
      />
      <path
        d="M-40 780 C 120 680, 240 900, 400 800 S 640 700, 760 840"
        stroke="#2A2A2A"
        strokeWidth="1.5"
      />
      <path
        d="M620 640 l36 -36 m-36 0 l36 36"
        stroke="#00D973"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="30"
        y="150"
        width="70"
        height="70"
        rx="16"
        stroke="#00D973"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        transform="rotate(12 65 185)"
      />
      <DotGrid x={470} y={560} cols={5} rows={4} />
      <path
        d="M300 210 q 30 -40 60 0 t 60 0"
        stroke="#FBBF24"
        strokeOpacity="0.8"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RegisterDecor() {
  return (
    <svg
      className="auth__decor"
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="640" cy="860" r="260" stroke="#1F1F1F" strokeWidth="1.5" />
      <circle cx="640" cy="860" r="190" stroke="#262626" strokeWidth="1.5" />
      <circle
        cx="640"
        cy="860"
        r="120"
        stroke="#00D973"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeDasharray="4 8"
      />
      <path
        d="M380 -20 C 460 80, 560 40, 620 140 S 700 260, 760 240"
        stroke="#0F6BFF"
        strokeOpacity="0.65"
        strokeWidth="2"
      />
      <path
        d="M340 -20 C 420 80, 520 40, 580 140 S 660 260, 720 240"
        stroke="#2A2A2A"
        strokeWidth="1.5"
      />
      <path
        d="M300 -20 C 380 80, 480 40, 540 140 S 620 260, 680 240"
        stroke="#2A2A2A"
        strokeWidth="1.5"
      />
      <DotGrid x={560} y={330} cols={4} rows={3} />
      <rect
        x="40"
        y="700"
        width="84"
        height="84"
        rx="18"
        stroke="#0F6BFF"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        transform="rotate(-10 82 742)"
      />
      <path
        d="M200 760 q 25 -34 50 0 t 50 0 t 50 0"
        stroke="#FBBF24"
        strokeOpacity="0.8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M470 610 l36 -36 m-36 0 l36 36"
        stroke="#00D973"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotGrid({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) {
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(<circle key={`${r}-${c}`} cx={x + c * 24} cy={y + r * 24} r="2" />);
    }
  }
  return <g fill="#3A3A3A">{dots}</g>;
}
