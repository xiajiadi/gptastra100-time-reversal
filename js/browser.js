'use strict';
// ============================================================================
//  browser.js —— 浏览器窗口与网页（全部原创文本，预渲染到离屏画布）
// ============================================================================
(() => {
  const { UI, SERIF, MONO } = O.FONT;
  const PW = 1240, PH = 2000, S = O.LS;
  const FIND = 'time reversal';
  const KEYS = [FIND, 'Loschmidt echo', 'Loschmidt-Echo', 'forward-only', 'future cache', '时间反演', '单向时钟', '未来缓存', 'Zeitumkehr', '時間反転', 'обращение времени', '시간 반전'];
  const TX = {
    en: [
      'A Loschmidt echo measures how closely a prepared state returns after forward evolution followed by an attempted inverse. In the ideal model the two operations cancel. In the laboratory a slightly different Hamiltonian governs the second leg.',
      'For a quantum state, the echo is the squared overlap between the recovered state and the original preparation. A peak near one tells the experimenter that the two states are nearly indistinguishable by this measure.',
      'The pulse controller records each stage against a forward-only device clock. The echo peak belongs to a later sample in the same acquisition trace. Its timestamp remains later than the preparation time.',
      'The comparison run detunes the inverse pulse by a small amount. As the delay increases, the two trajectories diverge and the measured return falls below the control. Readout errors are estimated by repeating the preparation.',
      'A backward jump in wall time can be introduced by clock synchronisation or by a manual adjustment. Cross-check the acquisition counter within the same boot before interpreting a receipt with an earlier date.',
      'The acquisition system writes the raw trace before the viewer builds its preview. Investigators keep both records so that a cache hit can be distinguished from a fresh measurement.',
    ],
    hero: [
      'Time reversal in a dynamical model exchanges a trajectory with one that runs in the opposite direction. In classical mechanics the operation reverses momenta while leaving positions unchanged.',
      'A Loschmidt echo tests time reversal on a prepared state. The apparatus evolves the sample, applies a controlled inverse, then measures how much of the starting state has been recovered.',
      'The apparatus timestamps the recovered signal after the inverse pulse. Throughout a time reversal experiment, the device clock and its acquisition counter continue forward.',
      'When the inverse is imperfect, the Loschmidt echo loses contrast. Small errors can accumulate during both halves of the sequence, leaving only a partial return at the readout.',
      'An inverse propagator gives a formula for time reversal of the model. Extending the operation to a physical device would require control of every relevant interaction with its surroundings.',
      'An archived test fixture pairs a time reversal trace with a cached response whose source sequence is ahead of its receipt. The fixture leaves the writer field blank and provides no independent clock for the source.',
      'The device ledger records the cached response at 03:17:42. The corresponding write is absent from the captured session. The archive retains the payload and flags its provenance as unresolved.',
      'The distinction matters because whole-system time reversal would have to account for the observer and the records as well as the sample. An echo demonstrates recovery of a selected state under a controlled protocol.',
    ],
    zh: [
      '单向时钟为同一次开机期间发生的事件提供排序依据。系统时间可以因校时而回拨，单调计数器仍按自己的时间基准向前推进。',
      '判断两条日志的先后顺序时，先确认它们使用同一计数来源，并核对设备与会话标识。跨设备的时间戳要结合同步误差来解读。',
      '时间反演实验可以让样品接近先前的状态。脉冲发出、回声到达和文件落盘，仍按这个顺序出现在设备日志里。',
      '档案中有一条被标为“未来缓存”的测试记录。接收时已有完整内容，写入方字段却为空。当天的原始采集文件找不到对应条目。',
      '复核这种记录需要保存原始响应、缓存键和计数器读数。重开页面可能触发缓存刷新，使首次命中时的状态丢失。',
    ],
    de: [
      'Bei einer idealen Zeitumkehr kehrt ein System entlang derselben Bahn zurück. In einem Experiment lässt sich die Rückentwicklung nur für ausgewählte Freiheitsgrade kontrollieren.',
      'Das Loschmidt-Echo misst, wie gut der präparierte Zustand wiederhergestellt wird. Kleine Abweichungen im Umkehrpuls verändern den Überlapp mit dem Ausgangszustand.',
      'Der Zähler des Messgeräts läuft während der Zeitumkehr weiter. Die Laufzeit des Experiments bleibt im Protokoll ablesbar, auch wenn der Endzustand dem Anfangszustand ähnelt.',
    ],
    ja: [
      '時間反転の操作を試すには、まず試料を同じ初期状態に準備します。逆向きのパルスを加えた後、もとの状態との重なりを測ります。',
      'ロシュミット・エコーが現れても、測定器の時計は進み続けます。開始、反転パルス、読み出しはログにこの順序で残ります。',
      '装置の時刻が戻って見える場合は、まず壁時計と単調カウンタを照合します。同じ起動セッション内の記録を使ってください。',
    ],
    ru: [
      'Обращение времени в модели меняет направление движения по траектории. Для классической системы при этом меняют знаки импульсов, сохраняя координаты.',
      'Эхо Лошмидта оценивают по совпадению начального и восстановленного состояний. Ошибки управляющего импульса уменьшают наблюдаемый сигнал.',
      'Счётчик прибора продолжал расти во время опыта. В журнале обращение времени образца отмечено между подготовкой и считыванием сигнала.',
    ],
    ko: [
      '시간 반전 실험에서 확인하는 것은 준비한 상태가 얼마나 잘 복원되는지입니다. 상태를 진화시킨 뒤 역연산을 적용하고 처음 상태와의 겹침을 측정합니다.',
      '장치의 단조 시계는 시간 반전 실험 중에도 계속 앞으로 갑니다. 같은 부팅 세션의 기록에서 준비, 역연산, 읽기의 순서를 확인할 수 있습니다.',
    ],
  };
  const pages = []; O.pages = pages;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = PW * S; cv.height = PH * S; const c = cv.getContext('2d'); c.scale(S, S); return { cv, c, hits: [] }; };
  // 带关键词记录的段落
  function para(P, text, x, y, w, font, lh, col) {
    const c = P.c; const lines = O.wrap(c, text, font, w); c.font = font; c.fillStyle = col;
    lines.forEach((l, i) => {
      const yy = y + i * lh; c.fillText(l, x, yy);
      const lower = l.toLowerCase();
      for (const key of P.keys || KEYS) {
        const k = key.toLowerCase();
        for (let p = lower.indexOf(k); p >= 0; p = lower.indexOf(k, p + k.length)) {
          const x0 = c.measureText(l.slice(0, p)).width, ww = c.measureText(l.slice(p, p + k.length)).width;
          P.hits.push({ x: x + x0 - 1, y: yy - lh * .72, w: ww + 2, h: lh * .92 });
        }
      }
    });
    return y + lines.length * lh;
  }
  const fill = (P, col) => { P.c.fillStyle = col; P.c.fillRect(0, 0, PW, PH); };

  // Paper figures are computed once on the cached page canvases.
  const tex = String.raw;
  const ink = '#263842', faint = '#5e6f77', teal = '#207b83', rust = '#a04a49', violet = '#66518b';

  function label(c, text, x, y, size = 13, color = faint, weight = 400) {
    c.font = weight + ' ' + size + 'px ' + UI;
    c.fillStyle = color; c.fillText(text, x, y);
  }

  function path(c, points, color, width = 1, fillColor) {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    if (fillColor) { c.closePath(); c.fillStyle = fillColor; c.fill(); }
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }

  function dot(c, x, y, r, color) {
    c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.fillStyle = color; c.fill();
  }

  function arrow(c, a, b, color, size = 7) {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const wing = v => [b[0] - size * Math.cos(v), b[1] - size * Math.sin(v)];
    path(c, [a, b], color, 1.8); path(c, [wing(angle - .46), b, wing(angle + .46)], color, 1.8);
  }

  function equation(c, source, x, y, width, size, color = ink) {
    let box = O.TeX.layout(c, source, size);
    if (box.w > width) box = O.TeX.layout(c, source, size * width / box.w);
    c.fillStyle = color; O.TeX.draw(c, box, x, y);
  }

  function grid(c, x, y, w, h, nx, ny) {
    for (let i = 0; i <= nx; i++) path(c, [[x + w * i / nx, y], [x + w * i / nx, y + h]], '#d3dce0');
    for (let i = 0; i <= ny; i++) path(c, [[x, y + h * i / ny], [x + w, y + h * i / ny]], '#d3dce0');
    path(c, [[x, y], [x, y + h], [x + w, y + h]], faint);
  }

  const seq = (n, sample) => Array.from({ length: n + 1 }, (_, i) => sample(i / n));
  const TAU = Math.PI * 2;
  function curvature(c) {
    // Flamm embedding of an equatorial Schwarzschild spatial slice (r in units of r_s).
    const project = (r, a) => [145 + r * 25 * Math.cos(a),
      124 + r * 9.5 * Math.sin(a) - 20 * Math.sqrt(r - 1)];
    for (let i = 0; i < 23; i++) {
      const a = TAU * i / 23;
      path(c, seq(28, u => project(1.025 + 3.37 * u, a)), '#76a4ac', .85);
    }
    for (let i = 13; i >= 0; i--) {
      const r = 1.025 + i * .26;
      path(c, seq(64, u => project(r, TAU * u)), i === 0 ? rust : '#4f8794', i === 0 ? 2.4 : 1);
    }
    path(c, seq(42, u => project(1.18 + 2.42 * u, 2.2 - 2.05 * u)), violet, 2.3);
    path(c, [[167, 121], [211, 141], [263, 141]], rust, 1);
    label(c, 'r = rₛ', 267, 145, 12, rust);
    label(c, 'z(r) / rₛ', 286, 53, 12, ink);
    path(c, [[300, 87], [300, 59], [325, 76]], faint);
    label(c, 'r / rₛ', 320, 92, 12);
    label(c, 'Equatorial slice · t held fixed', 15, 154, 11);
  }

  function minkowski(c) {
    const q = [165, 83];
    grid(c, 60, 12, 210, 139, 6, 4);
    path(c, [[101, 19], q, [229, 19]], teal, 1.7, '#c7e5e6');
    path(c, [[101, 147], q, [229, 147]], teal, 1.7, '#dce9eb');
    arrow(c, [165, 152], [165, 11], ink);
    arrow(c, [65, 83], [268, 83], ink);
    arrow(c, [142, 146], [188, 20], violet);
    path(c, [[93, 109], [242, 55]], violet, 1.8);
    dot(c, 165, 83, 3, ink);
    label(c, 'ct', 169, 19, 12, ink); label(c, 'x', 274, 88, 12, ink);
    label(c, 'ct′', 196, 25, 12, violet); label(c, 'x′', 245, 53, 12, violet);
    label(c, 'null', 72, 31, 11, teal); label(c, 'event O', 177, 99, 11, ink);
  }

  function bloch(c) {
    const cap = Math.PI / 2, tilt = .34;
    const project = (x, y, z) => [136 + 62 * x, 82 + 62 * (y * Math.sin(tilt) - z * Math.cos(tilt))];
    const sphere = (lat, lon) => project(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
    const center = project(0, 0, 0);
    c.beginPath(); c.arc(...center, 62, 0, TAU);
    c.fillStyle = '#e2eef0'; c.fill(); c.strokeStyle = teal; c.lineWidth = 1.2; c.stroke();
    for (const lat of [-.8, -.43, 0, .43, .8]) path(c, seq(60, u => sphere(lat, u * TAU)), '#9ab8bf');
    for (let i = 0; i < 8; i++) path(c, seq(34, u => sphere(cap * (2 * u - 1), i * TAU / 8)), '#7198a4');
    arrow(c, [136, 148], [136, 8], faint);
    arrow(c, center, sphere(.38, .87), violet);
    path(c, seq(38, u => sphere(.38 - .56 * u, .87 + 3.3 * u)), rust, 2.4);
    dot(c, ...sphere(-.18, 4.17), 3.5, rust);
    label(c, '|0⟩', 143, 17, 13, ink); label(c, '|1⟩', 143, 151, 13, ink);
    path(c, [[229, 57], [249, 57]], violet, 2); label(c, 'prepared state', 255, 61, 12);
    path(c, [[229, 81], [249, 81]], rust, 2); label(c, 'detuned path', 255, 85, 12);
    label(c, 'Rotating frame', 229, 114, 12, ink);
  }

  function echoes(c) {
    const x = 47, y = 23, w = 270, h = 104;
    grid(c, x, y, w, h, 6, 4);
    [0, .14, .32, .58].forEach((eps, idx) => {
      const color = [teal, '#4676a5', violet, rust][idx];
      const signal = u => {
        let fidelity = 1;
        for (let j = 1; j <= 9; j++) {
          const a = (u - .67) * (3.6 + j * .51) + eps * (.6 + j * .19);
          fidelity *= 1 - (.21 + .023 * j) * Math.sin(a) ** 2;
        }
        return [x + w * u, y + h * (1 - fidelity)];
      };
      path(c, seq(130, signal), color, 2.1);
      for (let i = idx % 2; i <= 9; i += 2) dot(c, ...signal(i / 9), 1.8, color);
      path(c, [[54 + 74 * idx, 12], [66 + 74 * idx, 12]], color, 2);
      label(c, 'ε=' + eps.toFixed(2), 70 + 74 * idx, 16, 10, ink);
    });
    label(c, 'ℒ', 16, 32, 14, ink); label(c, '1', 34, 26, 11); label(c, '0', 34, 130, 11);
    label(c, '0', x, 143, 11); label(c, 't / τ', 310, 143, 12, ink);
  }

  function phase(c) {
    const x = 47, y = 16, w = 266, h = 114;
    grid(c, x, y, w, h, 6, 4);
    const angle = a => ((a % TAU) + TAU) % TAU;
    const colors = ['#428592', '#487992', '#745883', '#a05158', '#4f8a84'];
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    for (let row = 0; row < 32; row++) {
      let q = TAU * (row + .5) / 32, p = TAU * O.hash(row, 21);
      c.fillStyle = colors[row % colors.length]; c.globalAlpha = .6;
      for (let j = 0; j < 550; j++) {
        p = angle(p + 1.18 * Math.sin(q)); q = angle(q + p);
        if (j > 35) c.fillRect(x + q / TAU * w, y + (1 - p / TAU) * h, 1.15, 1.15);
      }
    }
    c.restore();
    label(c, 'p', 32, 23, 13, ink); label(c, 'q', 320, 137, 13, ink);
    label(c, '0', 36, 131, 11); label(c, '2π', 299, 146, 11);
    label(c, 'K = 1.18 · both axes mod 2π', 61, 146, 11, ink);
  }

  function cauchy(c) {
    const top = [176, 13], bottom = [176, 150], left = [89, 82], right = [263, 82];
    path(c, [left, top, right, bottom], '#526b75', 1.6, '#e4eff0');
    path(c, [[116, 68], [170, 29], [231, 63]], '#a07575', 1.1, '#eddce0');
    path(c, [[119, 67], [168, 109], [232, 63]], '#7594a3', 1.1, '#d2e3e9');
    path(c, [left, [132, 75], [177, 85], [221, 79], right], teal, 2.3);
    arrow(c, [158, 125], [170, 37], violet);
    dot(c, 170, 29, 3.4, rust);
    dot(c, 167, 110, 3.4, violet);
    label(c, 'p', 178, 36, 12, rust); label(c, 'Σ', 269, 86, 14, teal);
    label(c, 'D⁺(Σ)', 201, 51, 13, ink); label(c, 'D⁻(Σ)', 196, 118, 13, ink);
    label(c, 'null boundaries', 16, 43, 11); label(c, 'i⁺', 184, 18, 12, ink);
    label(c, 'i⁻', 184, 152, 12, ink); label(c, 'γ', 147, 120, 13, violet);
  }

  const FIGURES = {
    gr: ['Schwarzschild spatial embedding', curvature, tex`z(r)=2[r_s(r-r_s)]^{1/2}`],
    sr: ['Light cone and boosted axes', minkowski, tex`\Delta s^2=-c^2\Delta t^2+\Delta x^2,\quad \Delta s^2_{\text{null}}=0`],
    spin: ['Driven spin in the rotating frame', bloch, tex`\rho=\frac{1}{2}(I+r_x\sigma_x+r_y\sigma_y+r_z\sigma_z)`],
    echo: ['Nine-mode return fidelity', echoes, tex`\mathcal{L}(\tau)=\prod_{j=1}^{9}(1-a_j\sin^2\phi_j)`],
    phase: ['Nonlinear phase space', phase, tex`p_{n+1}=p_n+K\sin q_n,\quad q_{n+1}=q_n+p_{n+1}`],
    cauchy: ['Cauchy data and causal domain', cauchy, tex`G_{\mu\nu}+\Lambda g_{\mu\nu}=\frac{8\pi G}{c^4}T_{\mu\nu}`],
  };

  function figure(c, type, x, y, width, number) {
    const [title, draw, formula] = FIGURES[type];
    c.save(); c.translate(x, y); c.scale(width / 360, width / 360);
    c.fillStyle = '#f0f4f4'; c.fillRect(0, 0, 360, 223);
    c.strokeStyle = '#bdc9cd'; c.lineWidth = 1; c.strokeRect(.5, .5, 359, 222);
    c.fillStyle = '#dce6e8'; c.fillRect(1, 1, 358, 29);
    label(c, number, 12, 20, 12, teal, 650);
    label(c, title, 45, 20, 13, ink, 650);
    c.save(); c.translate(0, 30); draw(c); c.restore();
    path(c, [[12, 189], [347, 189]], '#bdc9cd');
    equation(c, formula, 15, 211, 329, 13.5);
    c.restore();
    return y + 223 * width / 360;
  }
  function search(q, lang, results) {
    const P = mk(), c = P.c; fill(P, '#fafaf9');
    c.fillStyle = '#fff'; c.fillRect(0, 0, PW, 90); c.strokeStyle = '#e4e6ea'; c.beginPath(); c.moveTo(0, 90); c.lineTo(PW, 90); c.stroke();
    c.font = `600 26px ${UI}`; c.fillStyle = '#4c5758'; c.fillText('Field Index', 28, 56);
    O.rr(c, 190, 22, 640, 46, 23); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#dfe1e5'; c.stroke();
    c.font = `17px ${UI}`; c.fillStyle = '#202124'; c.fillText(q, 214, 52);
    const tabs = lang === 'zh' ? ['全部', '论文', '笔记', '协议', '档案'] : lang === 'de' ? ['Alle', 'Studien', 'Notizen', 'Protokolle', 'Archiv'] : ['All', 'Papers', 'Notes', 'Protocols', 'Archive'];
    c.font = `14px ${UI}`; tabs.forEach((s, i) => { c.fillStyle = i === 0 ? '#395e69' : '#5f6368'; c.fillText(s, 190 + i * 86, 118); });
    const count = lang === 'zh' ? '本地索引 · 14 条记录' : lang === 'de' ? 'Lokaler Index · 14 Einträge' : 'Local index · 14 records';
    c.fillStyle = '#70757a'; c.font = `13.5px ${UI}`; c.fillText(count, 190, 160);
    const exhibits = lang === 'zh' ? ['gr', 'sr', 'echo', 'cauchy'] :
      lang === 'de' ? ['phase', 'spin', 'gr', 'echo'] : ['sr', 'gr', 'phase', 'spin'];
    const sourceNames = {
      gr: 'Schwarzschild / equatorial embedding',
      sr: 'Minkowski / boosted coordinates',
      spin: 'Spin dynamics / detuned pulse',
      echo: 'ML-042 / return fidelity',
      phase: 'Poincaré section / kicked rotor',
      cauchy: 'Causal boundary / initial data',
    };
    exhibits.forEach((type, i) => {
      const y = 194 + 258 * i;
      label(c, sourceNames[type], 626, y + 18, 15, ink, 600);
      figure(c, type, 626, y + 29, 350, '0' + (i + 1));
    });
    let y = 200;
    for (let k = 0; k < 14; k++) {
      const r = results[k % results.length];
      c.font = `13px ${UI}`; c.fillStyle = '#202124'; c.fillText(r[1], 190, y);
      c.font = `21px ${UI}`; c.fillStyle = '#304d65'; c.fillText(r[0], 190, y + 30, 405);
      y = para(P, r[2], 190, y + 58, 405, '15px ' + UI, 23, '#4d5156') + 27;
    }
    return P;
  }
  function wiki(title, lang, sub, card, sections) {
    const P = mk(), c = P.c; fill(P, '#fbfbfa');
    c.fillStyle = '#f8f9fa'; c.fillRect(0, 0, PW, 70); c.strokeStyle = '#a2a9b1'; c.beginPath(); c.moveTo(0, 70); c.lineTo(PW, 70); c.stroke();
    c.font = `600 18px ${SERIF}`; c.fillStyle = '#202122'; c.fillText(lang === 'zh' ? '观测手册' : lang === 'de' ? 'Laborlexikon' : lang === 'ru' ? 'Справочник' : 'Meridian Reference', 30, 44);
    O.rr(c, 330, 18, 420, 36, 4); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#a2a9b1'; c.stroke(); c.font = `15px ${UI}`; c.fillStyle = '#72777d'; c.fillText(lang === 'zh' ? '搜索' : 'Search', 344, 42);
    c.font = `34px ${SERIF}`; c.fillStyle = '#000'; c.fillText(title, 40, 132); c.fillStyle = '#a2a9b1'; c.fillRect(40, 146, PW - 80, 1);
    c.font = `14px ${UI}`; c.fillStyle = '#54595d'; c.fillText(sub, 40, 172);
    // 信息框
    c.fillStyle = '#f8f9fa'; c.fillRect(PW - 360, 200, 320, 380); c.strokeStyle = '#a2a9b1'; c.strokeRect(PW - 360, 200, 320, 380);
    c.font = `600 15px ${UI}`; c.fillStyle = '#202122'; c.fillText(card[0], PW - 340, 230);
    const box = O.TeX.layout(c, card[1], 26); c.fillStyle = '#202122'; O.TeX.draw(c, box, PW - 200 - box.w / 2, 300);
    c.font = `13px ${UI}`; c.fillStyle = '#202122'; card.slice(2).forEach((s, i) => c.fillText(s, PW - 340, 360 + i * 32));
    const exhibits = { en: ['spin', 'echo'], zh: ['sr', 'cauchy'], de: ['phase', 'gr'], ru: ['gr', 'cauchy'] }[lang];
    let y = 220; const T = TX[lang];
    for (let k = 0; k < 18; k++) {
      if (k === 2 || k === 8) {
        figure(c, exhibits[0], 40, y, 380, 'A');
        y = figure(c, exhibits[1], 447, y, 380, 'B') + 27;
      }
      if (k % 4 === 3) { c.font = `26px ${SERIF}`; c.fillStyle = '#202122'; c.fillText(sections[(k - 3) / 4], 40, y + 20); c.fillStyle = '#a2a9b1'; c.fillRect(40, y + 30, PW - 440, 1); y += 64; }
      y = para(P, T[k % T.length], 40, y, k < 8 ? PW - 440 : PW - 80, `16px ${SERIF}`, 26, '#202122') + 18;
    }
    return P;
  }
  function paper() {
    const P = mk(), c = P.c; fill(P, '#65696b');
    const layouts = [
      ['spin', 'echo', 'Spin preparation and return fidelity'],
      ['phase', 'cauchy', 'Recovering incomplete initial data'],
      ['gr', 'sr', 'Coordinate reversal and invariant ordering'],
    ];
    for (let pg = 0; pg < 3; pg++) {
      const y0 = 30 + pg * 660; c.fillStyle = '#fcfcfb'; c.fillRect(150, y0, 940, 630);
      const [left, right, subtitle] = layouts[pg];
      label(c, 'MERIDIAN LABORATORY   /   TECHNICAL NOTE ML-042', 188, y0 + 27, 12, teal, 650);
      if (pg === 0) {
        c.font = `600 22px ${SERIF}`; c.fillStyle = '#111'; c.textAlign = 'center'; c.fillText('Return Fidelity Under an Imperfect Inverse Pulse', 620, y0 + 60);
        c.font = '14px ' + SERIF; c.fillText('Revision 3 · Theory and numerical controls', 620, y0 + 86); c.textAlign = 'left';
      }
      label(c, String(pg + 1).padStart(2, '0') + '   ' + subtitle, 188, y0 + 120, 17, ink, 650);
      path(c, [[188, y0 + 131], [1050, y0 + 131]], '#b9c7cb');
      figure(c, left, 188, y0 + 149, 412, (pg + 1) + 'a');
      figure(c, right, 638, y0 + 149, 412, (pg + 1) + 'b');
      const line = [
        tex`\mathcal{L}(\tau)=|\langle\psi_0|\exp[-i(-H+\epsilon V)\tau/\hbar]\exp[-iH\tau/\hbar]|\psi_0\rangle|^2`,
        tex`\widehat{x}_{\lambda}=\sum_j\frac{\sigma_j}{\sigma_j^2+\lambda}\langle u_j,y\rangle v_j,\qquad \sigma_j\to0\Rightarrow\text{ill-conditioned history}`,
        tex`d\tau^2=-g_{\mu\nu}dx^\mu dx^\nu/c^2,\qquad N_{R}(q)-N_{R}(p)>0\quad\text{on the same trace}`,
      ][pg];
      equation(c, line, 209, y0 + 448, 815, 21);
      const comments = [
        [TX.en[0], TX.en[1]],
        ['A reversible map can amplify small errors in its starting coordinates. Near the chaotic layer, the measured point is compatible with several distinct histories at the instrument resolution.',
          'A complete Cauchy surface can determine evolution within its domain of dependence. The logged detector samples occupy only a finite segment and leave most of the initial data unobserved.'],
        ['The Schwarzschild embedding shows the curvature of a spatial slice at fixed coordinate time. The vertical direction is an embedding coordinate.',
          'Boosted observers disagree about the order of spacelike events. Both preserve the order of the preparation and the readout on a single timelike instrument trace.'],
      ][pg];
      para(P, comments[0], 188, y0 + 492, 414, '14px ' + SERIF, 22, '#30363a');
      para(P, comments[1], 638, y0 + 492, 414, '14px ' + SERIF, 22, '#30363a');
      path(c, [[188, y0 + 589], [1050, y0 + 589]], '#b9c7cb');
      label(c, 'ML-042   /   CONTROL SERIES 17', 188, y0 + 610, 11, faint, 650);
      label(c, (pg + 1) + ' / 3', 1009, y0 + 610, 11);
    }
    return P;
  }

  function heroPage() {
    const P = mk(), c = P.c; fill(P, '#fbfbf8'); P.keys = [FIND];
    c.fillStyle = '#eaf0ef'; c.fillRect(0, 0, PW, 59);
    label(c, 'Meridian Reference', 32, 37, 21, ink, 650);
    label(c, 'Dynamics  /  Supplement to ML-042  /  Archived revision 17', 302, 36, 15, faint, 550);
    c.font = '34px ' + SERIF; c.fillStyle = ink; c.fillText('Time reversal', 253, 108);
    path(c, [[253, 126], [1180, 126]], '#a5b7ba');
    label(c, '§ 2.1    INVERSE OF THE JOINT EVOLUTION', 253, 155, 14, teal, 650);
    equation(c, tex`\rho_S'=\Tr_R[U_{SR}\rho_{SR}U_{SR}^\dagger]`, 255, 196, 520, 27);
    equation(c, tex`R_{\sigma,\mathcal{M}}(X)=\sigma^{1/2}\mathcal{M}^\dagger[\mathcal{M}(\sigma)^{-1/2}X\mathcal{M}(\sigma)^{-1/2}]\sigma^{1/2}`,
      255, 241, 594, 24);
    label(c, '(12)', 864, 239, 14, faint);
    path(c, [[253, 259], [896, 259]], '#c4cecf');
    label(c, 'MARGINALIA     /     DO NOT TRACE OUT THE RECORDER', 255, 287, 14, rust, 650);
    equation(c, tex`\Delta N_R>0\quad\wedge\quad\mathcal{L}(\tau)\approx1`, 477, 325, 358, 24, ink);
    para(P, 'Time reversal of the sample leaves a later entry on the recorder. The recovery map acts on the support of the reference state.',
      255, 322, 217, '16px ' + SERIF, 25, ink);
    para(P, 'FC-03: the source hash matches the receipt. The write event is missing from the captured segment.',
      477, 359, 418, '16px ' + SERIF, 24, ink);
    figure(c, 'cauchy', 929, 145, 272, '2b');
    figure(c, 'phase', 477, 485, 416, '3a');
    figure(c, 'echo', 35, 485, 416, '3b');
    label(c, '§ 2.2    EXTERNAL RECORDS', 35, 786, 18, teal, 650);
    let y = 831;
    for (let k = 0; k < 13; k++) {
      y = para(P, TX.hero[k % TX.hero.length], 35, y, 780, '18px ' + SERIF, 27, ink) + 22;
    }
    return P;
  }
  function oldbook() {
    const P = mk(), c = P.c; const g = c.createLinearGradient(0, 0, PW, 0); g.addColorStop(0, '#d9d5c8'); g.addColorStop(.5, '#eeeae0'); g.addColorStop(1, '#dcd8cc'); c.fillStyle = g; c.fillRect(0, 0, PW, PH);
    const R = O.rng(1984); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(80,69,53,${R() * .05})`; c.beginPath(); c.arc(R() * PW, R() * PH, R() * 6, 0, 7); c.fill(); }
    c.fillStyle = '#302c26'; c.font = `italic 30px "Palatino Linotype", ${SERIF}`; c.textAlign = 'center'; c.fillText('Meridian Laboratory · Instrument Logbook', PW / 2, 110);
    c.font = `20px "Palatino Linotype", ${SERIF}`; c.fillText('22 November 1984 · Rack C / Run 17', PW / 2, 150); c.textAlign = 'left';
    c.font = `600 24px "Palatino Linotype", ${SERIF}`; c.fillText('Series 17: the second pulse', 160, 230); c.fillText('The echo returned. The clock advanced.', 160, 268);
    const notes = [
      '02:58:10 · Synchronised the rack clock to the desk reference before starting the acquisition. The counter was left running through all stages of the measurement.',
      '03:00:22 · First clear Loschmidt echo. A narrow peak appeared at the predicted delay. The paper feed carried the peak past the pen once, as in the control.',
      '03:06:45 · Repeated with the inverse pulse detuned. The return broadened and lost amplitude. The forward-only counter advanced by the same number of ticks.',
      '03:17:42 · The terminal loaded a preview before the corresponding plot was filed. Set aside the printout with the acquisition strip. The spool could not be reconstructed.',
      'Morning addendum · The receipt is clipped to this leaf. The origin stamp is blank. Compare the print spool with the original instrument ledger before assigning the record a date.',
    ];
    let y = 330;
    for (let k = 0; k < 20; k++) {
      if (k === 1) {
        label(c, 'ATTACHMENTS 17-B & 17-C   /   STRIP TRACE AND MODEL', 160, y + 13, 13, '#625747', 650);
        figure(c, 'echo', 160, y + 27, 425, '17B');
        y = figure(c, 'spin', 607, y + 27, 425, '17C') + 34;
      }
      y = para(P, notes[k % notes.length], 160, y, PW - 320, `19px "Palatino Linotype", ${SERIF}`, 30, '#38332c') + 22;
    }
    return P;
  }
  function qa(title, lang, answers, dark) {
    const P = mk(), c = P.c; fill(P, dark ? '#1b1b1d' : '#f6f6f6');
    c.fillStyle = dark ? '#262629' : '#fff'; c.fillRect(0, 0, PW, 64); c.font = `600 20px ${UI}`; c.fillStyle = dark ? '#e7e7e7' : '#222'; c.fillText(lang === 'zh' ? '仪器论坛' : lang === 'ja' ? '実験ノート' : lang === 'ko' ? '실험실 포럼' : 'Bench Forum', 30, 40);
    c.font = `600 28px ${UI}`; c.fillStyle = dark ? '#fff' : '#111'; O.wrap(c, title, `600 28px ${UI}`, PW - 120).forEach((l, i) => c.fillText(l, 60, 126 + i * 38));
    c.font = `13px ${UI}`; c.fillStyle = '#666b6d'; c.fillText(lang === 'zh' ? '测量与校时 · 已归档 · 9 条回复' : lang === 'ja' ? '測定と校正 · アーカイブ済み' : lang === 'ko' ? '장치 시계 · 보관됨' : 'Instrumentation · Archived thread · 9 replies', 60, 190);
    const attachments = { en: ['gr', 'sr'], zh: ['cauchy', 'phase'], ja: ['spin', 'echo'], ko: ['sr', 'gr'] }[lang];
    let y = 240;
    for (let k = 0; k < 9; k++) {
      c.fillStyle = dark ? '#232326' : '#fff'; const top = y; const a = answers[k % answers.length];
      const lines = O.wrap(c, a, `16px ${UI}`, PW - 220).length; c.fillRect(40, top - 10, PW - 80, lines * 26 + 90);
      c.fillStyle = '#c7c7c7'; c.beginPath(); c.arc(84, top + 24, 16, 0, 7); c.fill();
      c.font = `600 14px ${UI}`; c.fillStyle = dark ? '#ddd' : '#333'; c.fillText(['rack_c', 'Nadia V.', '陈序', 'trace_reader', 'pulse_lab', '安藤', 'osc_17', 'Min J.', 'ledger_io'][k], 112, top + 29);
      c.font = `600 15px ${UI}`; c.fillStyle = '#737879'; c.fillText(`▲ ${(54 / (k + 1)) | 0}`, PW - 160, top + 29);
      y = para(P, a, 80, top + 66, PW - 220, `16px ${UI}`, 26, dark ? '#d2d2d2' : '#2a2a2a') + 40;
      if (k === 0 || k === 3) {
        const caption = { en: 'Attached figures', zh: '附件图版', ja: '添付図版', ko: '첨부 도판' }[lang];
        label(c, caption, 80, y + 3, 15, dark ? '#d2d2d2' : faint, 650);
        figure(c, attachments[0], 80, y + 15, 393, k === 0 ? 'A1' : 'B1');
        y = figure(c, attachments[1], 498, y + 15, 393, k === 0 ? 'A2' : 'B2') + 30;
      }
    }
    return P;
  }
  function code() {
    const P = mk(), c = P.c; fill(P, '#0d1117');
    c.fillStyle = '#161b22'; c.fillRect(0, 0, PW, 60); c.font = `600 16px ${UI}`; c.fillStyle = '#e6edf3'; c.fillText('meridian / device-ledger  ·  audit/cache_receipt.py', 24, 37);
    const src = [
      'from dataclasses import dataclass', '',
      '# Offline fixture, case FC-03. Preserve the original receipt.',
      '# Sequence numbers are scoped to one boot and one writer.', '',
      '@dataclass(frozen=True)', 'class Receipt:',
      '    key: str', '    read_seq: int', '    source_seq: int',
      '    writer: str | None', '    boot: str', '',
      'def classify(receipt, boot):',
      '    if receipt.boot != boot:', '        return "different_session"',
      '    if receipt.source_seq > receipt.read_seq and receipt.writer is None:',
      '        return "future_cache"', '    return "ordinary_receipt"', '',
      'sample = Receipt("echo/17", 1842, 1910, None, "rack-c-17")',
      'result = classify(sample, boot="rack-c-17")', '',
      '# 03:17:42 / cache HIT / source sequence 1910 / receipt sequence 1842',
      '# Source write absent from the captured segment.',
      '# Case FC-03 remains open pending an independent writer trace.',
    ];
    const appendixY = 100 + src.length * 24 + 6;
    label(c, 'Artifacts  /  numerical controls', 70, appendixY, 15, '#a7b9c3', 650);
    figure(c, 'phase', 70, appendixY + 18, 356, 'A');
    figure(c, 'echo', 441, appendixY + 18, 356, 'B');
    c.font = `15px ${MONO}`;
    for (let k = 0; k < 3; k++) src.forEach((l, i) => {
      const y = 100 + (k * src.length + i) * 24 + (k > 0 ? 268 : 0);
      c.fillStyle = '#828b96'; c.fillText(String(k * src.length + i + 1).padStart(3), 20, y);
      c.fillStyle = l.startsWith('#') ? '#a0aab4' : /\b(def|class|import|if|return)\b/.test(l) ? '#d9a297' : '#e6edf3';
      c.fillText(l, 70, y);
      const p = l.indexOf('future_cache');
      if (p >= 0) {
        const x = 70 + c.measureText(l.slice(0, p)).width;
        P.hits.push({ x, y: y - 17, w: c.measureText('future_cache').width, h: 22 });
      }
    });
    return P;
  }
  const RES_EN = [
    ['Time reversal and inverse evolution', 'meridian.example › reference › time-reversal', 'A time reversal formula for the model starts with the inverse propagator. The prepared state and every interaction determine which inverse applies.'],
    ['Loschmidt echo: preparation and readout', 'meridian.example › reference › loschmidt-echo', 'A Loschmidt echo measures the overlap after forward and inverse evolution. The acquisition trace keeps both stages on one timebase.'],
    ['Return fidelity under an imperfect inverse pulse', 'meridian.example › papers › ML-042.pdf', 'Test note ML-042 compares the ideal return with a detuned pulse over a range of delays. Includes the raw traces and the calibration run.'],
    ['Why does the device clock keep running?', 'bench.example › threads › echo-clock', 'The forward-only clock orders events across the pulse sequence and readout. Wall time can jump when the host is resynchronised.'],
    ['Rack C / Run 17: instrument logbook', 'meridian.example › archive › 1984 › rack-c', 'The paper trace records a Loschmidt echo just after 03:00. A later entry mentions a terminal preview whose source plot could not be found.'],
    ['Cache receipt FC-03: source sequence unresolved', 'meridian.example › records › FC-03', 'A future cache fixture arrived with a complete payload, a later source sequence and an empty writer field. The captured ledger contains only the receipt.'],
    ['Compare monotonic and wall-clock timestamps', 'bench.example › notes › clock-audit', 'Record the boot identifier alongside the forward-only counter. Cross-machine timestamps need a common reference before they can establish ordering.'],
    ['Lorentz boosts and the light cone', 'meridian.example › notes › SR-09', 'A change of coordinates preserves null separation. Compare the ordinary and boosted axes before assigning an order to spacelike events.'],
    ['A spatial slice of the Schwarzschild metric', 'meridian.example › notes › GR-16', 'The equatorial embedding visualizes intrinsic spatial curvature at fixed coordinate time. The embedding height is an auxiliary coordinate.'],
    ['Nonlinear map with partial readout', 'meridian.example › papers › ML-042 › figure 2a', 'At the instrument resolution an observed point near the chaotic layer admits several candidate histories. Retain the external trace as an additional constraint.'],
  ];
  const RES_ZH = [
    ['单向时钟与系统时间', 'meridian.example › zh › device-clock', '同一次开机期间，单向时钟可用于比较事件顺序。系统时间可能因校时或人工调整产生跳变。'],
    ['时间反演有公式吗？', 'bench.example › zh › reverse-time', '逆演化公式描述的是受控系统的状态。洛施密特回声实验可以测量恢复程度，采集器仍会继续计时。'],
    ['回声实验的设备日志', 'meridian.example › zh › run-17', '记录包含准备脉冲、反演脉冲以及读出。给每次采集保留同一设备的序列号，便于核对先后。'],
    ['未来缓存 FC-03：原始回执', 'meridian.example › records › FC-03', '03:17:42 命中缓存。回执序列为 1842，来源序列为 1910，写入方字段为空。原始回执已保全。'],
    ['回拨系统时间后如何排查日志', 'bench.example › zh › timestamp-order', '先核对开机会话，再比较单向时钟读数。如果缓存已经刷新，寻回首次响应应以原始回执为准。'],
    ['弯曲时空的赤道截面', 'meridian.example › zh › GR-16', '在固定坐标时间上，将施瓦西度规的空间截面嵌入三维空间。嵌入高度是辅助坐标。'],
    ['光锥、参考系与因果次序', 'meridian.example › zh › SR-09', '对照两套坐标轴与零间隔边界。同一设备上的准备和读出仍有固定的因果次序。'],
  ];
  const RES_DE = [
    ['Zeitumkehr und Loschmidt-Echo', 'meridian.example › de › zeitumkehr', 'Das Echo vergleicht den Ausgangszustand mit dem Zustand nach der Rückentwicklung. Die Geräteuhr läuft während des Versuchs weiter.'],
    ['Protokoll der zweiten Pulsfolge', 'meridian.example › papers › ML-042.pdf', 'Der Bericht zeigt, wie ein verstimmter Umkehrpuls das Loschmidt-Echo abschwächt. Die Rohdaten enthalten beide Pulszeiten.'],
    ['Zeitstempel im Messprotokoll prüfen', 'bench.example › de › geraeteuhr', 'Die Reihenfolge ist am monotonen Zähler ablesbar. Ein Sprung der Systemzeit ändert die Reihenfolge der aufgezeichneten Ereignisse nicht.'],
    ['Archivbeleg FC-03', 'meridian.example › records › FC-03', 'Der Cache-Beleg trägt eine spätere Quellsequenz. Im Mitschnitt fehlt der zugehörige Schreibeintrag.'],
  ];
  O.Pages = {
    PW, PH,
    init() {
      pages.length = 0;
      pages.push(search('time reversal formula', 'en', RES_EN)); // 0
      pages.push(search('时间反演公式 单向时钟', 'zh', RES_ZH)); // 1
      pages.push(wiki('Loschmidt echo', 'en', 'Meridian reference · Experimental methods', [
        'Return fidelity', 'L(t) = |\\langle \\Psi_0 | \\Psi_{ret} \\rangle|^2',
        'Observable: overlap with initial state', 'Protocol: forward evolution, inverse, readout',
        'Ideal control: L = 1', 'Trace clock: acquisition counter', 'Related note: ML-042',
      ], ['Pulse sequence', 'Sources of error', 'Comparison runs', 'Acquisition records'])); // 2
      pages.push(wiki('单向时钟', 'zh', '观测手册 · 仪器计时', [
        '同一开机会话内的事件排序', 'C(t_2) \\ge C(t_1)',
        '条件：t₂ ≥ t₁', '参考源：单调计数器', '计数单位：时钟刻度',
        '相关记录：仪器回执 FC-03', '采集设备：Rack C',
      ], ['单调计数', '系统校时', '回声实验', '缓存回执'])); // 3
      pages.push(wiki('Zeitumkehr', 'de', 'Laborlexikon · Dynamik', [
        'Ideale Rückentwicklung', 'U(-t) = U(t)^\\dagger',
        'Modell: unitäre Entwicklung', 'Messgröße: Überlapp', 'Protokoll: zwei Pulse',
        'Zeitbasis: Gerätezähler', 'Versuchsnotiz: ML-042',
      ], ['Dynamik', 'Versuchsaufbau', 'Messfehler', 'Geräteprotokoll'])); // 4
      pages.push(paper()); // 5
      pages.push(qa('Can an echo return before the trigger?', 'en', [
        'Start with the acquisition trace. In Run 17 the Loschmidt echo arrives at sample 5914, after the inverse pulse at 5880.',
        'Check whether the viewer restored a cached preview. That timestamp might describe the saved file, while the forward-only counter records the current acquisition.',
        'If this is the future cache fixture, preserve the receipt and export the source segment before refreshing. FC-03 is missing the writer trace.',
        'The two counters are comparable only if they belong to the same session. Could you attach the original capture header?',
      ])); // 6
      pages.push(qa('未来缓存的回执先到了，写入记录在哪里？', 'zh', [
        '把首次响应和请求头一起保存。回执 1842 已经命中，来源序列 1910 对应的写入方字段为空。',
        '我在原始采集段里没找到它。单向时钟正常，日志里也没有重启迹象。',
        '手册里有一份类似的未来缓存记录，编号 FC-03。先看它的原始回执，网页刷新过一次，预览已经变了。',
        '需要找到写入方的采集日志，再核对两个序列号是否确实来自同一个开机会话。',
      ])); // 7
      pages.push(qa('時間反転パルスのあと、時計はどうなる？', 'ja', TX.ja)); // 8
      pages.push(wiki('Обращение времени', 'ru', 'Справочник Meridian · Динамика', [
        'Обратная эволюция', 'U(-t) = U(t)^\\dagger',
        'Измерение: эхо Лошмидта', 'Подготовка: исходное состояние',
        'Время: счётчик прибора', 'Протокол опыта: ML-042',
      ], ['Траектория', 'Измерение эха', 'Погрешность', 'Журнал прибора'])); // 9
      pages.push(code()); // 10
      pages.push(oldbook()); // 11
      pages.push(search('Zeitumkehr Loschmidt-Echo', 'de', RES_DE)); // 12
      pages.push(qa('시간 반전 실험에서 장치 시계도 돌아가나요?', 'ko', TX.ko)); // 13
      pages.push(heroPage()); // 14 hero
    },
  };
  const URL = [
    'field.example/?q=time+reversal+formula', 'field.example/?q=时间反演公式+单向时钟',
    'meridian.example/reference/loschmidt-echo', 'meridian.example/zh/device-clock',
    'meridian.example/de/zeitumkehr', 'meridian.example/papers/ML-042.pdf',
    'bench.example/threads/echo-clock', 'bench.example/zh/threads/FC-03',
    'bench.example/ja/notes/reversal-pulse', 'meridian.example/ru/time-reversal',
    'code.example/meridian/device-ledger', 'meridian.example/archive/1984/rack-c',
    'field.example/?q=Zeitumkehr+Loschmidt-Echo', 'bench.example/ko/threads/device-clock',
    'meridian.example/reference/time-reversal?rev=17',
  ];
  const TITLE = [
    'time reversal formula · Field Index', '时间反演公式 · 本地索引', 'Loschmidt echo', '单向时钟',
    'Zeitumkehr · Laborlexikon', 'Return Fidelity · ML-042', 'Can an echo return before the trigger?',
    '未来缓存 FC-03', '時間反転パルス', 'Обращение времени', 'device-ledger / cache_receipt.py',
    'Instrument Logbook · Rack C', 'Zeitumkehr · Lokaler Index', '시간 반전과 장치 시계', 'Time reversal · Meridian',
  ];
  const FAV = ['#5b7680', '#5b7680', '#3d4a4d', '#3d4a4d', '#3d4a4d', '#8b5c56', '#6a7780', '#6a7780', '#6a7780', '#3d4a4d', '#8b949e', '#897c69', '#5b7680', '#6a7780', '#3d4a4d'];

  // ---------------- 窗口绘制 ----------------
  O.drawBrowser = (c, w, t, hl) => {
    const a = clamp((t - w.t) / .16); if (a <= 0) return;
    const sc = .94 + .06 * E.o3(a), cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
    c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 36; c.shadowOffsetY = 10; c.fillStyle = '#dfe2e6'; O.rr(c, w.x, w.y, w.w, w.h, 8); c.fill(); c.restore();
    c.save(); O.rr(c, w.x, w.y, w.w, w.h, 8); c.clip();
    // 标签栏
    c.fillStyle = '#dee1e6'; c.fillRect(w.x, w.y, w.w, 40);
    const n = w.tabs, tw = Math.min(230, (w.w - 190) / n);
    for (let i = 0; i < n; i++) {
      const x = w.x + 10 + i * tw, act = i === n - 1, pg = (w.page + i * 5) % 15;
      if (act) { c.fillStyle = '#fff'; O.rr(c, x, w.y + 6, tw, 40, 9); c.fill(); }
      else if (i < n - 2) { c.fillStyle = '#b9bcc2'; c.fillRect(x + tw - 1, w.y + 14, 1, 16); }
      c.fillStyle = FAV[act ? w.page : pg]; c.beginPath(); c.arc(x + 18, w.y + 24, 7, 0, 7); c.fill();
      c.font = `12.5px ${UI}`; c.fillStyle = act ? '#202124' : '#45474a'; c.save(); c.beginPath(); c.rect(x + 30, w.y + 8, tw - 42, 30); c.clip(); c.fillText(TITLE[act ? w.page : pg], x + 32, w.y + 28); c.restore();
    }
    c.strokeStyle = '#5f6368'; c.lineWidth = 1.2; const bx = w.x + w.w;
    c.beginPath(); c.moveTo(bx - 128, w.y + 20); c.lineTo(bx - 118, w.y + 20); c.stroke(); c.strokeRect(bx - 79, w.y + 15, 10, 10);
    c.beginPath(); c.moveTo(bx - 28, w.y + 15); c.lineTo(bx - 18, w.y + 25); c.moveTo(bx - 18, w.y + 15); c.lineTo(bx - 28, w.y + 25); c.stroke();
    // 工具栏
    c.fillStyle = '#fff'; c.fillRect(w.x, w.y + 40, w.w, 44);
    c.strokeStyle = '#5f6368'; c.lineWidth = 1.6; const ty = w.y + 62;
    c.beginPath(); c.moveTo(w.x + 26, ty); c.lineTo(w.x + 16, ty); c.moveTo(w.x + 20, ty - 5); c.lineTo(w.x + 15, ty); c.lineTo(w.x + 20, ty + 5); c.stroke();
    c.strokeStyle = '#bdc1c6'; c.beginPath(); c.moveTo(w.x + 46, ty); c.lineTo(w.x + 56, ty); c.moveTo(w.x + 52, ty - 5); c.lineTo(w.x + 57, ty); c.lineTo(w.x + 52, ty + 5); c.stroke();
    c.strokeStyle = '#5f6368'; c.beginPath(); c.arc(w.x + 84, ty, 6, -2.4, 2.2); c.stroke();
    c.fillStyle = '#f1f3f4'; O.rr(c, w.x + 108, w.y + 47, w.w - 170, 30, 15); c.fill();
    c.font = `13.5px ${UI}`; c.fillStyle = '#202124'; c.save(); c.beginPath(); c.rect(w.x + 130, w.y + 47, w.w - 210, 30); c.clip(); c.fillText(URL[w.page], w.x + 136, w.y + 67); c.restore();
    c.fillStyle = '#5f6368'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(w.x + w.w - 30, w.y + 54 + i * 7, 1.6, 0, 7); c.fill(); }
    c.fillStyle = '#e8eaed'; c.fillRect(w.x, w.y + 84, w.w, 1);
    // 页面
    const P = pages[w.page], ch = w.h - 85, cw = w.w;
    const maxS = PH - ch - 10, s = Math.max(0, ((w.s0 + Math.max(0, t - w.t - .3) * w.sp) % (maxS * 2)));
    const sy = s > maxS ? 2 * maxS - s : s;
    c.fillStyle = '#fff'; c.fillRect(w.x, w.y + 85, cw, ch);
    const vw = Math.min(cw, PW);
    c.drawImage(P.cv, 0, sy * O.LS, vw * O.LS, ch * O.LS, w.x, w.y + 85, vw, ch);
    // 查找高亮
    if (hl > 0) {
      c.save(); c.beginPath(); c.rect(w.x, w.y + 85, cw, ch); c.clip(); c.globalCompositeOperation = 'multiply';
      let k = 0; const cur = Math.floor(t * 9 + w.i * 3);
      for (const h of P.hits) {
        const y = h.y - sy + w.y + 85; if (y < w.y + 60 || y > w.y + w.h) continue;
        c.fillStyle = (k++ % 7) === cur % 7 ? `rgba(255,150,40,${hl})` : `rgba(255,236,60,${hl})`; c.fillRect(w.x + h.x, y, h.w, h.h);
      }
      c.restore();
      if (w.hero) {
        const fx = w.x + w.w - 380, fy = w.y + 92; c.fillStyle = '#fff'; O.rr(c, fx, fy, 360, 44, 8); c.fill(); c.strokeStyle = '#dadce0'; c.stroke();
        c.font = `14px ${UI}`; c.fillStyle = '#202124'; c.fillText(FIND, fx + 16, fy + 28); c.fillStyle = '#5f6368';
        c.fillText(`${(Math.floor(t * 9) % P.hits.length) + 1}/${P.hits.length}`, fx + 230, fy + 28); c.fillText('⌃  ⌄  ✕', fx + 290, fy + 28);
      }
    }
    if (w.hero && t >= 77.65) {
      const x = 437, y = 422, width = 710, height = 172;
      c.save(); c.globalAlpha *= sstep(77.65, 77.80, t);
      c.shadowColor = 'rgba(12,32,35,.27)'; c.shadowBlur = 28; c.shadowOffsetY = 8;
      c.fillStyle = '#f4f7f6'; O.rr(c, x, y, width, height, 8); c.fill();
      c.shadowColor = 'transparent';
      c.strokeStyle = '#a7b9b6'; c.lineWidth = 1; O.rr(c, x, y, width, height, 8); c.stroke();
      c.textAlign = 'center'; c.fillStyle = '#2d5c55'; c.font = `600 15px ${MONO}`;
      c.fillText('CACHE RECEIPT  /  FC-03', x + width / 2, y + 36);
      c.fillStyle = '#213431'; c.font = `600 24px ${MONO}`;
      c.fillText('2026-11-19  03:00:00', x + width / 2, y + 83);
      c.fillStyle = '#536763'; c.font = `15px ${MONO}`;
      c.fillText('SOURCE  ·  clock.local', x + width / 2, y + 131);
      c.restore();
    }
    c.restore(); c.restore();
  };
})();
