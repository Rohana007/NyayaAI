/**
 * Radar/spider chart for skill visualization
 * Pure Canvas — no external dependencies
 */
function drawRadarChart(canvasId, scores, labels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(cx, cy) - 30;
  const n = labels.length;
  const gold = '#C9A84C', goldDim = 'rgba(201,168,76,0.15)', text2 = '#8A8070';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid rings
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = cx + (r * ring / 5) * Math.cos(angle);
      const y = cy + (r * ring / 5) * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(201,168,76,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw axes
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.strokeStyle = 'rgba(201,168,76,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw data polygon
  ctx.beginPath();
  scores.forEach((val, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const dist = (val / 100) * r;
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = goldDim;
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw data points
  scores.forEach((val, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const dist = (val / 100) * r;
    ctx.beginPath();
    ctx.arc(cx + dist * Math.cos(angle), cy + dist * Math.sin(angle), 4, 0, 2 * Math.PI);
    ctx.fillStyle = gold;
    ctx.fill();
  });

  // Draw labels
  ctx.font = '11px DM Sans, sans-serif';
  ctx.fillStyle = text2;
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const lx = cx + (r + 20) * Math.cos(angle);
    const ly = cy + (r + 20) * Math.sin(angle);
    ctx.fillText(label, lx, ly + 4);
  });
}

function drawProgressBar(elementId, value, animated = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (animated) {
    el.style.width = '0%';
    setTimeout(() => { el.style.width = value + '%'; }, 50);
  } else {
    el.style.width = value + '%';
  }
}
