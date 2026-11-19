'use strict';

(() => {
  const HEIGHT = 326;
  const SANS = '"Segoe UI", "Microsoft YaHei UI", sans-serif';
  const MONO = '"Cascadia Mono", Consolas, monospace';
  const color = {
    card: '#181a20', panel: '#11141e', border: '#343a49', grid: '#2b3243',
    text: '#eef0f8', label: '#b3bcd1', muted: '#929eb8', violet: '#c5aafa',
    blue: '#8dbafa', amber: '#efbe93',
  };
  const echoColors = [[19, 23, 39], [36, 47, 93], [58, 80, 146], [119, 89, 181], [206, 171, 237]];
  const residualColors = [[17, 21, 33], [27, 42, 68], [66, 92, 153], [121, 100, 184], [197, 159, 222]];
  const cache = new Map();
  const unit = v => Math.max(0, Math.min(1, v));
  const mix = (a, b, f) => a + (b - a) * f;
  const g = (u, s) => Math.exp(-.5 * (u / s) ** 2);
  const ease = v => { const f = unit(v); return f * f * (3 - 2 * f); };

  function label(c, value, x, y, { size = 15, ink = color.label, align = 'left', mono = false, weight = 400 } = {}) {
    c.fillStyle = ink;
    c.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
    c.textAlign = align;
    c.fillText(value, x, y);
  }

  function stroke(c, points, ink, width = 1, dash = []) {
    c.strokeStyle = ink;
    c.lineWidth = width;
    c.setLineDash(dash);
    c.beginPath();
    c.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
    c.stroke();
    c.setLineDash([]);
  }

  function dot(c, x, y, r, fill, outline) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (outline) {
      c.strokeStyle = outline;
      c.lineWidth = 1.5;
      c.stroke();
    }
  }

  function rgb(ramp, amount) {
    const p = unit(amount) * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(p));
    return ramp[i].map((v, k) => Math.round(mix(v, ramp[i + 1][k], p - i)));
  }

  function frame(c, w, title, id) {
    c.beginPath();
    c.roundRect(.5, .5, w - 1, HEIGHT - 1, 12);
    c.fillStyle = color.card;
    c.fill();
    c.strokeStyle = color.border;
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = color.violet;
    c.fillRect(20, 17, 3, 20);
    label(c, title, 32, 34, { size: 20, ink: color.text, weight: 650 });
    label(c, id, w - 20, 33, { size: 14, align: 'right', mono: true, ink: color.muted });
    stroke(c, [[20, 48.5], [w - 20, 48.5]], color.border);
    stroke(c, [[20, 287.5], [w - 20, 287.5]], color.border);
  }

  function grid(c, r, xCount, yCount) {
    c.fillStyle = color.panel;
    c.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i <= xCount; i++) {
      const x = r.x + i / xCount * r.w;
      stroke(c, [[x, r.y], [x, r.y + r.h]], color.grid);
    }
    for (let i = 0; i <= yCount; i++) {
      const y = r.y + i / yCount * r.h;
      stroke(c, [[r.x, y], [r.x + r.w, y]], color.grid);
    }
  }

  function legend(c, r, ramp, markers) {
    const gradient = c.createLinearGradient(r.x, 0, r.x + r.w, 0);
    ramp.forEach((entry, i) => gradient.addColorStop(i / (ramp.length - 1), `rgb(${entry.join(',')})`));
    c.fillStyle = gradient;
    c.fillRect(r.x, r.y, r.w, 8);
    markers.forEach((marker, i) => label(c, marker, r.x + i * r.w / (markers.length - 1), r.y + 23, {
      size: 13, mono: true, align: i === 0 ? 'left' : i === markers.length - 1 ? 'right' : 'center',
    }));
  }

  // Synthetic fidelity over reversal time u and log perturbation v. Two secondary
  // ridges survive after the broad low-order solution loses coherence.
  const slice = .59;
  function fidelity(u, v) {
    const basin = .45 * g(u - (.21 + .14 * v), .16) * g(v - .77, .34);
    const ridge = .88 * g(u - (.61 + .19 * (v - slice) ** 2 - .08 * (v - slice)), .032 + .025 * v) * g(v - .58, .29);
    const satellite = .31 * g(u - (.80 - .14 * v), .047) * g(v - .33, .27);
    const gaps = 1 - .34 * g(v - .39, .032) - .29 * g(v - .71, .021);
    const interference = .075 * (.5 + .5 * Math.cos(105 * u * v + 22 * u)) * g(u - .5, .4);
    return unit(.027 + basin + gaps * (ridge + satellite) + interference);
  }

  function field(key, nx, ny, ramp, sample) {
    if (cache.has(key)) return cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = nx;
    canvas.height = ny;
    const context = canvas.getContext('2d');
    const img = context.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const pos = 4 * (j * nx + i);
        img.data.set([...rgb(ramp, sample(i, j)), 255], pos);
      }
    }
    context.putImageData(img, 0, 0);
    cache.set(key, canvas);
    return canvas;
  }

  function drawField(c, image, r) {
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(image, r.x, r.y, r.w, r.h);
    c.restore();
    c.strokeStyle = color.border;
    c.strokeRect(r.x, r.y, r.w, r.h);
  }

  function echo(c, w, dt) {
    frame(c, w, '洛施密特回波 · 返回保真度', 'ECHO  /  128 × 56');
    const a = { x: 74, y: 82, w: Math.round(w * .57) - 69, h: 145 };
    const b = { x: Math.round(w * .57) + 64, y: 82, w: Math.round(w * .43) - 88, h: 123 };
    const sample = field('echo', 128, 56, echoColors, (i, j) => fidelity(i / 127, 1 - j / 55));
    label(c, 'log₁₀ ε', a.x, 70, { mono: true });
    label(c, 'F(τ, ε)  /  扰动切片', b.x, 70, { ink: color.text });
    drawField(c, sample, a);
    const row = a.y + a.h * (1 - slice);
    stroke(c, [[a.x, row], [a.x + a.w, row]], '#e5d8f5', 1.15, [5, 5]);
    ['−2', '−4', '−6', '−8'].forEach((s, i) => label(c, s, a.x - 9, a.y + i * a.h / 3 + 5, { mono: true, align: 'right' }));
    [0, 3, 6, 9, 12].forEach((s, i) => label(c, String(s), a.x + i * a.w / 4, 247, { mono: true, align: 'center' }));
    label(c, '反演间隔 τ / s', a.x + a.w / 2, 272, { align: 'center' });

    grid(c, b, 4, 2);
    ['1.0', '0.5', '0'].forEach((s, i) => label(c, s, b.x - 9, b.y + i * b.h / 2 + 5, { mono: true, align: 'right' }));
    const u = mix(.06, .61, ease(dt / 1.65));
    const peakX = a.x + a.w * u;
    stroke(c, [[peakX, a.y], [peakX, a.y + a.h]], '#d7c3fb', 1.2, [3, 5]);
    dot(c, peakX, row, 4.5, color.panel, color.text);
    const points = Array.from({ length: 129 }, (_, i) => [b.x + i * b.w / 128, b.y + (1 - fidelity(i / 128, slice)) * b.h]);
    stroke(c, points, color.violet, 2.35);
    const bx = b.x + u * b.w;
    const by = b.y + (1 - fidelity(u, slice)) * b.h;
    stroke(c, [[bx, by], [bx, b.y + b.h]], '#657798', 1, [3, 4]);
    dot(c, bx, by, 4, color.text);
    label(c, '0 s', b.x, 225, { mono: true });
    label(c, '12 s', b.x + b.w, 225, { mono: true, align: 'right' });
    legend(c, { x: b.x, y: 238, w: b.w }, echoColors, ['F 0', '0.5', '1']);
    label(c, '高保真窗口只在狭窄的扰动区间重现', 20, 313);
    label(c, `τ ${(u * 12).toFixed(2)} s  ·  F ${fidelity(u, slice).toFixed(3)}`, w - 20, 313, { mono: true, align: 'right', ink: color.violet });
  }

  const floor = -7;
  const exponents = [0, -.12, -.34, -.63, -1.08, -1.36, -1.71, -2.12, -2.53, -2.78,
    -3.33, -3.72, -4.04, -4.42, -4.81, -5.17, -5.66, -6.06, -6.61, -7.18,
    -7.68, -8.33, -9.16, -9.71, -10.42, -10.78, -11.39, -11.87, -12.1, -12.25,
    -12.62, -12.84];

  function residualField() {
    if (cache.has('jacobian')) return cache.get('jacobian');
    const n = exponents.length;
    // Orthogonal changes of basis preserve the singular spectrum of the diagonal kernel.
    const j = exponents.map((e, row) => exponents.map((_, col) => row === col ? 10 ** e : 0));
    function rotate(rows, gap, strength, phase) {
      for (let i = 0; i < n - gap; i++) {
        const k = i + gap;
        const angle = strength * Math.cos((i + phase) * .91);
        const cs = Math.cos(angle);
        const sn = Math.sin(angle);
        for (let p = 0; p < n; p++) {
          const a = rows ? j[i][p] : j[p][i];
          const b = rows ? j[k][p] : j[p][k];
          if (rows) {
            j[i][p] = cs * a - sn * b;
            j[k][p] = sn * a + cs * b;
          } else {
            j[p][i] = cs * a - sn * b;
            j[p][k] = sn * a + cs * b;
          }
        }
      }
    }
    rotate(true, 1, .33, 2);
    rotate(false, 5, .42, 4);
    rotate(true, 7, .18, 8);
    rotate(false, 2, .34, 6);
    rotate(false, 11, .14, 11);
    const magnitudes = j.map(row => row.map(Math.abs));
    const norms = magnitudes.map(row => Math.max(...row));
    return field('jacobian', n, n, residualColors, (col, row) => magnitudes[row][col] / norms[row]);
  }

  function spectrum(c, w, dt) {
    frame(c, w, '边界算子 · 奇异值与残差耦合', 'SVD  /  JᵀJ');
    const a = { x: 74, y: 82, w: Math.round(w * .60) - 92, h: 146 };
    const b = { x: Math.round(w * .60) + 24, y: 82, w: Math.round(w * .40) - 57, h: 146 };
    label(c, 'log₁₀ (σᵢ / σ₁)', a.x, 70, { mono: true });
    label(c, '∂rᵢ / ∂θⱼ   ·   行归一化幅值', b.x, 70, { ink: color.text });
    grid(c, a, 4, 4);
    const posY = exponent => a.y - exponent / 14 * a.h;
    const fy = posY(floor);
    c.fillStyle = '#24213b';
    c.fillRect(a.x + 1, fy, a.w - 2, a.y + a.h - fy);
    stroke(c, [[a.x, fy], [a.x + a.w, fy]], color.amber, 1.3, [5, 6]);
    label(c, '噪声底', a.x + a.w - 10, fy - 7, { align: 'right', ink: color.amber });
    [0, -3.5, -7, -10.5, -14].forEach(e => label(c, String(e).replace('-', '−'), a.x - 9, posY(e) + 5, { mono: true, align: 'right' }));
    const posX = i => a.x + 6 + i / 31 * (a.w - 12);
    [1, 8, 16, 24, 32].forEach(i => label(c, String(i), posX(i - 1), 249, { mono: true, align: 'center' }));
    label(c, '奇异模态序号 i', a.x + a.w / 2, 273, { align: 'center' });
    const points = exponents.map((e, i) => [posX(i), posY(e)]);
    const last = Math.max(1, Math.round(31 * ease(dt / 1.4)));
    stroke(c, points.slice(0, last + 1), color.violet, 2.25);
    for (let i = 0; i <= last; i++) {
      const [x, y] = points[i];
      stroke(c, [[x, y], [x, a.y + a.h]], i < 19 ? '#3d4773' : '#393251', 1);
      dot(c, x, y, i < 19 ? 2.7 : 2.2, i < 19 ? color.violet : '#9694bd');
    }
    if (last >= 19) dot(c, ...points[19], 4.8, color.panel, color.amber);

    drawField(c, residualField(), b);
    const rowHeight = b.h / exponents.length;
    c.strokeStyle = '#c9baf0';
    c.lineWidth = 1.25;
    c.strokeRect(b.x + .5, b.y + last * rowHeight, b.w - 1, rowHeight);
    legend(c, { x: b.x, y: 239, w: b.w }, residualColors, ['|J| 0', '0.5', '1']);
    label(c, '噪声底以下的模态无法从残差中唯一恢复', 20, 313);
    label(c, 'κ ≈ 6.9 × 10¹²', w - 20, 313, { mono: true, align: 'right', ink: color.violet });
  }

  // Coordinates in the reconstructed device clock, which is allowed to fold.
  // Each edge is directed in reconstruction order, not screen-space order.
  const branches = [
    { points: [[.06, 0], [.20, 0], [.34, 1], [.52, 1], [.86, 2]], ink: '#5c6989' },
    { points: [[.20, 0], [.31, 0], [.52, 1], [.67, 2], [.91, 2]], ink: '#657292' },
    { points: [[.06, 2], [.17, 2], [.28, 1], [.52, 1], [.80, 0], [.93, 0]], ink: '#556481' },
  ];
  const closed = [[.34, 0], [.49, 1], [.70, 2], [.34, 0]];

  function arrow(c, a, b, ink) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const x = mix(a[0], b[0], .68);
    const y = mix(a[1], b[1], .68);
    c.fillStyle = ink;
    c.beginPath();
    c.moveTo(x + 5 * Math.cos(angle), y + 5 * Math.sin(angle));
    c.lineTo(x + 6 * Math.cos(angle + 2.55), y + 6 * Math.sin(angle + 2.55));
    c.lineTo(x + 6 * Math.cos(angle - 2.55), y + 6 * Math.sin(angle - 2.55));
    c.closePath();
    c.fill();
  }

  function causal(c, w, dt) {
    frame(c, w, '设备时钟 · 因果支路闭合检验', 'FC-03  /  CLOCK GRAPH');
    const a = { x: 82, y: 79, w: Math.round(w * .66) - 103, h: 151 };
    const bx = a.x + a.w + 22;
    const bw = w - bx - 20;
    grid(c, a, 4, 1);
    const project = ([u, row]) => [a.x + a.w * u, a.y + 25 + row * 49];
    ['本机', '回波', '缓存'].forEach((name, i) => {
      const y = project([0, i])[1];
      label(c, name, a.x - 11, y + 5, { align: 'right' });
      stroke(c, [[a.x, y], [a.x + a.w, y]], '#414b65');
    });
    for (const branch of branches) {
      const points = branch.points.map(project);
      stroke(c, points, branch.ink, 1.5);
      points.forEach(([x, y]) => dot(c, x, y, 3, branch.ink));
    }
    const loop = closed.map(project);
    const progress = ease(dt / 2.15) * 3;
    for (let i = 0; i < 3; i++) {
      const a0 = loop[i];
      const a1 = loop[i + 1];
      const ink = i === 2 ? color.violet : color.blue;
      stroke(c, [a0, a1], '#6d6a93', 1.3, [4, 5]);
      const f = unit(progress - i);
      if (f > 0) {
        const end = [mix(a0[0], a1[0], f), mix(a0[1], a1[1], f)];
        stroke(c, [a0, end], ink, 2.7, i === 2 ? [7, 4] : []);
        if (f > .55) arrow(c, a0, end, ink);
      }
    }
    ['A', 'B', 'C'].forEach((name, i) => {
      const [x, y] = loop[i];
      dot(c, x, y, 5.5, color.panel, i === 0 && progress >= 3 ? color.violet : color.blue);
      label(c, name, x + 9, y - 9, { mono: true, ink: color.text });
    });
    ['−6', '−3', '0', '+3', '+6'].forEach((n, i) => label(c, n, a.x + a.w * i / 4, 251, { mono: true, align: 'center' }));
    label(c, '设备时标偏移 / ms', a.x + a.w / 2, 274, { align: 'center' });

    label(c, '闭合残差  |δt| / ms', bx, 71, { ink: color.text });
    const candidates = [
      { id: 'α', residual: 3.81, shown: '3.81', ink: '#7887a8' },
      { id: 'β', residual: 1.27, shown: '1.27', ink: '#7887a8' },
      { id: 'γ', residual: .0024, shown: '0.0024', ink: color.violet },
    ];
    const barX = bx + 26;
    const barW = bw - 92;
    const logWidth = value => unit((Math.log10(value) + 3) / 4) * barW;
    const threshold = barX + logWidth(.01);
    candidates.forEach((item, i) => {
      const y = 111 + i * 45;
      label(c, item.id, bx, y + 5, { mono: true, ink: item.ink });
      c.fillStyle = '#272d3f';
      c.fillRect(barX, y - 4, barW, 8);
      c.fillStyle = item.ink;
      c.fillRect(barX, y - 4, logWidth(item.residual) * ease((dt - i * .25) / .8), 8);
      label(c, item.shown, bx + bw, y + 5, { mono: true, align: 'right', ink: item.ink });
    });
    stroke(c, [[threshold, 92], [threshold, 223]], color.amber, 1.15, [4, 5]);
    label(c, '阈值 0.010 ms', bx, 245, { ink: color.amber, mono: true });
    label(c, '条长采用对数刻度', bx, 270, { ink: color.muted });
    label(c, '虚线回边由缓存记录反推', 20, 313);
    label(c, progress >= 3 ? 'γ   A → B → C → A' : 'γ   回边求解中', w - 20, 313, { align: 'right', mono: true, ink: color.violet });
  }

  const plots = { echo, spectrum, causal };
  O.drawRevisionPlot = (c, { mode, t0 }, y, t) => {
    const plot = plots[mode];
    if (!Object.hasOwn(plots, mode)) return;
    const { col0, col1 } = O.G;
    c.save();
    c.translate(col0, y);
    c.textBaseline = 'alphabetic';
    c.lineJoin = 'round';
    plot(c, col1 - col0, Math.max(0, t - t0));
    c.restore();
  };
})();
