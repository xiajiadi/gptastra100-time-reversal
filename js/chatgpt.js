'use strict';
// ============================================================================
//  chatgpt.js —— 虚构 ChatGPT 桌面端窗口（深色主题）：侧栏、空状态、输入框、菜单、对话流
// ============================================================================
(() => {
  const T = O.T, G = O.G;
  const C = O.CL = {
    bg: '#181818', side: '#202632', bar: '#202632', line: '#34363d', text: '#f2f2f5', t2: '#c7c9d1', t3: '#9da1ac', t4: '#727781',
    inp: '#33353d', inpLine: '#474a54', menu: '#292b35', hover: '#3f4150', acc: '#8e79e7', accDeep: '#6445bf',
    bubble: '#21447b', red: '#dc807d', green: '#88d1ae', tool: '#232630',
  };
  const UI = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", sans-serif';
  const UID = '"Segoe UI Variable Display", "Segoe UI", "Microsoft YaHei UI", sans-serif';
  const SERIF = 'Cambria, "Astra Serif", serif';      // Astra Serif = 打包的 Noto Serif SC（见 index.html）
  const MONO = '"Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace';
  O.FONT = { UI, UID, SERIF, MONO };

  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  // 乱码：把 UTF-8 字节当 GBK 解码（中文用户最熟悉的那种乱码），解不出的字节用「锟斤拷」
  const GBK = (() => { try { return new TextDecoder('gbk'); } catch (e) { return null; } })();
  const mojiCache = new Map();
  const moji = O.moji = s => { let r = mojiCache.get(s); if (r) return r; if (!GBK) r = s.replace(/[^\x00-\x7f]/g, '锟'); else { let k = 0; r = GBK.decode(new TextEncoder().encode(s)).replace(/�/g, () => '锟斤拷'[k++ % 3]); } mojiCache.set(s, r); return r; };
  O.rr = rr;
  const spark = O.spark = (c,x,y,r) => O.brandMark(c,x,y,r);
  const chevron = (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - s, y - s / 2); c.lineTo(x, y + s / 2); c.lineTo(x + s, y - s / 2); c.stroke(); };
  const check = (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s * .3, y + s * .7); c.lineTo(x + s, y - s * .7); c.stroke(); c.lineCap = 'butt'; };
  O.icons = { chevron, check };

  // ---------------- 文字换行（中日韩逐字，西文按词） ----------------
  const NOSTART = '，。、：；！？）」』》〉,.;:!?)]%…';
  const wrapCache = new Map();
  const wrap = (c, text, font, maxW) => {
    const key = font + '|' + maxW + '|' + text; let r = wrapCache.get(key); if (r) return r;
    c.font = font; const units = []; const chars = Array.from(text); let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (/[A-Za-z0-9_.,'"\-+=/()\[\]#@$×→←·|]/.test(ch)) { let w = ''; while (i < chars.length && /[A-Za-z0-9_.,'"\-+=/()\[\]#@$×→←·|]/.test(chars[i])) w += chars[i++]; while (i < chars.length && chars[i] === ' ') w += chars[i++]; units.push(w); }
      else { let w = ch; i++; while (i < chars.length && NOSTART.includes(chars[i])) w += chars[i++]; while (i < chars.length && chars[i] === ' ' && /[ -~]/.test(ch)) w += chars[i++]; units.push(w); }
    }
    const lines = []; let cur = '', cw = 0;
    for (const u of units) { const w = c.measureText(u).width; if (cw + w > maxW && cur) { lines.push(cur); cur = u.replace(/^ +/, ''); cw = c.measureText(cur).width; } else { cur += u; cw += w; } }
    if (cur) lines.push(cur); r = lines; wrapCache.set(key, r); return r;
  };
  O.wrap = wrap;

  // ---------------- 对话布局 ----------------
  const COLW = G.col1 - G.col0;
  const F = { p: `21px ${UI}`, pb: `600 21px ${UI}`, h: `600 23px ${UI}`, hb: `600 30px ${UI}`, user: `21px ${UI}`, tool: `13.5px ${MONO}`, small: `13px ${UI}`, card: `21px ${UI}`, water: `12.5px ${MONO}` };
  const LH = { p: 36, h: 40, user: 32, water: 20.5, card: 32 };
  const meas = document.createElement('canvas').getContext('2d');
  O.countAt = t => { const k = clamp((t - 55.6) / (T.close - .6 - 55.6)); return Math.min(18364, Math.round(18364 * Math.pow(k, 1.75) + (k > 0 && k < 1 ? O.hash(Math.floor(t * 30), 9) * 37 : 0))); };

  // 返回 { items:[{b,y,h,...}], H }  —— y 为内容坐标
  function layout(blocks, t) {
    const items = []; let y = 0;
    for (const b of blocks) {
      const vis = t >= b.t0; let h = 0, mb = 0, extra = {};
      switch (b.k) {
        case 'user': { const lines = wrap(meas, b.text, F.user, 540); let w = 0; meas.font = F.user; for (const l of lines) w = Math.max(w, meas.measureText(l).width); extra = { lines, bw: w + 36 }; h = vis ? lines.length * LH.user + 24 : 0; mb = vis ? 30 : 0; break; }
        case 'think': h = vis ? 28 : 0; mb = vis ? 10 : 0; break;
        case 'tool': h = vis ? (b.out && t >= b.t1 ? 50 : 28) : 0; mb = vis ? 4 : 0; break;
        case 'count': h = vis ? 30 : 0; mb = vis ? 8 : 0; break;
        case 'gap': h = vis ? b.h : 0; break;
        case 'p': {
          const font = b.bold ? F.pb : F.p, lines = wrap(meas, b.text, font, COLW); const n = vis ? Math.floor((t - b.t0) * (b.cps || 30)) + 1 : 0;
          let cnt = 0, shown = 0; for (const l of lines) { if (cnt < n) shown++; cnt += Array.from(l).length; }
          extra = { lines, n, font, total: cnt }; h = shown * LH.p; mb = vis ? 12 : 0; break;
        }
        case 'h': h = vis ? (b.big ? 40 : LH.h) : 0; mb = vis ? 6 : 0; if (vis) y += 10; break;
        case 'm': { const box = O.TeX.layout(meas, b.tex, b.big ? 33 : 27);
          const scale = Math.min(1, (COLW - 56) / Math.max(1, box.w));
          extra = { box, scale }; h = vis ? (box.a + box.d) * scale + 28 : 0; mb = vis ? 8 : 0; break; }
        case 'line': h = vis ? LH.p + 6 : 0; mb = vis ? 8 : 0; break;
        case 'plot': h = vis ? 330 : 0; mb = vis ? 14 : 0; break;
        case 'draft': h = vis ? 82 : 0; mb = vis ? 16 : 0; break;
        case 'water': { const n = t >= b.t0 ? O.waterLines(t) : 0; extra = { n }; h = n * LH.water + (n ? 10 : 0); mb = n ? 10 : 0; break; }
        case 'card': {
          const ls = b.lines.map(l => ({ t0: l[0], text: l[1], cps: l[2], w: wrap(meas, l[1], F.card, COLW - 60) }));
          let lh = 0; for (const l of ls) if (t >= l.t0) lh += l.w.length * LH.card + 10;
          extra = { ls }; h = vis ? 36 + lh + (t >= b.btn ? 66 : 0) : 0; mb = vis ? 16 : 0; break;
        }
      }
      items.push(Object.assign({ b, y, h, vis }, extra)); y += h + mb;
    }
    return { items, H: y };
  }
  const VIEWH = G.view.y1 - G.view.y0;
  const scrollOf = H => Math.max(0, H + 30 - VIEWH);
  const blocksOf = era => era === 2 ? O.blocks2 : O.blocks1;
  // 锚点：返回屏幕逻辑坐标 [x,y]
  O.anchor = (id, t) => {
    const inB2 = O.blocks2.some(b => b.id === id), tt = inB2 ? Math.max(t, T.back) : Math.min(t, T.white - .001);
    if (!inB2 && tt < T.send) return [G.cx, 400];
    const L = layout(inB2 ? O.blocks2 : O.blocks1, tt), sc = scrollOf(L.H);
    const it = L.items.find(i => i.b.id === id); if (!it) return [G.cx, 600];
    let w = COLW; if (it.lines) { meas.font = it.font || F.p; w = Math.min(COLW, Math.max(...it.lines.map(l => meas.measureText(l).width))); }
    if (it.box) w = it.box.w;
    const x = ['m', 'plot', 'draft'].includes(it.b.k) ? G.cx : G.col0 + w / 2;
    return [x, G.view.y0 + 20 + it.y - sc + Math.max(it.h, 28) / 2];
  };

  // ---------------- 绘制 ----------------
  function drawTranscript(c, t, era) {
    const blocks = blocksOf(era), L = layout(blocks, t), sc = scrollOf(L.H), top = G.view.y0 + 20 - sc;
    c.save(); c.beginPath(); c.rect(G.col0 - 35, G.view.y0, COLW + 70, VIEWH); c.clip();
    const fast = era === 1 ? clamp((O.waterLines(t + 1 / 30) - O.waterLines(t)) * LH.water / 30) : 0;   // 滚动太快 → 残影
    for (const it of L.items) {
      if (!it.vis && it.b.k !== 'water') continue;
      const y = top + it.y; if (y > G.view.y1 + 40 || y + it.h < G.view.y0 - 60) continue;
      drawBlock(c, it, t, y, fast);
    }
    // 生成中的火花
    const gen = era === 1 ? (t >= T.think && t < T.white) : ((t >= T.ask && t < 177.9) || (t >= T.last && t < 187.8));
    if (gen) { const y = top + L.H + 6; if (y < G.view.y1 - 10) spark(c, G.col0 + 12, y + 8, 11, t * 1.3 + Math.sin(t * 3) * .4, C.acc); }
    c.restore();
    // 顶部渐隐
    const g = c.createLinearGradient(0, G.view.y0, 0, G.view.y0 + 30); g.addColorStop(0, C.bg); g.addColorStop(1, 'rgba(24,24,24,0)');
    c.fillStyle = g; c.fillRect(G.col0 - 35, G.view.y0, COLW + 70, 30);
    return L;
  }
  function revealText(c, lines, n, x, y, lh, col) {
    let cnt = 0;
    for (let i = 0; i < lines.length; i++) {
      const arr = Array.from(lines[i]); if (cnt >= n) break;
      const k = Math.min(arr.length, n - cnt); c.fillStyle = col; c.fillText(arr.slice(0, k).join(''), x, y + i * lh);
      cnt += arr.length;
    }
  }
  function spinner(c, x, y, r, t, col) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, t * 7, t * 7 + 4.2); c.stroke(); }
  function drawBlock(c, it, t, y, fast) {
    const b = it.b; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    switch (b.k) {
      case 'user': {
        const x = G.col1 - it.bw; c.fillStyle = C.bubble; rr(c, x, y, it.bw, it.h, 18); c.fill();
        c.font = F.user; c.fillStyle = C.text; it.lines.forEach((l, i) => c.fillText(l, x + 18, y + 30 + i * LH.user)); break;
      }
      case 'think': {
        const done = t >= b.t1, sec = Math.max(1, Math.round((Math.min(t, b.t1) - b.t0)));
        c.font = F.small;
        if (!done) { const sh = (t * .8) % 1; const g = c.createLinearGradient(G.col0 + 26 + sh * 200 - 60, 0, G.col0 + 26 + sh * 200 + 60, 0); g.addColorStop(0, C.t3); g.addColorStop(.5, C.text); g.addColorStop(1, C.t3); c.fillStyle = g; c.fillText('正在思考…', G.col0 + 30, y + 19); spark(c, G.col0 + 10, y + 14, 8, t * 2, C.acc); }
        else { c.fillStyle = C.t3; c.fillText(`已思考 ${sec} 秒`, G.col0, y + 19); chevron(c, G.col0 + 108, y + 13, 4, C.t3); }
        break;
      }
      case 'tool': {
        const done = t >= b.t1, a = clamp((t - b.t0) / .12);
        const tool = ({'Deep Research':'深度研究','Search':'搜索','Data Analysis':'数据分析'})[b.name] || b.name;
        c.globalAlpha = a; c.font = F.tool;
        if (done) { glyph(c, /Python|Analysis/.test(b.name)?'code':'globe',G.col0+7,y+13,17,'#a1a7bb'); } else spinner(c, G.col0 + 6, y + 13, 5, t, C.t3);
        c.fillStyle = C.t2; c.font = `600 13.5px ${MONO}`; c.fillText(tool, G.col0 + 22, y + 18);
        const nw = c.measureText(tool).width; c.font = F.tool; c.fillStyle = C.t3; c.fillText(b.arg, G.col0 + 30 + nw, y + 18);
        if (b.out && done) { c.fillStyle = C.t4; c.fillText('⎿  ' + b.out, G.col0 + 22, y + 42); }
        c.globalAlpha = 1; break;
      }
      case 'count': {
        const done = t >= b.t1; c.font = F.tool;
        if (!done) {
          spinner(c, G.col0 + 6, y + 14, 5, t, C.acc); const n = O.countAt(t);
          c.fillStyle = C.t2; c.font = `600 13.5px ${MONO}`; c.fillText('检索来源', G.col0 + 22, y + 19);
          c.font = F.tool; c.fillStyle = C.t3; const langs = Math.min(24, 3 + Math.floor((t - b.t0) * 1.6));
          c.fillText(`${O.fmt(n)} 项  ·  ${langs} 种语言  ·  ${Math.min(86, Math.max(0, Math.floor((t - T.br0) * 7.3)))} 个窗口`, G.col0 + 90, y + 19);
        } else {
          c.fillStyle = C.green; c.beginPath(); c.arc(G.col0 + 6, y + 14, 4, 0, 7); c.fill();
          c.fillStyle = C.t2; c.font = `600 13.5px ${MONO}`; c.fillText('已查阅', G.col0 + 22, y + 19);
          c.font = F.tool; c.fillStyle = C.t3; c.fillText('18,364 项来源  ·  24 种语言', G.col0 + 66, y + 19);
        }
        break;
      }
      case 'p': {
        c.font = it.font; const col = b.red ? C.red : b.ok ? C.green : b.last ? '#f3f8f6' : C.text;
        revealText(c, it.lines, it.n, G.col0, y + 22, LH.p, col);
        if (b.red && it.n >= it.total) { const k = clamp((t - b.t0 - it.total / b.cps) / .3); if (k < 1) { c.globalAlpha = 1 - k; c.fillStyle = 'rgba(239,90,82,.25)'; c.fillRect(G.col0 - 6, y, COLW, it.h); c.globalAlpha = 1; } }
        break;
      }
      case 'h': { c.font = b.big ? F.hb : F.h; c.fillStyle = C.text; const n = Math.floor((t - b.t0) * 60) + 1; c.fillText(Array.from(b.text).slice(0, n).join(''), G.col0, y + (b.big ? 30 : 25)); break; }
      case 'm': {
        const a = clamp((t - b.t0) / .18); c.globalAlpha = a; c.fillStyle = C.text;
        c.save(); c.translate(G.cx - it.box.w * it.scale / 2, y + 13); c.scale(it.scale, it.scale);
        O.TeX.draw(c, it.box, 0, it.box.a); c.restore(); c.globalAlpha = 1; break;
      }
      case 'line': {
        let x = G.col0; const k = clamp((t - b.t0) / .4); c.globalAlpha = 1;
        b.segs.forEach((s, i) => {
          if (i / b.segs.length > k) return;
          if (s.at && t < s.at) return;
          if (s.m) { const box = O.TeX.layout(c, s.m, 18); c.fillStyle = C.text; O.TeX.draw(c, box, x + 4, y + 23); x += box.w + 8; return; }
          c.font = s.b ? F.pb : F.p; const w = c.measureText(s.s).width;
          if (s.tag) { const pulse = .5 + .5 * Math.sin((t - s.at) * 9); c.fillStyle = `rgba(122,193,171,${.25 + .25 * pulse})`; rr(c, x - 4, y + 2, w + 8, 28, 6); c.fill(); c.fillStyle = '#b9e6d7'; }
          else c.fillStyle = s.b ? '#fff' : C.text;
          c.fillText(s.s, x, y + 23); x += w;
        });
        break;
      }
      case 'plot': O.drawRevisionPlot(c, b, y, t); break;
      case 'draft': {
        const x = G.col0, w = COLW, n = Math.floor((t - b.t0 - .55) * 28);
        c.fillStyle = '#282c39'; rr(c, x, y, w, 78, 13); c.fill();
        c.strokeStyle = '#525d7d'; rr(c, x + .5, y + .5, w - 1, 77, 13); c.stroke();
        c.fillStyle = C.acc; c.font = `600 13px ${MONO}`; c.fillText('恢复的草稿  /  尚未发送', x + 22, y + 25);
        c.fillStyle = C.text; c.font = F.user;
        const text = Array.from(b.text).slice(0, Math.max(0, n)).join('');
        c.fillText(text, x + 22, y + 57);
        if (Math.floor(t * 2.6) % 2 === 0) c.fillRect(x + 24 + c.measureText(text).width, y + 40, 1.6, 21);
        break;
      }
      case 'water': drawWater(c, it, t, y, fast); break;
      case 'card': drawCard(c, it, t, y); break;
    }
  }

  function waterLine(i) {
    const r = O.rng(i * 7919 + 13), kind = r();
    const index = String(i + 1).padStart(6, '0');
    const drift = (Math.exp(-i / 185) * (.68 + r() * .6)).toExponential(5);
    const elapsed = (r() * 183).toFixed(6).padStart(10,'0');
    if (kind < .44) return `[fit:${index}]  τ = ${elapsed}  clock.local ↔ clock.echo   residual=${drift}`;
    if (kind < .72) return `[check]  R(R(t)) − t = ${drift}   ∂t_echo / ∂τ = −1.0000000`;
    if (kind < .90) return `[frame ${index}]   Δx = ${drift}   hash=${Math.floor(r() * 2**32).toString(16).padStart(8,'0')}`;
    return '[clock.local]  source=03:00:00   write_target=03:00:00   channel=099';
  }
  function drawWater(c, it, t, y, fast) {
    const n = it.n; if (!n) return;
    const i0 = Math.max(0, Math.floor((G.view.y0 - 40 - y) / LH.water)), i1 = Math.min(n, Math.ceil((G.view.y1 + 20 - y) / LH.water));
    c.font = F.water;
    const ghosts = fast > .02 ? 4 : 1;
    for (let g = 0; g < ghosts; g++) {
      const off = g * fast * 26; c.globalAlpha = ghosts > 1 ? (g === 0 ? .55 : .3) : 1;
      for (let i = i0; i < i1; i++) {
        const r = O.hash(i, 5); c.fillStyle = r < .05 ? C.acc : r < .1 ? '#9fd3ff' : (i > n - 3 ? C.text : C.t2);
        c.fillText(waterLine(i), G.col0, y + 16 + i * LH.water + off);
      }
    }
    c.globalAlpha = 1;
  }

  // ---------------- 确认卡片 ----------------
  function drawCard(c, it, t, y) {
    const b = it.b, x = G.col0, w = COLW; const hh = it.h;
    c.fillStyle = '#2a2c36'; rr(c, x, y, w, hh, 14); c.fill(); c.strokeStyle = '#555264'; c.lineWidth = 1; rr(c, x + .5, y + .5, w - 1, hh - 1, 14); c.stroke();
    let yy = y + 30; c.font = F.card;
    const SPAN = [3.4, 2.6, 1.2], ge = O.glitchAt(t);
    it.ls.forEach((l, li) => {
      if (t < l.t0) return; const n = Math.floor((t - l.t0) * l.cps) + 1;
      if (t >= T.click) { revealText(c, l.w, n, x + 30, yy + 14, LH.card, C.text); yy += l.w.length * LH.card + 10; return; }
      // 逐字从乱码"修复"成中文
      const all = Array.from(l.text), M = Array.from(moji(l.text)), m = M.length;
      let k0 = 0;
      l.w.forEach((wl, wi) => {
        const cs = Array.from(wl); let s = '';
        cs.forEach((ch, j) => {
          const k = k0 + j; if (k >= n) return;
          let ok = t >= l.t0 + k / l.cps + .45 + O.hash(k + li * 97, 55) * SPAN[li];
          if (ok && ge && ge.s > .55 && ge.type < 2 && t < 156.2 && O.hash(k + ge.f * 7, 56) < .35) ok = false;
          s += ok ? ch : M.slice(Math.floor(k * m / all.length), Math.floor((k + 1) * m / all.length)).join('') || '锟';
        });
        c.fillStyle = C.text; c.fillText(s, x + 30, yy + 14 + wi * LH.card); k0 += cs.length;
      });
      yy += l.w.length * LH.card + 10;
    });
    if (t >= b.btn) {
      const a = clamp((t - b.btn) / .25), by = yy + 10; c.globalAlpha = a;
      const go = { x: x + 30, y: by, w: 124, h: 44 }, no = { x: x + 168, y: by, w: 124, h: 44 };
      O.cardBtns = { go: [go.x + go.w / 2, go.y + go.h / 2], no: [no.x + no.w / 2, no.y + no.h / 2] };
      const cur = O.curNow || [0, 0], over = r => cur[0] >= r.x && cur[0] <= r.x + r.w && cur[1] >= r.y && cur[1] <= r.y + r.h;
      if (t < T.click + .25) {
        const pressGo = t >= T.click && t < T.click + .12;
        c.fillStyle = pressGo ? '#569781' : over(go) ? '#a2d6c2' : C.acc; rr(c, go.x, go.y, go.w, go.h, 10); c.fill();
        c.fillStyle = '#fff'; c.font = `600 17px ${UI}`; c.textAlign = 'center'; c.fillText('载入', go.x + go.w / 2, go.y + 28);
        c.fillStyle = over(no) ? '#484959' : '#353643'; rr(c, no.x, no.y, no.w, no.h, 10); c.fill(); c.strokeStyle = '#555865'; rr(c, no.x + .5, no.y + .5, no.w - 1, no.h - 1, 10); c.stroke();
        c.fillStyle = C.t2; c.fillText('取消', no.x + no.w / 2, no.y + 28); c.textAlign = 'left';
      } else {
        c.fillStyle = C.t3; c.font = `14px ${UI}`; check(c, go.x + 8, go.y + 22, 6, C.green); c.fillText('已载入 03:00:00', go.x + 24, go.y + 27);
      }
      c.globalAlpha = 1;
    } else if (!O.cardBtns) O.cardBtns = { go: [x + 92, yy + 32], no: [x + 230, yy + 32] };
  }

  // ---------------- 输入框 ----------------
  function glyph(c, kind, x, y, size, color = C.t2) {
    c.save(); c.translate(x,y); c.scale(size / 24,size / 24);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.65;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    const lines = (...points) => { c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p)); };
    if (kind === 'home') {
      lines([-9,-1],[0,-9],[9,-1],[9,9],[3,9],[3,3],[-3,3],[-3,9],[-9,9],[-9,-1]);
    } else if (kind === 'clock') {
      c.arc(0,0,9,0,Math.PI*2); lines([0,-5],[0,0],[-4,4]);
    } else if (kind === 'picture') {
      c.roundRect(-9,-8,18,16,3); lines([-8,5],[-3,0],[1,3],[4,-1],[9,3]);
      c.moveTo(5,-3.7); c.arc(3.7,-3.7,1.3,0,7);
    } else if (kind === 'folder') {
      lines([-9,-5],[-9,-7],[-2,-7],[1,-4],[9,-4],[9,7],[-9,7],[-9,-5]); lines([-8,-1],[8,-1]);
    } else if (kind === 'files') {
      c.rect(-9,-7,5,15); c.rect(-1,-7,5,15); lines([5,-7],[9,-8],[12,6],[8,7],[5,-7]);
    } else if (kind === 'panel') {
      c.roundRect(-9,-7,18,14,2); lines([3,-5],[3,5]);
    } else if (kind === 'plugin') {
      c.arc(0,0,9,.05,6.2); lines([-4,2],[-1,5],[5,-1],[2,-4],[-4,2]); lines([-5,-2],[-3,0]); lines([0,-5],[2,-3]);
    } else if (kind === 'plus') {
      lines([-8,0],[8,0]); lines([0,-8],[0,8]);
    } else if (kind === 'mic') {
      c.roundRect(-3.3,-9,6.6,12,3.3); c.moveTo(6,0); c.arc(0,0,6,0,Math.PI); lines([0,6],[0,10]);
    } else if (kind === 'bolt') {
      lines([1,-10],[-8,1],[-1,1],[-2,10],[8,-2],[1,-2],[1,-10]);
    } else if (kind === 'globe') {
      c.arc(0,0,9,0,7); c.moveTo(4,0); c.ellipse(0,0,4,9,0,0,7); lines([-8,0],[8,0]);
    } else if (kind === 'code') {
      c.roundRect(-9,-7,18,14,3); lines([-5,-2],[-2,0],[-5,2]); lines([1,3],[5,3]);
    } else if (kind === 'shield') {
      lines([0,-8],[-7,-5],[-6,4],[0,9],[6,4],[7,-5],[0,-8]); lines([0,-4],[0,1]); lines([0,4],[0,4.2]);
    } else if (kind === 'list') {
      [-5,0,5].forEach(yy=>{lines([-3,yy],[8,yy]); lines([-8,yy],[-7.5,yy]);});
    } else if (kind === 'chev') {
      lines([-5,-2],[0,3],[5,-2]);
    } else {
      lines([-8,0],[8,0]);
    }
    c.stroke(); c.restore();
  }
  function drawIME(c, x, y, cand) {
    if (!cand) return; c.font = `16px ${UI}`;
    const items = cand.map((s, i) => `${i + 1} ${s}`); const ws = items.map(s => c.measureText(s).width + 22); const W = ws.reduce((a, b) => a + b, 0) + 60;
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 18; c.shadowOffsetY = 4; c.fillStyle = '#2c2c2c'; rr(c, x, y, W, 42, 8); c.fill(); c.restore();
    c.strokeStyle = '#444'; rr(c, x + .5, y + .5, W - 1, 41, 8); c.stroke();
    let xx = x + 8;
    items.forEach((s, i) => { if (i === 0) { c.fillStyle = '#3a3a3a'; rr(c, xx - 2, y + 6, ws[i], 30, 5); c.fill(); c.fillStyle = '#4cc2ff'; rr(c, xx - 2, y + 13, 3, 16, 2); c.fill(); } c.fillStyle = i === 0 ? '#fff' : '#d0d0d0'; c.fillText(s, xx + 8, y + 27); xx += ws[i]; });
    c.fillStyle = '#9a9a9a'; c.font = `12px ${UI}`; c.fillText('‹ ›', xx + 8, y + 26);
  }

  // ---------------- 模型菜单 ----------------
  // 状态行（输入框上方）
  function drawStatus(c, t, era) {
    let s = null, prog = -1;
    if (era === 1 && t >= T.think && t < T.white) {
      const el = Math.floor(t - T.think), tm = el >= 60 ? `${Math.floor(el / 60)}m ${el % 60}s` : `${el}s`;
      if (t < T.tools) s = '正在思考…'; else if (t < T.close) s = '深度研究  /  正在核对来源'; else if (t < T.calc) s = '正在生成检索纪要…'; else if (t < T.start) s = '数据分析  /  Python 沙盒';
      else { s = `因果重建  ${(Math.min(t, T.done) - T.start).toFixed(1)}s / 11.7s`; prog = clamp((t - T.start) / (T.done - T.start)); }
      if (prog < 0) s += `  (${tm} · Esc 停止)`;
    }
    if (era === 2 && ((t >= T.ask && t < 155.4) || (t > T.click && t < 177.9) || (t >= T.last && t < 187.8))) s = '生成回复…';
    if (!s) return;
    const y = G.inp1.y - 26; spark(c, G.col0 + 10, y - 5, 7, t * 2.2, C.acc);
    c.font = `13.5px ${MONO}`; c.fillStyle = prog >= 0 ? '#b3dacd' : C.acc; c.fillText(s, G.col0 + 26, y);
    if (prog >= 0) {
      const x = G.col0 + 320, w = 300; c.fillStyle = '#34363d'; rr(c, x, y - 10, w, 8, 4); c.fill(); c.fillStyle = C.acc; rr(c, x, y - 10, Math.max(4, w * prog), 8, 4); c.fill();
      c.fillStyle = C.t3; c.fillText(`${Math.floor(prog * 100)}%`, x + w + 14, y);
    }
  }

  // ---------------- 主入口 ----------------
  O.ChatGPT = {
    draw(c, t) {
      const era = O.era(t); if (era === 'white' || era === 'black') return;
      const sent = t >= T.send;
      O.Plate.frame(c,t,sent);
      if (!sent) {
        O.Plate.input(c,t,false,drawIME);
        O.Plate.popup(c,t);
      } else {
        drawTranscript(c,t,era);
        drawStatus(c,t,era);
        O.Plate.input(c,t,true,drawIME);
      }
      c.restore();
      if (!sent) O.Plate.warning(c,t);
    },
  };
})();
