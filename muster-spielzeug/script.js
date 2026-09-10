// Fließmuster — generatives Partikel-Spielzeug mit Flow-Field
(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const clearBtn = document.getElementById("clearBtn");
  const paletteBtn = document.getElementById("paletteBtn");
  const saveBtn = document.getElementById("saveBtn");
  const brushSize = document.getElementById("brushSize");
  const helpBtn = document.getElementById("helpBtn");
  const helpOverlay = document.getElementById("helpOverlay");
  const closeHelp = document.getElementById("closeHelp");
  const hint = document.getElementById("hint");

  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let width, height;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#07070c";
    ctx.fillRect(0, 0, width, height);
  }
  window.addEventListener("resize", resize);

  // ---------- Value-noise flow field ----------
  const NOISE_SIZE = 256;
  const noiseGrid = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  for (let i = 0; i < noiseGrid.length; i++) noiseGrid[i] = Math.random();

  function noiseAt(x, y) {
    const xi = Math.floor(x) & (NOISE_SIZE - 1);
    const yi = Math.floor(y) & (NOISE_SIZE - 1);
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const x1 = (xi + 1) & (NOISE_SIZE - 1);
    const y1 = (yi + 1) & (NOISE_SIZE - 1);

    const v00 = noiseGrid[yi * NOISE_SIZE + xi];
    const v10 = noiseGrid[yi * NOISE_SIZE + x1];
    const v01 = noiseGrid[y1 * NOISE_SIZE + xi];
    const v11 = noiseGrid[y1 * NOISE_SIZE + x1];

    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);

    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }

  function flowAngle(x, y, t) {
    const scale = 0.006;
    const n = noiseAt(x * scale, y * scale + t * 0.06);
    return n * Math.PI * 4;
  }

  // ---------- Palettes ----------
  const palettes = [
    { name: "Aurora", stops: ["#5ee7df", "#66a6ff", "#b28dff", "#ff8ecf"] },
    { name: "Sonnenuntergang", stops: ["#ff5f6d", "#ffc371", "#ffe259", "#ff9a9e"] },
    { name: "Wald", stops: ["#134e5e", "#71b280", "#c6ffdd", "#43cea2"] },
    { name: "Neon", stops: ["#f72585", "#7209b7", "#3a0ca3", "#4cc9f0"] },
    { name: "Feuer", stops: ["#ff0000", "#ff8c00", "#ffd700", "#ff4500"] },
  ];
  let paletteIndex = 0;

  function lerpColor(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return `rgb(${a.r + (b.r - a.r) * t}, ${a.g + (b.g - a.g) * t}, ${a.b + (b.b - a.b) * t})`;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function paletteColor(t) {
    const stops = palettes[paletteIndex].stops;
    const scaled = ((t % 1) + 1) % 1 * (stops.length - 1);
    const i = Math.floor(scaled);
    const frac = scaled - i;
    return lerpColor(stops[i], stops[Math.min(i + 1, stops.length - 1)], frac);
  }

  // ---------- Particles ----------
  const particles = [];
  const MAX_PARTICLES = 2600;

  function spawn(x, y, speed) {
    const count = Math.min(2, 1 + Math.floor(speed / 30));
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 1,
        decay: 0.007 + Math.random() * 0.01,
        colorT: Math.random(),
        size: parseFloat(brushSize.value) * (0.6 + Math.random() * 0.8),
      });
    }
  }

  let time = 0;
  function step() {
    time += 1;

    // fading trail
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(7, 7, 12, 0.045)";
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "lighter";

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const angle = flowAngle(p.x, p.y, time);
      p.vx += Math.cos(angle) * 0.12;
      p.vy += Math.sin(angle) * 0.12;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.fillStyle = paletteColor(p.colorT + time * 0.0006);
      ctx.globalAlpha = Math.max(0, p.life) * 0.45;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(step);
  }

  // ---------- Pointer handling ----------
  let last = null;
  function pointerMove(x, y) {
    if (last) {
      const dx = x - last.x, dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(dist / 9));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        spawn(last.x + dx * t, last.y + dy * t, dist);
      }
    } else {
      spawn(x, y, 0);
    }
    last = { x, y };
    if (!hint.classList.contains("faded")) hint.classList.add("faded");
  }

  function pointerEnd() {
    last = null;
  }

  canvas.addEventListener("mousemove", (e) => {
    if (e.buttons === undefined || e.buttons >= 0) pointerMove(e.clientX, e.clientY);
  });
  canvas.addEventListener("mouseleave", pointerEnd);

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      pointerMove(t.clientX, t.clientY);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      pointerMove(t.clientX, t.clientY);
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", pointerEnd);

  // ---------- UI ----------
  function clearCanvas() {
    particles.length = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#07070c";
    ctx.fillRect(0, 0, width, height);
  }

  clearBtn.addEventListener("click", clearCanvas);

  paletteBtn.addEventListener("click", () => {
    paletteIndex = (paletteIndex + 1) % palettes.length;
    paletteBtn.textContent = `Palette: ${palettes[paletteIndex].name}`;
    setTimeout(() => (paletteBtn.textContent = "Palette"), 1200);
  });

  saveBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `fliessmuster-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  helpBtn.addEventListener("click", () => helpOverlay.classList.remove("hidden"));
  closeHelp.addEventListener("click", () => helpOverlay.classList.add("hidden"));
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      clearCanvas();
    }
  });

  // ---------- Init ----------
  resize();
  // gentle auto-swirl seed so the canvas isn't empty on load
  for (let i = 0; i < 60; i++) {
    spawn(width / 2 + (Math.random() - 0.5) * 200, height / 2 + (Math.random() - 0.5) * 200, 20);
  }
  requestAnimationFrame(step);
})();
