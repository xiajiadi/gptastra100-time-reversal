'use strict';

(() => {
  const SR = 48000;
  const FRAME_BYTES = 4;
  const HEADER_BYTES = 44;
  const frames = seconds => Math.round(seconds * SR);
  const START = frames(103);
  const END = frames(142);
  const ADD = frames(10.65);
  const CUT = frames(199.35);
  const SOURCE_LENGTH = END - START;
  const STRETCHED_LENGTH = SOURCE_LENGTH + ADD;
  const RATIO = STRETCHED_LENGTH / SOURCE_LENGTH;
  const HOP = frames(.03);
  const SEARCH = frames(.018);
  const MIN_ADVANCE = HOP / 4;

  function overlapScore(pcm, previous, candidate) {
    let cross = 0;
    let previousPower = 0;
    let candidatePower = 0;
    for (let i = 0; i < HOP * 2; i += 16) {
      const a = pcm[previous + i];
      const b = pcm[candidate + i];
      const c = pcm[previous + i + 1];
      const d = pcm[candidate + i + 1];
      cross += a * b + c * d;
      previousPower += a * a + c * c;
      candidatePower += b * b + d * d;
    }
    return cross / Math.sqrt(previousPower * candidatePower + 1);
  }

  function findGrain(pcm, previous, target, finalStart) {
    const lo = Math.max(previous + MIN_ADVANCE, target - SEARCH);
    const hi = Math.min(finalStart, target + SEARCH);
    let best = Math.max(lo, Math.min(target, hi));
    let bestScore = -Infinity;
    const reference = (previous + HOP) * 2;
    const consider = candidate => {
      // Stay close to the edit map when several periods line up equally well.
      const offset = (candidate - target) / SEARCH;
      const score = overlapScore(pcm, reference, candidate * 2) - .035 * offset * offset;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    };
    consider(best);
    for (let i = lo; i <= hi; i += 8) consider(i);
    const coarse = best;
    for (let i = Math.max(lo, coarse - 7); i <= Math.min(hi, coarse + 7); i++) consider(i);
    return best;
  }

  function stretch(pcm, result) {
    const fade = Float64Array.from({ length: HOP }, (_, i) =>
      .5 - .5 * Math.cos(Math.PI * i / (HOP - 1)));
    result.set(pcm.subarray(0, HOP * 2));
    let previous = 0;
    const lastGrain = STRETCHED_LENGTH - 2 * HOP;
    const lastSourceGrain = SOURCE_LENGTH - 2 * HOP;
    for (let at = HOP; at <= lastGrain; at += HOP) {
      // Pin both ends to original sample positions so cuts and transients outside this window do not move.
      const remaining = (lastGrain - at) / HOP;
      const next = remaining === 0 ? lastSourceGrain : findGrain(pcm, previous,
        Math.round(at / RATIO), lastSourceGrain - remaining * MIN_ADVANCE);
      const a = (previous + HOP) * 2;
      const b = next * 2;
      for (let i = 0; i < HOP; i++) {
        const j = i * 2;
        const w = fade[i];
        result[at * 2 + j] = Math.round(pcm[a + j] * (1 - w) + pcm[b + j] * w);
        result[at * 2 + j + 1] = Math.round(pcm[a + j + 1] * (1 - w) + pcm[b + j + 1] * w);
      }
      previous = next;
    }
    result.set(pcm.subarray((SOURCE_LENGTH - HOP) * 2), (STRETCHED_LENGTH - HOP) * 2);
  }

  // Each cue is [logical time, pulses]. A pulse specifies offset from the event,
  // length, start/end frequency, attack fraction, level and stereo pan.
  const CUES = [
    [111.8, [[0, .38, 740, 530, .09, 1, -.35], [.12, .32, 930, 790, .12, .56, .42]]],
    [120.8, [[0, .18, 960, 700, .08, .85, -.55], [.14, .19, 610, 510, .1, .7, .52], [.32, .24, 355, 290, .12, .64, 0]]],
    [126.4, [[-.42, .43, 210, 790, .92, .78, -.28], [0, .38, 705, 340, .06, .87, .28]]],
    [138.95, [[-.62, .62, 540, 180, .9, .8, .12], [0, .48, 126, 102, .08, 1, 0], [.035, .29, 732, 650, .08, .52, -.48]]],
  ];

  function mixCues(pcm) {
    for (const [seconds, pulses] of CUES) {
      const at = START + Math.round((frames(seconds) - START) * RATIO);
      let power = 0;
      let count = 0;
      for (let i = (at - frames(.25)) * 2; i < (at + frames(.25)) * 2; i += 16) {
        power += pcm[i] ** 2 + pcm[i + 1] ** 2;
        count += 2;
      }
      const rms = Math.sqrt(power / count);
      // Cues sit below the local bed and cannot open a silent passage.
      const level = Math.min(2600, Math.max(0, rms - 96) * .49);
      if (level === 0) continue;
      for (const [offset, duration, f0, f1, attack, gain, pan] of pulses) {
        const first = at + frames(offset);
        const n = frames(duration);
        const l = Math.cos((pan + 1) * Math.PI / 4);
        const r = Math.sin((pan + 1) * Math.PI / 4);
        for (let j = 0; j < n; j++) {
          const u = j / (n - 1);
          const shape = u < attack ? u / attack : (1 - u) / (1 - attack);
          const envelope = .5 - .5 * Math.cos(Math.PI * shape);
          const phase = 2 * Math.PI * duration * u * (f0 + .5 * (f1 - f0) * u);
          const ring = Math.sin(phase) + .19 * Math.sin(2.07 * phase) + .08 * Math.sin(3.41 * phase);
          const sample = level * gain * envelope * ring;
          const i = (first + j) * 2;
          pcm[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] + sample * l)));
          pcm[i + 1] = Math.max(-32768, Math.min(32767, Math.round(pcm[i + 1] + sample * r)));
        }
      }
    }
  }

  O.retimeAudio = wav => {
    const header = new DataView(wav);
    if (wav.byteLength < HEADER_BYTES + CUT * FRAME_BYTES ||
        header.getUint32(0) !== 0x52494646 || header.getUint32(8) !== 0x57415645 ||
        header.getUint32(12) !== 0x666d7420 || header.getUint32(16, true) !== 16 ||
        header.getUint16(20, true) !== 1 || header.getUint16(22, true) !== 2 ||
        header.getUint32(24, true) !== SR || header.getUint16(32, true) !== FRAME_BYTES ||
        header.getUint16(34, true) !== 16 || header.getUint32(36) !== 0x64617461 ||
        header.getUint32(40, true) < CUT * FRAME_BYTES) {
      throw new Error('Expected stereo 48 kHz PCM16 from Audio.render through the recording cut');
    }

    const output = new ArrayBuffer(HEADER_BYTES + (CUT + ADD) * FRAME_BYTES);
    new Uint8Array(output, 0, HEADER_BYTES).set(new Uint8Array(wav, 0, HEADER_BYTES));
    const resultHeader = new DataView(output);
    resultHeader.setUint32(4, output.byteLength - 8, true);
    resultHeader.setUint32(40, output.byteLength - HEADER_BYTES, true);

    // The existing renderer writes little-endian PCM on the same host.
    const source = new Int16Array(wav, HEADER_BYTES, CUT * 2);
    const result = new Int16Array(output, HEADER_BYTES);
    result.set(source.subarray(0, START * 2));
    stretch(source.subarray(START * 2, END * 2), result.subarray(START * 2, (END + ADD) * 2));
    result.set(source.subarray(END * 2), (END + ADD) * 2);
    mixCues(result);
    return output;
  };
})();
