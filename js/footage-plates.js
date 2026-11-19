'use strict';

// The scene starts from the supplied screen plates. Only the fictional model,
// typed text and story outputs are composited onto those pixels.
(() => {
  const { T, G } = O;
  const { X, Y, W } = G.native;
  const { UI } = O.FONT;
  const images = {};
  let mark = null;
  const crop = (c, im, sx, sy, sw, sh, x, y, w, h) =>
    c.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  const paint = (c, color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(X(x),Y(y),w*W,h*W);
  };

  async function ready(loadImage) {
    const names = {
      home: 'work-home.png', chat: 'work-chat.png', model: 'work-model.png',
      ultra: 'work-effort.png', slider: 'recorded-slider.png', warning: 'recorded-warning.png',
      logo: 'chatgpt-mark.png',
    };
    for (const [key, path] of Object.entries(names)) {
      images[key] = await loadImage(['assets/' + path]);
      if (!images[key]) throw new Error('Missing display plate: ' + path);
    }
    const raw = document.createElement('canvas');
    raw.width = images.logo.width; raw.height = images.logo.height;
    const r = raw.getContext('2d', { willReadFrequently: true });
    r.drawImage(images.logo, 0, 0);
    const p = r.getImageData(0, 0, raw.width, raw.height);
    let left = raw.width, right = 0, top = raw.height, bottom = 0;
    for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
      const i = (y * raw.width + x) * 4;
      const luminance = Math.min(p.data[i], p.data[i + 1], p.data[i + 2]);
      const a = clamp((luminance - 64) / 191);
      p.data[i] = p.data[i + 1] = p.data[i + 2] = 255;
      p.data[i + 3] = Math.round(a * 255);
      if (a > .15) { left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y); }
    }
    r.putImageData(p,0,0);
    mark = { raw, left, top, width:right-left+1, height:bottom-top+1 };
    if (mark.width < 12 || mark.height < 12) throw new Error('Invalid ChatGPT logo crop');
  }

  O.brandMark = (c,x,y,r) => {
    if (!mark) return;
    const size = r * 2;
    const scale = size / Math.max(mark.width,mark.height);
    const w = mark.width*scale, h = mark.height*scale;
    crop(c,mark.raw,mark.left,mark.top,mark.width,mark.height,x-w/2,y-h/2,w,h);
  };

  function frame(c,t,sent) {
    const w=G.win;
    c.save(); c.shadowColor='#000a'; c.shadowBlur=30; c.shadowOffsetY=12;
    c.fillStyle='#191d23'; O.rr(c,w.x,w.y,w.w,w.h,12); c.fill(); c.restore();
    c.save(); O.rr(c,w.x,w.y,w.w,w.h,12); c.clip();
    c.drawImage(sent?images.chat:images.home,w.x,w.y,w.w,w.h);
    // Use the supplied shell and the work panel. The dialogue is animated separately.
    if (sent) {
      paint(c,'#181818',401,225,1560,1318);
      if (t >= T.close) {
        paint(c,'#181818',201,116,909,55);
        c.font = '600 19px '+UI; c.fillStyle='#f3f3f3';
        c.fillText(O.garble(t)?O.moji('寻找逆转时间的公式'):'寻找逆转时间的公式',X(207),Y(151));
      }
      if (t >= T.tools) {
        paint(c,'#2b2b2b',2280,377,544,56);
        c.font='17px '+UI; c.fillStyle='#bcbcbc';
        c.fillText(t>=T.close?'FC-03  ·  缓存回执':'正在检索论文和资料',X(2296),Y(415));
      }
    }
    // Anonymous account marker, confined to the original avatar bounds.
    c.fillStyle='#b49354'; c.beginPath(); c.arc(X(52),Y(1749),24*W,0,7); c.fill();
    c.font='500 13px '+UI; c.fillStyle='#fff'; c.textAlign='center';
    c.fillText('A',X(52),Y(1755)); c.textAlign='left';
  }

  function input(c,t,sent,drawIME) {
    const selected=t>=T.pick;
    if (selected) {
      const x=sent?1460:1633, y=sent?1692:880;
      paint(c,sent?'#333333':'#363636',x,y,sent?307:345,52);
      const label='GPTAstra100', effort=t>=T.ddClose?'Ultra  2×':'高';
      c.font='17.8px '+UI; c.fillStyle='#f3f3f3';
      const max=X(sent?1721:1948), eW=c.measureText(effort).width;
      const tx=max-eW-c.measureText(label).width-24;
      c.fillText(label,tx,Y(y+38));
      c.fillStyle=t>=T.ddClose?'#aa75ff':'#bdbdbd';
      c.fillText(effort,max-eW-16,Y(y+38));
      O.icons.chevron(c,max+6,Y(y+28),4,'#a4a4a4');
    }
    if (sent || t < T.focus) return;
    const st=O.inputAt(t), tx=X(872), ty=Y(813);
    paint(c,'#363636',866,778,1216,81);
    c.font='20px '+UI; c.fillStyle='#f4f4f4';
    c.fillText(st.text,tx,ty);
    let xx=tx+c.measureText(st.text).width;
    if (st.comp) {
      c.fillText(st.comp,xx,ty);
      const len=c.measureText(st.comp).width;
      c.strokeStyle='#b7b7b7'; c.beginPath(); c.moveTo(xx,ty+4); c.lineTo(xx+len,ty+4); c.stroke();
      drawIME(c,xx-5,ty+18,st.cand); xx+=len;
    }
    if (st.text||st.comp||Math.floor(t*2)%2===0) c.fillRect(xx+1,ty-18,1.4,23);
    if (st.text||st.comp) {
      const cx=X(2084), cy=Y(908);
      c.fillStyle='#2c63bb'; c.beginPath(); c.arc(cx,cy,27.5*W,0,7); c.fill();
      c.strokeStyle='#fff'; c.lineWidth=1.7; c.lineCap='round';
      c.beginPath(); c.moveTo(cx,cy+8); c.lineTo(cx,cy-8); c.moveTo(cx-7,cy-1);
      c.lineTo(cx,cy-8); c.lineTo(cx+7,cy-1); c.stroke(); c.lineCap='butt';
    }
  }

  function popup(c,t) {
    if(t<T.ddOpen || t>=T.ddClose) return;
    const { x,y,w,h }=G.dd;
    c.save();
    c.globalAlpha = sstep(T.ddOpen,T.ddOpen+.13,t);
    if(t<T.pick+.20) {
      O.rr(c,x,y,w,h,23*W); c.clip();
      crop(c,images.model,1471,944,515,646,x,y,w,h);
      if(t>=18.2) {
        const y0=G.rowY(3), hov=O.curNow && O.curNow[1]>=y0 && O.curNow[1]<y0+G.dd.row;
        c.fillStyle=hov?'#3d3d3d':'#292929';
        O.rr(c,x+7,y0+1,w-26,G.dd.row-2,7); c.fill();
        c.font='18.3px '+UI; c.fillStyle='#f2f2f2';
        c.fillText('GPTAstra100',X(1498),Y(1364));
      }
    } else {
      const ultra=t>=30.32;
      const h2=196*W;
      O.rr(c,x,y,w,h2,23*W); c.clip();
      if(ultra) {
        crop(c,images.ultra,1471,944,515,196,x,y,w,h2);
        paint(c,'#2a2a2a',1636,961,202,45);
        c.textAlign='center'; c.font='600 20px '+UI; c.fillStyle='#a875ff';
        c.fillText('Ultra  2×',X(1729),Y(997)); c.textAlign='left';
      } else {
        const progress=inv(T.pick+.20,30.32,t);
        const i=Math.round(progress*69), sx=(i%8)*514, sy=Math.floor(i/8)*196;
        crop(c,images.slider,sx,sy,514,196,x,y,w,h2);
      }
      paint(c,'#2a2a2a',1622,1011,236,40);
      c.textAlign='center'; c.fillStyle='#b3b3b3'; c.font='17px '+UI;
      c.fillText('GPTAstra100  ›',X(1730),Y(1033)); c.textAlign='left';
    }
    c.restore();
  }

  function warning(c,t) {
    if(t<T.dlg||t>T.cont+.11) return;
    const d=G.dlg, w=G.win;
    c.save();
    c.globalAlpha=sstep(T.dlg,T.dlg+.13,t)*(1-sstep(T.cont,T.cont+.11,t));
    c.fillStyle='rgba(0,0,0,.17)'; O.rr(c,w.x,w.y,w.w,w.h,12); c.fill();
    c.save();
    O.rr(c,d.x,d.y,d.w,d.h,14); c.clip();
    c.drawImage(images.warning,d.x,d.y,d.w,d.h);
    c.restore(); c.restore();
  }

  O.Plate = { ready,frame,input,popup,warning,hasRecordedPointer:t=>t>=T.pick+.20&&t<30.32 };
})();
