'use strict';
// ============================================================================
//  audio.js —— 全片配乐与声音设计（纯代码合成，逐采样对齐时间轴）
//    音乐：低频持续音、合成钢琴（F♯–C–F–E，结尾整段倒放）、弦乐簇、泛音、
//          心跳、拨弦与钟表回声、谢泼德音阶、颗粒数据雨、耳鸣、反向渐强
//    环境：机箱风扇（随负载升降，白屏时停转）、键盘、鼠标、显示器唤醒、倒走的秒针
//    人声：只有呼吸（合成）
// ============================================================================
(() => {
  const SR = 48000, TAU = Math.PI * 2;
  const T = O.T;
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const nz = () => rnd() * 2 - 1;
  const S = t => Math.max(0, Math.round(t * SR));
  const db = d => Math.pow(10, d / 20);
  class Env { constructor(k) { this.k = k; this.i = 0; } at(t) { const k = this.k; if (t <= k[0][0]) return k[0][1]; while (this.i < k.length - 2 && t > k[this.i + 1][0]) this.i++; if (this.i > 0 && t < k[this.i][0]) this.i = 0; const a = k[this.i], b = k[this.i + 1]; if (!b) return a[1]; if (t >= b[0]) return b[1]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); } }
  // RBJ 双二阶滤波
  const bq = (type, f, Q, g = 0) => {
    const w = TAU * Math.min(f, SR * .45) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q), A = Math.pow(10, g / 40); let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  };
  const run = (f, x) => { const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2; f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y; return y; };
  const retune = (f, type, fr, Q, g) => { const n = bq(type, fr, Q, g); f.b0 = n.b0; f.b1 = n.b1; f.b2 = n.b2; f.a1 = n.a1; f.a2 = n.a2; };
  // 带限锯齿波表
  const SAW = (() => { const n = 4096, t = new Float32Array(n + 1); for (let h = 1; h <= 40; h++) for (let i = 0; i <= n; i++) t[i] += Math.sin(TAU * h * i / n) / h * (h > 30 ? (40 - h) / 10 : 1); for (let i = 0; i <= n; i++) t[i] *= .55; return t; })();
  const sawAt = ph => { const x = ph * 4096, i = x | 0, f = x - i; return SAW[i] + (SAW[i + 1] - SAW[i]) * f; };
  const pan2 = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  O.Audio = {
    SR,
    async render() {
      const N = Math.ceil(O.DUR * SR);
      const mk = () => [new Float32Array(N), new Float32Array(N)];
      const mDry = mk(), mWet = mk(), sDry = mk(), sWet = mk(), br = mk();
      const put = (bus, i, l, r) => { if (i >= 0 && i < N) { bus[0][i] += l; bus[1][i] += r; } };

      // ---------------- 钢琴 ----------------
      function pianoNote(f, vel, dur = Math.min(10, 3 + 900 / f)) {
        const n = S(dur), tmp = new Float32Array(n), B = .00032;
        for (let p = 1; p <= 16; p++) {
          const fp = f * p * Math.sqrt(1 + B * p * p); if (fp > 11000) break;
          const amp = vel * Math.pow(p, -1.2) * (p === 2 ? 1.25 : 1) * (p > 6 ? .7 : 1) * Math.min(1, 1.6 * vel + .2 * (p < 4));
          const d1 = (2.2 + .9 * p) * Math.pow(f / 260, .35), d2 = (.28 + .09 * p) * Math.pow(f / 260, .45);
          for (const det of [-.4, .45]) {
            const ff = fp * Math.pow(2, det * (1 + p * .07) / 1200), w = TAU * ff / SR, k = 2 * Math.cos(w), ph = rnd() * TAU;
            let y0 = Math.sin(ph), y1 = Math.sin(ph - w), e1 = .62, e2 = .38; const m1 = Math.exp(-d1 / SR), m2 = Math.exp(-d2 / SR);
            for (let j = 0; j < n; j++) { tmp[j] += amp * .5 * y0 * (e1 + e2); const y = k * y0 - y1; y1 = y0; y0 = y; e1 *= m1; e2 *= m2; }
          }
        }
        const hf = bq('bp', Math.min(4000, f * 6), 1.2); for (let j = 0; j < S(.012); j++) tmp[j] += run(hf, nz()) * vel * .35 * (1 - j / S(.012));
        const at = S(.003); for (let j = 0; j < at; j++) tmp[j] *= j / at;
        const rel = S(.25); for (let j = n - rel; j < n; j++) tmp[j] *= (n - j) / rel;
        return tmp;
      }
      function piano(out, t0, f, vel, o = {}) {
        const i0 = S(t0), tmp = pianoNote(f, vel, o.dur);
        const [gl, gr] = pan2(clamp(Math.log2(f / 262) * .22 + (o.pan || 0), -.7, .7)), wet = o.wet == null ? .55 : o.wet;
        for (let j = 0; j < tmp.length; j++) { const v = tmp[j]; put(out, i0 + j, v * gl, v * gr); put(mWet, i0 + j, v * gl * wet, v * gr * wet); }
      }

      // ---------------- drone ----------------
      {
        const amp = new Env([[0, 0], [1.5, .035], [3, .05], [12, .07], [20, .085], [34.6, .1], [40, .06], [50.9, .045], [56, .08], [66, .14], [79.98, .19], [80.0, 0], [84.6, 0], [86, .05], [104, .065], [118, .09], [127, .09], [131, .04], [141.98, .04], [142.0, 0], [150.2, 0], [152, .045], [161, .05], [161.05, .015], [162.6, .015], [165, .04], [180, .045], [190, .035], [199.34, .03], [199.35, 0], [O.DUR, 0]]);
        const bright = new Env([[0, 120], [50, 160], [66, 380], [80, 600], [80.01, 120], [105, 140], [127, 300], [131, 180], [142, 180], [142.01, 110], [O.DUR, 110]]);
        const lpL = bq('lp', 150, .8), lpR = bq('lp', 150, .8); let ph = [0, 0, 0, 0, 0, 0];
        const root = midi(30), fifth = midi(37);
        const fr = [root, root * 1.006, fifth, root * 2, root * 2.012, fifth * 2];
        for (let i = 0; i < N; i++) {
          const t = i / SR, a = amp.at(t); if (a <= 0 && i % 4800 !== 0) { lpL.y1 *= .99; lpR.y1 *= .99; continue; }
          if (i % 64 === 0) { const c = bright.at(t); retune(lpL, 'lp', c, .9); retune(lpR, 'lp', c * 1.04, .9); }
          for (let k = 0; k < 6; k++) { ph[k] += fr[k] / SR; if (ph[k] > 1) ph[k] -= 1; }
          const sub = Math.sin(TAU * ph[0]) * .36 + Math.sin(TAU * ph[1]) * .26 + Math.sin(TAU * ph[2]) * .26 + Math.sin(TAU * ph[5]) * .08 * (1 + Math.sin(t * .37));
          const sl = run(lpL, sawAt(ph[3])), sr = run(lpR, sawAt(ph[4]));
          put(mDry, i, (sub + sl * .9) * a, (sub + sr * .9) * a); put(mWet, i, sl * a * .4, sr * a * .4);
        }
      }

      // ---------------- 主动机 ----------------
      const motif = [66, 60, 65, 64];   // F♯4 C4 F4 E4
      piano(mDry, 6.5, midi(motif[0]), .35, { wet: .7 }); piano(mDry, 6.5, midi(motif[0] - 12), .25, { wet: .7 });
      [12.8, 14.25, 15.7, 17.3].forEach((t, i) => { piano(mDry, t, midi(motif[i]), .42, { wet: .7 }); piano(mDry, t + .004, midi(motif[i] - 12), .2, { wet: .7 }); });
      // 报告段
      piano(mDry, 85.6, midi(42), .5, { wet: .8 }); piano(mDry, 85.6, midi(54), .32, { wet: .8 });
      piano(mDry, 93.2, midi(motif[3]), .3, { wet: .85 });
      piano(mDry, 100.8, midi(motif[0] + 24), .16, { wet: .95, dur: 6 });
      // 定理 1 失败：低音簇
      [42, 43, 48, 54].forEach(m => piano(mDry, T.fail, midi(m), .55, { wet: .7 }));
      piano(mDry, T.loop, midi(motif[0] + 24), .22, { wet: .95 }); piano(mDry, T.loop + .02, midi(motif[1] + 36), .1, { wet: .95 });

      // ---------------- 结尾：整段倒放的主动机（含混响） ----------------
      {
        const L = 20, n = S(L), loc = [new Float32Array(n), new Float32Array(n)], wtmp = [new Float32Array(n), new Float32Array(n)];
        const notes = [[1.0, motif[0] - 12, .45], [1.0, motif[0], .4],
          ...[4.6, 7.6, 10.1, 13.0].map((t, i) => [t, motif[i], i === 3 ? .5 : .45])];
        const localPut = (bus, i, l, r) => { if (i >= 0 && i < n) { bus[0][i] += l; bus[1][i] += r; } };
        for (const [t, m, v] of notes) {
          const f = midi(m), i0 = S(t), note = pianoNote(f, v);
          const [gl, gr] = pan2(clamp(Math.log2(f / 262) * .22, -.7, .7));
          for (let j = 0; j < note.length; j++) {
            const l = note[j] * gl, r = note[j] * gr;
            localPut(loc, i0 + j, l, r);
            localPut(wtmp, i0 + j, l * .9, r * .9);
          }
        }
        // 卷积混响后整体倒放
        const ctx = new OfflineAudioContext(2, n, SR), b = ctx.createBuffer(2, n, SR), bw = ctx.createBuffer(2, n, SR);
        b.copyToChannel(loc[0], 0); b.copyToChannel(loc[1], 1); bw.copyToChannel(wtmp[0], 0); bw.copyToChannel(wtmp[1], 1);
        const s1 = ctx.createBufferSource(); s1.buffer = b; s1.connect(ctx.destination);
        const s2 = ctx.createBufferSource(); s2.buffer = bw; const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = this.ir(ctx, 7.5, 6.5, 7000, 1500, 7); const g = ctx.createGain(); g.gain.value = .5; s2.connect(cv).connect(g).connect(ctx.destination);
        s1.start(); s2.start(); const r = await ctx.startRendering();
        const off = 165.6 - (L - 13.0);
        for (let ch = 0; ch < 2; ch++) { const d = r.getChannelData(ch); for (let j = 0; j < n; j++) { const i = S(off) + j; if (i < N) mDry[ch][i] += d[n - 1 - j] * .8; } }
      }

      // ---------------- 泛音（悬停） ----------------
      const pad = (t0, t1, fs, a, attack, rel, vib = 5) => {
        const i0 = S(t0), i1 = S(t1 + rel);
        for (let i = i0; i < i1 && i < N; i++) {
          const t = i / SR, e = a * Math.min(1, (t - t0) / attack) * (t > t1 ? Math.max(0, 1 - (t - t1) / rel) : 1);
          let l = 0, r = 0;
          fs.forEach((f, k) => { const v = Math.sin(TAU * f * t + .004 * f * Math.sin(TAU * vib * t + k)) * e / fs.length; l += v * (k % 2 ? .6 : 1); r += v * (k % 2 ? 1 : .6); });
          put(mDry, i, l, r); put(mWet, i, l * .8, r * .8);
        }
      };
      pad(20.3, 25.6, [midi(89), midi(90) + 1.5, midi(96)], .045, 2.2, 1.6);
      pad(155.5, 160.9, [midi(84), midi(85) + .8], .028, 3, .12, 4.2);     // 卡片前的紧张泛音，点击时立刻断
      pad(189.5, T.cut - .05, [midi(100), midi(100) * 1.5 + .6], .026, 1.6, .04, 3.1);  // 最后的高音泛音

      // ---------------- 弦乐簇（第四幕） ----------------
      {
        const voices = [[105, 54], [107, 48], [109, 55], [111, 60], [113, 52], [122, 61], [124, 43], [126, 66], [128, 65], [131, 64], [134, 78], [136, 77]];
        const amp = new Env([[105, 0], [112, .05], [116.4, .08], [116.5, .16], [117.5, .03], [121, .025], [127, .055], [131, .006], [141.98, .006], [142, 0], [O.DUR, 0]]);
        const cut = new Env([[105, 300], [116.5, 1800], [118, 500], [128, 900], [141.9, 4200]]);
        const lp = [bq('lp', 400, .7), bq('lp', 400, .7)], ph = voices.map(() => [rnd(), rnd(), rnd()]);
        for (let i = S(105); i < S(142.02); i++) {
          const t = i / SR, a = amp.at(t); if (i % 64 === 0) { const c = cut.at(t); retune(lp[0], 'lp', c, .8); retune(lp[1], 'lp', c * 1.06, .8); }
          let l = 0, r = 0;
          voices.forEach(([t0, m], v) => { if (t < t0) return; const g = Math.min(1, (t - t0) / 2.5); const f = midi(m); for (let d = 0; d < 3; d++) { ph[v][d] += f * (1 + (d - 1) * .0035 + .0015 * Math.sin(t * 5.3 + v + d)) / SR; ph[v][d] %= 1; const s = sawAt(ph[v][d]) * g; if (d !== 1) l += s; if (d !== 0) r += s; } });
          l = run(lp[0], l) * a * .22; r = run(lp[1], r) * a * .22; put(mDry, i, l, r); put(mWet, i, l * .7, r * .7);
        }
      }

      // ---------------- 心跳 ----------------
      const beat = (t, a) => {
        for (const [dt, aa, f0] of [[0, 1, 62], [.27, .7, 55]]) {
          const i0 = S(t + dt), n = S(.32); let ph = 0;
          const bp = bq('bp', 180, 1.2);
          for (let j = 0; j < n; j++) { const tt = j / SR, f = f0 * (1 + 1.4 * Math.exp(-tt * 30)); ph += f / SR; const e = Math.min(1, tt / .004) * Math.exp(-tt * 14) * aa * a; const v = Math.sin(TAU * ph) * e + Math.sin(TAU * ph * 2.3) * e * .35 * Math.exp(-tt * 22) + run(bp, nz()) * e * .5 * Math.exp(-tt * 40); put(mDry, i0 + j, v, v); put(mWet, i0 + j, v * .15, v * .15); }
        }
      };
      { let t = 116.9, p = 60 / 66; while (t < T.done) { beat(t, .13 + .06 * clamp((t - 117) / 24)); p = 60 / (66 + 22 * Math.pow(clamp((t - 117) / 24.7), 1.6)); t += p; } }
      for (let t = 150.6; t < T.click; t += .94) beat(t, .2);
      beat(26.24 + 3.66, .9);   // 刻度自己滑过去：低沉的「咚」

      // 同一个钟表音色先正放，倒数时把瞬态和两次回声一起倒过来。
      const clockTick = (t, a, p, reverse = false) => {
        const n = S(.095), tick = new Float32Array(n), metal = bq('bp', 2900, 3.4);
        for (let j = 0; j < n; j++) {
          const u = j / SR;
          const edge = Math.min(1, u / .0015, (n - j - 1) / S(.006));
          const body = .24 * Math.sin(TAU * 920 * u) + .08 * Math.sin(TAU * 2110 * u);
          tick[j] = (body + run(metal, nz()) * .72) * Math.exp(-u * 61) * edge;
        }
        for (const [delay, level, pan] of [[0, 1, p], [.13, .32, -p], [.29, .12, p]]) {
          const i0 = reverse ? S(t - delay) - n + 1 : S(t + delay);
          const [gl, gr] = pan2(pan);
          for (let j = 0; j < n; j++) {
            const v = tick[reverse ? n - 1 - j : j] * a * level;
            put(mDry, i0 + j, v * gl, v * gr);
          }
        }
      };

      // ---------------- 拨弦时钟（检索） ----------------
      const pluck = (t, f, a, pan) => {
        const i0 = S(t), P = Math.max(2, Math.round(SR / f)), buf = new Float32Array(P); for (let k = 0; k < P; k++) buf[k] = nz();
        const n = S(.9), [gl, gr] = pan2(pan); let idx = 0, last = 0;
        for (let j = 0; j < n; j++) { const v = buf[idx]; const nv = .5 * (v + last) * .996; last = v; buf[idx] = nv; idx = (idx + 1) % P; const s = v * a * Math.min(1, j / 20); put(mDry, i0 + j, s * gl, s * gr); put(mWet, i0 + j, s * gl * .35, s * gr * .35); }
      };
      {
        let t = 51.8, k = 0;
        while (t < 79.95) {
          const x = clamp((t - 51.8) / 28), p = k % 2 ? .35 : -.35;
          pluck(t, midi(motif[k % motif.length]), .16 + .1 * x, p);
          if (k % 4 === 0) clockTick(t, .07 + .025 * x, k % 8 === 0 ? -.44 : .44);
          t += .52 * Math.pow(.075 / .52, Math.pow(x, 1.3));
          k++;
        }
      }

      // ---------------- 谢泼德音阶 ----------------
      const shepard = (t0, t1, octPerSec, a0, a1) => {
        const i0 = S(t0), i1 = S(t1), K = 9, ph = new Float64Array(K);
        for (let i = i0; i < i1; i++) {
          const t = i / SR, a = lerp(a0, a1, Math.pow((t - t0) / (t1 - t0), 1.5)); let s = 0;
          for (let k = 0; k < K; k++) { const pos = ((k + (t - t0) * octPerSec) % K) / K, f = 30 * Math.pow(2, pos * K), w = Math.exp(-Math.pow((pos - .5) * 4.2, 2)); ph[k] += f / SR; s += Math.sin(TAU * ph[k]) * w; }
          s *= a * .22; put(mDry, i, s, s * .92); put(mWet, i, s * .5, s * .5);
        }
      };
      shepard(57.8, 80.0, 1 / 7.5, .0, .5);

      // ---------------- 颗粒数据雨 ----------------
      const rain = (t0, t1, d0, d1, a) => {
        let t = t0; while (t < t1) {
          const x = (t - t0) / (t1 - t0), dens = d0 * Math.pow(d1 / d0, x); t += -Math.log(1 - rnd() * .999) / dens;
          const f = 1800 + rnd() * 7000, n = S(.002 + rnd() * .004), i0 = S(t), [gl, gr] = pan2(nz() * .9), aa = a * (.4 + rnd() * .6);
          for (let j = 0; j < n; j++) { const v = Math.sin(TAU * f * j / SR) * aa * Math.sin(Math.PI * j / n); put(mDry, i0 + j, v * gl, v * gr); }
        }
      };
      rain(57.7, 79.98, 15, 380, .05); rain(130.2, 139.0, 30, 520, .026);

      // ---------------- 反向渐强 ----------------
      {
        // 反向渐强（"由我来计算"之前）：衰减噪声 + 和弦，倒过来
        const n = S(2.6), x = [new Float32Array(n), new Float32Array(n)], lp = bq('lp', 5000, .6), lp2 = bq('lp', 5000, .6);
        const chord = [motif[0] - 12, motif[1] - 12, motif[2], motif[3]].map(midi);
        for (let j = 0; j < n; j++) { const tt = j / SR, e = Math.exp(-tt * 2.1); x[0][j] = run(lp, nz()) * e * .22; x[1][j] = run(lp2, nz()) * e * .22; chord.forEach((f, k) => { const v = Math.sin(TAU * f * tt) * e * .07; x[0][j] += v * (k % 2 ? .7 : 1); x[1][j] += v * (k % 2 ? 1 : .7); }); }
        const i0 = S(98.0) - n; for (let j = 0; j < n; j++) put(mDry, i0 + j, x[0][n - 1 - j], x[1][n - 1 - j]);
      }

      // ---------------- 环境：风扇 ----------------
      {
        const rpm = new Env([[0, 900], [52.6, 900], [56, 1700], [66, 2400], [80, 2600], [81.6, 1100], [104, 1000], [112, 1600], [130, 2500], [141.95, 3000], [142.0, 3000], [142.7, 0], [O.DUR, 0]]);
        const lp = [bq('lp', 400, .7), bq('lp', 400, .7)], hp = [bq('hp', 60, .7), bq('hp', 60, .7)]; let ph = 0, ph2 = 0;
        for (let i = 0; i < S(T.cut); i++) {
          const t = i / SR, r = rpm.at(t); if (r < 5) continue;
          if (i % 128 === 0) { retune(lp[0], 'lp', 180 + r * .35, .7); retune(lp[1], 'lp', 175 + r * .34, .7); }
          const bpf = r / 60 * 7; ph += bpf * (1 + .004 * Math.sin(t * 3.1)) / SR; ph2 += bpf * 1.003 / SR;
          const a = db(-46) * Math.pow(r / 900, 1.6), tone = (Math.sin(TAU * ph) * .5 + Math.sin(TAU * ph * 2) * .25 + Math.sin(TAU * ph2 * 3) * .1) * .35;
          const l = (run(hp[0], run(lp[0], nz())) + tone) * a, rr = (run(hp[1], run(lp[1], nz())) + tone * .9) * a;
          put(sDry, i, l, rr); put(sWet, i, l * .3, rr * .3);
        }
      }
      // 房间底噪（录音停止时一起消失）
      { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < S(T.cut); i++) { const w = nz(); b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0527; const p = (b0 + b1 + b2 + w * .1848) * db(-62); put(sDry, i, p, p * .95); } }

      // ---------------- 键盘 / 鼠标 / 显示器 ----------------
      const click = (t, a, f1, f2, dec, body) => {
        const i0 = S(t), n = S(.06), b1 = bq('bp', f1, 2.5), b2 = bq('bp', f2, 1.6), [gl, gr] = pan2(nz() * .25);
        for (let j = 0; j < n; j++) { const tt = j / SR, x = nz(); const v = (run(b1, x) * Math.exp(-tt * dec) + run(b2, x) * body * Math.exp(-tt * dec * .45)) * a; put(sDry, i0 + j, v * gl, v * gr); put(sWet, i0 + j, v * gl * .4, v * gr * .4); }
      };
      for (const e of O.typing) {
        const big = e.k === 'space' || e.k === ' ' || e.k === 'enter', a = db(e.k === 'enter' ? -15 : big ? -18 : -20) * (.8 + rnd() * .4);
        click(e.t, a, big ? 1700 : 2600 + rnd() * 900, big ? 260 : 420 + rnd() * 160, big ? 300 : 420, big ? 1.4 : .9);
        click(e.t + .07 + rnd() * .03, a * .35, 3000, 500, 600, .5);
      }
      for (const t of O.clicks) { click(t, db(-19), 4800, 1200, 900, .3); click(t + .085, db(-25), 5200, 1300, 1000, .2); }
      click(T.wake, db(-34), 6000, 120, 300, 2.5);            // 显示器唤醒
      click(T.sleep, db(-36), 5500, 110, 400, 2.0);           // 显示器休眠
      // 信号故障：不配爆音，只在 2:30–2:35 留一层很轻的电流「滋滋」声
      { const lp = bq('lp', 1400, .7), a0 = db(-39); for (let i = S(150.6); i < S(155.4); i++) { const t = i / SR, env = sstep(150.6, 151.6, t) * (1 - sstep(154.2, 155.4, t)) * (.75 + .25 * Math.sin(t * 9.1) * Math.sin(t * 2.3)); const x = Math.sin(TAU * 50 * t) * .45 + Math.sin(TAU * 100 * t) * .3 + Math.sin(TAU * 150 * t + 1) * .2 + run(lp, nz()) * .25; const s = Math.tanh(x * 3) * a0 * env; put(sDry, i, s, s * .9); } }
      // 倒走的秒针：回声先到，每拍收在屏幕所示的整秒上。
      for (let k = 0; k < 7; k++) {
        clockTick(T.clockRev + k, db(-23 - k * .7), k % 2 ? .36 : -.36, true);
      }

      // ---------------- 呼吸（合成） ----------------
      const breath = (t0, dur, a, type, cutAt) => {
        const i0 = S(t0), n = S(dur), inh = type === 'in';
        const fm = inh ? [900, 1900, 3300, 5200] : [520, 1150, 2350, 3900], gs = inh ? [.5, .8, .9, .7] : [1, .7, .45, .25];
        const bps = fm.map(f => bq('bp', f, inh ? 2.2 : 1.6)), hp = bq('hp', inh ? 500 : 180, .7), lo = bq('lp', 260, .7);
        let tur = 0, trem = 0;
        for (let j = 0; j < n; j++) {
          const tt = j / SR, i = i0 + j; if (cutAt && i >= S(cutAt)) break;
          const k = tt / dur, env = Math.pow(Math.sin(Math.PI * Math.min(1, inh ? Math.pow(k, .6) : Math.pow(k, .8))), inh ? 1.2 : 1.6);
          tur += (nz() - tur) * .004; trem = .55 + .45 * Math.sin(TAU * (type === 'shaky' ? 9.5 : 4) * tt + 3 * tur);
          const x = nz(); let s = 0; bps.forEach((f, q) => s += run(f, x) * gs[q]); s = run(hp, s + x * (inh ? .25 : .1)) + run(lo, x) * .25;
          const v = s * env * a * (type === 'shaky' ? trem : (.85 + .3 * tur)) * (1 + .8 * tur);
          put(br, i, v, v * .94);
        }
      };
      breath(184.25, .55, db(-29), 'in');
      breath(185.7, 1.9, db(-26), 'shaky');
      breath(188.6, .62, db(-25), 'in'); breath(189.3, .85, db(-27), 'out');
      breath(190.45, .48, db(-24), 'in'); breath(191.0, 1.1, db(-25), 'shaky');
      [192.5, 193.25, 194.0].forEach(t => { breath(t, .33, db(-23), 'in'); breath(t + .36, .36, db(-25), 'out'); });
      breath(T.cut - .4, .62, db(-17), 'in', T.cut);   // 猛吸一口气——被截断

      // ---------------- 混响与混音 ----------------
      // 配乐与环境分两路渲染：配乐的"硬切"要连混响尾巴一起切掉
      const renderBus = async (pairs) => {
        const ctx = new OfflineAudioContext(2, N, SR);
        for (const [bus, gain, irArgs] of pairs) {
          const b = ctx.createBuffer(2, N, SR); b.copyToChannel(bus[0], 0); b.copyToChannel(bus[1], 1); const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); g.gain.value = gain; s.connect(g);
          if (irArgs) { const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = this.ir(ctx, ...irArgs); g.connect(cv).connect(ctx.destination); } else g.connect(ctx.destination);
          s.start();
        }
        const r = await ctx.startRendering(); return [r.getChannelData(0), r.getChannelData(1)];
      };
      const M = await renderBus([[mDry, 1], [mWet, .55, [6.5, 5.8, 6000, 900, 3]]]);
      const X = await renderBus([[sDry, 1], [sWet, 1, [.9, .55, 7000, 3000, 5]], [br, 1], [br, .35, [.5, .3, 8000, 4000, 9]]]);
      const gate = (t0, t1) => { for (let i = S(t0); i < S(t1) && i < N; i++) { const k = Math.min(1, (i - S(t0)) / 240); M[0][i] *= 1 - k; M[1][i] *= 1 - k; } };
      gate(80.0, 84.6); gate(142.0, 150.2); gate(198, O.DUR);   // 配乐先停，最后一口呼吸留到录像切断
      // 卡死 3 帧：配乐跟着"掉帧"
      for (let i = S(T.freeze0); i < S(T.freeze1); i++) { const k = Math.min(1, (i - S(T.freeze0)) / 96, (S(T.freeze1) - i) / 96); const m = 1 - .92 * k; M[0][i] *= m; M[1][i] *= m; }
      // 白屏之后的耳鸣（不经过门）
      for (let i = S(142.25); i < S(149.6); i++) { const t = i / SR, a = .022 * clamp((t - 142.25) / 1.2) * clamp((149.6 - t) / 2.5); const v = Math.sin(TAU * 6150 * t) * a; M[0][i] += v; M[1][i] += v * .9; }
      const L = new Float32Array(N), R = new Float32Array(N);
      for (let i = 0; i < N; i++) { L[i] = M[0][i] + X[0][i]; R[i] = M[1][i] + X[1][i]; }
      // 录像停止：绝对静音
      for (let i = S(T.cut); i < N; i++) { L[i] = 0; R[i] = 0; }
      // 软限幅 + 归一化
      let pk = 0; for (let i = 0; i < N; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
      const g = db(-1.2) / pk;
      const sat = x => { const y = x * g; return Math.abs(y) < .85 ? y : Math.sign(y) * (.85 + .15 * Math.tanh((Math.abs(y) - .85) / .15)); };
      for (let i = 0; i < N; i++) { L[i] = sat(L[i]); R[i] = sat(R[i]); }
      // 报告每段响度
      const seg = [[0, 12], [12, 34], [34, 51], [51, 80], [80, 85], [85, 105], [105, 130], [130, 142], [142, 150], [150, 161], [161, 180], [180, 199.3]];
      this.report = 'peak_gain=' + g.toFixed(2) + ' ' + seg.map(([a, b]) => { let s = 0, c = 0; for (let i = S(a); i < S(b); i += 7) { s += L[i] * L[i]; c++; } return `${a}-${b}:${(10 * Math.log10(s / c + 1e-12)).toFixed(1)}dB`; }).join(' ');
      return this.wav(L, R);
    },
    // 合成混响脉冲：衰减噪声，越往后越暗
    ir(ctx, len, t60, lp0, lp1, sd) {
      const n = Math.round(len * SR), b = ctx.createBuffer(2, n, SR); let s = sd * 7919;
      const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); let y = 0;
        for (let i = 0; i < n; i++) { const t = i / SR, c = lp0 * Math.pow(lp1 / lp0, t / len), a = 1 - Math.exp(-TAU * c / SR); y += (r() - y) * a; d[i] = y * Math.pow(10, -3 * t / t60) * Math.min(1, t / .012) * .12; }
      }
      return b;
    },
    wav(L, R) {
      const n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf); let o = 0;
      const w4 = s => { for (const ch of s) v.setUint8(o++, ch.charCodeAt(0)); };
      w4('RIFF'); v.setUint32(o, 36 + n * 4, true); o += 4; w4('WAVE'); w4('fmt '); v.setUint32(o, 16, true); o += 4; v.setUint16(o, 1, true); o += 2; v.setUint16(o, 2, true); o += 2;
      v.setUint32(o, SR, true); o += 4; v.setUint32(o, SR * 4, true); o += 4; v.setUint16(o, 4, true); o += 2; v.setUint16(o, 16, true); o += 2; w4('data'); v.setUint32(o, n * 4, true); o += 4;
      let d = 0, ds = 0x2545F491; const dr = () => { ds ^= ds << 13; ds ^= ds >>> 17; ds ^= ds << 5; return (ds >>> 0) / 4294967296; };   // 固定种子的抖动，保证每次逐字节一致
      for (let i = 0; i < n; i++) { d = (dr() - dr()) * .5; v.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767 + d))), true); o += 2; v.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767 + d))), true); o += 2; }
      return buf;
    },
  };
})();
