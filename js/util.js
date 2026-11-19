'use strict';
// ============================================================================
//  util.js —— 通用数学、缓动、确定性随机数与噪声
// ============================================================================
const O = window.O = {};
O.FPS = 30;
O.RUNTIME = 210;
O.STRETCH = 10.65;
O.storyTime = t => t <= 103 ? t : t < 142 + O.STRETCH
  ? 103 + (t - 103) * 39 / (39 + O.STRETCH)
  : t - O.STRETCH;
O.DUR = 203.0;               // 成片总长（秒）
O.SW = 3840; O.SH = 2160;    // 显示器物理分辨率（屏幕画布）
O.LS = 1.5;                  // Windows 缩放 150% → 逻辑坐标 2560×1440
O.LW = 2560; O.LH = 1440;

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const inv = (a, b, v) => clamp((v - a) / (b - a));
const sstep = (a, b, v) => { const k = inv(a, b, v); return k * k * (3 - 2 * k); };
const E = O.E = {
  lin: k => k,
  io: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  io3: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  o2: k => 1 - (1 - k) * (1 - k),
  o3: k => 1 - Math.pow(1 - k, 3),
  i2: k => k * k,
  i3: k => k * k * k,
  sine: k => .5 - .5 * Math.cos(Math.PI * k),
  oBack: k => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};
Object.assign(window, { clamp, lerp, inv, sstep });

// 整数哈希 → [0,1)
O.hash = (n, s = 0) => { let h = (n | 0) * 374761393 + (s | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16); return (h >>> 0) / 4294967296; };
O.rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// 一维值噪声（平滑），返回 [-1,1]
O.noise = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(O.hash(i, s), O.hash(i + 1, s), u) * 2 - 1; };
O.fbm = (x, s = 0, oct = 3) => { let v = 0, a = .5, f = 1, n = 0; for (let k = 0; k < oct; k++) { v += O.noise(x * f, s + k * 17) * a; n += a; a *= .5; f *= 2.03; } return v / n; };

// 关键帧轨道：keys = [[t, v(数字或数组), ease?], ...]，ease 作用于进入该关键帧的那一段
O.track = (keys, t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], k = (E[b[2] || 'sine'])(inv(a[0], b[0], t));
      if (Array.isArray(a[1])) return a[1].map((v, j) => lerp(v, b[1][j], k));
      return lerp(a[1], b[1], k);
    }
  }
  return keys[keys.length - 1][1];
};
// 分段常量：返回 t 所在的最后一个 [t,v] 的 v
O.step = (keys, t, def) => { let v = def; for (const k of keys) { if (t >= k[0]) v = k[1]; else break; } return v; };
O.fmt = n => n.toLocaleString('en-US');
