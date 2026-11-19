'use strict';
// ============================================================================
//  main.js —— 启动 / 预览 / 截帧检查 / 逐帧离线渲染
//    index.html                     实时预览（降分辨率）
//    index.html?shots=10,20.5       保存 out/shots/<t>.jpg（可加 &scale=.5 &crop=x,y,w,h）
//    index.html?screen=10           保存屏幕画布本身 out/shots/screen-10.jpg
//    index.html?render=1&from=&to=  渲染 MP4（tools/render.ps1 调用）
//    index.html?audio=1             合成配乐 → out/audio.wav
// ============================================================================
(async () => {
  const q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
  const log = m => { console.log(m); if (location.protocol.startsWith('http')) return fetch('/__log?m=' + encodeURIComponent(m)).catch(() => { }); };
  const save = (path, body) => fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body });
  try {
    if (q.has('audio')) { const t0 = performance.now(); const wav = O.retimeAudio(await O.Audio.render()); await save('out/audio.wav', new Blob([wav])); await log(`AUDIO DONE ${(wav.byteLength / 1e6).toFixed(1)}MB ${((performance.now() - t0) / 1000).toFixed(1)}s ${O.Audio.report || ''}`); return; }
    const W = +(q.get('w') || 3840), H = Math.round(W * 9 / 16);
    const cv = $('cv'); cv.width = W; cv.height = H;
    for (const f of ['16px "Segoe UI Variable Text"', '16px "Astra Serif"', '16px Georgia', '16px "Cascadia Mono"', '16px "Cambria Math"', '16px "Palatino Linotype"', '600 16px "Segoe UI Variable Text"', '600 16px "Astra Serif"', '900 16px "Astra Serif"', '16px "Segoe UI Emoji"']) { try { await document.fonts.load(f, 'Aa熵😂'); } catch (e) { } }
    O.Screen.init(); O.Cam.init(cv);
    // 可选：黑屏倒影照片
    const loadImg = async names => { for (const n of names) { try { const im = new Image(); im.src = n; await im.decode(); return im; } catch (e) { } } return null; };
    await O.Plate.ready(loadImg);
    const r1 = await loadImg(['assets/reflect-1.jpg', 'assets/reflect-1.png', 'assets/reflect-1.jpeg', 'assets/reflect-1.webp']), r2 = await loadImg(['assets/reflect-2.jpg', 'assets/reflect-2.png', 'assets/reflect-2.jpeg', 'assets/reflect-2.webp']);
    if (r1 || r2) { O.Cam.setRef(r1 || r2, r2); await log(`REF images: ${r1 ? r1.naturalWidth + 'x' + r1.naturalHeight : '-'} / ${r2 ? r2.naturalWidth + 'x' + r2.naturalHeight : '-'}`); }
    if (q.get('refgain')) O.refGain = +q.get('refgain');
    let info = null;
    const frame = time => {
      const t = O.storyTime(time);
      O.Screen.draw(t); O.Cam.upload(O.Screen.cv); info = O.Cam.render(t); return cv;
    };
    O.frame = frame;
    const toJpg = async (src, scale, crop) => {
      let c = src;
      if (scale !== 1 || crop) { const [x, y, w, h] = crop || [0, 0, src.width, src.height]; c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, c.width, c.height); }
      return await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
    };
    if (q.has('shots')) {
      const scale = +(q.get('scale') || .5), crop = q.get('crop') ? q.get('crop').split(',').map(Number) : null, tag = q.get('tag') || '';
      for (const s of q.get('shots').split(',')) {
        const t = +s, t0 = performance.now(); const src = frame(t); const ms = performance.now() - t0;
        await save(`out/shots/${tag}${s}.jpg`, await toJpg(src, scale, crop));
        await log(`SHOT ${s} ${ms.toFixed(0)}ms expo=${info ? info.expo.toFixed(2) : '-'} focus=${info ? info.focus.toFixed(3) : '-'}`);
      }
      await log('SHOTS DONE'); return;
    }
    if (q.has('sheet')) {   // ?sheet=a,b,c...&cols=4&name=x → out/shots/sheet-x.jpg
      const ts = q.get('sheet').split(',').map(Number), cols = +(q.get('cols') || 4), rows = Math.ceil(ts.length / cols), tw = 960, th = 540;
      const sh = document.createElement('canvas'); sh.width = tw * cols; sh.height = th * rows; const sc = sh.getContext('2d');
      for (let i = 0; i < ts.length; i++) {
        const src = frame(ts[i]); sc.drawImage(src, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
        sc.font = 'bold 22px Consolas'; sc.fillStyle = '#ff0'; sc.fillText(ts[i].toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26);
      }
      await save(`out/shots/sheet-${q.get('name') || 'x'}.jpg`, await new Promise(r => sh.toBlob(r, 'image/jpeg', .85)));
      await log('SHEET DONE'); return;
    }
    if (q.has('compare')) {
      const times = q.get('compare').split(',').filter(Boolean).map(Number);
      const notes = (q.get('notes') || '').split('|');
      const name = (q.get('name') || '制作拆解对比图').replace(/\.jpg$/, '');
      const tw = 920, th = Math.round(tw * 9 / 16), pad = 32, gap = 24;
      const rowW = pad * 2 + tw * 2 + gap, rowH = th + 182;
      const paper = '#0e1118', ink = '#e9edf6', muted = '#aab5c8', yellow = '#ffda54';
      const sans = '"Microsoft YaHei UI", "Segoe UI", sans-serif';
      const stamp = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + (t % 60).toFixed(2).padStart(5, '0');
      const canvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
      if (!times.length || times.some(t => !Number.isFinite(t) || t < 0 || t >= O.RUNTIME)) throw new Error('Invalid film time');
      if (!/^[\p{L}\p{N}_-]+$/u.test(name)) throw new Error('Invalid comparison image name');
      const [left, top] = O.scrToWorld([0, 0]);
      const [right, bottom] = O.scrToWorld([O.LW, O.LH]);
      const aspect = W / H;
      const insets = (q.get('inset') || '').split(';').map(entry => entry.split(',').map(Number));
      const all = q.has('split') ? null : canvas(rowW, times.length * rowH);
      const allCtx = all?.getContext('2d');
      const write = async (img, file) => {
        const blob = await new Promise(resolve => img.toBlob(resolve, 'image/jpeg', .94));
        const response = await save('out/shots/' + file, blob);
        if (!response.ok) throw new Error('Could not save ' + file);
      };
      for (const [i, time] of times.entries()) {
        // Both views and the camera pose are sampled from the same retimed frame.
        const src = frame(time), p = info.pose;
        const onScreen = (sx, sy) => {
          const x = sx, y = sy / aspect;
          const scale = p.tanH * (1 + .035 * (x * x + y * y));
          const ray = p.F.map((value, j) => value + scale * (p.R[j] * x + p.U[j] * y));
          const distance = -p.C[2] / ray[2];
          return [(p.C[0] + distance * ray[0] - left) / (right - left),
            (top - p.C[1] - distance * ray[1]) / (top - bottom)];
        };
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => onScreen(x, y));
        const bounds = j => [Math.min(0, ...corners.map(point => point[j])), Math.max(1, ...corners.map(point => point[j]))];
        const [minX, maxX] = bounds(0), [minY, maxY] = bounds(1);
        const scale = .95 / Math.max(maxX - minX, maxY - minY);
        const mapX = x => tw * (.5 + (x - (minX + maxX) / 2) * scale);
        const mapY = y => th * (.5 + (y - (minY + maxY) / 2) * scale);
        const plate = canvas(rowW, rowH), ctx = plate.getContext('2d');
        ctx.fillStyle = paper; ctx.fillRect(0, 0, rowW, rowH);
        ctx.fillStyle = yellow; ctx.font = '600 29px Consolas, monospace';
        ctx.fillText(stamp(time), pad, 48);
        ctx.fillStyle = ink; ctx.font = '600 30px ' + sans;
        ctx.fillText(notes[i] || '镜头拆解', pad + 172, 48, 650);
        const yaw = Math.atan2(-p.F[0], -p.F[2]) * 180 / Math.PI;
        ctx.fillStyle = muted; ctx.font = '21px ' + sans; ctx.textAlign = 'right';
        ctx.fillText('水平视场 ' + p.fov.toFixed(0) + '°   横向偏角 ' + yaw.toFixed(1) + '°   对焦距离 ' + (p.focus * 100).toFixed(0) + ' cm', rowW - pad, 48);
        ctx.textAlign = 'left';
        const y0 = 119, x1 = pad + tw + gap;
        ctx.font = '600 22px ' + sans; ctx.fillText('显示器原画  /  拍屏前', pad, 103);
        ctx.fillText('虚拟手机画面  /  拍屏后', x1, 103);
        ctx.fillStyle = '#161d27'; ctx.fillRect(pad, y0, tw, th); ctx.fillRect(x1, y0, tw, th);
        ctx.drawImage(O.Screen.cv, pad + mapX(0), y0 + mapY(0), mapX(1) - mapX(0), mapY(1) - mapY(0));
        ctx.drawImage(src, x1, y0, tw, th);
        const inset = insets.find(values => values.length === 5 && values.every(Number.isFinite) && values[0] === i);
        if (inset) {
          const [, sx, sy, sw, sh] = inset;
          if (sx >= 0 && sy >= 0 && sw > 0 && sh > 0 && sx + sw <= W && sy + sh <= H) {
            const iw = Math.min(365, (th - 65) * sw / sh), ih = iw * sh / sw;
            const ix = x1 + tw - iw - 14, iy = y0 + th - ih - 14;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(src, sx, sy, sw, sh, ix, iy, iw, ih);
            ctx.imageSmoothingEnabled = true;
            ctx.strokeStyle = yellow; ctx.lineWidth = 2;
            ctx.strokeRect(ix, iy, iw, ih);
          }
        }
        ctx.strokeStyle = '#343d4c'; ctx.lineWidth = 2;
        ctx.strokeRect(pad + mapX(0), y0 + mapY(0), mapX(1) - mapX(0), mapY(1) - mapY(0));
        ctx.strokeRect(x1, y0, tw, th);
        const [cx, cy] = onScreen(0, 0), aimX = mapX(cx), aimY = mapY(cy);
        ctx.save(); ctx.translate(pad, y0);
        ctx.strokeStyle = '#0b0d11'; ctx.lineWidth = 7;
        ctx.setLineDash([14, 8]); ctx.beginPath();
        corners.forEach(([x, y], j) => j ? ctx.lineTo(mapX(x), mapY(y)) : ctx.moveTo(mapX(x), mapY(y)));
        ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = yellow; ctx.lineWidth = 4; ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(aimX - 9, aimY); ctx.lineTo(aimX + 9, aimY);
        ctx.moveTo(aimX, aimY - 9); ctx.lineTo(aimX, aimY + 9); ctx.stroke();
        ctx.restore();
        ctx.font = '20px ' + sans; ctx.fillStyle = yellow;
        ctx.fillText('黄色虚线  取景范围     ＋  镜头朝向的中心', pad, rowH - 21);
        ctx.fillStyle = muted; ctx.textAlign = 'right';
        ctx.fillText('同一时刻  ·  取景框近似投影到屏幕平面', rowW - pad, rowH - 21);
        if (allCtx) allCtx.drawImage(plate, 0, i * rowH);
        else await write(plate, name + '-' + String(i + 1).padStart(2, '0') + '.jpg');
      }
      if (all) await write(all, name + '.jpg');
      await log('COMPARE DONE'); return;
    }
    if (q.has('screen')) {
      for (const s of q.get('screen').split(',')) { O.Screen.draw(O.storyTime(+s)); await save(`out/shots/screen-${s}.jpg`, await toJpg(O.Screen.cv, +(q.get('scale') || .5), q.get('crop') ? q.get('crop').split(',').map(Number) : null)); }
      await log('SCREEN DONE'); return;
    }
    if (q.has('render')) {
      const fps = +(q.get('fps') || 30), t0 = +(q.get('from') || 0), t1 = +(q.get('to') || O.RUNTIME), n0 = Math.round(t0 * fps), n1 = Math.round(t1 * fps);
      await log(`RENDER start ${W}x${H}@${fps} frames ${n0}..${n1}`);
      let audio = null;
      if (!q.has('noaudio')) { try { const r = await fetch('out/audio.aac'); if (r.ok) { const a = O.parseADTS(await r.arrayBuffer()); const a0 = Math.round(t0 * a.cfg.rate / 1024), a1 = Math.min(a.frames.length, Math.ceil(t1 * a.cfg.rate / 1024)); audio = { cfg: a.cfg, frames: a.frames.slice(a0, a1) }; } } catch (e) { await log('no audio: ' + e.message); } }
      const mux = new O.Mp4Stream({ width: W, height: H, fps, audio, body: 'out/body.bin', head: 'out/head.bin' });
      let err = null; const enc = new VideoEncoder({ output: (ch, m) => mux.addVideo(ch, m), error: e => { err = e; } });
      const cfg = { codec: W > 2560 ? 'avc1.640033' : 'avc1.640028', width: W, height: H, bitrate: +(q.get('br') || 56e6), framerate: fps, avc: { format: 'avc' }, bitrateMode: 'variable', latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware' };
      if (!(await VideoEncoder.isConfigSupported(cfg)).supported) cfg.hardwareAcceleration = 'no-preference';
      enc.configure(cfg);
      const channel = new MessageChannel();
      let resume = null;
      channel.port1.onmessage = () => { const next = resume; resume = null; next(); };
      const tick = () => new Promise(resolve => { resume = resolve; channel.port2.postMessage(0); });
      const us = 1e6 / fps, started = performance.now();
      for (let i = n0; i < n1; i++) {
        const src = frame(i / fps);
        const vf = new VideoFrame(src, { timestamp: Math.round((i - n0) * us), duration: Math.round(us) }); enc.encode(vf, { keyFrame: (i - n0) % (fps * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 4) await tick(); if (err) throw err;
        if (window.gc && (i - n0) % 150 === 149) window.gc();
        if ((i - n0) % 150 === 0) { await mux.chain; const el = (performance.now() - started) / 1000; const mem = performance.memory ? ` heap=${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)}MB` : ''; await log(`RENDER ${i - n0}/${n1 - n0}  t=${(i / fps).toFixed(1)}  ${el.toFixed(0)}s  ${((i - n0) / Math.max(el, .01)).toFixed(2)} fps${mem}`); }
      }
      channel.port1.close(); channel.port2.close();
      await enc.flush(); if (err) throw err;
      enc.close();
      const res = await mux.finish();
      await log(`RENDER DONE ${res.bytes} bytes, ${res.frames} video frames, ${res.audioFrames} audio frames, ${((performance.now() - started) / 1000).toFixed(0)}s`);
      return;
    }
    // ---------- 实时预览 ----------
    const au = $('au'); au.src = 'out/audio.wav';
    let t = +(q.get('t') || 0); au.currentTime = t; const msg = $('msg');
    const loop = () => { if (!au.paused) t = au.currentTime; frame(t); msg.textContent = t.toFixed(2); requestAnimationFrame(loop); };
    addEventListener('keydown', e => { if (e.code === 'Space') { au.paused ? au.play() : au.pause(); e.preventDefault(); } if (e.code === 'ArrowRight') { t += 5; au.currentTime = t; } if (e.code === 'ArrowLeft') { t = Math.max(0, t - 5); au.currentTime = t; } });
    requestAnimationFrame(loop);
  } catch (e) { await log('INIT ERR ' + (e && e.stack || e)); }
})();
