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
    if (q.has('compare')) {   // ?compare=t1,t2,... → 制作拆解对比图：左 = 代码画出的屏幕，右 = 虚拟手机拍出的成片
      const ts = q.get('compare').split(',').map(Number), notes = (q.get('notes') || '').split('|');
      const tw = 940, th = 529, gap = 20, pad = 30, head = 170, rowH = 64 + th + 70, foot = 90;
      const out = document.createElement('canvas'); out.width = pad * 2 + tw * 2 + gap; out.height = head + ts.length * rowH + foot; const o = out.getContext('2d');
      const SANS = '"Microsoft YaHei UI", "Noto Sans SC", sans-serif';
      o.fillStyle = '#0d0e10'; o.fillRect(0, 0, out.width, out.height);
      o.fillStyle = '#f2f0ea'; o.font = `700 46px ${SANS}`; o.fillText('GPTAstra100 制作拆解', pad, 72);
      o.fillStyle = '#9a9890'; o.font = `26px ${SANS}`; o.fillText('同一时刻：左边是代码画出的屏幕画面，右边是代码模拟的手机对着屏幕"拍"出来的成片画面', pad, 122);
      const SWm = .5975, SHm = .3361, SCY = .30, LW = 2560, LH = 1440;
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i], y0 = head + i * rowH;
        // 镜头取景范围投影到屏幕平面（单位：屏幕宽高的比例，0..1 为屏幕内）
        const p = O.pose(t), asp = W / H, pts = [];
        for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
          const d = [p.F[0] + p.R[0] * sx * p.tanH + p.U[0] * sy / asp * p.tanH, p.F[1] + p.R[1] * sx * p.tanH + p.U[1] * sy / asp * p.tanH, p.F[2] + p.R[2] * sx * p.tanH + p.U[2] * sy / asp * p.tanH];
          const k = -p.C[2] / d[2], X = p.C[0] + d[0] * k, Y = p.C[1] + d[1] * k;
          pts.push([X / SWm + .5, .5 - (Y - SCY) / SHm]);
        }
        // 取景框超出屏幕时缩小屏幕截图，让整个框都能看见
        const xs = pts.map(v => v[0]).concat([0, 1]), ys = pts.map(v => v[1]).concat([0, 1]);
        const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
        const inside = bx0 >= -.001 && bx1 <= 1.001 && by0 >= -.001 && by1 <= 1.001;
        const sc = inside ? 1 : Math.min(1, .9 / Math.max(bx1 - bx0, by1 - by0)), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const mx = u => (sc < 1 ? tw / 2 + (u - cx) * tw * sc : u * tw), my = v => (sc < 1 ? th / 2 + (v - cy) * th * sc : v * th);
        O.Screen.draw(O.storyTime(t)); const raw = document.createElement('canvas'); raw.width = tw; raw.height = th; const rc = raw.getContext('2d');
        rc.fillStyle = '#060607'; rc.fillRect(0, 0, tw, th); rc.drawImage(O.Screen.cv, mx(0), my(0), mx(1) - mx(0), my(1) - my(0));
        if (sc < 1) { rc.strokeStyle = '#3a3b3f'; rc.lineWidth = 2; rc.strokeRect(mx(0), my(0), mx(1) - mx(0), my(1) - my(0)); rc.fillStyle = '#6d6c66'; rc.font = `18px ${SANS}`; rc.fillText('显示器屏幕', mx(0) + 8, my(1) + 24); }
        rc.save(); rc.strokeStyle = '#ff9a3c'; rc.lineWidth = 4; rc.setLineDash([14, 8]); rc.beginPath(); pts.forEach((q2, j) => j ? rc.lineTo(mx(q2[0]), my(q2[1])) : rc.moveTo(mx(q2[0]), my(q2[1]))); rc.closePath(); rc.stroke(); rc.restore();
        const src = frame(t);
        o.fillStyle = '#e8e6df'; o.font = `600 28px ${SANS}`; o.fillText(`${String(i + 1).padStart(2, '0')}　${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, pad, y0 + 44);
        o.fillStyle = '#8a8880'; o.font = `22px ${SANS}`;
        o.fillText('代码画出的屏幕（虚线框 = 镜头拍到的范围）', pad + 140, y0 + 44);
        o.fillText('成片：代码模拟的手机对着屏幕拍摄', pad + tw + gap, y0 + 44);
        o.drawImage(raw, pad, y0 + 60); o.drawImage(src, pad + tw + gap, y0 + 60, tw, th);
        o.strokeStyle = '#2a2b2e'; o.lineWidth = 2; o.strokeRect(pad, y0 + 60, tw, th); o.strokeRect(pad + tw + gap, y0 + 60, tw, th);
        // 局部放大：直接取 4K 原图的一小块，不缩放细节
        const ins = (q.get('inset') || '').split(';').map(s => s.split(',').map(Number)).find(a => a[0] === i);
        if (ins) {
          const [, sx0, sy0, sw, sh] = ins, iw = 420, ih = Math.round(iw * sh / sw), ix = pad + tw + gap + tw - iw - 16, iy = y0 + 60 + th - ih - 16;
          o.imageSmoothingEnabled = false; o.drawImage(src, sx0, sy0, sw, sh, ix, iy, iw, ih); o.imageSmoothingEnabled = true;
          o.strokeStyle = '#ff9a3c'; o.lineWidth = 3; o.strokeRect(ix, iy, iw, ih);
          o.fillStyle = 'rgba(0,0,0,.7)'; o.fillRect(ix, iy, iw, 34); o.fillStyle = '#ffcf9f'; o.font = `20px ${SANS}`; o.fillText('4K 原图局部放大：屏幕的像素网格', ix + 10, iy + 24);
        }
        o.fillStyle = '#c9c7bf'; o.font = `24px ${SANS}`; o.fillText(notes[i] || '', pad, y0 + 60 + th + 44);
      }
      o.fillStyle = '#77756e'; o.font = `22px ${SANS}`; o.fillText('界面底图来自截图与录屏。论文图版、对话、虚拟摄像机与音轨按时间表生成。', pad, out.height - 38);
      await save('out/shots/' + (q.get('name') || '制作拆解对比图.jpg'), await new Promise(r => out.toBlob(r, 'image/jpeg', .92)));
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
