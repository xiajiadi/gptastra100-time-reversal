'use strict';
// ============================================================================
//  mp4.js —— 流式 MP4 封装（H.264 + 可选 AAC）
//    视频块边编码边写入 out/body.bin，最后生成 out/head.bin（ftyp+moov+mdat 头），
//    由 tools/render.ps1 拼接成成片。moov 在前，适合直接播放。
// ============================================================================
(() => {
  const cat = arrs => { let n = 0; for (const a of arrs) n += a.length; const o = new Uint8Array(n); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; };
  const u8 = (...v) => new Uint8Array(v);
  const u16 = v => u8(v >> 8 & 255, v & 255);
  const u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
  const i32 = v => u32(v >>> 0);
  const str = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
  const zeros = n => new Uint8Array(n);
  const box = (type, ...p) => { const body = cat(p); return cat([u32(body.length + 8), str(type), body]); };
  const full = (type, ver, flags, ...p) => box(type, u8(ver, flags >> 16 & 255, flags >> 8 & 255, flags & 255), ...p);
  const MATRIX = cat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  O.parseADTS = function (buf) {
    const b = new Uint8Array(buf), frames = []; let o = 0, cfg = null;
    while (o + 7 <= b.length) {
      if (b[o] !== 0xFF || (b[o + 1] & 0xF0) !== 0xF0) throw new Error('ADTS sync lost @' + o);
      const hl = (b[o + 1] & 1) ? 7 : 9, len = ((b[o + 3] & 3) << 11) | (b[o + 4] << 3) | (b[o + 5] >> 5);
      if (!cfg) { const prof = (b[o + 2] >> 6) + 1, sfi = (b[o + 2] >> 2) & 15, ch = ((b[o + 2] & 1) << 2) | (b[o + 3] >> 6); cfg = { asc: u8((prof << 3) | (sfi >> 1), ((sfi & 1) << 7) | (ch << 3)), rate: [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000][sfi], ch }; }
      frames.push(b.slice(o + hl, o + len)); o += len;
    }
    return { frames, cfg };
  };

  O.Mp4Stream = class {
    constructor(o) {
      Object.assign(this, { o, avcC: null, color: null, sizes: [], keys: [], ts: [], pend: [], vChunks: [], aChunks: [], vOff: [], aOff: [], cur: 0, vi: 0, ai: 0, out: [], outBytes: 0, first: true, chain: Promise.resolve(), sent: 0 });
      this.A = o.audio ? o.audio.frames : []; this.per = Math.round(o.fps / 2);
    }
    addVideo(chunk, meta) {
      if (meta && meta.decoderConfig) { if (meta.decoderConfig.description) this.avcC = new Uint8Array(meta.decoderConfig.description.slice ? meta.decoderConfig.description.slice(0) : meta.decoderConfig.description); if (meta.decoderConfig.colorSpace) this.color = meta.decoderConfig.colorSpace; }
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
      this.pend.push(d); this.sizes.push(d.length); this.keys.push(chunk.type === 'key'); this.ts.push(chunk.timestamp);
      if (this.pend.length >= this.per) this.emit(false);
    }
    write(d) { this.out.push(d); this.outBytes += d.length; if (this.outBytes > 32e6) this.flush(); }
    flush() {
      if (!this.out.length) return this.chain; const blob = new Blob(this.out), app = this.first ? 0 : 1, n = this.outBytes; this.out = []; this.outBytes = 0; this.first = false;
      this.chain = this.chain.then(async () => { const r = await fetch(`/__save?path=${encodeURIComponent(this.o.body)}&append=${app}`, { method: 'POST', body: blob }); if (r.status !== 204) throw new Error('save ' + r.status); this.sent += n; });
      return this.chain;
    }
    emit(last) {
      const fps = this.o.fps;
      if (this.pend.length) { this.vChunks.push({ first: this.vi, n: this.pend.length }); this.vOff.push(this.cur); for (const d of this.pend) { this.write(d); this.cur += d.length; } this.vi += this.pend.length; this.pend = []; }
      const tEnd = last ? Infinity : this.vi / fps, a0 = this.ai; const rate = this.o.audio ? this.o.audio.cfg.rate : 48000;
      let off = this.cur;
      while (this.ai < this.A.length && this.ai * 1024 / rate < tEnd) { const f = this.A[this.ai++]; this.write(f); this.cur += f.length; }
      if (this.ai > a0) { this.aChunks.push({ first: a0, n: this.ai - a0 }); this.aOff.push(off); }
    }
    async finish() {
      this.emit(true); await this.flush();
      const { width: W, height: H, fps } = this.o, N = this.sizes.length, vts = fps * 1000, vd = 1000, MTS = 1000;
      const A = this.A.slice(0, this.ai), hasA = !!this.o.audio && A.length > 0, ats = hasA ? this.o.audio.cfg.rate : 48000, ad = 1024;
      const vDur = N * vd, aDur = A.length * ad, movDur = Math.round(Math.max(vDur / vts, hasA ? aDur / ats : 0) * MTS);
      const stbl = (chunks, sizes, offsets, stsd, stts, extra = []) => {
        const stsc = []; let last = -1; chunks.forEach((c, i) => { if (c.n !== last) { stsc.push(u32(i + 1), u32(c.n), u32(1)); last = c.n; } });
        return box('stbl', stsd, stts, ...extra, full('stsc', 0, 0, u32(stsc.length / 3), ...stsc), full('stsz', 0, 0, u32(0), u32(sizes.length), cat(sizes.map(u32))), full('stco', 0, 0, u32(offsets.length), cat(offsets.map(u32))));
      };
      const CS = { p: { bt709: 1, bt470bg: 5, smpte170m: 6 }, t: { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13 }, m: { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 } }, cs = this.color || {};
      const colr = box('colr', str('nclx'), u16(CS.p[cs.primaries] || 1), u16(CS.t[cs.transfer] || 1), u16(CS.m[cs.matrix] == null ? 1 : CS.m[cs.matrix]), u8(cs.fullRange ? 0x80 : 0));
      let ctts = []; { let mono = true; for (let i = 1; i < N; i++) if (this.ts[i] < this.ts[i - 1]) mono = false;
        if (!mono) { const e = []; for (let i = 0; i < N; i++) e.push(u32(1), i32(Math.round(this.ts[i] * vts / 1e6) - i * vd + 2 * vd)); ctts = [full('ctts', 1, 0, u32(N), ...e)]; } }
      const keys = []; this.keys.forEach((k, i) => { if (k) keys.push(u32(i + 1)); });
      const make = base => {
        const vtrak = box('trak',
          full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(vDur / vts * MTS)), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(W << 16), u32(H << 16)),
          box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(vts), u32(vDur), u16(0x55C4), u16(0)), full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler\0')),
            box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
              stbl(this.vChunks, this.sizes, this.vOff.map(o => o + base),
                full('stsd', 0, 0, u32(1), box('avc1', zeros(6), u16(1), zeros(16), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xFFFF), box('avcC', this.avcC), colr)),
                full('stts', 0, 0, u32(1), u32(N), u32(vd)), [...ctts, full('stss', 0, 0, u32(keys.length), ...keys)]))));
        const traks = [vtrak];
        if (hasA) {
          const asc = this.o.audio.cfg.asc, br = 192000;
          const esds = full('esds', 0, 0, u8(0x03, 23 + asc.length, 0, 2, 0, 0x04, 15 + asc.length, 0x40, 0x15, 0, 0, 0), u32(br), u32(br), u8(0x05, asc.length), asc, u8(0x06, 1, 2));
          traks.push(box('trak',
            full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(Math.round(aDur / ats * MTS)), zeros(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)),
            box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(ats), u32(aDur), u16(0x55C4), u16(0)), full('hdlr', 0, 0, u32(0), str('soun'), zeros(12), str('SoundHandler\0')),
              box('minf', full('smhd', 0, 0, u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
                stbl(this.aChunks, A.map(f => f.length), this.aOff.map(o => o + base),
                  full('stsd', 0, 0, u32(1), box('mp4a', zeros(6), u16(1), zeros(8), u16(this.o.audio.cfg.ch), u16(16), u16(0), u16(0), u32(ats << 16 >>> 0), esds)),
                  full('stts', 0, 0, u32(1), u32(A.length), u32(ad)))))));
        }
        return box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(MTS), u32(movDur), u32(0x10000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(hasA ? 3 : 2)), ...traks);
      };
      const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
      const dummy = make(0), base = ftyp.length + dummy.length + 8, moov = make(base);
      if (moov.length !== dummy.length) throw new Error('moov size mismatch');
      const head = cat([ftyp, moov, u32(this.cur + 8), str('mdat')]);
      const r = await fetch(`/__save?path=${encodeURIComponent(this.o.head)}&append=0`, { method: 'POST', body: head }); if (r.status !== 204) throw new Error('save head ' + r.status);
      return { frames: N, audioFrames: A.length, bytes: head.length + this.cur };
    }
  };
})();
