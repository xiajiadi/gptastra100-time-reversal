'use strict';
// ============================================================================
//  screen.js —— 显示器上的全部像素：壁纸、桌面、ChatGPT、浏览器、任务栏、光标、故障
// ============================================================================
(() => {
  const T = O.T, G = O.G, { UI, UID, MONO } = O.FONT;
  let cv, c, wall;
  function makeWallpaper() {
    const w = document.createElement('canvas'); w.width = O.SW; w.height = O.SH; const x = w.getContext('2d'); x.scale(O.LS, O.LS);
    const g = x.createLinearGradient(0, 0, 2560, 1440); g.addColorStop(0, '#0a0d16'); g.addColorStop(.55, '#0c1220'); g.addColorStop(1, '#06070b'); x.fillStyle = g; x.fillRect(0, 0, 2560, 1440);
    const blob = (cx, cy, r, col) => { const gg = x.createRadialGradient(cx, cy, 0, cx, cy, r); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(0, 0, 2560, 1440); };
    blob(700, 1100, 900, 'rgba(32,52,92,.55)'); blob(1900, 300, 800, 'rgba(60,34,70,.35)'); blob(1500, 900, 520, 'rgba(24,70,90,.25)');
    x.globalAlpha = .07; for (let i = 0; i < 40; i++) { x.strokeStyle = i % 2 ? '#7fa6ff' : '#b58cff'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k <= 60; k++) { const px = k / 60 * 2560, py = 720 + Math.sin(k * .09 + i * .23) * (220 + i * 9) + (i - 20) * 14; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
    x.globalAlpha = 1; return w;
  }
  function icon(x, y, kind) {
    c.save(); c.translate(x, y);
    if (kind === 'start') { c.fillStyle = '#4cc2ff'; [[-11, -11], [1, -11], [-11, 1], [1, 1]].forEach(([a, b]) => c.fillRect(a, b, 10, 10)); }
    else if (kind === 'search') { c.strokeStyle = '#e6e6e6'; c.lineWidth = 2; c.beginPath(); c.arc(-2, -2, 7, 0, 7); c.moveTo(3, 3); c.lineTo(9, 9); c.stroke(); }
    else if (kind === 'task') { c.strokeStyle = '#e6e6e6'; c.lineWidth = 1.6; c.strokeRect(-10, -8, 12, 14); c.strokeRect(-2, -4, 12, 14); }
    else if (kind === 'files') { c.fillStyle = '#f2c14e'; O.rr(c, -12, -8, 24, 18, 3); c.fill(); c.fillStyle = '#e0a52a'; O.rr(c, -12, -11, 11, 6, 2); c.fill(); }
    else if (kind === 'web') { const g = c.createLinearGradient(-12, -12, 12, 12); g.addColorStop(0, '#36c1a6'); g.addColorStop(1, '#2f6fe0'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, 0, 5, 12, 0, 0, 7); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke(); }
    else if (kind === 'term') { c.fillStyle = '#2b2b2b'; O.rr(c, -12, -10, 24, 20, 3); c.fill(); c.strokeStyle = '#ccc'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-7, -4); c.lineTo(-2, 0); c.lineTo(-7, 4); c.moveTo(0, 5); c.lineTo(6, 5); c.stroke(); }
    else if (kind === 'chatgpt') { c.fillStyle = '#222327'; O.rr(c, -12, -12, 24, 24, 6); c.fill(); O.brandMark(c,0,0,9); }
    c.restore();
  }
  function taskbar(t, nBrowsers) {
    c.fillStyle = 'rgba(30,31,34,.94)'; c.fillRect(0, 1392, 2560, 48); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, 1392, 2560, 1);
    const items = ['start', 'search', 'task', 'files', 'web', 'term', 'chatgpt'], x0 = 1280 - items.length * 44 / 2 + 22;
    items.forEach((k, i) => {
      const x = x0 + i * 44, y = 1416;
      if (k === 'chatgpt') { c.fillStyle = 'rgba(255,255,255,.08)'; O.rr(c, x - 20, 1396, 40, 40, 5); c.fill(); c.fillStyle = '#4cc2ff'; O.rr(c, x - 8, 1434, 16, 3, 1.5); c.fill(); }
      if (k === 'web' && nBrowsers > 0) { c.fillStyle = 'rgba(255,255,255,.05)'; O.rr(c, x - 20, 1396, 40, 40, 5); c.fill(); c.fillStyle = '#9aa0a6'; O.rr(c, x - 3, 1434, 6, 3, 1.5); c.fill(); if (nBrowsers > 1) { c.fillStyle = 'rgba(255,255,255,.12)'; O.rr(c, x - 17, 1398, 36, 36, 5); c.fill(); } }
      icon(x, y, k);
      if (k === 'web' && nBrowsers > 1) { c.fillStyle = '#c42b1c'; c.beginPath(); c.arc(x + 12, y - 11, 9, 0, 7); c.fill(); c.font = `600 10px ${UI}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(nBrowsers > 99 ? '99+' : String(nBrowsers), x + 12, y - 7.5); c.textAlign = 'left'; }
    });
    // 托盘
    const tx = 2560 - 12; c.fillStyle = '#e6e6e6'; c.textAlign = 'right';
    c.font = `600 14px ${UI}`; c.fillText(O.clockStr(t), tx - 46, 1412); c.font = `12px ${UI}`; c.fillText('2026/11/18', tx - 46, 1430);
    c.strokeStyle = '#e6e6e6'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(tx - 22, 1406); c.lineTo(tx - 12, 1406); c.lineTo(tx - 12, 1424); c.lineTo(tx - 28, 1424); c.lineTo(tx - 28, 1412); c.stroke();
    const st = O.inputAt(t); c.font = `13px ${UI}`; c.fillText(st.en ? '英' : '中', tx - 140, 1422);
    c.beginPath(); c.moveTo(tx - 176, 1414); c.lineTo(tx - 170, 1414); c.lineTo(tx - 164, 1408); c.lineTo(tx - 164, 1426); c.lineTo(tx - 170, 1420); c.lineTo(tx - 176, 1420); c.closePath(); c.stroke();
    c.beginPath(); c.arc(tx - 200, 1424, 2, 0, 7); c.moveTo(tx - 206, 1418); c.arc(tx - 200, 1424, 8, -2.4, -.75); c.moveTo(tx - 211, 1413); c.arc(tx - 200, 1424, 14, -2.4, -.75); c.stroke();
    c.beginPath(); c.moveTo(tx - 236, 1420); c.lineTo(tx - 231, 1414); c.lineTo(tx - 226, 1420); c.stroke();
    c.textAlign = 'left';
  }
  function desktopIcons() {
    const items = [['回收站', 'bin'], ['项目', 'dir'], ['clock_notes.docx', 'doc']];
    items.forEach(([n, k], i) => {
      const x = 52, y = 40 + i * 104;
      if (k === 'bin') { c.strokeStyle = '#cfd6e0'; c.lineWidth = 2; c.strokeRect(x - 14, y + 6, 28, 34); c.beginPath(); c.moveTo(x - 18, y + 6); c.lineTo(x + 18, y + 6); c.stroke(); }
      else if (k === 'dir') { c.fillStyle = '#f2c14e'; O.rr(c, x - 22, y + 6, 44, 34, 4); c.fill(); }
      else { c.fillStyle = '#2b579a'; O.rr(c, x - 16, y + 2, 32, 40, 3); c.fill(); c.fillStyle = '#fff'; c.font = `600 18px ${UI}`; c.textAlign = 'center'; c.fillText('W', x, y + 30); }
      c.font = `12.5px ${UI}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 3; c.fillText(n, x, y + 62); c.shadowBlur = 0; c.textAlign = 'left';
    });
  }
  // ---------------- 光标 ----------------
  function cursorKind(t, p) {
    if (t >= T.focus && t < T.send && p[1] > G.inp0.y && p[1] < G.inp0.y + 90 && p[0] > G.inp0.x && p[0] < G.inp0.x + G.inp0.w) return 'ibeam';
    const inR = (x, y, w, h) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h;
    if (t >= T.ddOpen && t < T.ddClose && inR(G.dd.x, G.dd.y, G.dd.w, G.dd.h)) return 'hand';
    if (t >= T.permOpen && t < T.permPick && inR(G.perm.x, G.perm.y, G.perm.w, 260)) return 'hand';
    if (t >= T.dlg && t < T.cont + .1 && (inR(G.dlg.cont.x, G.dlg.cont.y, G.dlg.cont.w, G.dlg.cont.h) || inR(G.dlg.cancel.x, G.dlg.cancel.y, G.dlg.cancel.w, G.dlg.cancel.h))) return 'hand';
    const k = G.ctrl(G.inp0); if (t < T.send && inR(k.model.r - 110, k.model.y, 116, 30)) return 'hand';
    if (t < T.send && inR(k.perm.x, k.perm.y, 180, 30)) return 'hand';
    if (O.cardBtns && t > 155 && t < T.click + .3) { const b = O.cardBtns; if (Math.abs(p[0] - b.go[0]) < 62 && Math.abs(p[1] - b.go[1]) < 22) return 'hand'; if (Math.abs(p[0] - b.no[0]) < 62 && Math.abs(p[1] - b.no[1]) < 22) return 'hand'; }
    return 'arrow';
  }
  function drawCursor(t, p, kind) {
    c.save(); c.translate(Math.round(p[0] * 1.5) / 1.5, Math.round(p[1] * 1.5) / 1.5);
    c.lineJoin = 'round'; c.lineWidth = 1.3; c.strokeStyle = '#000'; c.fillStyle = '#fff';
    if (kind === 'arrow') { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 19); c.lineTo(4.4, 14.9); c.lineTo(7.6, 21.6); c.lineTo(10.4, 20.4); c.lineTo(7.3, 13.9); c.lineTo(13.2, 13.4); c.closePath(); c.fill(); c.stroke(); }
    else if (kind === 'hand') {
      c.translate(-6, -1); c.beginPath(); c.moveTo(5, 1.5); c.quadraticCurveTo(6.6, -.6, 8.2, 1.5); c.lineTo(8.2, 9); c.lineTo(10, 8.6); c.quadraticCurveTo(11.8, 8.6, 11.8, 10.4); c.lineTo(13.6, 10.2); c.quadraticCurveTo(15.4, 10.4, 15.4, 12); c.lineTo(17, 12);
      c.quadraticCurveTo(18.8, 12.4, 18.6, 14.4); c.lineTo(18.2, 19.6); c.quadraticCurveTo(17.4, 23, 14.6, 23.6); c.lineTo(8.6, 23.6); c.quadraticCurveTo(6.4, 23.2, 5, 20.6); c.lineTo(1.4, 14.2); c.quadraticCurveTo(.6, 12.2, 2.4, 11.8); c.quadraticCurveTo(3.8, 11.6, 5, 13.2); c.closePath(); c.fill(); c.stroke();
    } else { c.beginPath(); c.moveTo(-4, -9); c.lineTo(-1, -9); c.lineTo(0, -8); c.lineTo(1, -9); c.lineTo(4, -9); c.moveTo(0, -8); c.lineTo(0, 8); c.moveTo(-4, 9); c.lineTo(-1, 9); c.lineTo(0, 8); c.lineTo(1, 9); c.lineTo(4, 9); c.lineWidth = 3.4; c.strokeStyle = '#fff'; c.stroke(); c.lineWidth = 1.4; c.strokeStyle = '#000'; c.stroke(); }
    c.restore();
  }

  O.Screen = {
    init() {
      cv = document.createElement('canvas'); cv.width = O.SW; cv.height = O.SH; c = cv.getContext('2d', { alpha: false });
      wall = makeWallpaper(); O.Pages.init(); this.cv = cv; return cv;
    },
    // 画 t 时刻的屏幕；返回 { lum: 粗略平均亮度 }
    draw(t0) {
      let t = t0;
      if (t >= T.freeze0 && t < T.freeze1) t = T.freeze0;                 // 卡死 3 帧
      c.setTransform(1, 0, 0, 1, 0, 0);
      const era = O.era(t);
      if (t < T.wake + .02 || t >= T.sleep) { c.fillStyle = '#000'; c.fillRect(0, 0, O.SW, O.SH); return; }
      if (era === 'white') { c.fillStyle = '#fff'; c.fillRect(0, 0, O.SW, O.SH); return; }
      if (era === 'black') { c.fillStyle = '#000'; c.fillRect(0, 0, O.SW, O.SH); return; }
      c.drawImage(wall, 0, 0);
      c.setTransform(O.LS, 0, 0, O.LS, 0, 0);
      desktopIcons();
      O.curNow = O.cursorAt(t);
      O.ChatGPT.draw(c, t);
      let nb = 0;
      if (t >= T.br0 && t < T.close) {
        const hl = t >= 72.3 && t < T.close ? (Math.floor(t * 8.5) % 3 === 0 ? 0 : 1) * sstep(72.3, 72.8, t) : 0;
        const open = O.browsers.filter(w => t >= w.t);
        nb = open.length;
        // Older windows stay represented in the taskbar. The foreground stack supplies
        // the visible overlap without repainting dozens of hidden full-size page surfaces.
        for (const w of open.slice(-24)) O.drawBrowser(c, w, t, hl);
        // Two source PDFs briefly take focus while the rest of the results keep moving.
        const exhibits = [
          { i: 88, t: 62.51, end: 65.44, x: 198, y: 367, w: 1240, h: 680, page: 5, tabs: 3, s0: 1358, sp: 5 },
          { i: 89, t: 65.45, end: 68.4, x: 1117, y: 365, w: 1240, h: 738, page: 5, tabs: 4, s0: 32, sp: 4 },
        ];
        for (const page of exhibits) if (t >= page.t && t < page.end) O.drawBrowser(c,page,t,0);
      }
      taskbar(t, nb);
      if (t >= T.desk && !O.Plate.hasRecordedPointer(t) && !(t >= T.white && t < T.back + 1.0)) drawCursor(t, O.curNow, cursorKind(t, O.curNow));
      // 唤醒时淡入
      if (t < T.desk + .18) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(0,0,0,${1 - clamp((t - T.desk) / .18)})`; c.fillRect(0, 0, O.SW, O.SH); }
      // 计算时的撕裂与闪烁
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (t >= T.start + 3 && t < T.done) {
        const f = Math.floor(t * 30), k = (t - T.start) / (T.done - T.start);
        if (O.hash(f, 11) < .12 + .35 * k) { const y = Math.floor(O.hash(f, 12) * O.SH * .85), h = Math.floor(30 + O.hash(f, 13) * 380 * k), dx = Math.floor((O.hash(f, 14) - .5) * 160 * k); c.drawImage(cv, 0, y, O.SW, h, dx, y, O.SW, h); }
        if (O.hash(f, 15) < .08 * k) { c.fillStyle = `rgba(255,255,255,${.06 + .12 * O.hash(f, 16)})`; c.fillRect(0, 0, O.SW, O.SH); }
      }
      if (t >= T.done && t < T.white) { c.fillStyle = `rgba(255,255,255,${.85 * sstep(T.done + .05, T.white, t)})`; c.fillRect(0, 0, O.SW, O.SH); }
      // 信号恢复后的系统故障（点击「开始」后立刻消失）。按钮那一行保持完好。
      const ga = O.glitchAmt(t);
      if (ga > 0) {
        const f = Math.floor(t * 30), ge = O.glitchAt(t), b = O.cardBtns && t > 155.3 ? O.cardBtns.go[1] * O.LS : -1e4;
        const safe = (y, h) => (y + h < b - 60 || y > b + 60) ? y : (y < b ? b - 60 - h : b + 60);
        if (ga > .15) { c.fillStyle = `rgba(0,0,0,${.07 * ga})`; for (let y = (f * 7) % 9; y < O.SH; y += 9) c.fillRect(0, y, O.SW, 3); }
        if (ge) {
          const R = O.rng(ge.f * 13 + 5), s = ge.s;
          if (ge.type === 0) { for (let k = 0; k < 1 + Math.floor(s * 4); k++) { const h = 20 + R() * 260 * s, y = safe(R() * O.SH * .92, h), dx = (R() - .5) * 260 * s; c.drawImage(cv, 0, y, O.SW, h, dx, y, O.SW, h); } }
          else if (ge.type === 1) {
            for (let k = 0; k < 3 + s * 9; k++) {
              const w = 48 * (1 + Math.floor(R() * 3)), h = 48 * (1 + Math.floor(R() * 2)), x = Math.floor(R() * O.SW / 48) * 48, y = safe(Math.floor(R() * O.SH / 48) * 48, h);
              if (R() < .8) c.drawImage(cv, Math.floor(R() * O.SW / 48) * 48, Math.floor(R() * O.SH / 48) * 48, w, h, x, y, w, h);
              else { c.fillStyle = ['rgba(255,0,140,.3)', 'rgba(0,255,120,.25)', 'rgba(20,20,20,.85)'][Math.floor(R() * 3)]; c.fillRect(x, y, w, h); }
            }
          } else if (ge.type === 2) {
            const h = 80 + R() * 420 * s, y = safe(R() * O.SH * .8, h);
            c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .35 * s; c.drawImage(cv, 0, y, O.SW, h, 14 * s, y, O.SW, h); c.restore();
            c.fillStyle = `rgba(255,0,60,${.1 * s})`; c.fillRect(0, y, O.SW, h);
          } else { c.fillStyle = `rgba(0,0,0,${.5 + .4 * s})`; c.fillRect(0, 0, O.SW, b > 0 ? b - 60 : O.SH); }
        }
      }
    },
  };
})();
