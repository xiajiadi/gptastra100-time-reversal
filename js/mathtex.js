'use strict';
// ============================================================================
//  mathtex.js —— 极简 TeX 子集排版（Cambria Math），用于片中研究记录的公式
//  支持：_ ^ {} \frac \text \mathcal 希腊字母 常用符号 函数名 空格
// ============================================================================
(() => {
  const SYM = {
    rho: 'ρ', Psi: 'Ψ', Phi: 'Φ', Theta: 'Θ', Omega: 'Ω', Pi: 'Π', pi: 'π', Delta: 'Δ', Lambda: 'Λ', Sigma: 'Σ', Gamma: 'Γ',
    tau: 'τ', kappa: 'κ', alpha: 'α', beta: 'β', epsilon: 'ε', lambda: 'λ', sigma: 'σ', psi: 'ψ', phi: 'φ', theta: 'θ', omega: 'ω', mu: 'μ', nu: 'ν', eta: 'η', gamma: 'γ', delta: 'δ', chi: 'χ', xi: 'ξ', zeta: 'ζ', iota: 'ι',
    dagger: '†', hbar: 'ℏ', infty: '∞', partial: '∂', nabla: '∇', ell: 'ℓ',
    langle: '⟨', rangle: '⟩', lVert: '‖', rVert: '‖', vert: '|',
  };
  const REL = { ge: '≥', le: '≤', approx: '≈', Rightarrow: '⟹', Leftrightarrow: '⟺', to: '→', equiv: '≡', neq: '≠', sim: '∼', propto: '∝', mapsto: '↦', gg: '≫', ll: '≪', in: '∈', leftarrow: '←', Leftarrow: '⟸' };
  const BIN = { cdot: '·', times: '×', pm: '±', otimes: '⊗', oplus: '⊕', circ: '∘', wedge: '∧' };
  const OPS = { sum: '∑', oint: '∮', int: '∫', prod: '∏' };
  const FN = ['ln', 'Tr', 'exp', 'dim', 'lim', 'log', 'det', 'max', 'min', 'arg', 'sup', 'cg', 'rec', 'rev', 'sgn'];
  const GREEK_LC = 'αβγδεζηθικλμνξοπρςστυφχψω';
  const italic = ch => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D434 + c - 65);
    if (c >= 97 && c <= 122) return ch === 'h' ? 'ℎ' : String.fromCodePoint(0x1D44E + c - 97);
    const g = GREEK_LC.indexOf(ch); if (g >= 0) return String.fromCodePoint(0x1D6FC + g);
    return ch;
  };

  // ---------- 解析 ----------
  function parse(s) {
    let i = 0;
    const group = (end) => {
      const out = [];
      while (i < s.length) {
        const ch = s[i];
        if (end && ch === end) { i++; return out; }
        if (ch === '{') { i++; out.push({ t: 'grp', list: group('}') }); continue; }
        if (ch === '_' || ch === '^') {
          i++; const arg = atom(); let base = out.pop() || { t: 'sym', s: '', cls: 'ord' };
          if (base.t !== 'ss') base = { t: 'ss', base, sub: null, sup: null };
          if (ch === '_') base.sub = arg; else base.sup = arg;
          out.push(base); continue;
        }
        if (ch === ' ') { i++; continue; }
        out.push(atom());
      }
      return out;
    };
    const atom = () => {
      const ch = s[i];
      if (ch === '{') { i++; return { t: 'grp', list: group('}') }; }
      if (ch === '\\') {
        i++; let name = '';
        if (/[a-zA-Z]/.test(s[i])) { while (i < s.length && /[a-zA-Z]/.test(s[i])) name += s[i++]; } else name = s[i++];
        if (name === 'frac') { const a = atom(), b = atom(); return { t: 'frac', num: a, den: b }; }
        if (name === 'text') { i++; let txt = ''; let depth = 1; while (i < s.length) { if (s[i] === '{') depth++; if (s[i] === '}' && --depth === 0) { i++; break; } txt += s[i++]; } return { t: 'sym', s: txt, cls: 'ord', font: 'text' }; }
        if (name === 'mathcal') { const a = atom(); const map = { H: 'ℋ', L: 'ℒ', O: '𝒪', S: '𝒮', M: 'ℳ', C: '𝒞', D: '𝒟', P: '𝒫', R: 'ℛ', E: 'ℰ', F: 'ℱ', N: '𝒩' }; const k = a.t === 'grp' ? (a.list[0] && a.list[0].raw) : a.raw; return { t: 'sym', s: map[k] || k, cls: 'ord' }; }
        if (name === 'quad') return { t: 'sp', w: 1 };
        if (name === 'qquad') return { t: 'sp', w: 2 };
        if (name === ',') return { t: 'sp', w: .17 };
        if (name === ';') return { t: 'sp', w: .28 };
        if (name === '!') return { t: 'sp', w: -.12 };
        if (SYM[name]) return { t: 'sym', s: GREEK_LC.includes(SYM[name]) ? italic(SYM[name]) : SYM[name], cls: /langle/.test(name) ? 'open' : /rangle/.test(name) ? 'close' : 'ord', raw: name };
        if (REL[name]) return { t: 'sym', s: REL[name], cls: 'rel' };
        if (BIN[name]) return { t: 'sym', s: BIN[name], cls: 'bin' };
        if (OPS[name]) return { t: 'sym', s: OPS[name], cls: 'op', big: true };
        if (FN.includes(name)) return { t: 'sym', s: name, cls: 'fn' };
        return { t: 'sym', s: name, cls: 'ord' };
      }
      i++;
      if (/[a-zA-Z]/.test(ch)) return { t: 'sym', s: italic(ch), cls: 'ord', raw: ch };
      if (/[0-9.]/.test(ch)) { let n = ch; while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++]; return { t: 'sym', s: n, cls: 'ord' }; }
      if ('=<>'.includes(ch)) return { t: 'sym', s: ch, cls: 'rel' };
      if ('+−-'.includes(ch)) return { t: 'sym', s: ch === '-' ? '−' : ch, cls: 'bin' };
      if ('([|'.includes(ch)) return { t: 'sym', s: ch, cls: 'open' };
      if (')]'.includes(ch)) return { t: 'sym', s: ch, cls: 'close' };
      if (',;'.includes(ch)) return { t: 'sym', s: ch, cls: 'punct' };
      return { t: 'sym', s: ch, cls: GREEK_LC.includes(ch) ? 'ord' : 'ord' };
    };
    return group(null);
  }

  // ---------- 排版 ----------
  const MF = '"Cambria Math"', TF = '"Cambria Math", "Astra Serif", "Microsoft YaHei UI"';
  function measure(ctx, txt, size, font) { ctx.font = `${size}px ${font === 'text' ? TF : MF}`; return ctx.measureText(txt).width; }
  function lay(ctx, node, size) {
    if (Array.isArray(node)) return layList(ctx, node, size);
    switch (node.t) {
      case 'grp': return layList(ctx, node.list, size);
      case 'sp': return { w: node.w * size, a: 0, d: 0, kids: [] };
      case 'sym': {
        const sz = node.big ? size * 1.25 : size;
        const w = measure(ctx, node.s, sz, node.font);
        return { w, a: (node.big ? .95 : .74) * size, d: (node.big ? .38 : .24) * size, glyph: node.s, size: sz, font: node.font, kids: [], dy: node.big ? .1 * size : 0 };
      }
      case 'ss': {
        const b = lay(ctx, node.base, size), ss = size * .68;
        const sup = node.sup ? lay(ctx, node.sup, ss) : null, sub = node.sub ? lay(ctx, node.sub, ss) : null;
        const kids = [{ b, x: 0, y: 0 }]; let w2 = 0, a = b.a, d = b.d;
        const x0 = b.w + size * .03;
        if (sup) { const y = -(Math.max(size * .40, b.a - size * .3)); kids.push({ b: sup, x: x0, y }); w2 = Math.max(w2, sup.w); a = Math.max(a, -y + sup.a); }
        if (sub) { const y = (sup ? size * .30 : size * .22) + (b.big ? size * .15 : 0); kids.push({ b: sub, x: x0 - (b.glyph === '∮' || b.glyph === '∫' ? size * .15 : 0), y }); w2 = Math.max(w2, sub.w); d = Math.max(d, y + sub.d); }
        return { w: x0 + w2 + size * .04, a, d, kids };
      }
      case 'frac': {
        const fs = size * .9, n = lay(ctx, node.num, fs), dn = lay(ctx, node.den, fs);
        const w = Math.max(n.w, dn.w) + size * .3, axis = -size * .26, gap = size * .16;
        const kids = [{ b: n, x: (w - n.w) / 2, y: axis - gap - n.d }, { b: dn, x: (w - dn.w) / 2, y: axis + gap + dn.a }];
        return { w: w + size * .1, a: -axis + gap + n.d + n.a, d: axis + gap + dn.a + dn.d, kids, bar: { x: size * .05, y: axis, w, h: Math.max(1, size * .055) } };
      }
    }
    return { w: 0, a: 0, d: 0, kids: [] };
  }
  const GAP = { rel: .3, bin: .22, fn: .1, op: .12, punct: .0 };
  function layList(ctx, list, size) {
    const kids = []; let x = 0, a = 0, d = 0, prev = null;
    list.forEach((n, idx) => {
      const cls = n.t === 'sym' ? n.cls : (n.t === 'ss' && n.base.t === 'sym' ? n.base.cls : 'ord');
      const gp = GAP[cls] || 0;
      if (idx > 0 && (cls === 'rel' || cls === 'bin')) x += gp * size;
      else if (idx > 0 && (cls === 'fn' || cls === 'op') && prev !== 'open') x += gp * size;
      else if (idx > 0 && prev === 'fn' && cls !== 'open') x += .16 * size;
      else if (idx > 0 && (prev === 'rel' || prev === 'bin')) x += (GAP[prev]) * size;
      else if (idx > 0 && prev === 'punct') x += .2 * size;
      else if (idx > 0 && prev === 'op') x += .1 * size;
      const b = lay(ctx, n, size);
      kids.push({ b, x, y: 0 }); x += b.w; a = Math.max(a, b.a); d = Math.max(d, b.d); prev = cls;
    });
    return { w: x, a, d, kids };
  }
  function draw(ctx, box, x, y) {
    if (box.glyph != null) { ctx.font = `${box.size}px ${box.font === 'text' ? TF : MF}`; ctx.fillText(box.glyph, x, y + (box.dy || 0)); }
    if (box.bar) ctx.fillRect(x + box.bar.x, y + box.bar.y - box.bar.h / 2, box.bar.w, box.bar.h);
    for (const k of box.kids) draw(ctx, k.b, x + k.x, y + k.y);
  }
  const cache = new Map();
  O.TeX = {
    layout(ctx, tex, size) { const key = tex + '@' + size; let b = cache.get(key); if (!b) { ctx.save(); b = lay(ctx, parse(tex), size); ctx.restore(); cache.set(key, b); } return b; },
    draw(ctx, box, x, y) { ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; draw(ctx, box, x, y); ctx.restore(); },
  };
})();
