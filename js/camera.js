'use strict';
// ============================================================================
//  camera.js —— 虚拟手机摄像头（WebGL2）
//    场景：光线求交（显示器/子像素/边框/支架/桌面/键盘/鼠标/杯子/墙）+ 屏幕反射里的房间与拿手机的人
//    后期：景深（半分辨率聚集）→ 运动模糊 → 辉光 → 曝光/色差/暗角/锐化/色调映射/噪点
// ============================================================================
(() => {
  const T = O.T;
  const SWm = .5975, SHm = .3361, SCY = .30;   // 27" 16:9 屏幕（米）
  O.scrToWorld = p => [(p[0] / O.LW - .5) * SWm, SCY + (.5 - p[1] / O.LH) * SHm, 0];
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, len: a => Math.hypot(a[0], a[1], a[2]),
  };
  const rot = (v, axis, ang) => { const c = Math.cos(ang), s = Math.sin(ang), d = v3.dot(axis, v), cr = v3.cross(axis, v); return [v[0] * c + cr[0] * s + axis[0] * d * (1 - c), v[1] * c + cr[1] * s + axis[1] * d * (1 - c), v[2] * c + cr[2] * s + axis[2] * d * (1 - c)]; };

  // ---------------- 机位：关键帧 + 手持 ----------------
  let K = null;
  function keys() {
    if (K) return K; K = []; let prev = {};
    for (const [t, p, e] of O.camKeys) { const full = Object.assign({}, prev, p); full.ft = ('ft' in p) ? p.ft : null; K.push({ t, p: full, e: e || 'sine' }); prev = full; }
    return K;
  }
  // 锚点跟随：对过去 ~1.2 秒做指数加权平均，模拟摄影者"跟着文字走"的迟滞，避免内容跳动导致机位跳变
  const resolve = (at, t) => {
    if (typeof at[0] !== 'string') return at;
    let x = 0, y = 0, ws = 0;
    for (let k = 1; k <= 20; k++) { const w = k * Math.exp(-k / 4), a = O.anchor(at[0].slice(1), t - k * .06); x += a[0] * w; y += a[1] * w; ws += w; }
    return [x / ws + (at[1] || 0), y / ws + (at[2] || 0)];
  };
  function params(t) {
    const k = keys(); let i = 1; while (i < k.length - 1 && t > k[i].t) i++;
    const A = k[i - 1], B = k[i], u = t <= A.t ? 0 : t >= B.t ? 1 : E[B.e](inv(A.t, B.t, t));
    const L = (a, b) => lerp(a, b, u);
    const atA = resolve(A.p.at, t), atB = resolve(B.p.at, t);
    const ftA = A.p.ft ? resolve(A.p.ft, t) : atA, ftB = B.p.ft ? resolve(B.p.ft, t) : atB;
    return { at: [L(atA[0], atB[0]), L(atA[1], atB[1])], ft: [L(ftA[0], ftB[0]), L(ftA[1], ftB[1])], d: L(A.p.d, B.p.d), yaw: L(A.p.yaw, B.p.yaw), pitch: L(A.p.pitch, B.p.pitch), roll: L(A.p.roll || 0, B.p.roll || 0), fov: L(A.p.fov, B.p.fov), ap: L(A.p.ap || 1, B.p.ap || 1), sh: L(A.p.sh || 1, B.p.sh || 1) };
  }
  O.afErr = t => { let e = 0; for (const [t0, d, a] of O.afEvents) { if (t < t0 || t > t0 + d) continue; const k = clamp((t - t0) / d); e += a * Math.sin(k * Math.PI * 2.6) * Math.pow(1 - k, 1.6); } return e + O.afBias(t); };
  function pose(t) {
    const p = params(t), D = Math.PI / 180;
    const tgt = O.scrToWorld(p.at);
    const sh = p.sh, dg = D * sh;
    const yaw = p.yaw * D + (O.fbm(t * .32, 1, 3) * .45 + O.fbm(t * 6.5, 2, 2) * .05) * dg;
    const pitch = p.pitch * D + (O.fbm(t * .27, 3, 3) * .32 + O.fbm(t * 5.8, 4, 2) * .05 + Math.sin(t * 1.7) * .08) * dg;
    let C = v3.add(tgt, v3.mul([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], p.d));
    C = v3.add(C, [O.fbm(t * .4, 5) * .003 * sh, O.fbm(t * .37, 6) * .003 * sh, O.fbm(t * .3, 7) * .004 * sh]);
    let F = v3.norm(v3.sub(tgt, C));
    // 视线的手持抖动（转动）
    const up0 = [0, 1, 0]; let R = v3.norm(v3.cross(F, up0)), U = v3.cross(R, F);
    const ry = (O.fbm(t * .5, 8, 3) * .5 + O.fbm(t * 7.3, 9, 2) * .06) * dg, rp = (O.fbm(t * .45, 10, 3) * .45 + O.fbm(t * 6.9, 11, 2) * .06) * dg;
    F = v3.norm(rot(rot(F, U, ry), R, rp)); R = v3.norm(v3.cross(F, up0)); U = v3.cross(R, F);
    const roll = (p.roll + O.fbm(t * .35, 12, 2) * .6 * sh) * D; R = rot(R, F, roll); U = rot(U, F, roll);
    const fo = O.scrToWorld(p.ft), fd = Math.max(.02, v3.dot(v3.sub(fo, C), F)) * (1 + O.afErr(t));
    const tanH = Math.tan(p.fov * D / 2) * (1 + .012 * O.afErr(t));
    return { C, R, U, F, tanH, focus: Math.max(.03, fd), ap: p.ap, fov: p.fov };
  }
  O.pose = pose;
  // 自动曝光（滞后的测光）
  O.exposure = t => {
    let m = O.meter(t - 4); const dt = 1 / 60;
    for (let s = t - 4; s <= t; s += dt) { const x = O.meter(s), tc = x > m ? .22 : .5; m += (x - m) * (1 - Math.exp(-dt / tc)); }
    // 暗场按平均测光；亮场（满屏白网页）偏向保高光，白色不会被压成灰
    return clamp(.065 / m * (m > .05 ? Math.pow(m / .05, .35) : 1), .2, 90);
  };

  // ---------------- WebGL ----------------
  let gl, W, H, progs = {}, fb = {}, tex = {}, vao, frameNo = 0;
  const VS = `#version 300 es
  out vec2 vUv; void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;
  const COMMON = `#version 300 es
  precision highp float; precision highp sampler2D; in vec2 vUv;
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
  `;
  const FS_SCENE = COMMON + `
  layout(location=0) out vec4 oCol; layout(location=1) out vec4 oVel;
  uniform vec2 uRes; uniform vec3 uC0,uR0,uU0,uF0,uC1,uR1,uU1,uF1,uCp,uRp,uUp,uFp; uniform float uTanH,uTanHp,uAsp,uK1;
  uniform sampler2D uTex; uniform vec4 uScr; uniform float uBack,uBlack,uGlow,uBand,uTime,uRefl,uWin,uDoor,uHaze,uSub,uLit,uFw;
  uniform sampler2D uRefImg; uniform float uRefOn, uRefGain; uniform vec2 uRefShift;   // 黑屏倒影照片（可选）
  const float BZ = 0.0085, BB = 0.021;
  float boxPulse(float x, float a, float w, float f){ float x0 = x - f*.5, x1 = x + f*.5; float i0 = floor(x0)*w + clamp(fract(x0)-a, 0.0, w); float i1 = floor(x1)*w + clamp(fract(x1)-a, 0.0, w); return (i1-i0)/f; }
  vec2 boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out vec3 n){
    vec3 iv = 1.0/rd; vec3 t0 = (bmin-ro)*iv, t1 = (bmax-ro)*iv; vec3 tn3 = min(t0,t1), tf3 = max(t0,t1);
    float tn = max(max(tn3.x,tn3.y),tn3.z), tf = min(min(tf3.x,tf3.y),tf3.z);
    if (tn > tf || tn < 0.0) return vec2(1e9);
    n = -sign(rd) * step(tn3.yzx, tn3.xyz) * step(tn3.zxy, tn3.xyz); return vec2(tn, tf);
  }
  float sphSoft(vec3 P, vec3 R, vec3 Q, float r, float rough){ float t = max(dot(Q-P, R), 0.0); float d = length(Q - (P + R*t)); float s = rough*t + .006; return t > 0.0 ? 1.0 - smoothstep(r - s, r + s, d) : 0.0; }
  float capSoft(vec3 P, vec3 R, vec3 A, vec3 B, float r, float rough){ float m = 0.0; for (int i=0;i<5;i++){ m = max(m, sphSoft(P,R,mix(A,B,float(i)/4.0), r, rough)); } return m; }
  float softBox(vec2 p, vec2 lo, vec2 hi, float s){ vec2 a = smoothstep(lo - s, lo + s, p) * (1.0 - smoothstep(hi - s, hi + s, p)); return a.x*a.y; }
  // 背后的房间（窗、门缝、墙）+ 拿手机的人
  vec3 room(vec3 P, vec3 R, float rough, float lit){
    vec3 col = vec3(0.0006, 0.0007, 0.0009);
    if (R.z > 0.02) {
      float zw = 2.1; float tw = (zw - P.z)/R.z; vec3 Q = P + R*tw; float s = rough*tw + .01;
      float win = softBox(Q.xy, vec2(-0.6, 0.3), vec2(0.42, 1.5), s);
      float cur = 1.0 - 0.8*softBox(Q.xy, vec2(-0.6,-1.0), vec2(-0.42, 3.0), s) - 0.6*softBox(Q.xy, vec2(0.28,-1.0), vec2(0.42,3.0), s);
      float bars = 1.0 - 0.8*softBox(Q.xy, vec2(-0.08, 0.0), vec2(-0.04, 2.0), s*.6) - 0.8*softBox(Q.xy, vec2(-1.0,0.9), vec2(1.0,0.94), s*.6);
      float sky = 0.7 + 0.5*clamp((Q.y - 0.4)/1.1, 0.0, 1.0);
      col += vec3(0.011, 0.014, 0.022) * uWin * win * cur * bars * sky;
      float dw = max(0.012, s*1.6); float door = softBox(Q.xy, vec2(1.06-.004, -0.75), vec2(1.06+.004, 1.25), dw) * (0.008/(0.008 + 2.0*s));
      col += vec3(0.11, 0.07, 0.035) * uDoor * door;
      col += vec3(0.0012,0.0013,0.0016) * uWin * exp(-length(Q.xy - vec2(-0.25, 0.7))*1.4);
    }
    // 人（以相机为参照）：头、颈、肩、躯干、上臂、前臂、手
    vec3 bk = normalize(vec3(uC0.x*0.15, 0.0, 1.0)), up = vec3(0,1,0), rt = normalize(cross(up, bk));
    vec3 C = uC0;
    float occ = 0.0;
    vec3 sh = C + up*-0.16 + bk*0.36;
    occ = max(occ, sphSoft(P,R, C + up*0.075 + bk*0.31, 0.088, rough));
    occ = max(occ, sphSoft(P,R, C + up*0.02 + bk*0.30, 0.082, rough));
    occ = max(occ, capSoft(P,R, C + up*-0.04 + bk*0.33, sh, 0.05, rough));
    occ = max(occ, capSoft(P,R, sh - rt*0.17, sh + rt*0.17, 0.065, rough));
    occ = max(occ, capSoft(P,R, sh + up*-0.06, sh + up*-0.55 + bk*0.03, 0.17, rough));
    for (int k = 0; k < 2; k++) { float sg = k == 0 ? 1.0 : -1.0; vec3 s0 = sh + rt*0.18*sg, el = C + rt*0.21*sg + up*-0.30 + bk*0.17, ha = C + rt*0.085*sg + up*-0.035 + bk*0.03;
      occ = max(occ, capSoft(P,R, s0, el, 0.048, rough)); occ = max(occ, capSoft(P,R, el, ha, 0.04, rough)); occ = max(occ, sphSoft(P,R, ha, 0.038, rough)); }
    // 手机（横持）：以相机镜头为中心偏移
    float tp = dot(C - P, uF0)/dot(R, uF0);
    if (tp > 0.0) { vec3 Hh = P + R*tp - (C + uR0*0.05 - uU0*0.012); vec2 lp = vec2(dot(Hh, uR0), dot(Hh, uU0)); occ = max(occ, softBox(lp, vec2(-0.08,-0.037), vec2(0.08, 0.037), rough*tp + .003)); }
    vec3 person = vec3(0.0004, 0.00045, 0.0005) + lit * vec3(0.05, 0.045, 0.04);
    return mix(col, person, clamp(occ, 0.0, 1.0));
  }
  vec3 screenIrr(vec3 P, vec3 N){
    vec3 E = vec3(0.0);
    for (int i=0;i<4;i++) for (int j=0;j<3;j++){
      vec2 uv = vec2((float(i)+.5)/4.0, (float(j)+.5)/3.0);
      vec3 S = vec3(uScr.x + (uv.x*2.0-1.0)*uScr.z, uScr.y + (1.0-uv.y*2.0)*uScr.w, 0.0);
      vec3 L = textureLod(uTex, uv, 9.0).rgb;
      vec3 d = S - P; float r2 = max(dot(d,d), .0016); d *= inversesqrt(r2);
      E += L * pow(max(0.0, -d.z), 1.5) * max(0.0, dot(N, d)) / r2;
    }
    return E * (4.0*uScr.z*uScr.w/12.0) * uBack;
  }
  vec3 screenGloss(vec3 P, vec3 R, float lod){
    if (R.z > -0.01) return vec3(0.0);
    float t = -P.z / R.z; vec3 Q = P + R*t; vec2 uv = vec2((Q.x - uScr.x)/uScr.z*.5+.5, .5 - (Q.y - uScr.y)/uScr.w*.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
    return textureLod(uTex, uv, lod).rgb * uBack;
  }
  void main(){
    vec2 ndc = vUv*2.0 - 1.0; float row = 1.0 - vUv.y;
    vec2 q = vec2(ndc.x, ndc.y/uAsp); float r2 = dot(q,q); q *= 1.0 + uK1*r2;
    vec3 ro = mix(uC0, uC1, row), R = normalize(mix(uR0,uR1,row)), U = normalize(mix(uU0,uU1,row)), F = normalize(mix(uF0,uF1,row));
    vec3 rd = normalize(F + R*q.x*uTanH + U*q.y*uTanH);
    // ---- 屏幕平面（统一控制流里求导）----
    float ts = -ro.z/rd.z; vec3 Ps = ro + rd*ts;
    vec2 suv = vec2((Ps.x - uScr.x)/uScr.z*.5+.5, .5 - (Ps.y - uScr.y)/uScr.w*.5);
    vec2 s = suv * vec2(3840.0, 2160.0);
    vec2 fw = fwidth(s) * uFw + 1e-4;
    vec3 cF = textureGrad(uTex, suv, dFdx(suv), dFdy(suv)).rgb;
    vec3 cN = texelFetch(uTex, ivec2(clamp(floor(s), vec2(0.0), vec2(3839.0, 2159.0))), 0).rgb;
    // ---- 求交 ----
    float tBest = 1e9; int id = 0; vec3 nB = vec3(0); vec3 n;
    vec3 mn = vec3(uScr.x - uScr.z - BZ, uScr.y - uScr.w - BB, -0.035), mx = vec3(uScr.x + uScr.z + BZ, uScr.y + uScr.w + BZ, 0.0);
    vec2 h = boxHit(ro, rd, mn, mx, n); if (h.x < tBest) { tBest = h.x; id = n.z > .5 ? 1 : 2; nB = n; }
    h = boxHit(ro, rd, vec3(-0.035, 0.0, -0.115), vec3(0.035, mn.y, -0.07), n); if (h.x < tBest) { tBest = h.x; id = 3; nB = n; }
    h = boxHit(ro, rd, vec3(-0.13, 0.0, -0.2), vec3(0.13, 0.009, 0.02), n); if (h.x < tBest) { tBest = h.x; id = 3; nB = n; }
    h = boxHit(ro, rd, vec3(-0.24, 0.0, 0.215), vec3(0.2, 0.024, 0.36), n); if (h.x < tBest) { tBest = h.x; id = 5; nB = n; }
    { vec3 c = vec3(0.33, 0.014, 0.30), rr = vec3(0.032, 0.02, 0.058); vec3 o = (ro - c)/rr, d = rd/rr; float a = dot(d,d), b = dot(o,d), cc = dot(o,o)-1.0, dd = b*b - a*cc;
      if (dd > 0.0) { float t = (-b - sqrt(dd))/a; if (t > 0.0 && t < tBest) { tBest = t; id = 6; nB = normalize((ro + rd*t - c)/(rr*rr)); } } }
    { vec2 c = vec2(-0.43, 0.06); vec2 o = ro.xz - c; vec2 d = rd.xz; float a = dot(d,d), b = dot(o,d), cc = dot(o,o) - 0.042*0.042, dd = b*b - a*cc;
      if (dd > 0.0) { float t = (-b - sqrt(dd))/a; float y = ro.y + rd.y*t; if (t > 0.0 && t < tBest && y > 0.0 && y < 0.098) { tBest = t; id = 7; nB = normalize(vec3(ro.x + rd.x*t - c.x, 0.0, ro.z + rd.z*t - c.y)); }
        float tt = (0.098 - ro.y)/rd.y; vec2 pp = ro.xz + rd.xz*tt - c; if (tt > 0.0 && tt < tBest && dot(pp,pp) < 0.042*0.042) { tBest = tt; id = 8; nB = vec3(0,1,0); } } }
    { float t = -ro.y/rd.y; vec3 p = ro + rd*t; if (t > 0.0 && t < tBest && p.z < 0.78 && p.z > -0.5 && abs(p.x) < 1.1) { tBest = t; id = 4; nB = vec3(0,1,0); } }
    { float t = (-0.5 - ro.z)/rd.z; vec3 p = ro + rd*t; if (t > 0.0 && t < tBest && p.y > 0.0) { tBest = t; id = 9; nB = vec3(0,0,1); } }
    vec3 P = ro + rd*tBest; vec3 col = vec3(0.0);
    float scrLit = dot(textureLod(uTex, vec2(.5), 11.0).rgb, vec3(.3,.5,.2)) * uBack;
    if (id == 1) {
      vec2 uvp = vec2((P.x - uScr.x)/uScr.z*.5+.5, .5 - (P.y - uScr.y)/uScr.w*.5);
      bool inScr = uvp.x > 0.0 && uvp.x < 1.0 && uvp.y > 0.0 && uvp.y < 1.0;
      vec3 Rr = reflect(rd, vec3(0,0,1));
      if (inScr) {
        vec3 c = mix(cN, cF, smoothstep(.55, 1.4, max(fw.x, fw.y)));
        float my = boxPulse(s.y, .06, .88, fw.y)/.88;
        vec3 m = vec3(boxPulse(s.x, .025, .29, fw.x), boxPulse(s.x, .358, .29, fw.x), boxPulse(s.x, .691, .29, fw.x))/.29;
        m = mix(vec3(1.0), m * my, uSub);
        float cosV = clamp(-rd.z, 0.0, 1.0);
        float ang = mix(.62, 1.0, pow(cosV, .9));
        float band = 1.0 + uBand*sin(6.2832*(uvp.y*1.3 + uTime*.37));
        float edge = min(min(uvp.x, 1.0-uvp.x)*1.78, min(uvp.y, 1.0-uvp.y));
        float bleed = .9*exp(-edge*22.0) + .45*vnoise(uvp*vec2(5.0, 3.0)) + .25*vnoise(uvp*vec2(13.0,7.0)+3.1);
        vec3 blackL = uBlack * (1.0 + bleed) * vec3(.88, .95, 1.12);
        vec3 glow = uGlow * pow(1.0 - cosV, 1.25) * vec3(1.0, .9, 1.06) * (1.0 + .5*bleed);
        vec3 haze = uHaze * textureLod(uTex, uvp, 6.0).rgb;
        col = (c * m * ang * band + blackL + glow + haze) * uBack;
        float fres = .028 + .3*pow(1.0 - cosV, 5.0);
        if (uRefOn > 0.5) {
          vec3 ri = textureLod(uRefImg, clamp(uvp - uRefShift, 0.001, 0.999), 1.5).rgb;
          col += ri * uRefGain * (1.0 + 6.0*pow(1.0 - cosV, 5.0));
        } else col += room(P, Rr, .11, scrLit) * fres * uRefl;
      } else {
        float d2s = max(max(abs(P.x - uScr.x) - uScr.z, abs(P.y - uScr.y) - uScr.w), 0.0);
        vec3 bez = vec3(.003) * scrLit + room(P, Rr, .25, scrLit) * .012 * uRefl;
        bez += textureLod(uTex, clamp(uvp, 0.0, 1.0), 5.0).rgb * uBack * .022 * exp(-d2s/.0012);
        col = bez;
      }
    } else if (id == 2 || id == 3) {
      col = vec3(.018) * screenIrr(P + nB*.001, nB) / 3.1416 + vec3(.0002) * scrLit;
      col += screenGloss(P, reflect(rd, nB), 7.0) * .012;
    } else if (id == 4) {
      float g = .55 + .45*vnoise(vec2(P.x*9.0, P.z*130.0)) * vnoise(vec2(P.x*40.0, P.z*900.0)+2.0);
      vec3 alb = vec3(.15, .10, .065) * g;
      col = alb * screenIrr(P, nB) / 3.1416;
      vec3 Rr = reflect(rd, nB); float fr = .03 + .5*pow(1.0 - max(-rd.y, 0.0), 5.0);
      col += screenGloss(P, Rr, 7.5) * fr * .5;
    } else if (id == 5) {
      vec3 lp = P - vec3(-0.24, 0.0, 0.215); float topf = step(.5, nB.y);
      vec2 kg = vec2(lp.x/0.0195, lp.z/0.0205); vec2 kf = fract(kg);
      float key = topf * step(.08, kf.x) * step(kf.x, .92) * step(.08, kf.y) * step(kf.y, .92) * step(0.3, lp.z/0.0205) ;
      vec3 alb = mix(vec3(.012), vec3(.045), key);
      col = alb * screenIrr(P + nB*.002, nB) / 3.1416 + screenGloss(P, reflect(rd, nB), 7.0) * .02 * key;
    } else if (id == 6) {
      col = vec3(.03) * screenIrr(P, nB) / 3.1416 + screenGloss(P, reflect(rd, nB), 6.0) * .05;
    } else if (id == 7 || id == 8) {
      col = vec3(.6, .58, .55) * screenIrr(P + nB*.002, nB) / 3.1416 + screenGloss(P, reflect(rd, nB), 6.5) * .04;
      if (id == 8) col *= .3;
    } else if (id == 9) {
      float b = exp(-length(P.xy - vec2(0.0, 0.3))*2.2);
      col = vec3(.4, .4, .42) * scrLit * .06 * b + vec3(.00002);
    }
    if (id >= 2) col *= uLit;
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    oCol = vec4(col, clamp(tBest * max(dot(rd, F), 0.05), 0.01, 50.0));   // 沿光轴的深度：对焦面是平面
    // 运动矢量（相对上一时刻的相机，像素/快门）
    // 当前与上一时刻都用同一套（无畸变）投影，避免镜头畸变被误当成运动
    vec3 dir = P - uCp; float zz = max(dot(dir, uFp), 1e-3);
    vec2 pp = vec2(dot(dir, uRp)/zz/uTanHp, dot(dir, uUp)/zz/uTanHp*uAsp);
    vec3 dc = P - uC0; float zc = max(dot(dc, uF0), 1e-3);
    vec2 pc = vec2(dot(dc, uR0)/zc/uTanH, dot(dc, uU0)/zc/uTanH*uAsp);
    if (id == 0) { pp = vec2(dot(rd, uRp)/dot(rd,uFp)/uTanHp, dot(rd,uUp)/dot(rd,uFp)/uTanHp*uAsp); pc = vec2(dot(rd, uR0)/dot(rd,uF0)/uTanH, dot(rd,uU0)/dot(rd,uF0)/uTanH*uAsp); }
    vec2 vel = (pc - pp) * .5 * uRes; if (any(isnan(vel)) || any(isinf(vel))) vel = vec2(0.0);
    oVel = vec4(clamp(vel, -400.0, 400.0), 0.0, 1.0);
  }`;
  // 屏幕画布 → sRGB 纹理：全程在显卡内完成（避免浏览器走内存拷贝导致泄漏）
  const FS_COPY = COMMON + `out vec4 o; uniform sampler2D uRaw;
  void main(){ vec3 c = texelFetch(uRaw, ivec2(gl_FragCoord.xy), 0).rgb; c = mix(c/12.92, pow((c + .055)/1.055, vec3(2.4)), step(.04045, c)); o = vec4(c, 1.0); }`;
  const FS_DOWN = COMMON + `out vec4 o; uniform sampler2D uSrc; uniform float uFocus, uApK, uCocMax, uCorner;
  void main(){ vec4 c = texture(uSrc, vUv); float z = max(c.a, .005);
    vec2 r = vUv - .5; float coc = uApK*(1.0/z - 1.0/uFocus) * 0.25;   // 半分辨率下的半径
    coc += sign(coc + 1e-5) * uCorner * dot(r, r) * 4.0;
    o = vec4(c.rgb, clamp(coc, -uCocMax, uCocMax)); }`;
  const FS_TILE = COMMON + `out vec4 o; uniform sampler2D uSrc; uniform vec2 uSrcSize;
  void main(){ vec2 base = floor(gl_FragCoord.xy) * 16.0; float m = 0.0; for (int y=0;y<16;y++) for (int x=0;x<16;x++){ vec2 p = (base + vec2(x,y) + .5)/uSrcSize; m = max(m, abs(texture(uSrc, p).a)); } o = vec4(m); }`;
  const FS_DIL = COMMON + `out vec4 o; uniform sampler2D uSrc; uniform vec2 uInv;
  void main(){ float m = 0.0; for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) m = max(m, texture(uSrc, vUv + vec2(x,y)*uInv).r); o = vec4(m); }`;
  const FS_GATHER = COMMON + `out vec4 o; uniform sampler2D uHalf, uTile; uniform vec2 uInv; uniform float uFrame;
  void main(){
    vec4 c0 = texture(uHalf, vUv); float cs = abs(c0.a); float R = texture(uTile, vUv).r;
    vec3 col = c0.rgb; float tot = 1.0, fg = 0.0;
    if (R > .6) {
      float rs = max(R*R/(2.0*64.0), .36), radius = rs, ang = hash13(vec3(gl_FragCoord.xy, uFrame))*6.2832;
      for (int i=0;i<100;i++){
        if (radius >= R) break;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uInv * radius; vec4 s = texture(uHalf, tc);
        float ss = abs(s.a); if (s.a < c0.a) ss = clamp(ss, 0.0, cs*2.0);
        float m = smoothstep(radius - .5, radius + .5, ss);
        float lum = dot(s.rgb, vec3(.3,.5,.2)); float wb = 1.0 + m * clamp(lum*.0, 0.0, 0.0);
        col += mix(col/tot, s.rgb, m) * wb; tot += wb;
        if (s.a > c0.a + 1.0) fg = max(fg, m);
        radius += rs/radius; ang += 2.39996323;
      }
    }
    col /= tot; if (any(isnan(col)) || any(isinf(col))) col = c0.rgb;
    o = vec4(col, max(smoothstep(.3, 1.0, cs), fg));
  }`;
  const FS_COMP = COMMON + `out vec4 o; uniform sampler2D uScene, uVel, uGather; uniform vec2 uInv; uniform float uFocus, uApK;
  vec3 dof(vec2 uv){ vec4 sc = texture(uScene, uv); float coc = abs(uApK*(1.0/max(sc.a,.005) - 1.0/uFocus)); vec4 g = texture(uGather, uv); float a = max(g.a, smoothstep(1.2, 3.5, coc)); return mix(sc.rgb, g.rgb, a); }
  void main(){ vec2 v = texture(uVel, vUv).xy; float l = length(v); if (l > 140.0) v *= 140.0/l;
    vec3 acc = vec3(0.0); float n = l < .7 ? 1.0 : clamp(2.0 + ceil(l * .42), 3.0, 12.0); float j = hash12(gl_FragCoord.xy) - .5;
    for (int i=0;i<12;i++){ if (float(i) >= n) break; float k = n < 2.0 ? 0.0 : (float(i) + .5 + j*.8)/n - .5; acc += dof(vUv + v*k*uInv); }
    acc /= n; if (any(isnan(acc)) || any(isinf(acc))) acc = vec3(0.0);
    o = vec4(min(acc, vec3(60.0)), 1.0); }`;
  const FS_BDOWN = COMMON + `out vec4 o; uniform sampler2D uSrc; uniform vec2 uInv; uniform float uThr;
  void main(){ vec3 c = vec3(0.0); c += texture(uSrc, vUv + vec2(-1,-1)*uInv).rgb; c += texture(uSrc, vUv + vec2(1,-1)*uInv).rgb; c += texture(uSrc, vUv + vec2(-1,1)*uInv).rgb; c += texture(uSrc, vUv + vec2(1,1)*uInv).rgb; c *= .25;
    if (uThr > 0.0) c = max(c - uThr, 0.0); o = vec4(c, 1.0); }`;
  const FS_BUP = COMMON + `out vec4 o; uniform sampler2D uSrc, uBase; uniform vec2 uInv;
  void main(){ vec3 c = vec3(0.0); for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ float w = (x==0?2.0:1.0)*(y==0?2.0:1.0); c += texture(uSrc, vUv + vec2(x,y)*uInv).rgb * w; } o = vec4(c/16.0 + texture(uBase, vUv).rgb, 1.0); }`;
  const FS_FINAL = COMMON + `out vec4 o; uniform sampler2D uSrc, uBloom; uniform vec2 uInv, uRes; uniform float uExp, uNoise, uFrame, uCA, uBloomK, uVig, uSharp, uFade;
  vec3 aces(vec3 x){ return clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14), 0.0, 1.0); }
  vec3 toSrgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - .055, step(.0031308, c)); }
  void main(){
    vec2 d = vUv - .5; vec2 uv = .5 + d*(1.0 - uCA*1.2);
    vec3 c; c.r = texture(uSrc, uv - d*uCA).r; c.g = texture(uSrc, uv).g; c.b = texture(uSrc, uv + d*uCA).b;
    vec3 bl = (texture(uSrc, vUv + vec2(uInv.x,0)).rgb + texture(uSrc, vUv - vec2(uInv.x,0)).rgb + texture(uSrc, vUv + vec2(0,uInv.y)).rgb + texture(uSrc, vUv - vec2(0,uInv.y)).rgb)*.25;
    c += (c - bl) * uSharp;
    c = max(c, 0.0) + texture(uBloom, vUv).rgb * uBloomK;
    float vg = 1.0 - uVig*smoothstep(.15, .75, dot(d*vec2(1.0,.75), d*vec2(1.0,.75))*2.2);
    c *= uExp * vg;
    c = aces(c);
    c = toSrgb(c);
    float lum = dot(c, vec3(.3,.59,.11));
    // 传感器噪点：亮度颗粒 + 低频彩色斑块
    float g1 = hash13(vec3(gl_FragCoord.xy, uFrame)) + hash13(vec3(gl_FragCoord.xy + 17.0, uFrame)) - 1.0;
    vec2 bp = gl_FragCoord.xy / 5.0 + uFrame*13.1;
    vec3 ch = vec3(vnoise(bp), vnoise(bp + 41.7), vnoise(bp + 83.1)) - .5;
    float amp = uNoise * (.03 + .05*sqrt(max(lum, 0.0))) * (1.0 - .6*lum);
    c += g1 * amp + ch * uNoise * .045 * (1.0 - lum);
    c = mix(vec3(dot(c, vec3(.3,.59,.11))), c, .93);
    c += vec3(.002, .004, .009) * (1.0 - c);
    c *= uFade;
    c += (hash13(vec3(gl_FragCoord.xy, uFrame + 7.0)) - .5)/255.0;
    o = vec4(c, 1.0);
  }`;

  function compile(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 3000)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function rt(w, h, filter = gl.LINEAR) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); t.w = w; t.h = h; return t; }
  function fbo(...ts) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); ts.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); gl.drawBuffers(ts.map((_, i) => gl.COLOR_ATTACHMENT0 + i)); f.w = ts[0].w; f.h = ts[0].h; return f; }
  function pass(prog, target, unis, texs) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target || null); gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
    gl.useProgram(prog.p); let unit = 0;
    for (const [k, t] of Object.entries(texs || {})) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[k], unit++); }
    for (const [k, v] of Object.entries(unis || {})) { const l = prog.u[k]; if (l == null) continue; if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else gl.uniform4fv(l, v); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  O.Cam = {
    init(canvas) {
      W = canvas.width; H = canvas.height;
      gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float RT');
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      progs.scene = compile(FS_SCENE); progs.down = compile(FS_DOWN); progs.tile = compile(FS_TILE); progs.dil = compile(FS_DIL); progs.gather = compile(FS_GATHER);
      progs.comp = compile(FS_COMP); progs.bdown = compile(FS_BDOWN); progs.bup = compile(FS_BUP); progs.final = compile(FS_FINAL); progs.copy = compile(FS_COPY);
      tex.dummy = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.dummy); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      tex.raw = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.raw); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, O.SW, O.SH);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      tex.scr = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.scr);
      gl.texStorage2D(gl.TEXTURE_2D, 12, gl.SRGB8_ALPHA8, O.SW, O.SH);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
      fb.scr = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb.scr); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.scr, 0); fb.scr.w = O.SW; fb.scr.h = O.SH;
      tex.col = rt(W, H); tex.vel = rt(W, H, gl.NEAREST); fb.scene = fbo(tex.col, tex.vel);
      tex.half = rt(W / 2, H / 2); fb.half = fbo(tex.half);
      tex.tile = rt(Math.ceil(W / 32), Math.ceil(H / 32), gl.NEAREST); fb.tile = fbo(tex.tile);
      tex.tile2 = rt(Math.ceil(W / 32), Math.ceil(H / 32), gl.NEAREST); fb.tile2 = fbo(tex.tile2);
      tex.gath = rt(W / 2, H / 2); fb.gath = fbo(tex.gath);
      tex.comp = rt(W, H); fb.comp = fbo(tex.comp);
      tex.bl = []; fb.bl = []; tex.bu = []; fb.bu = [];
      for (let i = 0; i < 6; i++) { const w = Math.ceil(W / (2 << i)), h = Math.ceil(H / (2 << i)); tex.bl[i] = rt(w, h); fb.bl[i] = fbo(tex.bl[i]); tex.bu[i] = rt(w, h); fb.bu[i] = fbo(tex.bu[i]); }
    },
    // 载入黑屏倒影照片（assets/reflect-1.jpg、reflect-2.jpg），sRGB 纹理 + mipmap
    setRef(img1, img2) {
      const mk = img => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      if (img1) tex.ref1 = mk(img1); if (img2) tex.ref2 = mk(img2);
    },
    upload(screenCanvas) {
      gl.bindTexture(gl.TEXTURE_2D, tex.raw);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, screenCanvas);
      gl.bindTexture(gl.TEXTURE_2D, null);
      pass(progs.copy, fb.scr, {}, { uRaw: tex.raw });
      gl.bindTexture(gl.TEXTURE_2D, tex.scr); gl.generateMipmap(gl.TEXTURE_2D);
    },
    render(t, opt = {}) {
      frameNo = Math.round(t * O.FPS);
      const p0 = pose(t), p1 = pose(t + .016), pp = pose(t - 1 / 60);
      const on = O.isOn(t) ? 1 : 0;
      let back = 0;
      if (t >= T.wake) back = clamp((t - T.wake) / .06);
      if (t >= T.sleep) back = 1 - clamp((t - T.sleep) / .22);
      if (t >= T.black + .03 && t < T.back) back = 0;                       // 白屏后失去信号：背光熄灭
      if (t >= T.back && t < T.back + .06) back = (t - T.back) / .06;
      const ga = O.glitchAmt(t), mo = O.moire(t);
      if (ga > 0) back *= 1 - .08 * ga * (.5 + .5 * Math.sin(t * 53) * Math.sin(t * 7.1));
      // 倒影照片：随手持晃动平移（倒影里的人就是拿手机的人）
      const pb = params(t), Dg = Math.PI / 180, tb = O.scrToWorld(pb.at);
      const cb = v3.add(tb, v3.mul([Math.sin(pb.yaw * Dg) * Math.cos(pb.pitch * Dg), Math.sin(pb.pitch * Dg), Math.cos(pb.yaw * Dg) * Math.cos(pb.pitch * Dg)], pb.d));
      const refImg = (t >= 194 && tex.ref2) ? tex.ref2 : tex.ref1, refShift = [(p0.C[0] - cb[0]) / SWm * 1.6, -(p0.C[1] - cb[1]) / SHm * 1.6];
      const expo = O.exposure(t), gain = expo / 7;
      const apK = 10.4 * Math.pow(Math.tan(35 * Math.PI / 180) / p0.tanH, 1.35) * p0.ap * (W / 3840);
      const sc = [0, .30, SWm / 2, SHm / 2];
      pass(progs.scene, fb.scene, {
        uRes: [W, H], uC0: p0.C, uR0: p0.R, uU0: p0.U, uF0: p0.F, uC1: p1.C, uR1: p1.R, uU1: p1.U, uF1: p1.F, uCp: pp.C, uRp: pp.R, uUp: pp.U, uFp: pp.F,
        uTanH: p0.tanH, uTanHp: pp.tanH, uAsp: W / H, uK1: .035, uScr: sc, uBack: back, uBlack: .0005, uGlow: .004, uBand: (t < T.white ? .018 : .03) + .09 * ga, uTime: t,
        uRefl: 1.0, uWin: 4.0, uDoor: 1.4, uHaze: .014, uSub: mo.sub, uLit: 8.0, uFw: mo.fw,
        uRefOn: refImg ? 1 : 0, uRefGain: (O.refGain || .9) / 90, uRefShift: refShift,
      }, { uTex: tex.scr, uRefImg: refImg || tex.dummy });
      const cocMax = 64;
      pass(progs.down, fb.half, { uFocus: p0.focus, uApK: apK, uCocMax: cocMax, uCorner: .6 }, { uSrc: tex.col });
      pass(progs.tile, fb.tile, { uSrcSize: [W / 2, H / 2] }, { uSrc: tex.half });
      pass(progs.dil, fb.tile2, { uInv: [1 / tex.tile.w, 1 / tex.tile.h] }, { uSrc: tex.tile });
      pass(progs.gather, fb.gath, { uInv: [2 / W, 2 / H], uFrame: frameNo % 64 }, { uHalf: tex.half, uTile: tex.tile2 });
      pass(progs.comp, fb.comp, { uInv: [1 / W, 1 / H], uFocus: p0.focus, uApK: apK }, { uScene: tex.col, uVel: tex.vel, uGather: tex.gath });
      // 辉光
      let src = tex.comp;
      for (let i = 0; i < 6; i++) { pass(progs.bdown, fb.bl[i], { uInv: [.5 / src.w, .5 / src.h], uThr: i === 0 ? .0 : 0 }, { uSrc: src }); src = tex.bl[i]; }
      let up = tex.bl[5];
      for (let i = 4; i >= 0; i--) { pass(progs.bup, fb.bu[i], { uInv: [1 / up.w, 1 / up.h] }, { uSrc: up, uBase: tex.bl[i] }); up = tex.bu[i]; }
      const fade = t >= T.cut ? 0 : 1;
      pass(progs.final, null, { uInv: [1 / W, 1 / H], uRes: [W, H], uExp: expo, uNoise: clamp(.22 + .78 * Math.log2(Math.max(gain, 1)) / 5), uFrame: frameNo % 997, uCA: .0016, uBloomK: .011, uVig: .32, uSharp: .38, uFade: fade }, { uSrc: tex.comp, uBloom: tex.bu[0] });
      return { expo, focus: p0.focus, pose: p0 };
    },
  };
})();
