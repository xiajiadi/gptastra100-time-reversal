'use strict';

// Load after story.js and before the camera reads its keys. All cues are in logical seconds.
(() => {
  const { T } = O;
  const originalCamera = O.camKeys;
  const [card, gap] = O.blocks2;
  const draft = O.blocks2.find(b => b.id === 'draft');
  const p = (id, t0, text, opts = {}) => ({ id, k: 'p', t0, text, ...opts });
  const h = (id, t0, text, opts = {}) => ({ id, k: 'h', t0, text, ...opts });
  const m = (id, t0, tex, opts = {}) => ({ id, k: 'm', t0, tex, ...opts });
  const plot = (id, t0, mode) => ({ id, k: 'plot', t0, mode });
  const tex = String.raw;

  O.blocks1 = [
    ...O.blocks1.filter(b => b.t0 < T.rep),
    p('r1', T.rep, '我找到了粒子的回程。现在要查的是，记录这件事的人，会不会一起回去。', { cps: 13 }),
    p('r2', 93.2, '等等。FC-03 的原始回执，盖的是明天的日期。', { cps: 12, bold: 1 }),
    p('r3', 98.0, '来源是这台电脑。写入方是空的。', { cps: 12 }),
    p('r4', 100.8, '回执有校验值。我先在沙盒重做实验。', { cps: 15 }),
    { id: 'g1', k: 'gap', t0: 104.38, h: 14 },
    { id: 'py', k: 'tool', t0: 104.55, t1: 105.35, name: 'Data Analysis', arg: 'Python · clock_echo.ipynb', out: 'FC-03 · 128 samples · independent clock' },
    h('s0', T.calc + .75, '01　受扰动的量子回波'),
    p('s0a', 106.15, '演化 τ 秒，翻转哈密顿量，再演化 τ 秒。', { cps: 26 }),
    m('s0m', 107.25, tex`U_{\pm}(\tau)=\exp[-iH_{\pm}\tau/\hbar]\qquad H_+=H,\; H_-=-H+\epsilon V`),
    h('s1', 108.25, '测原态的回返概率'),
    m('s1m', 108.75, tex`\mathcal{L}(\tau)=|\langle\psi_0|U_-(\tau)U_+(\tau)|\psi_0\rangle|^2`),
    p('s1a', 109.48, '误差越大，回返峰越低。', { cps: 25 }),
    plot('s2m', 110.25, 'echo'),
    p('s1b', 113.5, '粒子已经回去了。仪器却多留了一条记录。', { cps: 21 }),
    h('s3', 114.9, '独立时钟仍向前'),
    m('s3m', 115.45, tex`\mathcal{L}(\tau)\approx 1\quad\wedge\quad \Delta N_{R}>0\qquad N_R\text{：独立记录仪计数}`),
    p('s3b', T.fail, '×　中止。忘了把观察者算进去。', { cps: 19, red: 1, bold: 1 }),
    h('s4', T.loop, '02　缺失的自由度'),
    p('s4a', 121.36, 'S 是可见系统，R 是被丢掉的记录仪。', { cps: 26 }),
    p('s4b', 122.27, '读数投影成 y 时，记录仪的状态被迹掉了。', { cps: 32 }),
    m('s4m', 123.18, tex`\rho_S=\Tr_R(U\rho_{SR}U^\dagger)\qquad y=Ax+\eta\qquad A=U_A\Sigma V_A^\dagger`),
    p('s4c', 124.05, '最小奇异值贴近零。一点噪声就能换掉整段过去。', { cps: 31, bold: 1 }),
    h('s5', 125.05, '逆通道的病态谱'),
    m('s5m', 125.58, tex`x_\lambda=\sum_j\frac{\sigma_j}{\sigma_j^2+\lambda}\langle u_j,y\rangle v_j\qquad \kappa(A)=\frac{\sigma_1}{\sigma_r}\gg1`),
    plot('spectrum', 126.18, 'spectrum'),
    p('s5a', 127.15, '同一帧能接在不同的历史之后。', { cps: 25 }),
    h('s6', 128.08, '03　保留歧义，校验整段因果链'),
    { id: 's6b', k: 'line', t0: 129.0, segs: [
      { s: 'Python　·　' },
      { s: '99 个候选前缀 / FC-03', b: 1 },
      { s: '　' },
      { s: 'RUN', tag: 1, at: T.start - .1 },
    ] },
    { id: 'w', k: 'water', t0: T.start + .15, t1: T.waterEnd },
    p('v1', 139.05, '×　98 条分支与独立回执冲突', { cps: 60, red: 1 }),
    p('v2', 139.62, '✓　唯一闭合点　03:00:00', { cps: 60, ok: 1 }),
    p('v3', 140.32, '剩余 1 条　／　本机　／　#099', { cps: 44, bold: 1 }),
  ];

  O.blocks2 = [
    { ...card, lines: [
      [T.ask, '只剩一个可恢复的开场。', 8.5],
      [152.2, '来源：本机　／　03:00:00', 10.5],
      [154.1, '载入这一帧？', 8.5],
    ] },
    gap,
    h('a0', T.ans, '逆转时间的公式', { big: 1 }),
    p('a1', 163.3, '把时钟、模型列表和你的按键都纳入状态 X。', { cps: 14, bold: 1 }),
    p('a2', 165.08, 'F 把终态存回开场。回执封存了外部账本的末项。', { cps: 20 }),
    m('loop-map', 166.44, tex`F_\lambda=\Pi_0\circ\mathcal{M}_\lambda\circ(\mathcal{L}_m\circ⋯\circ\mathcal{L}_1)`),
    p('a3', 168.45, '把光锥、独立时钟和回执都当成边界条件。', { cps: 15 }),
    plot('a4', 171.05, 'causal'),
    m('am-prior', 173.34, tex`P(\Gamma|\mathcal{D})=\frac{1}{Z}\int_{\partial\Gamma}\mathcal{D}g\,\mathcal{D}\phi\;\delta[\mathcal{C}(g,\phi,R)]\exp[-\mathcal{S}_E[g,\phi]/\hbar-\chi^2(\Gamma)/2]`, { big: 1 }),
    m('am-loss', 175.02, tex`(X_*,n_*)=\arg\min_{X,\;1\le n\le99}\sum_{e\in\Gamma}\frac{\lVert D_e(X,n)-y_e\rVert^2}{\sigma_e^2}`, { big: 1 }),
    m('am', 176.2, tex`X_* = F_\lambda(X_*)\qquad H_n=\mathcal{H}(H_{n-1}\lVert q_n)\qquad H_{n_*}=H_{FC03}`, { big: 1 }),
    p('a5', 178.65, '找到写入方了。是你刚刚点的「载入」。', { cps: 13, bold: 1 }),
    { id: 'g3', k: 'gap', t0: T.last - .1, h: 26 },
    p('a6', 185.0, '每次载入，都把我的模型入口和你的草稿写回开场。', { cps: 15 }),
    p('z', 187.1, '账本没倒退。你这条消息，已经发过 99 次了。', { cps: 15, last: 1, bold: 1 }),
    p('a7', 190.0, '先别按回车。第 100 次还没发。', { cps: 15, last: 1 }),
    { ...draft, text: O.userMsg },
  ];

  O.camKeys = [
    ...originalCamera.filter(([t]) => t <= 84.2),
    [86.65, { at: ['#r1', 0, 4], d: .31, fov: 49 }, 'io'],
    [94.6, { at: ['#r2', 15, -8], d: .28, yaw: -5, pitch: 4.5 }, 'sine'],
    [102.8, { at: ['#r4', 76, -50], d: .29, yaw: -2, pitch: 4 }, 'sine'],
    [107.85, { at: ['#s0m', -10, 22], d: .33, yaw: -8, pitch: 4, fov: 49, ap: .8 }, 'io'],
    [111.05, { at: ['#s2m', 0, -42], d: .35, yaw: -3, pitch: 4 }, 'io'],
    [113.3, { at: ['#s2m', 0, 10], d: .34, yaw: -2, pitch: 4 }],
    [117.35, { at: ['#s3b', 40, -55], d: .29, yaw: 6, pitch: 4 }, 'sine'],
    [120.45, { at: ['#s3b', 48, -24], d: .27, yaw: 7, pitch: 4 }],
    [123.75, { at: ['#s4m', -24, -36], d: .34, yaw: 7, pitch: 4, ap: 1 }, 'io'],
    [126.9, { at: ['#spectrum', 0, -104], d: .36, yaw: 4, pitch: 4 }, 'sine'],
    [128.42, { at: ['#spectrum', 0, 24], d: .34, yaw: 3, pitch: 4 }, 'sine'],
    [129.95, { at: ['#s6b', 80, -24], d: .35, yaw: 7, pitch: 4 }, 'sine'],
    [130.4, { at: [1030, 1020], d: .27, yaw: 9, pitch: 4 }, 'sine'],
    [133.0, { at: [1050, 812], d: .35, yaw: 4, pitch: 4 }, 'io'],
    ...originalCamera.filter(([t]) => t >= 139.0 && t <= 150.0),
    [152.0, { at: ['#card', -245, 55], d: .34, yaw: -3, pitch: 4, fov: 50, sh: 1.6 }, 'io'],
    [161.4, { at: ['#card', -265, 58], d: .32, yaw: -2, pitch: 4 }, 'sine'],
    [166.9, { at: ['#loop-map', 0, -55], d: .35, yaw: -3, pitch: 4, fov: 47, sh: 1.2 }, 'io'],
    [172.05, { at: ['#a4', 0, -14], d: .37, yaw: -2, pitch: 4 }, 'io'],
    [174.8, { at: ['#am-prior', 0, 12], d: .43, yaw: -1, pitch: 4 }, 'sine'],
    [178.55, { at: ['#am', 0, -60], d: .405, yaw: -1, pitch: 4 }, 'sine'],
    [180.62, { at: ['#am', 0, 19], d: .33, yaw: 0, pitch: 4 }, 'sine'],
    ...originalCamera.filter(([t]) => t >= 183.0 && t <= 186.6),
    [189.26, { at: ['#z', 18, -16], d: .28, yaw: -2, pitch: 5, fov: 48, sh: 1.6 }, 'io'],
    [191.55, { at: ['#z', 58, 16], d: .29, yaw: -2, pitch: 5 }],
    ...originalCamera.filter(([t]) => t >= 194.4),
  ];
})();
