'use strict';
// ============================================================================
//  story.js —— 全片时间轴（单一长镜头）：界面事件、光标、打字、对话内容、浏览器、机位
//  所有时间单位为秒。画面、声音都从这里读取同一份时间表。
// ============================================================================
(() => {
  const T = O.T = {
    wake: 3.0, desk: 3.22,
    ddOpen: 12.55, flick: 21.5, pick: 26.2, freeze0: 26.235, freeze1: 26.335,
    drag0: 27.45, drag1: 28.3, notch: 29.3, slide0: 29.9, slide1: 30.55, ddClose: 31.4,
    permOpen: 33.0, permPick: 34.6, dlg: 31.45, cont: 38.0,
    focus: 40.3, type0: 40.75, send: 50.9,
    think: 51.3, tools: 52.7, br0: 57.6, brLast: 69.8, close: 80.0,
    rep: 85.5, calc: 105.0, fail: 116.5, loop: 121.0, start: 130.0, waterEnd: 139.0, done: 141.7,
    white: 142.0, black: 142.067, back: 150.0, ask: 150.6, click: 161.0, ans: 162.6,
    clockRev: 184.0, last: 185.0, sleep: 195.5, cut: 199.35, end: O.DUR,
  };
  O.isOn = t => t >= T.wake && t < T.sleep;          // 背光
  O.era = t => t < T.white ? 1 : t < T.black ? 'white' : t < T.back ? 'black' : 2;

  // ---------------- 任务栏时钟 ----------------
  O.clockSec = t => {
    const base = 3 * 3600;            // 03:00:00 开始录制
    if (t >= 195.25) return base;
    if (t >= T.clockRev) return base + 182 - Math.floor(t - T.clockRev);
    if (t >= T.start && t < T.done + .2) {            // 计算时秒数卡顿 / 跳帧
      const w = Math.floor(t * 4), r = O.hash(w, 77);
      const j = r < .2 ? -1 : r > .85 ? 1 : 0;
      return base + Math.floor(t) + j;
    }
    return base + Math.floor(t);
  };
  O.clockStr = t => { const s = O.clockSec(t); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };

  // ---------------- 界面几何（逻辑像素 2560×1440） ----------------
  const W = 1324 / 1800;
  const X = px => 221 + px * W, Y = px => 42 + px * W;
  const G = O.G = {
    win: { x: X(0), y: Y(0), w: 2880 * W, h: 1800 * W },
    title: 64, side: 75, native: { X, Y, W },
    homeCx: X(1488), cx: X(1180), col0: X(444), col1: X(1916),
    greetY: Y(701), inp0: { x: X(848), y: Y(756), w: 1280 * W, h: 196 * W },
    inp1: { x: X(444), y: Y(1564), w: 1472 * W, h: 196 * W },
  };
  G.ctrl = r => ({
    plus: { x: r.x + 32, y: r.y + r.h - 32 },
    perm: { x: r.x + 2, y: r.y + r.h - 53, h: 42 },
    model: { r: r.x + r.w - 106, y: r.y + r.h - 53, h: 42 },
    send: { x: r.x + r.w - 53, y: r.y + r.h - 53, s: 41 },
  });
  G.dd = { x: X(1471), y: Y(944), w: 515 * W, row: 56 * W, h: 646 * W,
    n0: X(1498), step: (1932 - 1498) * W / 3, trackY: Y(1090) };
  G.rowY = i => Y([1126, 1184, 1241, 1354][i] - 27);
  G.perm = { x: G.inp0.x + 12, y: Y(965), w: 346, row: 54 };
  G.dlg = { x: G.homeCx - 386, y: 537, w: 772, h: 270 };
  G.dlg.cancel = { x: G.dlg.x + 30, y: G.dlg.y + 185, w: 344, h: 53 };
  G.dlg.cont = { x: G.dlg.x + 393, y: G.dlg.y + 185, w: 344, h: 53 };
  G.view = { y0: Y(235), y1: G.inp1.y - 45 };

  // ---------------- 打字（含微软拼音输入法） ----------------
  // 动作：['c', 拼音, [候选...], 选第几个(0 起), 提交键] ; ['k', 字符] 直接输入 ; ['b', n] 退格 ; ['p', 秒] 停顿 ; ['shift'] 切中英 ; ['enter']
  const SCRIPT = [
    ['c', 'nishi', ['你是', '逆势', '你使', '尼氏'], 0, 'space'],
    ['c', 'shei', ['谁', '水', '睡', '税'], 0, 'space'], ['k', '？'],
    ['p', .66], ['b', 4], ['p', .38],
    ['shift'], ['k', 'A', 1], ['k', 's'], ['k', 't'], ['k', 'r'], ['k', 'a'],
    ['k', '1'], ['k', '0'], ['k', '0'], ['k', ' '], ['shift'],
    ['c', 'daren', ['大人', '打人', '达人', '大任'], 0, 'space'], ['k', '，'],
    ['c', 'qingbangwo', ['请帮我', '请帮', '请伴我', '请办'], 0, 'space'],
    ['c', 'zhaodao', ['找到', '照到', '赵到', '找道'], 0, 'space'],
    ['c', 'nizhuan', ['扭转', '逆转', '拟转', '你转'], 1, '2'],
    ['c', 'shijiande', ['时间的', '实践的', '事件的', '世间的'], 0, 'space'],
    ['c', 'gongshi', ['公式', '公示', '工时', '共识'], 0, 'space'],
    ['c', 'daku', ['大哭', '😭', '打库', '打哭'], 1, '2'],
    ['p', .52], ['enter'],
  ];
  // 生成按键时间表，并整体缩放到 [type0, send]
  const buildTyping = () => {
    const R = O.rng(2026), ev = []; let t = 0;
    const key = (k, extra) => { ev.push(Object.assign({ t, k }, extra || {})); t += .062 + R() * .06 + (R() < .12 ? .07 : 0); };
    for (const a of SCRIPT) {
      if (a[0] === 'c') {
        for (let i = 0; i < a[1].length; i++) key(a[1][i], { comp: a[1].slice(0, i + 1), cand: a[2] });
        t += .1 + R() * .16 + (a[3] > 0 ? .38 : 0);            // 看候选
        key(a[4], { commit: a[3] < 0 ? a[1] : a[2][a[3]], sel: a[3] });
        t += .06 + R() * .12;
      } else if (a[0] === 'k') { key(a[1], { commit: a[1], shift: a[2] }); }
      else if (a[0] === 'b') { for (let i = 0; i < a[1]; i++) { key('back', { back: 1 }); t -= .03; } }
      else if (a[0] === 'p') t += a[1];
      else if (a[0] === 'shift') { key('shift', { toggle: 1 }); t += .08; }
      else if (a[0] === 'enter') key('enter', { send: 1 });
    }
    const last = ev[ev.length - 1].t, k = (T.send - T.type0) / last;
    ev.forEach(e => e.t = T.type0 + e.t * k);
    return ev;
  };
  O.typing = buildTyping();
  // t 时刻输入框状态：{ text, comp, cand, sel, en }
  O.inputAt = t => {
    let text = '', comp = '', cand = null, sel = 0, en = false;
    for (const e of O.typing) {
      if (e.t > t) break;
      if (e.comp != null) { comp = e.comp; cand = e.cand; sel = 0; }
      else if (e.commit != null) { text += e.commit; comp = ''; cand = null; }
      else if (e.back) text = [...text].slice(0, -1).join('');
      else if (e.toggle) en = !en;
      else if (e.send) { text = ''; comp = ''; cand = null; }
    }
    return { text, comp, cand, sel, en };
  };
  O.userMsg = 'Astra100 大人，请帮我找到逆转时间的公式😭';

  // ---------------- 光标 ----------------
  const d = G.dd, c0 = G.ctrl(G.inp0);
  const rowC = i => G.rowY(i) + d.row / 2;
  O.cursorKeys = [
    [0, [1260, 900]], [6.2, [1260, 900]], [8.8, [1450, 730], 'io'],
    [12.1, [c0.model.r - 55, c0.model.y + 19], 'io3'],
    [13.25, [c0.model.r - 50, c0.model.y + 19]],
    [14.6, [d.x + 101, rowC(0)], 'io'], [15.5, [d.x + 102, rowC(0) + 1]],
    [17.1, [d.x + 111, rowC(1)], 'io'], [18.25, [d.x + 115, rowC(2)], 'io'],
    [20.3, [d.x + 130, rowC(3) - 2], 'io'], [22.3, [d.x + 134, rowC(3)]],
    [23.0, [d.x + 123, rowC(2)], 'io'], [24.6, [d.x + 134, rowC(3) + 1], 'io'],
    [26.2, [d.x + 134, rowC(3) + 1]],
    [T.drag0, [d.n0 + d.step, d.trackY], 'io'],
    [T.drag1, [d.n0 + 3 * d.step, d.trackY], 'io'],
    [30.8, [d.n0 + 3 * d.step, d.trackY + 1]],
    [31.3, [1660, 880], 'io'], [32.0, [1665, 880]],
    [34.8,[G.dlg.cancel.x+125,G.dlg.cancel.y+26],'io'],
    [35.75,[G.dlg.cancel.x+130,G.dlg.cancel.y+30]],
    [37.05,[G.dlg.cont.x+158,G.dlg.cont.y+23],'io'], [38,[G.dlg.cont.x+160,G.dlg.cont.y+26]],
    [40.3, [G.inp0.x + 170, G.inp0.y + 44], 'io'], [41.15, [G.inp0.x + 320, G.inp0.y + 114], 'io'],
    [51.3, [G.inp0.x + 322, G.inp0.y + 116]], [52.5, [1779, 1060], 'io'], [154.6, [1779, 1060]],
  ];
  // 第二段（确认卡片）光标——依赖卡片布局，在 claude.js 布局完成后由 O.cardBtns 提供
  O.cursorAt = t => {
    if (t < 154.6) return O.track(O.cursorKeys, t);
    const b = O.cardBtns || { go: [G.col0 + 60, 380], no: [G.col0 + 196, 380] };
    const mid = [(b.go[0] + b.no[0]) / 2, b.go[1] + 2];
    const K = [[154.6, [1968, 1080]], [156.0, mid, 'io'], [156.6, [mid[0] + 6, mid[1] + 3]],
      [157.2, [b.no[0] - 4, b.no[1] + 1], 'io'], [158.1, [b.no[0] - 2, b.no[1] + 3]],    // 移向取消，停住
      [158.9, [b.go[0] + 8, b.go[1] + 2], 'io'], [T.click, [b.go[0] + 4, b.go[1] + 3]]];  // 慢慢回到开始
    const p = O.track(K, t);
    if (t > 156 && t < T.click + .4) { const s = .9 * sstep(156, 157, t); p[0] += O.fbm(t * 9, 3) * s * 1.6; p[1] += O.fbm(t * 9, 4) * s * 1.4; }  // 手在抖
    return p;
  };
  O.clicks = [T.ddOpen - .05, T.pick, T.drag0, T.drag1 + .05, T.ddClose, T.cont, T.focus, T.click];
  O.pressed = t => O.clicks.some(c => t >= c && t < c + .09) || (t >= T.drag0 && t < T.drag1 + .05);

  // ---------------- ChatGPT 对话内容 ----------------
  // 类型：user / think / tool / count / p / h / m(公式) / line(混排) / water / card / gap
  const P = (id, t0, text, o = {}) => Object.assign({ id, k: 'p', t0, text }, o);
  const M = (id, t0, tex, o = {}) => Object.assign({ id, k: 'm', t0, tex }, o);
  const H = (id, t0, text, o = {}) => Object.assign({ id, k: 'h', t0, text }, o);
  const cps = 30;  // 推导部分的流式速度（字/秒）
  O.blocks1 = [
    { id: 'u', k: 'user', t0: T.send + .05, text: O.userMsg },
    { id: 'th', k: 'think', t0: T.think, t1: T.tools - .1 },
    { id: 't1', k: 'tool', t0: T.tools, t1: 53.5, name: 'Deep Research', arg: 'Plan research', out: 'Time reversal · clock records · causal order' },
    { id: 't2', k: 'tool', t0: 53.6, t1: 55.0, name: 'Search', arg: '"time reversal physical clock"' },
    { id: 't3', k: 'tool', t0: 54.05, t1: 55.3, name: 'Search', arg: '"时间反演 洛施密特回波"' },
    { id: 't4', k: 'tool', t0: 54.4, t1: 55.6, name: 'Search', arg: '"Zeitumkehr und Kausalität"' },
    { id: 't5', k: 'tool', t0: 54.68, t1: 55.8, name: 'Search', arg: '"時間反転と時計の記録"' },
    { id: 't6', k: 'tool', t0: 54.9, t1: 56.0, name: 'Search', arg: '"обращение времени"' },
    { id: 't7', k: 'tool', t0: 55.08, t1: 56.1, name: 'Search', arg: '"inversion du temps"' },
    { id: 't8', k: 'tool', t0: 55.22, t1: 56.2, name: 'Search', arg: '"시간 역전 실험"' },
    { id: 'cnt', k: 'count', t0: 55.6, t1: T.close },
    { id: 'g0', k: 'gap', t0: T.rep - .2, h: 6 },
    P('r1', T.rep, '我找到了让粒子沿原路返回的方法。没有找到让发生过的事重新变成「还没发生」的公式。', { cps: 10 }),
    P('r2', 93.2, '但检索结果里，有一份带着明天日期的实验记录。', { cps: 8.4, bold: 1 }),
    P('r3', 98.0, '记录者填的是这台电脑。', { cps: 6.8 }),
    P('r4', 100.8, '我会在 Python 沙盒里复现它。', { cps: 7.1 }),
    { id: 'g1', k: 'gap', t0: T.calc - .1, h: 14 },
    { id: 'py', k: 'tool', t0: 104.55, t1: 105.35, name: 'Data Analysis', arg: 'Python · clock_echo.ipynb', out: 'Sandbox ready · loaded 128 clock samples' },
    H('s0', T.calc + .75, '01 / 对称点'),
    P('s0a', 106.1, '把时间轴折在 t₀。两侧任意一对时刻，到折点的距离相等。', { cps }),
    M('s0m', 107.1, 't_{before} = t_0 - \\tau \\qquad t_{after} = t_0 + \\tau'),
    H('s1', 108.0, '02 / 回波'),
    M('s1m', 108.65, 'X(t_0 + \\tau) = \\Theta X(t_0 - \\tau)'),
    P('s1a', 109.6, 'Θ 反转运动状态。沙盒里的轨迹会重合。', { cps }),
    { id: 's2m', k: 'plot', t0: 110.25, mode: 'echo' },
    P('s1b', 113.5, '粒子回到了原处，但记录仪的时间戳仍在增加。', { cps }),
    H('s3', 114.9, '03 / 检查独立时钟'),
    M('s3m', 115.6, '\\frac{d t_{clock}}{d \\tau} = 1'),
    P('s3b', T.fail, '×　回波复现成功。没有检测到时间倒流。', { cps: 22, red: 1, bold: 1 }),
    H('s4', T.loop, '04 / 记录自带的时钟'),
    P('s4a', 121.45, '我多读到了一列。它没有跟着沙盒时钟走。', { cps: 19 }),
    P('s4b', 123.0, '每写入一帧，那一列就向前少一秒。', { cps }),
    M('s4m', 123.65, 't_{echo}(\\tau) = t_0 - \\tau'),
    P('s4c', 124.45, '来源字段  clock.local  ／  此设备', { cps, bold: 1 }),
    H('s5', 125.4, '05 / 折回零点'),
    M('s5m', 125.8, 'R_{t_0}(t) = 2t_0 - t \\qquad R_{t_0}(R_{t_0}(t)) = t'),
    P('s5a', 126.65, '如果记录也能沿同一条轨迹折回，就能把一帧写进它的过去。', { cps }),
    H('s6', 127.9, '06 / 校对缺失帧'),
    { id: 's6b', k: 'line', t0: 129.0, segs: [{ s: 'Data Analysis　·　' }, { s: '回波拟合 11.7 秒', b: 1 }, { s: '　' }, { s: 'RUN', tag: 1, at: T.start - .1 }] },
    { id: 'w', k: 'water', t0: T.start + .15, t1: T.waterEnd },
    P('v1', 139.05, '✓　两列时钟在同一帧相交', { cps: 60, ok: 1 }),
    P('v2', 139.62, '✓　折点已锁定　03:00:00', { cps: 60, ok: 1 }),
    P('v3', 140.32, '检测到源帧　03:00:00  /  本机  /  第 099 次', { cps: 47, bold: 1 }),
  ];
  O.blocks2 = [
    { id: 'card', k: 'card', t0: T.ask, lines: [[T.ask, '找到一帧可以恢复的记录。', 8.5], [152.2, '来源：这台电脑　／　03:00:00', 10.5], [154.1, '载入这一帧？', 8.5]], btn: 155.4 },
    { id: 'g2', k: 'gap', t0: T.ans - .1, h: 10 },
    H('a0', T.ans, '逆转时间的公式', { big: 1 }),
    P('a1', 163.3, '以凌晨三点为折点，把开始和结束接在一起。', { cps: 9.5, bold: 1 }),
    P('a2', 165.9, '在结束的那一帧，向开始写入一条记录。', { cps: 9.4 }),
    P('a3', 168.45, '写入内容：一条消息，和一个还不存在的模型。', { cps: 9.5 }),
    { id: 'a4', k: 'plot', t0: 171.05, mode: 'mirror' },
    M('am', 174.0, 'R_{t_0}(t) = 2t_0 - t \\qquad t_0 = 03{:}00{:}00', { big: 1 }),
    P('a5', 176.15, '下一次看到我时，你会以为模型列表出了错。', { cps: 9.5, bold: 1 }),
    { id: 'g3', k: 'gap', t0: T.last - .1, h: 26 },
    P('z', 186.3, '先别按回车。你这条消息，已经发过 99 次了。', { cps: 12, last: 1, bold: 1 }),
    { id: 'draft', k: 'draft', t0: 192.0, text: O.userMsg },
  ];

  // 计算瀑布：t 时刻已输出的行数（加速）
  O.waterLines = t => {
    if (t < T.start + .15) return 0;
    const x = Math.min(t, T.waterEnd) - (T.start + .15);
    return Math.floor(6 * x + 8 * (Math.exp(.52 * x) - 1));
  };

  // ---------------- 浏览器窗口 ----------------
  O.browsers = (() => {
    const R = O.rng(47213), out = []; const N = 86;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const t = T.br0 + (T.brLast - .4 - T.br0) * (1 - Math.pow(1 - k, 1.9));
      const cen = Math.pow(k, .8);   // 越往后越靠中间
      const w = 820 + R() * 560, h = 560 + R() * 380;
      let x, y;
      const side = R() < .5 ? -1 : 1;
      const ex = lerp(side < 0 ? -260 + R() * 420 : 2560 - w + 260 - R() * 420, R() * (2560 - w), cen);
      x = ex; y = lerp(R() < .5 ? -60 + R() * 200 : 1392 - h - R() * 160 + 80, 30 + R() * (1360 - h), cen * .9);
      out.push({ i, t, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), page: Math.floor(R() * 14), tabs: 2 + Math.floor(R() * 9), sp: 40 + R() * 160, s0: R() * 600, seed: Math.floor(R() * 1e6) });
    }
    // 最后一个：微距镜头对准的那扇窗
    out.push({ i: N, t: T.brLast, x: 120, y: 250, w: 1240, h: 820, page: 14, tabs: 6, sp: 26, s0: 0, seed: 7, hero: 1 });
    return out;
  })();

  // ---------------- 摄影机 ----------------
  // at: 看向的屏幕点（逻辑像素，或 '#块id' 锚点），d: 距离(米)，yaw/pitch: 机位方位(度)，fov: 水平视角，
  // ft: 对焦点（默认 = at），ap: 光圈虚化倍数，sh: 手持抖动倍数
  O.camKeys = [
    [0, { at: [1280, 700], d: .80, yaw: -5, pitch: 7, roll: -.7, fov: 68, ap: 1, sh: 1 }],
    [6.0, { at: [1250, 672], d: .72, yaw: -5, pitch: 6.6 }],
    [11.6, { at: [1515, 695], d: .40, yaw: 6, pitch: 5, fov: 55, roll: -.4 }, 'io'],
    [13.6, { at: [1530, 815], d: .29, yaw: 16, pitch: 6, fov: 46, ft: [1465, 810] }, 'io'],
    [17.0, { at: [1510, 922], d: .235, yaw: 18, pitch: 5.5 }],
    [20.5, { at: [1450, 1037], d: .137, yaw: 13, pitch: 4, fov: 41 }, 'io'],
    [25.7, { at: [1458, 1039], d: .136, yaw: 12, pitch: 4 }, 'lin'],
    [27.1, { at: [1476, 808], d: .247, yaw: 10, pitch: 4, fov: 46 }, 'io'],
    [28.45, { at: [1499, 810], d: .221, yaw: 9, pitch: 3.5 }],
    [30.8, { at: [1491, 817], d: .235, yaw: 7, pitch: 3 }, 'o2'],
    [32.2, { at: [1300, 650], d: .34, yaw: -3, pitch: 5, fov: 51 }, 'io'],
    [34.6, { at: [1290, 671], d: .32, yaw: -4, pitch: 5 }, 'sine'],
    [38.0, { at: [1360, 683], d: .315, yaw: -2, pitch: 4 }, 'sine'],
    [40.6, { at: [1130, 637], d: .29, yaw: -5, pitch: 4, fov: 48 }, 'io'],
    [47.0, { at: [1174, 638], d: .265, yaw: -4, pitch: 4 }, 'sine'],
    [50.4, { at: [1192, 638], d: .272, yaw: -3, pitch: 4 }, 'sine'],
    [53.3, { at: [1287, 449], d: .52, yaw: -2, pitch: 5, fov: 60 }, 'io'],
    [57.6, { at: [1280, 522], d: .47, yaw: -2, pitch: 5 }],
    // 浏览器爆发：始终拍屏幕本身——先拉远到屏幕刚好占满画面，再在屏幕范围内左右快摇
    [60.2, { at: [1280, 722], d: .435, yaw: -3, pitch: 5, fov: 66, sh: 1.6 }, 'o3'],
    [62.5, { at: [1268, 716], d: .44 }],
    [63.32, { at: [648, 668], d: .215, yaw: -6, pitch: 5, fov: 49 }, 'oBack'],
    [65.10, { at: [659, 676], d: .216, yaw: -6 }],
    [65.97, { at: [1614, 687], d: .228, yaw: 4 }, 'oBack'],
    [67.7, { at: [1615, 695], d: .218, yaw: 4 }],
    [68.85, { at: [1280, 722], d: .435, yaw: -3, fov: 66 }, 'io'],
    [71.0, { at: [1286, 720], d: .44, sh: 1.2 }],
    [72.6, { at: [460, 470], d: .115, yaw: 27, pitch: 6, fov: 40, sh: 1 }, 'io'],
    [77.65, { at: [757, 489], d: .110, yaw: 26, pitch: 5 }, 'lin'],
    [79.8, { at: [792, 505], d: .139, yaw: 23, pitch: 5 }, 'sine'],
    [80.6, { at: [792, 505], d: .141 }],
    [84.2, { at: ['#cnt', 0, 120], d: .36, yaw: -3, pitch: 5, fov: 50 }, 'io'],
    [86.4, { at: ['#r1', 0, 20], d: .29, fov: 46 }, 'io'],
    [104.0, { at: ['#r4', 0, -40], d: .23, yaw: -2, pitch: 4 }, 'sine'],
    [106.5, { at: ['#s0m', -60, 0], d: .25, yaw: -12, pitch: 4, fov: 46, ap: .8 }, 'io'],
    [112.0, { at: ['#s2m', 0, 0], d: .295, yaw: -4, pitch: 4 }, 'sine'],
    [117.0, { at: ['#s3b', 60, 0], d: .23, yaw: 8, pitch: 4 }, 'sine'],
    [120.0, { at: ['#s3b', 40, 0], d: .235, yaw: 8, pitch: 4 }],
    [122.6, { at: ['#s4a', 100, 0], d: .24, yaw: 10, pitch: 4, ap: 1 }, 'io'],
    [126.5, { at: ['#s5m', 60, 0], d: .25, yaw: 12, pitch: 4 }, 'sine'],
    [129.8, { at: ['#s6b', 100, 0], d: .23, yaw: 10, pitch: 4 }, 'sine'],
    [130.4, { at: [1400, 1010], d: .24, yaw: 9, pitch: 4 }, 'sine'],
    [133.0, { at: [1380, 820], d: .30, yaw: 4, pitch: 4 }, 'io'],
    [139.0, { at: [1416, 700], d: .56, yaw: -22, pitch: 6, fov: 58, roll: 1.2, sh: 1.5, ft: [1416, 700] }, 'io'],
    [140.0, { at: ['#v3', 80, 0], d: .42, yaw: -14, pitch: 5, roll: .2, sh: 1.2, ft: null }, 'io'],
    [142.0, { at: ['#v3', 60, -30], d: .43, yaw: -13, pitch: 5 }],
    [145.5, { at: [1290, 720], d: .58, yaw: -3, pitch: 5, fov: 60, roll: -.4, sh: .9 }, 'sine'],
    [150.0, { at: [1300, 720], d: .58, yaw: -3, pitch: 5 }],
    [152.0, { at: ['#card', 120, 70], d: .34, yaw: -3, pitch: 4, fov: 50, sh: 1.6 }, 'io'],
    [161.4, { at: ['#card', 110, 92], d: .31, yaw: -2, pitch: 4 }, 'sine'],
    [166.0, { at: ['#a2', 120, 0], d: .29, yaw: -2, pitch: 4, fov: 46, sh: 1.3 }, 'io'],
    [173.0, { at: ['#a4', 0, 48], d: .28, yaw: -3, pitch: 4 }, 'sine'],
    [175.6, { at: ['#am', 0, -16], d: .255, yaw: -1, pitch: 4 }, 'sine'],
    [179.8, { at: ['#am', 0, 10], d: .215, yaw: -1, pitch: 4 }, 'sine'],
    [183.0, { at: [2432, 1416], d: .195, yaw: 5, pitch: 4, fov: 46, ft: [2432, 1416] }, 'io'],
    [186.6, { at: [2436, 1416], d: .176, yaw: 5, pitch: 4, sh: 1.5 }],
    [189.4, { at: ['#z', 30, 0], d: .23, yaw: -2, pitch: 5, fov: 46, sh: 2.1 }, 'io'],
    [191.45, { at: ['#z', 30, 12], d: .265, yaw: -2, pitch: 5 }],
    [194.4, { at: ['#draft', 0, -28], d: .29, yaw: -3, pitch: 5, sh: 2.1 }],
    [196.2, { at: [1290, 720], d: .56, yaw: -3, pitch: 5, fov: 60, sh: 2.4 }, 'io'],
    [O.DUR, { at: [1290, 720], d: .56 }],
  ];
  // 对焦滞后 / 拉风箱：[开始, 时长, 幅度(相对距离)]
  O.afEvents = [[3.3, 1.0, .35], [6.4, .9, .12], [11.8, .7, .08], [21.2, .8, .1], [60.4, .7, .07], [63.28, .5, .04], [66.02, .5, .04], [68.8, .5, .04], [72.9, .8, .15],
    [84.4, .8, .1], [106.8, .6, .08], [131.6, 1.2, .5], [140.2, .7, .2], [152.2, .6, .1], [183.2, .8, .16], [189.6, 1.0, .3], [196.4, .9, .2]];
  O.afBias = t => {           // 系统性失焦（暗处对不上焦、瀑布时故意失焦）
    if (t < T.wake + .3) return .55;
    if (t > 133.5 && t < 139.0) return .6 * sstep(133.5, 136.5, t);
    if (t >= 139.0 && t < 139.6) return .6 * (1 - sstep(139.0, 139.6, t));
    if (t >= T.black && t < T.back) return .15 * sstep(143, 146, t);
    if (t >= T.sleep) return .25 * sstep(T.sleep + .5, T.sleep + 2.5, t);
    return 0;
  };
  // 场景测光（相机自动曝光的输入，线性亮度）
  O.meterKeys = [
    [0, .00025], [T.wake, .00025], [T.wake + .05, .002], [T.desk, .02], [11.5, .022], [13.8, .024], [20.8, .02], [26.0, .021],
    [32.5, .02], [35.0, .018], [40.0, .022], [52.6, .02], [57.5, .022], [60.5, .25], [64, .4], [67, .5], [70, .55], [72.5, .58], [79.9, .58],
    [80.0, .02], [104, .022], [106, .024], [129, .025], [133, .05], [138.9, .09], [139.2, .03], [141.9, .03],
    [142.0, 1.0], [142.067, 1.0], [142.1, .0004], [143.0, .00022], [149.9, .00022], [150.0, .02], [182.5, .022], [183.2, .03], [187, .03], [189.6, .021], [195.4, .021], [195.8, .00018], [O.DUR, .00018]];
  const logarithmicMeter = O.meterKeys.map(([t, value]) => [t, Math.log(value), 'lin']);
  O.meter = t => Math.exp(O.track(logarithmicMeter, t));

  // 摩尔纹强度：全片统一用减弱后的设置（彩色摩尔纹很少，文字更突出）
  O.moire = t => ({ fw: 2.8, sub: .45 });

  // ---------------- 信号恢复后的系统故障：150s 屏幕重新亮起 → 用户点「开始」的那一刻恢复正常 ----------------
  O.garble = t => t >= T.back && t < T.click;
  O.heartAt = t => { let b = 1e9; for (let k = 150.6; k < T.click; k += .94) b = Math.min(b, Math.abs(t - k)); return b; };
  O.glitchAmt = t => {
    if (t < T.back || t >= T.click) return 0; const x = t - T.back;
    if (x < 1.6) return 1; if (x < 5.4) return lerp(1, .32, (x - 1.6) / 3.8);
    return .05 + .3 * Math.exp(-Math.pow(O.heartAt(t) / .07, 2));      // 犹豫时：故障跟着心跳轻轻地闪
  };
  O.glitchEvents = (() => {
    const ev = [];
    for (let f = Math.floor(T.back * 30); f < Math.floor(T.click * 30); f++) {
      const t = f / 30, a = O.glitchAmt(t); if (O.hash(f, 101) >= a * .2) continue;
      const r = O.hash(f, 102), type = r < .45 ? 0 : r < .7 ? 2 : r < .94 ? 1 : 3;   // 撕裂为主，色块少量，闪黑偶尔
      ev.push({ t, f, type, s: .25 + .6 * O.hash(f, 103) * Math.min(1, a + .2) });
    }
    return ev;
  })();
  O.glitchAt = t => { const f = Math.floor(t * 30 + 1e-6); return O.glitchEvents.find(e => e.f === f) || null; };
})();
