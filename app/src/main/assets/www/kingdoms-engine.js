/* =========================================================
   حرب العصور القديمة v3 — ممالك الحرب
   11 شخصية متحركة • 4 قدرات • 5 خرائط • قلعة قابلة للترقية
   ========================================================= */
'use strict';

/* ---------- أدوات عامة ---------- */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));

const W = 960, H = 540;
const GROUND_Y = 470;
const SPAWN_PAD = 26;

const canvas = $('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ---------- الصوت الإجرائي ---------- */
const Sfx = {
  ac: null, muted: false,
  ensure() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  hit()   { this.tone(rand(160, 220), 0.08, 'square', 0.06, -80); },
  arrow() { this.tone(700, 0.1, 'sawtooth', 0.04, -300); },
  rock()  { this.tone(90, 0.25, 'triangle', 0.12, -40); },
  die()   { this.tone(300, 0.2, 'square', 0.05, -220); },
  coin()  { this.tone(880, 0.07, 'sine', 0.05); this.tone(1320, 0.09, 'sine', 0.04); },
  spawn() { this.tone(440, 0.08, 'triangle', 0.05, 120); },
  heal()  { this.tone(620, 0.12, 'sine', 0.05, 200); },
  fire()  { this.tone(200, 0.4, 'sawtooth', 0.09, -120); },
  bolt()  { this.tone(1200, 0.08, 'sawtooth', 0.1, -900); this.tone(180, 0.3, 'square', 0.08, -100); },
  freeze(){ this.tone(1400, 0.5, 'sine', 0.06, -1100); },
  stomp() { this.tone(60, 0.35, 'triangle', 0.16, -20); },
  magic() { this.tone(500, 0.25, 'sine', 0.06, 400); },
  lvl()   { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'triangle', 0.07), i * 90)); },
  win()   { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.08), i * 130)); },
  lose()  { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.07), i * 150)); },
};

/* ---------- لوحات الألوان ---------- */
const PAL_PLAYER = { skin: '#e8b88a', armor: '#4a90d9', armorDark: '#2a5a9e', trim: '#cdd6e0', weapon: '#d8dee6', wood: '#7a4a22' };
const PAL_ENEMY  = { skin: '#c99a72', armor: '#c0453f', armorDark: '#7e2a26', trim: '#3a2a24', weapon: '#9aa3ad', wood: '#5c3a1e' };

/* ---------- نظام الشخصيات المتحركة (Rig إجرائي) ---------- */
function RL(g, x1, y1, x2, y2, w, c) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  g.fillStyle = c;
  for (let i = 0; i <= steps; i++) {
    const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
    g.fillRect(Math.round(x - w / 2), Math.round(y - w / 2), w, w);
  }
}
function RR(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

function drawHeadRig(g, x, y, pal, kind) {
  RR(g, x - 3, y - 4, 7, 7, pal.skin);
  RR(g, x + 1, y - 1, 2, 2, '#1a1410');
  if (kind === 'plume') {
    RR(g, x - 4, y - 7, 9, 4, pal.armorDark);
    RR(g, x - 4, y - 4, 2, 4, pal.armorDark);
    RR(g, x + 3, y - 4, 2, 4, pal.armorDark);
    RR(g, x - 1, y - 10, 2, 3, '#c94a3d');
    RR(g, x - 2, y - 9, 1, 2, '#e06a55');
  } else if (kind === 'plain') {
    RR(g, x - 4, y - 7, 9, 3, pal.armorDark);
    RR(g, x - 4, y - 5, 2, 4, pal.armorDark);
    RR(g, x + 3, y - 5, 2, 4, pal.armorDark);
  } else if (kind === 'hood') {
    RR(g, x - 4, y - 8, 9, 5, pal.armorDark);
    RR(g, x - 5, y - 5, 2, 5, pal.armorDark);
    RR(g, x + 4, y - 4, 1, 3, pal.armorDark);
    RR(g, x + 1, y - 1, 2, 2, '#7ef0a0');
  } else if (kind === 'horned') {
    RR(g, x - 5, y - 8, 11, 5, pal.armorDark);
    RR(g, x - 7, y - 9, 3, 3, '#e8e2d0');
    RR(g, x - 8, y - 7, 2, 3, '#e8e2d0');
    RR(g, x + 5, y - 9, 3, 3, '#e8e2d0');
    RR(g, x + 7, y - 7, 2, 3, '#e8e2d0');
    RR(g, x + 1, y - 1, 3, 2, '#ff5a3d');
  } else if (kind === 'giant') {
    RR(g, x - 5, y - 7, 10, 4, pal.armorDark);
    RR(g, x + 1, y - 1, 3, 2, '#ff8a3d');
  } else if (kind === 'wizard') {                      // قبعة ساحر مدببة
    RR(g, x - 4, y - 6, 9, 3, pal.armorDark);
    RR(g, x - 3, y - 12, 5, 7, pal.armorDark);
    RR(g, x - 2, y - 14, 2, 3, pal.armor);
    RR(g, x - 5, y - 4, 2, 4, pal.armorDark);
    RR(g, x + 4, y - 4, 2, 4, pal.armorDark);
    RR(g, x + 1, y - 1, 2, 2, '#ffb347');
  } else if (kind === 'tusked') {                      // خوذة بأنياب (قائد الفيلة)
    RR(g, x - 4, y - 7, 9, 4, pal.armorDark);
    RR(g, x - 6, y - 5, 2, 2, '#e8e2d0');
    RR(g, x + 5, y - 5, 2, 2, '#e8e2d0');
    RR(g, x + 1, y - 1, 2, 2, '#1a1410');
  }
}

/* إنسان متحرك */
function drawHumanoidRig(g, u, pal, o) {
  const t = u.animT, atk = u.atkAnim || 0;
  const walking = u.state === 'walk' && u.dying <= 0;
  const wSpd = o.giant ? 5.5 : 9;
  const wk = walking ? Math.sin(t * wSpd) : 0;
  const bob = walking ? Math.abs(Math.cos(t * wSpd)) * (o.giant ? 1.6 : 1) : 0;
  const hipY = -13 - bob, shY = -24 - bob;
  const legSw = wk * 3.2;

  if (o.cape) {
    const fl = Math.sin(t * 7) * 1.5 + (walking ? 2 : 0.5);
    RR(g, -7 - fl * 0.4, shY + 1, 4, 12 + fl, pal.armorDark);
    RR(g, -6 - fl * 0.6, shY + 3, 3, 9 + fl * 0.7, pal.armor);
  }
  if (o.robe) {
    const sw = Math.sin(t * 3) * 1.2;
    RR(g, -4, hipY, 8, 13, pal.armor);
    RR(g, -4 + sw, hipY + 11, 8, 2, pal.armorDark);
  } else {
    RL(g, -1, hipY, -1 + legSw, 0, 3, pal.armorDark);
    RL(g, 1, hipY, 1 - legSw, 0, 3, pal.armor);
    RR(g, -2 + legSw, -1, 3, 2, pal.wood);
    RR(g, 0 - legSw, -1, 3, 2, pal.wood);
  }
  RR(g, -4, shY, 8, 12, pal.armor);
  RR(g, -4, shY, 8, 2, pal.trim);
  RR(g, -4, shY + 9, 8, 3, pal.armorDark);
  RR(g, -1, shY + 9, 2, 3, '#f4c542');

  const swing = atk > 0 ? Math.sin((1 - atk) * Math.PI) : 0;
  const ax = 2, ay = shY + 2;

  if (o.weapon === 'tower') {                          // حامل الترس: ترس برجي ضخم
    RL(g, -2, shY + 2, -4 - wk * 2, shY + 10, 3, pal.skin);
    RR(g, -10, shY - 2, 7, 20, pal.wood);
    RR(g, -9, shY - 1, 5, 18, pal.trim);
    RR(g, -8, shY + 6, 3, 3, '#f4c542');
    RR(g, -8, shY - 4, 5, 3, pal.armorDark);
    const ang = -0.4 - swing * 1.6;
    const hx = ax + Math.cos(ang) * 4, hy = ay + Math.sin(ang) * 4;
    RL(g, ax, ay, hx, hy, 3, pal.skin);
    RL(g, hx, hy, hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7, 2, pal.weapon);
  } else if (o.shield) {
    RL(g, -2, shY + 2, -5, shY + 8, 3, pal.skin);
    RR(g, -9, shY + 3, 5, 10, pal.wood);
    RR(g, -8, shY + 4, 3, 8, pal.trim);
    RR(g, -8, shY + 7, 3, 2, '#f4c542');
  } else {
    RL(g, -2, shY + 2, -4 - wk * 2, shY + 10, 3, pal.skin);
  }

  if (o.weapon === 'sword') {
    const ang = -0.5 - swing * 2.1;
    const hx = ax + Math.cos(ang) * 5, hy = ay + Math.sin(ang) * 5;
    RL(g, ax, ay, hx, hy, 3, pal.skin);
    RL(g, hx, hy, hx + Math.cos(ang) * 9, hy + Math.sin(ang) * 9, 2, pal.weapon);
    RR(g, hx - 1, hy - 1, 2, 2, pal.wood);
    if (swing > 0.55) {
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.arc(4, shY + 6, 11, -1.3, 0.5); g.stroke();
    }
  } else if (o.weapon === 'spear') {
    const th = swing * 5;
    RL(g, ax, ay, ax + 2 + th, ay + 2, 3, pal.skin);
    RL(g, ax - 3 + th, ay + 8, ax + 9 + th, ay - 6, 1, pal.wood);
    RR(g, ax + 8 + th, ay - 8, 2, 4, pal.weapon);
    RR(g, ax + 8 + th, ay - 9, 1, 2, pal.weapon);
  } else if (o.weapon === 'bow') {
    const draw = swing;
    RL(g, ax, ay, ax + 4, ay + 3, 3, pal.skin);
    g.strokeStyle = pal.wood; g.lineWidth = 1.5;
    g.beginPath(); g.arc(ax + 7, ay + 2, 6, -1.2, 1.2); g.stroke();
    const qx = ax + 7, qy = ay + 2;
    const px1 = qx + Math.cos(-1.2) * 6, py1 = qy + Math.sin(-1.2) * 6;
    const px2 = qx + Math.cos(1.2) * 6, py2 = qy + Math.sin(1.2) * 6;
    g.strokeStyle = '#e8e2d0'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(px1, py1); g.lineTo(qx + 1 - draw * 3, qy); g.lineTo(px2, py2); g.stroke();
    if (draw > 0.15) { RR(g, qx + 1 - draw * 3, qy, 8, 1, pal.wood); RR(g, qx + 8, qy - 1, 3, 2, pal.weapon); }
  } else if (o.weapon === 'staff') {                   // عصا الكاهن (خضراء)
    const raise = swing * 3;
    RL(g, ax, ay, ax + 3, ay + 3 - raise, 3, pal.skin);
    RL(g, ax + 4, ay - 12, ax + 4, ay + 8, 2, pal.wood);
    RR(g, ax + 3, ay - 15, 4, 4, '#7ef0a0');
    g.globalAlpha = 0.35 * Math.min(1, 0.6 + Math.sin(t * 5) * 0.4 + swing);
    RR(g, ax + 2, ay - 16, 6, 6, '#a8ffc8');
    g.globalAlpha = 1;
  } else if (o.weapon === 'firestaff') {               // عصا الساحر (نارية + كرة عند الهجوم)
    const raise = swing * 4;
    RL(g, ax, ay, ax + 3, ay + 3 - raise, 3, pal.skin);
    RL(g, ax + 4, ay - 13, ax + 4, ay + 8, 2, '#4a2e16');
    RR(g, ax + 3, ay - 16, 4, 4, '#ff8a3d');
    g.globalAlpha = 0.4 + Math.sin(t * 6) * 0.2 + swing * 0.4;
    RR(g, ax + 2, ay - 18, 6, 6, '#ffd9a8');
    RR(g, ax + 1, ay - 19, 8, 8, 'rgba(255,120,40,0.35)');
    g.globalAlpha = 1;
    if (swing > 0.5) { RR(g, ax + 6, ay - 14 - swing * 6, 5, 5, '#ff9a3d'); }
  } else if (o.weapon === 'club') {
    const ang = -2.4 + swing * 2.8;
    const hx = ax + Math.cos(ang) * 4, hy = ay + Math.sin(ang) * 4;
    RL(g, ax, ay, hx, hy, 4, pal.skin);
    RL(g, hx, hy, hx + Math.cos(ang) * 11, hy + Math.sin(ang) * 11, 4, pal.wood);
    RR(g, hx + Math.cos(ang) * 11 - 2, hy + Math.sin(ang) * 11 - 2, 6, 6, '#6a5a42');
    RR(g, hx + Math.cos(ang) * 11 - 1, hy + Math.sin(ang) * 11 - 3, 2, 2, '#8a7a62');
  } else if (o.weapon === 'axe') {
    const ang = -2.2 + swing * 2.6;
    const hx = ax + Math.cos(ang) * 5, hy = ay + Math.sin(ang) * 5;
    RL(g, ax, ay, hx, hy, 4, pal.skin);
    RL(g, hx, hy, hx + Math.cos(ang) * 10, hy + Math.sin(ang) * 10, 2, pal.wood);
    const bx = hx + Math.cos(ang) * 10, by = hy + Math.sin(ang) * 10;
    RR(g, bx - 2, by - 5, 4, 8, pal.weapon);
    RR(g, bx + 1, by - 3, 3, 4, '#c8d0da');
  }
  drawHeadRig(g, 0, shY - 5, pal, o.helm);
}

/* فارس على حصان */
function drawHorseRig(g, u, pal) {
  const t = u.animT, atk = u.atkAnim || 0;
  const g1 = Math.sin(t * 11), g2 = Math.sin(t * 11 + Math.PI * 0.5);
  const bounce = Math.abs(Math.sin(t * 11)) * 1.5;
  const bodyY = -16 - bounce;
  RL(g, -8, bodyY + 4, -9 + g1 * 4, 0, 2.5, pal.wood);
  RL(g, -5, bodyY + 4, -4 + g2 * 4, 0, 2.5, pal.wood);
  RL(g, 5, bodyY + 4, 4 - g2 * 4, 0, 2.5, pal.wood);
  RL(g, 8, bodyY + 4, 9 - g1 * 4, 0, 2.5, pal.wood);
  RR(g, -9, bodyY, 19, 7, pal.armorDark);
  RR(g, -8, bodyY + 1, 17, 4, pal.armor);
  RL(g, -9, bodyY + 1, -13, bodyY - 3 + Math.sin(t * 8) * 2, 2, pal.armorDark);
  RL(g, 8, bodyY + 1, 12, bodyY - 6, 4, pal.armor);
  RR(g, 11, bodyY - 9, 6, 4, pal.armor);
  RR(g, 15, bodyY - 8, 3, 2, pal.armorDark);
  RR(g, 12, bodyY - 8, 1.5, 1.5, '#1a1410');
  RL(g, 8, bodyY - 7, 12, bodyY - 9, 2, '#3a2a1a');
  const swing = atk > 0 ? Math.sin((1 - atk) * Math.PI) : 0;
  const ry = bodyY - 8;
  const fl = Math.sin(t * 9) * 1.5 + 1;
  RR(g, -6 - fl * 0.5, ry - 3, 3, 10 + fl, pal.armorDark);
  RL(g, -1, ry + 6, -3, ry + 12, 2.5, pal.armorDark);
  RL(g, 1, ry + 6, 3, ry + 12, 2.5, pal.armorDark);
  RR(g, -3, ry - 4, 7, 10, pal.armor);
  RR(g, -3, ry - 4, 7, 2, pal.trim);
  RL(g, 2, ry - 1, 4, ry, 2.5, pal.skin);
  const ang = -0.15 + swing * 0.25;
  RL(g, -2, ry + 1, 16, ry - 3 - swing * 2, 1.5, pal.wood);
  RR(g, 15, ry - 6 - swing * 2, 3, 3, pal.weapon);
  drawHeadRig(g, 0, ry - 8, pal, 'plume');
}

/* فيل حرب: أرجل أربع، خرطوم يتأرجح، أنياب، برج فارس */
function drawElephantRig(g, u, pal) {
  const t = u.animT, atk = u.atkAnim || 0;
  const g1 = Math.sin(t * 6), g2 = Math.sin(t * 6 + Math.PI * 0.5);
  const bounce = Math.abs(Math.sin(t * 6)) * 1.2;
  const bodyY = -22 - bounce;
  const grey = '#8a8494', greyD = '#6a6474', greyL = '#a09aae';
  RL(g, -11, bodyY + 8, -12 + g1 * 3, 0, 4, greyD);
  RL(g, -6, bodyY + 8, -6 + g2 * 3, 0, 4, grey);
  RL(g, 5, bodyY + 8, 5 - g2 * 3, 0, 4, grey);
  RL(g, 10, bodyY + 8, 11 - g1 * 3, 0, 4, greyD);
  RR(g, -14, bodyY, 28, 12, grey);
  RR(g, -13, bodyY + 1, 26, 8, greyL);
  RR(g, -14, bodyY + 8, 28, 3, greyD);
  RL(g, -14, bodyY + 2, -19, bodyY - 2 + Math.sin(t * 5) * 2, 3, greyD); // ذيل
  const trunk = Math.sin(t * 3.5) * 3 + (atk > 0 ? Math.sin((1 - atk) * Math.PI) * 6 : 0);
  RL(g, 13, bodyY + 2, 17, bodyY + 8, 4, grey);          // خرطوم
  RL(g, 17, bodyY + 8, 16 + trunk * 0.4, bodyY + 16 + trunk, 3, greyD);
  RR(g, 12, bodyY + 4, 3, 5, '#e8e2d0');                 // أنياب
  RR(g, 15, bodyY + 5, 2, 4, '#e8e2d0');
  RR(g, 8, bodyY - 4, 5, 6, greyD);                      // أذن
  RR(g, 9, bodyY - 3, 3, 4, grey);
  const swing = atk > 0 ? Math.sin((1 - atk) * Math.PI) : 0;
  RR(g, -8, bodyY - 8, 14, 8, pal.wood);                 // البرج (howdah)
  RR(g, -7, bodyY - 7, 12, 5, pal.armorDark);
  RR(g, -9, bodyY - 12, 3, 6, pal.wood);
  RR(g, 5, bodyY - 12, 3, 6, pal.wood);
  RR(g, -3, bodyY - 16, 7, 9, pal.armor);                // الفارس
  RR(g, -3, bodyY - 16, 7, 2, pal.trim);
  RL(g, 2, bodyY - 12, 5 + swing * 3, bodyY - 8, 2, pal.skin);
  RL(g, 3, bodyY - 14, 10 + swing * 4, bodyY - 18, 1.5, pal.wood); // رمح
  drawHeadRig(g, 0, bodyY - 21, pal, 'tusked');
}

/* منجنيق */
function drawCatapultRig(g, u, pal) {
  const atk = u.atkAnim || 0;
  const rot = u.x * 0.15;
  RR(g, -12, -14, 24, 6, pal.wood);
  RR(g, -12, -14, 24, 2, '#8a5a2e');
  const swing = atk > 0 ? Math.sin((1 - atk) * Math.PI) : 0;
  const ang = -2.2 + swing * 2.0;
  const bx = 2, by = -14;
  const ex = bx + Math.cos(ang) * 14, ey = by + Math.sin(ang) * 14;
  RL(g, bx, by, ex, ey, 2.5, pal.armorDark);
  RR(g, ex - 2, ey - 2, 5, 5, '#6a5a42');
  if (swing > 0.7) RR(g, ex - 1, ey - 1, 3, 3, '#b8a888');
  g.strokeStyle = pal.wood; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-10, -12); g.lineTo(ex, ey); g.stroke();
  [[-8], [8]].forEach(([wx]) => {
    g.save(); g.translate(wx, -5); g.rotate(rot);
    RR(g, -5, -5, 10, 10, '#5c3a1e');
    RR(g, -3, -3, 6, 6, '#7a4a22');
    RL(g, -4, 0, 4, 0, 1.5, '#4a2e16');
    RL(g, 0, -4, 0, 4, 1.5, '#4a2e16');
    g.restore();
  });
  RR(g, 10, -18, 3, 10, pal.armor);
  RR(g, 9, -20, 5, 3, pal.armorDark);
}

/* تعريف الشخصيات */
const RIGS = {
  swordsman: { helm: 'plume',  weapon: 'sword', shield: true,  scale: 1.5, top: 40 },
  spearman:  { helm: 'plain',  weapon: 'spear', scale: 1.5, top: 40 },
  archer:    { helm: 'plain',  weapon: 'bow',   scale: 1.5, top: 40 },
  healer:    { helm: 'hood',   weapon: 'staff', robe: true, scale: 1.5, top: 40 },
  mage:      { helm: 'wizard', weapon: 'firestaff', robe: true, scale: 1.55, top: 44 },
  shieldman: { helm: 'plain',  weapon: 'tower', scale: 1.5, top: 42 },
  knight:    { horse: true, scale: 1.4, top: 46 },
  elephant:  { elephant: true, scale: 1.5, top: 52 },
  catapult:  { machine: true, scale: 1.35, top: 24 },
  boss:      { helm: 'giant',  weapon: 'club', scale: 2.0, giant: true, top: 42 },
  megaBoss:  { helm: 'horned', weapon: 'axe',  scale: 2.5, giant: true, cape: true, top: 42 },
};

function drawUnitRig(g, u, pal) {
  const o = RIGS[u.type] || RIGS.swordsman;
  if (o.machine) drawCatapultRig(g, u, pal);
  else if (o.horse) drawHorseRig(g, u, pal);
  else if (o.elephant) drawElephantRig(g, u, pal);
  else drawHumanoidRig(g, u, pal, o);
}

/* ---------- تعريفات الوحدات (11) ---------- */
const UNIT_TYPES = {
  swordsman: { name: 'مقاتل',    icon: '🗡️', cost: 50,  hp: 120, dmg: 14, range: 34,  speed: 46, atkCd: 0.9, cd: 2.0, reward: 22,  size: 48 },
  spearman:  { name: 'رماح',     icon: '🔱', cost: 70,  hp: 150, dmg: 9,  range: 52,  speed: 52, atkCd: 0.5, cd: 2.5, reward: 28,  size: 48 },
  archer:    { name: 'رامي',     icon: '🏹', cost: 90,  hp: 80,  dmg: 12, range: 210, speed: 40, atkCd: 1.4, cd: 3.0, reward: 34,  size: 48 },
  shieldman: { name: 'حامل الترس', icon: '🛡️', cost: 130, hp: 340, dmg: 8,  range: 30,  speed: 28, atkCd: 1.0, cd: 4.0, reward: 48,  size: 48 },
  knight:    { name: 'فارس',     icon: '🐎', cost: 160, hp: 220, dmg: 22, range: 38,  speed: 78, atkCd: 0.8, cd: 5.0, reward: 60,  size: 48 },
  healer:    { name: 'كاهن',     icon: '✨', cost: 120, hp: 90,  dmg: 0,  range: 130, speed: 36, atkCd: 1.2, cd: 6.0, reward: 55,  size: 48, healer: true },
  mage:      { name: 'ساحر',     icon: '🔮', cost: 200, hp: 95,  dmg: 30, range: 240, speed: 34, atkCd: 2.2, cd: 8.0, reward: 85,  size: 48, splash: 55, magic: true },
  catapult:  { name: 'منجنيق',   icon: '🪨', cost: 300, hp: 150, dmg: 55, range: 320, speed: 18, atkCd: 3.2, cd: 9.0, reward: 110, size: 48, splash: 70, siege: true },
  elephant:  { name: 'فيل حرب',  icon: '🐘', cost: 380, hp: 560, dmg: 40, range: 44,  speed: 34, atkCd: 1.5, cd: 12,  reward: 150, size: 56, splash: 50, siege: true },
  boss:      { name: 'عملاق',    icon: '👹', cost: 0,   hp: 900, dmg: 45, range: 46,  speed: 26, atkCd: 1.6, cd: 0,   reward: 260, size: 48 },
  megaBoss:  { name: 'زعيم',     icon: '☠️', cost: 0,   hp: 1700, dmg: 65, range: 52, speed: 22, atkCd: 1.4, cd: 0,  reward: 450, size: 64 },
};
const BAR_UNITS = ['swordsman', 'spearman', 'archer', 'shieldman', 'knight', 'healer', 'mage', 'catapult', 'elephant'];

/* ---------- الخرائط الخمس (Biomes) ---------- */
const BIOMES = [
  {
    id: 'desert', name: 'صحراء بابل', icon: '🏜️',
    sky: ['#2b1a3a', '#4a2450', '#7a2f4e', '#b04a3c', '#d97a35', '#e8a04c'],
    ground: '#d9b380', groundDark: '#c49a62', groundLine: '#b8875a', hill: '#c49a62',
    decor: 'ziggurat', ambient: 'sand', tint: null,
  },
  {
    id: 'forest', name: 'غابة الظل', icon: '🌲',
    sky: ['#0e1a14', '#16301f', '#1e4a2a', '#2e6a38', '#4a8a4a', '#6aa85a'],
    ground: '#4a7a3a', groundDark: '#3a6230', groundLine: '#2e4e26', hill: '#3a6230',
    decor: 'trees', ambient: 'leaves', tint: 'rgba(20,60,30,0.12)',
  },
  {
    id: 'ice', name: 'جبال الجليد', icon: '❄️',
    sky: ['#0e1430', '#1a2450', '#2a3a72', '#3a5a9a', '#5a82c2', '#8ab2e2'],
    ground: '#dce8f4', groundDark: '#c2d4e6', groundLine: '#a8c0d8', hill: '#c2d4e6',
    decor: 'ice', ambient: 'snow', tint: 'rgba(80,140,220,0.10)',
  },
  {
    id: 'volcano', name: 'قلعة البركان', icon: '🌋',
    sky: ['#1a0808', '#3a1008', '#6a1e0a', '#9a3210', '#c85a18', '#e88a30'],
    ground: '#4a3028', groundDark: '#3a241e', groundLine: '#2a1a14', hill: '#3a241e',
    decor: 'lava', ambient: 'ember', tint: 'rgba(200,60,10,0.10)',
  },
  {
    id: 'underworld', name: 'العالم السفلي', icon: '👹',
    sky: ['#0a0414', '#1a0a2e', '#2e1450', '#4a2272', '#6a3494', '#8a4ab2'],
    ground: '#3a2a4e', groundDark: '#2c1f3c', groundLine: '#221830', hill: '#2c1f3c',
    decor: 'crystal', ambient: 'soul', tint: 'rgba(120,60,200,0.12)',
  },
];

/* ---------- الترقيات (12) ---------- */
const UPGRADES = [
  { id: 'dmg',     icon: '⚔️', name: 'حدّة الأسلحة',  desc: '+15% ضرر الوحدات',            base: 120, mult: 1.7, max: 8 },
  { id: 'hp',      icon: '🛡️', name: 'دروع متينة',    desc: '+15% صحة الوحدات',            base: 110, mult: 1.7, max: 8 },
  { id: 'income',  icon: '🪙', name: 'مناجم الذهب',   desc: '+1.5 ذهب/ثانية',              base: 100, mult: 1.8, max: 8 },
  { id: 'cost',    icon: '📜', name: 'عقود رخيصة',    desc: '-7% تكلفة الاستدعاء',         base: 150, mult: 1.9, max: 5 },
  { id: 'basehp',  icon: '🧱', name: 'أسوار أسمى',    desc: '+250 صحة قاعدتك وترميم',      base: 130, mult: 1.8, max: 8 },
  { id: 'cd',      icon: '⏱️', name: 'أبواب سريعة',   desc: '-8% زمن التبريد',             base: 140, mult: 1.8, max: 5 },
  { id: 'range',   icon: '🎯', name: 'تدريب متقدم',   desc: '+8% مدى الهجوم',              base: 120, mult: 1.7, max: 5 },
  { id: 'ability', icon: '🔥', name: 'طقس ناري',      desc: '-12% تبريد مطر النار',        base: 160, mult: 1.9, max: 5 },
  { id: 'magic',   icon: '🔮', name: 'قوة السحر',     desc: '+18% ضرر الساحر والقدرات',    base: 180, mult: 1.9, max: 5 },
  { id: 'siege',   icon: '🪨', name: 'حصار أثقل',     desc: '+20% ضرر المنجنيق والفيل',    base: 200, mult: 1.9, max: 5 },
  { id: 'frost',   icon: '❄️', name: 'شتاء قارس',     desc: '+1.2 ثانية مدة التجمد',       base: 170, mult: 2.0, max: 3 },
  { id: 'storm',   icon: '⚡', name: 'عاصفة رعدية',   desc: '+2 صاعقة في البرق',           base: 190, mult: 2.0, max: 3 },
];
function upgCost(u) { return Math.round(u.base * Math.pow(u.mult, G.upg[u.id] || 0)); }
function upgMult(id) { return G.upg[id] || 0; }

/* ---------- ترقية القلعة ---------- */
const CASTLE_LEVELS = [
  { cost: 0,    hpBonus: 0,   name: 'حصن خشبي' },
  { cost: 450,  hpBonus: 450, name: 'قلعة حجرية' },
  { cost: 1000, hpBonus: 900, name: 'حصن الملوك' },
];
function castleCost() {
  const lv = G.castle;
  return lv >= CASTLE_LEVELS.length - 1 ? null : CASTLE_LEVELS[lv + 1].cost;
}

/* ---------- القدرات الأربع ---------- */
const ABILITIES = {
  fire:   { icon: '🔥', name: 'مطر النار',  cd: 30, key: 'Q' },
  bolt:   { icon: '⚡', name: 'عاصفة برق',  cd: 25, key: 'W' },
  heal:   { icon: '💚', name: 'موجة الشفاء', cd: 35, key: 'E' },
  freeze: { icon: '❄️', name: 'تجمد الأعداء', cd: 40, key: 'R' },
};
const ABILITY_ORDER = ['fire', 'bolt', 'heal', 'freeze'];

/* ---------- إعدادات الصعوبة ---------- */
const DIFFS = {
  easy:   { name: 'سهل',  ehp: 0.75, edmg: 0.7,  espawn: 1.35, income: 3.2 },
  normal: { name: 'عادي', ehp: 1.0,  edmg: 1.0,  espawn: 1.0,  income: 2.5 },
  hard:   { name: 'صعب',  ehp: 1.3,  edmg: 1.35, espawn: 0.78, income: 2.0 },
};

/* ---------- حالة اللعبة ---------- */
const G = {
  state: 'menu', diff: 'normal', biome: 0,
  gold: 150, kills: 0, wave: 1, level: 1, xp: 0,
  time: 0, spawnTimer: 5, bossTimer: 75,
  playerBase: { hp: 1200, max: 1200 },
  enemyBase:  { hp: 1200, max: 1200 },
  units: [], projectiles: [], particles: [], floaters: [], bolts: [],
  cooldowns: {}, abilityCds: {}, castle: 0,
  upg: {}, shake: 0, bgOffset: 0, smokeT: 0, ambientT: 0,
};
function xpNeed() { return 10 + (G.level - 1) * 8; }
function biome() { return BIOMES[G.biome] || BIOMES[0]; }

function resetGame() {
  const d = DIFFS[G.diff];
  const bScale = 1 + G.biome * 0.18;                    // كل خريطة أصعب من سابقتها
  G.gold = 150; G.kills = 0; G.wave = 1; G.level = 1; G.xp = 0; G.time = 0;
  G.spawnTimer = 5; G.bossTimer = 75;
  const baseHp = Math.round((1200 + CASTLE_LEVELS[G.castle].hpBonus) * 1);
  G.playerBase = { hp: 1200 + CASTLE_LEVELS[G.castle].hpBonus, max: 1200 + CASTLE_LEVELS[G.castle].hpBonus };
  G.enemyBase = { hp: Math.round(1200 * bScale), max: Math.round(1200 * bScale) };
  G.units = []; G.projectiles = []; G.particles = []; G.floaters = []; G.bolts = [];
  G.cooldowns = {}; BAR_UNITS.forEach((t) => (G.cooldowns[t] = 0));
  G.abilityCds = {}; ABILITY_ORDER.forEach((a) => (G.abilityCds[a] = 0));
  G.upg = {}; UPGRADES.forEach((u) => (G.upg[u.id] = 0));
  G.shake = 0; G.smokeT = 0; G.ambientT = 0;
  G._d = d; G._b = bScale;
}

/* ---------- إحصاءات فعّالة مع الترقيات ---------- */
function effStats(type, side) {
  const t = UNIT_TYPES[type];
  const st = {
    hp: t.hp, dmg: t.dmg, range: t.range, speed: t.speed, atkCd: t.atkCd,
    splash: t.splash, healer: t.healer, magic: t.magic, siege: t.siege,
    reward: t.reward, size: t.size,
  };
  if (side === 'player') {
    st.dmg = Math.round(st.dmg * (1 + 0.15 * upgMult('dmg')));
    st.hp = Math.round(st.hp * (1 + 0.15 * upgMult('hp')));
    st.range = Math.round(st.range * (1 + 0.08 * upgMult('range')));
    if (st.magic) st.dmg = Math.round(st.dmg * (1 + 0.18 * upgMult('magic')));
    if (st.siege) st.dmg = Math.round(st.dmg * (1 + 0.20 * upgMult('siege')));
  } else {
    st.hp = Math.round(st.hp * G._d.ehp * (G._b || 1));
    st.dmg = Math.round(st.dmg * G._d.edmg);
  }
  return st;
}
function unitCost(type) {
  return Math.max(10, Math.round(UNIT_TYPES[type].cost * (1 - 0.07 * upgMult('cost'))));
}
function unitCd(type) {
  return UNIT_TYPES[type].cd * (1 - 0.08 * upgMult('cd'));
}
function abilityCd(id) {
  let c = ABILITIES[id].cd;
  if (id === 'fire') c *= (1 - 0.12 * upgMult('ability'));
  return c;
}

/* ---------- استدعاء الوحدات ---------- */
function spawnUnit(type, side) {
  const st = effStats(type, side);
  const t = UNIT_TYPES[type];
  const u = {
    type, side, st, t,
    x: side === 'player' ? W - SPAWN_PAD - 10 : SPAWN_PAD + 10,
    y: GROUND_Y - randi(0, 26),
    dir: side === 'player' ? -1 : 1,
    hp: st.hp, max: st.hp,
    state: 'walk', animT: rand(0, 9), atkTimer: rand(0, 0.4), atkAnim: 0,
    flash: 0, healFx: 0, dying: 0, frozen: 0,
  };
  G.units.push(u);
  return u;
}
function trySpawn(type) {
  if (G.state !== 'playing' || !type) return;
  const cost = unitCost(type);
  if (G.gold < cost || G.cooldowns[type] > 0) return;
  G.gold -= cost;
  G.cooldowns[type] = unitCd(type);
  spawnUnit(type, 'player');
  Sfx.spawn();
}

/* ---------- تنفيذ القدرات الأربع ---------- */
function castAbility(id) {
  if (G.state !== 'playing' || G.abilityCds[id] > 0) return;
  G.abilityCds[id] = abilityCd(id);
  const magicBoost = 1 + 0.18 * upgMult('magic');
  if (id === 'fire') {
    Sfx.fire();
    showToast('🔥 مطر النار!');
    G.shake = Math.max(G.shake, 5);
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        if (G.state !== 'playing') return;
        const tx = rand(W * 0.28, W * 0.62);
        G.projectiles.push({
          kind: 'meteor', x: tx + rand(-60, 60), y: -30,
          sx: tx + rand(-60, 60), sy: -30, tx, ty: GROUND_Y - randi(0, 20),
          t: 0, dur: rand(0.5, 0.8), dir: 1, dmg: Math.round(45 * magicBoost), side: 'player', splash: 60, target: { isBase: false },
        });
      }, i * 110);
    }
  } else if (id === 'bolt') {
    Sfx.bolt();
    showToast('⚡ عاصفة البرق!');
    G.shake = Math.max(G.shake, 6);
    const strikes = 3 + 2 * upgMult('storm');
    for (let i = 0; i < strikes; i++) {
      setTimeout(() => {
        if (G.state !== 'playing') return;
        const tx = rand(W * 0.2, W * 0.7);
        G.bolts.push({ x: tx, life: 0.35, max: 0.35, seed: Math.random() * 99 });
        Sfx.bolt();
        let hitAny = false;
        for (const o of G.units) {
          if (o.side === 'player' || o.dying > 0) continue;
          if (Math.abs(o.x - tx) < 46) { dealDamage(o, Math.round(70 * magicBoost), 'player'); hitAny = true; }
        }
        spawnParticles(tx, GROUND_Y - 10, 10, '#ffe97a');
        if (hitAny) G.shake = Math.max(G.shake, 4);
      }, i * 260);
    }
  } else if (id === 'heal') {
    Sfx.heal();
    showToast('💚 موجة الشفاء!');
    const healAmt = Math.round(90 * magicBoost);
    for (const o of G.units) {
      if (o.side !== 'player' || o.dying > 0) continue;
      o.hp = Math.min(o.max, o.hp + healAmt);
      o.healFx = 0.7;
      spawnParticles(o.x, o.y - 24, 5, '#7ef0a0');
    }
    const ph = Math.round(G.playerBase.max * 0.08);
    G.playerBase.hp = Math.min(G.playerBase.max, G.playerBase.hp + ph);
    addFloater(W - 70, GROUND_Y - 150, '+' + ph, '#7ef0a0', 1.1);
  } else if (id === 'freeze') {
    Sfx.freeze();
    showToast('❄️ تجمد الأعداء!');
    const dur = 3.5 + 1.2 * upgMult('frost');
    for (const o of G.units) {
      if (o.side === 'player' || o.dying > 0) continue;
      o.frozen = dur;
      spawnParticles(o.x, o.y - 20, 6, '#a8e0ff');
    }
  }
}

/* ---------- ذكاء العدو ---------- */
function enemyAI(dt) {
  G.spawnTimer -= dt;
  G.bossTimer -= dt;

  if (G.spawnTimer <= 0) {
    const wave = G.wave;
    const isBossWave = wave % 5 === 0;
    const pool = ['swordsman'];
    if (wave >= 2) pool.push('archer', 'spearman');
    if (wave >= 3) pool.push('knight', 'shieldman');
    if (wave >= 4) pool.push('healer');
    if (wave >= 6) pool.push('catapult', 'mage');
    if (wave >= 7) pool.push('elephant');
    const type = pool[randi(0, pool.length - 1)];
    const count = 1 + Math.floor(wave / 4);
    for (let i = 0; i < count; i++) setTimeout(() => { if (G.state === 'playing') spawnUnit(type, 'enemy'); }, i * 450);
    if (isBossWave) {
      setTimeout(() => { if (G.state === 'playing') { spawnUnit('megaBoss', 'enemy'); Sfx.rock(); } }, count * 450 + 300);
      showToast('⚠️ موجة زعيم! الموجة ' + wave);
    }
    G.spawnTimer = Math.max(2.2, 7 - wave * 0.45) * G._d.espawn * rand(0.8, 1.2);
    G.wave++;
    updateHud();
  }
  if (G.bossTimer <= 0) {
    spawnUnit('boss', 'enemy');
    G.bossTimer = 75;
    showToast('👹 عملاق قادم!');
    Sfx.rock();
  }
}

/* ---------- الخبرة والمستويات ---------- */
function gainXp(n) {
  G.xp += n;
  while (G.xp >= xpNeed()) {
    G.xp -= xpNeed();
    G.level++;
    const bonus = 50 + G.level * 10;
    G.gold += bonus;
    const heal = Math.round(G.playerBase.max * 0.1);
    G.playerBase.hp = Math.min(G.playerBase.max, G.playerBase.hp + heal);
    showToast(`⭐ مستوى ${G.level}! +${bonus}🪙 +${heal}❤️`);
    Sfx.lvl();
    addFloater(W / 2, 200, '⭐ مستوى ' + G.level, '#b08cff', 1.6);
  }
}

/* ---------- القتال ---------- */
function dealDamage(target, dmg, fromSide) {
  target.hp -= dmg;
  target.flash = 0.12;
  if (target.hp <= 0 && target.dying === 0) {
    target.dying = 0.8;
    Sfx.die();
    spawnParticles(target.x, target.y - 20, 8, '#8a7a62');
    if (fromSide === 'player') {
      G.kills++;
      G.gold += target.st.reward;
      gainXp(Math.max(1, Math.round(target.st.reward / 8)));
      addFloater(target.x, target.y - 40, '+' + target.st.reward, '#f4c542', 0.9);
      spawnCoins(target.x, target.y - 24);
      Sfx.coin();
      updateHud();
    }
  }
}

function attack(a, b) { dealDamage(b, a.st.dmg, a.side); }

function updateCombat(dt) {
  for (const u of G.units) {
    if (u.dying > 0) { u.dying -= dt; continue; }
    u.flash = Math.max(0, u.flash - dt);
    u.healFx = Math.max(0, u.healFx - dt);
    u.atkTimer -= dt;
    u.atkAnim = Math.max(0, (u.atkAnim || 0) - dt * 3.2);

    /* تجمد: لا يتحرك ولا يهاجم */
    if (u.frozen > 0) {
      u.frozen -= dt;
      u.state = 'frozen';
      if (Math.random() < dt * 4) G.particles.push({ x: u.x + rand(-8, 8), y: u.y - rand(10, 40), vx: 0, vy: rand(-10, 10), life: 0.5, color: '#a8e0ff', size: 2 });
      continue;
    }

    /* الكاهن: يداوي أقرب حليف جريح */
    if (u.st.healer) {
      let ally = null, adist = Infinity;
      for (const o of G.units) {
        if (o.side !== u.side || o === u || o.dying > 0 || o.hp >= o.max) continue;
        const d = Math.abs(o.x - u.x);
        if (d < adist) { adist = d; ally = o; }
      }
      if (ally && adist <= u.st.range) {
        u.state = 'attack';
        if (u.atkTimer <= 0) {
          u.atkTimer = u.st.atkCd;
          u.atkAnim = 1;
          const heal = Math.round(u.max * 0.14);
          ally.hp = Math.min(ally.max, ally.hp + heal);
          ally.healFx = 0.5;
          u.healFx = 0.3;
          addFloater(ally.x, ally.y - 44, '+' + heal, '#7ef0a0', 0.8);
          Sfx.heal();
          spawnParticles(ally.x, ally.y - 24, 4, '#7ef0a0');
        }
      } else {
        let front = null, fdist = Infinity;
        for (const o of G.units) {
          if (o.side !== u.side || o === u || o.st.healer || o.dying > 0) continue;
          const d = Math.abs(o.x - u.x);
          if (d < fdist) { fdist = d; front = o; }
        }
        u.state = 'walk';
        if (front && fdist > 90) u.x += u.dir * u.st.speed * dt;
        else if (!front) u.x += u.dir * u.st.speed * 0.6 * dt;
        u.animT += dt;
      }
      continue;
    }

    /* الوحدات القتالية */
    let target = null, tdist = Infinity;
    for (const o of G.units) {
      if (o.side === u.side || o.dying > 0) continue;
      const d = Math.abs(o.x - u.x);
      if (d < tdist) { tdist = d; target = o; }
    }
    const baseX = u.side === 'player' ? SPAWN_PAD + 10 : W - SPAWN_PAD - 10;
    const baseDist = Math.abs(baseX - u.x);
    let attackingBase = false;
    if (!target || baseDist < tdist) { target = { isBase: true, x: baseX, hp: 1 }; tdist = baseDist; attackingBase = true; }

    if (tdist <= u.st.range) {
      u.state = 'attack';
      if (u.atkTimer <= 0) {
        u.atkTimer = u.st.atkCd;
        if (u.type === 'archer') fireArrow(u, target);
        else if (u.type === 'catapult') fireRock(u, target);
        else if (u.type === 'mage') fireFireball(u, target);
        else {
          u.atkAnim = 1;
          if (attackingBase) hitBase(u); else attack(u, target);
          Sfx.hit();
          spawnParticles(target.x, target.y - 20, 4, '#e8d9b5');
          if (u.type === 'elephant') { Sfx.stomp(); G.shake = Math.max(G.shake, 3); spawnParticles(u.x + u.dir * 20, u.y, 6, 'rgba(180,150,110,0.6)'); }
        }
      }
    } else {
      u.state = 'walk';
      u.x += u.dir * u.st.speed * dt;
      u.animT += dt;
      if ((u.type === 'knight' || u.type === 'boss' || u.type === 'megaBoss' || u.type === 'elephant') && Math.random() < dt * 8) {
        G.particles.push({ x: u.x - u.dir * 8, y: u.y, vx: -u.dir * rand(10, 30), vy: rand(-25, -8), life: rand(0.25, 0.5), color: 'rgba(180,150,110,0.55)', size: randi(2, 4) });
      }
      if (u.st.healer && Math.random() < dt * 3) {
        G.particles.push({ x: u.x + rand(-6, 10), y: u.y - rand(20, 40), vx: rand(-8, 8), vy: rand(-18, -6), life: rand(0.4, 0.8), color: '#7ef0a0', size: 2 });
      }
      if (u.type === 'mage' && Math.random() < dt * 4) {
        G.particles.push({ x: u.x + rand(-6, 10), y: u.y - rand(24, 44), vx: rand(-8, 8), vy: rand(-20, -8), life: rand(0.3, 0.6), color: '#ffb347', size: 2 });
      }
      if (u.type === 'megaBoss' && Math.random() < dt * 5) {
        G.particles.push({ x: u.x + rand(-16, 16), y: u.y - rand(10, 70), vx: rand(-6, 6), vy: rand(-30, -12), life: rand(0.4, 0.9), color: 'rgba(120,60,160,0.6)', size: randi(2, 4) });
      }
    }
  }

  G.units = G.units.filter((u) => !(u.dying <= 0 && u.hp <= 0));
}

function hitBase(u) {
  const base = u.side === 'player' ? G.enemyBase : G.playerBase;
  base.hp -= u.st.dmg;
  G.shake = Math.max(G.shake, 3);
  spawnParticles(u.side === 'player' ? SPAWN_PAD + 20 : W - SPAWN_PAD - 20, GROUND_Y - 30, 6, '#b8860b');
  if (base.hp <= 0) endGame(u.side === 'player');
  updateHud();
}

/* ---------- المقذوفات ---------- */
function fireArrow(u, target) {
  u.atkAnim = 1;
  const tx = target.x;
  const ty = target.isBase ? GROUND_Y - 40 : target.y - 20;
  G.projectiles.push({
    kind: 'arrow', x: u.x + u.dir * 14, y: u.y - 26,
    sx: u.x, sy: u.y - 26, tx, ty,
    t: 0, dur: Math.max(0.25, Math.abs(tx - u.x) / 420),
    dir: u.dir, dmg: u.st.dmg, side: u.side, target,
  });
  Sfx.arrow();
}

function fireRock(u, target) {
  u.atkAnim = 1;
  const tx = target.x, ty = target.isBase ? GROUND_Y - 30 : target.y - 16;
  G.projectiles.push({
    kind: 'rock', x: u.x, y: u.y - 40,
    sx: u.x, sy: u.y - 40, tx, ty,
    t: 0, dur: Math.max(0.5, Math.abs(tx - u.x) / 260),
    dir: u.dir, dmg: u.st.dmg, side: u.side, splash: u.st.splash, target,
  });
  Sfx.tone(140, 0.15, 'triangle', 0.06, 60);
}

function fireFireball(u, target) {
  u.atkAnim = 1;
  const tx = target.x, ty = target.isBase ? GROUND_Y - 30 : target.y - 18;
  G.projectiles.push({
    kind: 'fireball', x: u.x + u.dir * 10, y: u.y - 40,
    sx: u.x, sy: u.y - 40, tx, ty,
    t: 0, dur: Math.max(0.35, Math.abs(tx - u.x) / 300),
    dir: u.dir, dmg: u.st.dmg, side: u.side, splash: u.st.splash, target,
  });
  Sfx.magic();
}

function updateProjectiles(dt) {
  for (const p of G.projectiles) {
    p.t += dt;
    const k = clamp(p.t / p.dur, 0, 1);
    p.x = p.sx + (p.tx - p.sx) * k;
    p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * (p.kind === 'rock' ? 90 : p.kind === 'fireball' ? 40 : p.kind === 'meteor' ? 0 : 34);
    if (p.kind === 'meteor' && Math.random() < 0.5) {
      G.particles.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-30, 10), life: rand(0.2, 0.4), color: Math.random() < 0.5 ? '#ff9a3d' : '#ffd9a8', size: 3 });
    }
    if (p.kind === 'fireball' && Math.random() < 0.7) {
      G.particles.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-20, 5), life: rand(0.15, 0.35), color: Math.random() < 0.5 ? '#ff9a3d' : '#ffd9a8', size: 2 });
    }
    if (k >= 1) {
      p.dead = true;
      if (p.kind === 'arrow') {
        const tgt = p.target && !p.target.isBase && G.units.includes(p.target) && p.target.dying <= 0 ? p.target : null;
        if (tgt) { dealDamage(tgt, p.dmg, p.side); spawnParticles(tgt.x, tgt.y - 20, 3, '#e8d9b5'); }
        else if (p.target && p.target.isBase) hitBaseById(p.side, p.dmg);
      } else {
        // حجر/كرة نارية/نيزك: ضرر جماعي
        G.shake = Math.max(G.shake, p.kind === 'meteor' ? 6 : p.kind === 'fireball' ? 4 : 7);
        Sfx.rock();
        spawnParticles(p.tx, p.ty, p.kind === 'meteor' ? 18 : p.kind === 'fireball' ? 12 : 14, p.kind === 'rock' ? '#b8a888' : '#ff9a3d');
        if (p.kind !== 'rock') spawnParticles(p.tx, p.ty, 8, '#ffd9a8');
        for (const o of G.units) {
          if (o.side === p.side || o.dying > 0) continue;
          if (Math.abs(o.x - p.tx) < p.splash && Math.abs(o.y - p.ty) < 40) dealDamage(o, p.dmg, p.side);
        }
        if (p.target && p.target.isBase) hitBaseById(p.side, p.dmg);
      }
    }
  }
  G.projectiles = G.projectiles.filter((p) => !p.dead);
  for (const b of G.bolts) b.life -= dt;
  G.bolts = G.bolts.filter((b) => b.life > 0);
}

function hitBaseById(side, dmg) {
  const base = side === 'player' ? G.enemyBase : G.playerBase;
  base.hp -= dmg;
  G.shake = Math.max(G.shake, 3);
  if (base.hp <= 0) endGame(side === 'player');
  updateHud();
}

/* ---------- جزيئات ---------- */
function spawnParticles(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    G.particles.push({ x, y, vx: rand(-70, 70), vy: rand(-130, -20), life: rand(0.3, 0.7), color, size: randi(2, 4) });
  }
}
function spawnCoins(x, y) {
  for (let i = 0; i < 3; i++) {
    G.particles.push({ x: x + rand(-8, 8), y, vx: rand(-40, 40), vy: rand(-160, -90), life: rand(0.5, 0.8), color: '#f4c542', size: 4, coin: true });
  }
}
function addFloater(x, y, text, color, life = 1) {
  G.floaters.push({ x, y, text, color, life, max: life });
}
function updateFx(dt) {
  for (const p of G.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.coin ? 260 : 320) * dt; }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const f of G.floaters) { f.life -= dt; f.y -= 34 * dt; }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  G.shake = Math.max(0, G.shake - dt * 18);
  G.smokeT -= dt;
  if (G.smokeT <= 0) {
    G.smokeT = 0.25;
    [['player', G.playerBase], ['enemy', G.enemyBase]].forEach(([side, base]) => {
      if (base.hp / base.max < 0.5 && Math.random() < 0.6) {
        const bx = side === 'player' ? W - 63 : 63;
        G.particles.push({ x: bx + rand(-10, 10), y: GROUND_Y - 130, vx: rand(-8, 8), vy: rand(-40, -20), life: rand(0.8, 1.4), color: 'rgba(90,80,75,0.7)', size: randi(3, 6) });
      }
    });
  }
  /* جزيئات البيئة حسب الخريطة */
  G.ambientT -= dt;
  if (G.ambientT <= 0) {
    G.ambientT = 0.12;
    const b = biome();
    if (b.ambient === 'sand' && Math.random() < 0.5) {
      G.particles.push({ x: rand(0, W), y: rand(60, 300), vx: rand(-60, -20), vy: rand(4, 14), life: rand(1, 2), color: 'rgba(232,200,150,0.4)', size: 2, ambient: true });
    } else if (b.ambient === 'leaves' && Math.random() < 0.6) {
      G.particles.push({ x: rand(0, W), y: rand(40, 260), vx: rand(-30, -10), vy: rand(18, 34), life: rand(1.2, 2.2), color: Math.random() < 0.5 ? '#5f8f3f' : '#7aa84a', size: 3, ambient: true });
    } else if (b.ambient === 'snow' && Math.random() < 0.8) {
      G.particles.push({ x: rand(0, W), y: rand(20, 240), vx: rand(-14, 14), vy: rand(24, 44), life: rand(1.5, 2.6), color: 'rgba(240,248,255,0.85)', size: 2, ambient: true });
    } else if (b.ambient === 'ember' && Math.random() < 0.7) {
      G.particles.push({ x: rand(0, W), y: GROUND_Y - rand(0, 30), vx: rand(-10, 10), vy: rand(-60, -30), life: rand(0.8, 1.6), color: Math.random() < 0.5 ? '#ff8a3d' : '#ffd9a8', size: 2, ambient: true });
    } else if (b.ambient === 'soul' && Math.random() < 0.5) {
      G.particles.push({ x: rand(0, W), y: GROUND_Y - rand(0, 60), vx: rand(-8, 8), vy: rand(-40, -18), life: rand(1, 2), color: 'rgba(170,120,255,0.5)', size: 3, ambient: true });
    }
  }
}

/* ---------- الرسم: السماء ودورة ليل/نهار حسب الخريطة ---------- */
const DAY_LEN = 90;
function dayPhase() { return (Math.sin((G.time % DAY_LEN) / DAY_LEN * Math.PI * 2 - Math.PI / 2) + 1) / 2; }

function drawSky() {
  const bands = biome().sky;
  const bh = 410 / bands.length;
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, i * bh, W, bh + 1);
  }
  const night = 1 - dayPhase();
  if (night > 0.15) {
    ctx.fillStyle = `rgba(255,255,255,${(night - 0.15) * 0.9})`;
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 40) % W, sy = (i * 61) % 160;
      if ((i * 7 + Math.floor(G.time * 2)) % 11 !== 0) ctx.fillRect(sx, sy, 2, 2);
    }
  }
  const arc = Math.PI * (0.15 + 0.7 * dayPhase());
  const cx = 120 + 720 * (dayPhase());
  const cy = 210 - Math.sin(arc) * 150;
  if (dayPhase() > 0.25) {
    ctx.fillStyle = 'rgba(247,180,60,0.35)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + G.time * 0.3;
      ctx.fillRect(cx + Math.cos(a) * 36 - 5, cy + Math.sin(a) * 36 - 5, 10, 10);
    }
    ctx.fillStyle = '#ff9a3d'; ctx.fillRect(cx - 21, cy - 21, 42, 42);
    ctx.fillStyle = '#f7d358'; ctx.fillRect(cx - 17, cy - 17, 34, 34);
    ctx.fillStyle = '#ffe89a'; ctx.fillRect(cx - 11, cy - 11, 22, 22);
    ctx.fillStyle = '#fff8d8'; ctx.fillRect(cx - 5, cy - 5, 10, 10);
  } else {
    const mx = 840 - 720 * dayPhase();
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(mx - 16, 72, 32, 32);
    ctx.fillStyle = '#cfc9b8';
    ctx.fillRect(mx - 8, 78, 6, 6); ctx.fillRect(mx + 4, 88, 5, 5); ctx.fillRect(mx - 2, 94, 4, 4);
    ctx.fillStyle = '#f4f1e6'; ctx.fillRect(mx - 12, 76, 4, 4);
  }
  if (night > 0.05) {
    ctx.fillStyle = `rgba(16,12,40,${night * 0.42})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- الرسم: خلفية الخريطة (parallax + ديكور) ---------- */
function drawParallax() {
  const b = biome();
  const off1 = (G.bgOffset * 0.25) % 480;
  const off2 = (G.bgOffset * 0.6) % 480;

  if (b.decor === 'ziggurat') {
    drawZiggurat(120 - off1, 300, 1);
    drawZiggurat(600 - off1, 320, 0.8);
    drawColumns(340 - off1, 330);
  } else if (b.decor === 'trees') {
    drawTree(100 - off1, 320, 1.1);
    drawTree(560 - off1, 330, 0.9);
    drawTree(760 - off1, 310, 1.2);
    drawBush(340 - off1, 350);
  } else if (b.decor === 'ice') {
    drawIcePeak(110 - off1, 330, 1.2);
    drawIcePeak(580 - off1, 340, 0.9);
    drawIcePeak(740 - off1, 320, 1.1);
  } else if (b.decor === 'lava') {
    drawVolcano(140 - off1, 330, 1.3);
    drawVolcano(620 - off1, 340, 0.9);
    drawLavaCrack(360 - off1, 360);
  } else if (b.decor === 'crystal') {
    drawCrystal(120 - off1, 330, 1.1);
    drawCrystal(600 - off1, 340, 0.85);
    drawCrystal(780 - off1, 320, 1.2);
    drawSkullRock(360 - off1, 355);
  }

  // تلال بعيدة
  ctx.fillStyle = b.hill;
  for (let i = -1; i < 3; i++) {
    const bx = i * 480 - off2;
    ctx.fillRect(bx, 380, 200, 90);
    ctx.fillRect(bx + 220, 400, 260, 70);
  }
  // أرض
  ctx.fillStyle = b.ground;
  ctx.fillRect(0, GROUND_Y - 60, W, H - GROUND_Y + 60);
  ctx.fillStyle = b.groundDark;
  for (let i = 0; i < W; i += 48) ctx.fillRect(i + ((G.bgOffset * 0.9) % 48), GROUND_Y - 20, 24, 4);
  ctx.fillStyle = b.groundLine;
  ctx.fillRect(0, GROUND_Y + 30, W, 6);
}

function drawZiggurat(x, y, s) {
  const u = Math.round(10 * s);
  ctx.fillStyle = '#6e5236';
  for (let i = 0; i < 4; i++) {
    const w = (8 - i * 2) * u, h = u;
    ctx.fillRect(x + i * u, y - i * (u + 2), w, h);
  }
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(x + 3 * u, y - 4 * (u + 2), 2 * u, u);
}
function drawColumns(x, y) {
  ctx.fillStyle = '#7d6a52';
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 60;
    ctx.fillRect(cx, y - 50, 10, 50);
    ctx.fillRect(cx - 3, y - 56, 16, 6);
  }
}
function drawTree(x, y, s) {
  const h = Math.round(60 * s);
  ctx.fillStyle = '#5c3a1e'; ctx.fillRect(x, y - h * 0.4, 8, h * 0.4);
  ctx.fillStyle = '#2e5c30';
  ctx.fillRect(x - 14, y - h * 0.55, 36, 18);
  ctx.fillRect(x - 10, y - h * 0.8, 28, 16);
  ctx.fillRect(x - 5, y - h, 18, 14);
  ctx.fillStyle = '#3e7a40';
  ctx.fillRect(x - 10, y - h * 0.75, 20, 8);
  ctx.fillRect(x - 4, y - h + 3, 10, 6);
}
function drawBush(x, y) {
  ctx.fillStyle = '#2e5c30';
  ctx.fillRect(x, y - 10, 26, 12);
  ctx.fillRect(x + 4, y - 16, 18, 8);
  ctx.fillStyle = '#c94a3d';
  ctx.fillRect(x + 6, y - 13, 3, 3); ctx.fillRect(x + 16, y - 8, 3, 3);
}
function drawIcePeak(x, y, s) {
  const h = Math.round(90 * s);
  ctx.fillStyle = '#c2d4e6';
  for (let i = 0; i < h; i += 6) {
    const w = Math.max(4, (h - i) * 0.5);
    ctx.fillRect(x + (h * 0.25) - w / 2, y - i, w, 6);
  }
  ctx.fillStyle = '#e8f2fa';
  for (let i = h * 0.55; i < h; i += 6) {
    const w = Math.max(3, (h - i) * 0.5);
    ctx.fillRect(x + (h * 0.25) - w / 2, y - i, w, 6);
  }
}
function drawVolcano(x, y, s) {
  const h = Math.round(80 * s);
  ctx.fillStyle = '#3a241e';
  for (let i = 0; i < h; i += 6) {
    const w = Math.max(8, (h - i) * 0.9);
    ctx.fillRect(x + h * 0.45 - w / 2, y - i, w, 6);
  }
  ctx.fillStyle = '#ff8a3d';
  ctx.fillRect(x + h * 0.45 - 6, y - h - 4, 12, 5);
  ctx.fillStyle = '#ffd9a8';
  ctx.fillRect(x + h * 0.45 - 3, y - h - 7, 6, 4);
}
function drawLavaCrack(x, y) {
  ctx.fillStyle = '#ff6a2a';
  ctx.fillRect(x, y, 40, 3);
  ctx.fillRect(x + 12, y + 3, 4, 8);
  ctx.fillRect(x + 30, y - 6, 3, 6);
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(x + 6, y, 10, 2);
}
function drawCrystal(x, y, s) {
  const h = Math.round(50 * s);
  ctx.fillStyle = '#7a4ab2';
  ctx.fillRect(x, y - h, 8, h);
  ctx.fillRect(x + 10, y - h * 0.6, 6, h * 0.6);
  ctx.fillStyle = '#b08cff';
  ctx.fillRect(x + 2, y - h + 6, 3, h - 10);
  ctx.fillRect(x + 11, y - h * 0.6 + 4, 2, h * 0.6 - 8);
}
function drawSkullRock(x, y) {
  ctx.fillStyle = '#5a4a6a';
  ctx.fillRect(x, y - 18, 22, 18);
  ctx.fillStyle = '#221830';
  ctx.fillRect(x + 4, y - 12, 5, 5);
  ctx.fillRect(x + 13, y - 12, 5, 5);
  ctx.fillRect(x + 7, y - 4, 8, 3);
}

/* ---------- الرسم: القلعة (3 مستويات) ---------- */
function drawBase(side) {
  const isPlayer = side === 'player';
  const x = isPlayer ? W - 96 : 30;
  const y = GROUND_Y - 118;
  const main = isPlayer ? '#3a6ea5' : '#a03c38';
  const dark = isPlayer ? '#2a4d78' : '#7a2a26';
  const roof = isPlayer ? '#6fb1ef' : '#e07a5f';
  const lv = isPlayer ? G.castle : 0;

  ctx.fillStyle = dark; ctx.fillRect(x, y + 20, 66, 98);
  ctx.fillStyle = main; ctx.fillRect(x + 4, y + 24, 58, 90);
  ctx.fillStyle = dark;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 16, y + 12, 10, 14);
  ctx.fillStyle = roof; ctx.fillRect(x, y + 8, 66, 8);
  ctx.fillStyle = '#241b12';
  ctx.fillRect(x + 24, y + 78, 18, 36);
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(x + 30, y - 34, 4, 44);
  ctx.fillStyle = isPlayer ? '#4a90d9' : '#d94a4a';
  const flagWave = Math.sin(G.time * 3 + (isPlayer ? 0 : 2)) * 2;
  ctx.fillRect(x + 34, y - 34 + flagWave, 22, 14);

  if (lv >= 1) {   // أبراج جانبية
    ctx.fillStyle = dark; ctx.fillRect(x - 10, y + 40, 14, 78);
    ctx.fillStyle = main; ctx.fillRect(x - 8, y + 44, 10, 70);
    ctx.fillStyle = roof; ctx.fillRect(x - 12, y + 34, 18, 7);
    ctx.fillStyle = dark; ctx.fillRect(x + 62, y + 40, 14, 78);
    ctx.fillStyle = main; ctx.fillRect(x + 64, y + 44, 10, 70);
    ctx.fillStyle = roof; ctx.fillRect(x + 60, y + 34, 18, 7);
  }
  if (lv >= 2) {   // برج مركزي أعلى + رايات ذهبية
    ctx.fillStyle = dark; ctx.fillRect(x + 18, y - 26, 30, 50);
    ctx.fillStyle = main; ctx.fillRect(x + 21, y - 22, 24, 44);
    ctx.fillStyle = roof; ctx.fillRect(x + 16, y - 32, 34, 8);
    ctx.fillStyle = '#f4c542';
    ctx.fillRect(x + 24, y - 16, 4, 4); ctx.fillRect(x + 38, y - 16, 4, 4);
    ctx.fillStyle = '#f4c542';
    ctx.fillRect(x - 8, y + 22, 10, 4);
    ctx.fillRect(x + 64, y + 22, 10, 4);
  }

  const base = isPlayer ? G.playerBase : G.enemyBase;
  const bw = 70, ratio = clamp(base.hp / base.max, 0, 1);
  ctx.fillStyle = '#241b12'; ctx.fillRect(x - 2, y - 46, bw + 4, 10);
  ctx.fillStyle = isPlayer ? '#4a90d9' : '#d94a4a';
  ctx.fillRect(x, y - 44, bw * ratio, 6);
}

/* ---------- الرسم: الوحدات ---------- */
function drawUnit(u) {
  const pal = u.side === 'player' ? PAL_PLAYER : PAL_ENEMY;
  const o = RIGS[u.type] || RIGS.swordsman;
  const scale = o.scale || 1.5;
  const f = u.side === 'player' ? -1 : 1;
  const swing = u.atkAnim > 0 ? Math.sin((1 - u.atkAnim) * Math.PI) : 0;

  ctx.fillStyle = 'rgba(20,12,8,0.3)';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + 2, 13 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (u.healFx > 0) {
    ctx.globalAlpha = u.healFx * 1.4;
    ctx.strokeStyle = '#7ef0a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(u.x, u.y - 24 * scale, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  let alpha = 1;
  if (u.dying > 0) {
    alpha = clamp(u.dying / 0.8, 0, 1);
    ctx.translate(u.x, u.y + (1 - alpha) * 14);
    ctx.globalAlpha = alpha;
    ctx.rotate((1 - alpha) * (u.side === 'player' ? -0.9 : 0.9));
  } else {
    ctx.translate(u.x + f * swing * 2.5, u.y);
  }
  if (u.flash > 0) ctx.globalAlpha = (alpha) * (0.55 + Math.sin(G.time * 60) * 0.25);
  ctx.scale(f * scale, scale);
  drawUnitRig(ctx, u, pal);
  ctx.restore();

  /* جليد التجمد */
  if (u.frozen > 0 && u.dying <= 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#a8e0ff';
    ctx.fillRect(u.x - 12 * scale, u.y - 40 * scale, 24 * scale, 42 * scale);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#e0f4ff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(u.x - 12 * scale, u.y - 40 * scale, 24 * scale, 42 * scale);
    ctx.globalAlpha = 1;
  }

  if (u.dying <= 0) {
    const bw = 40 * scale, ratio = clamp(u.hp / u.max, 0, 1);
    const by = u.y - (o.top * scale + 10);
    ctx.fillStyle = '#241b12'; ctx.fillRect(u.x - bw / 2 - 1, by - 1, bw + 2, 7);
    ctx.fillStyle = u.side === 'player' ? '#5fbf6f' : '#e05555';
    ctx.fillRect(u.x - bw / 2, by, bw * ratio, 5);
    if (u.type === 'megaBoss' || u.type === 'boss') {
      ctx.fillStyle = '#f4c542';
      ctx.font = '700 11px Changa, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(u.t.icon + ' ' + u.t.name, u.x, by - 6);
    }
  }
}

/* ---------- الرسم: مقذوفات وجزيئات وبرق ---------- */
function drawProjectiles() {
  for (const p of G.projectiles) {
    if (p.kind === 'arrow') {
      ctx.strokeStyle = 'rgba(216,201,168,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dir * 20, p.y + 3);
      ctx.lineTo(p.x - p.dir * 8, p.y);
      ctx.stroke();
      ctx.strokeStyle = '#d8c9a8';
      ctx.beginPath();
      ctx.moveTo(p.x - p.dir * 8, p.y);
      ctx.lineTo(p.x + p.dir * 6, p.y);
      ctx.stroke();
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(p.x + p.dir * 6 - 1, p.y - 2, 3, 3);
    } else if (p.kind === 'meteor') {
      ctx.fillStyle = '#ff9a3d'; ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
      ctx.fillStyle = '#ffd9a8'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.fillStyle = 'rgba(255,120,40,0.4)'; ctx.fillRect(p.x - 10, p.y - 14, 20, 20);
    } else if (p.kind === 'fireball') {
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
      ctx.fillStyle = '#ffd9a8'; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      ctx.fillStyle = 'rgba(255,120,40,0.35)'; ctx.fillRect(p.x - 9, p.y - 9, 18, 18);
    } else {
      ctx.fillStyle = '#8a7a62'; ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
      ctx.fillStyle = '#a89878'; ctx.fillRect(p.x - 4, p.y - 4, 6, 6);
    }
  }
  /* البرق: خط متعرج من السماء */
  for (const b of G.bolts) {
    const a = clamp(b.life / b.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 3;
    ctx.beginPath();
    let y = 0, x = b.x;
    ctx.moveTo(x, y);
    let seed = b.seed;
    while (y < GROUND_Y - 10) {
      y += 40;
      x = b.x + Math.sin(seed + y * 0.05) * 18;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(b.x, GROUND_Y - 6);
    ctx.stroke();
    ctx.strokeStyle = '#fff8d0'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawParticles() {
  for (const p of G.particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    if (p.coin) {
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    } else {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}
function drawFloaters() {
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
    ctx.font = '700 18px Changa, sans-serif';
    ctx.fillStyle = '#241b12';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

/* ---------- الحلقة الرئيسية ---------- */
let lastT = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;

  if (G.state === 'playing') {
    G.time += dt;
    G.bgOffset += dt * 8;
    G.gold += (G._d.income + 1.5 * upgMult('income')) * dt;
    for (const k in G.cooldowns) G.cooldowns[k] = Math.max(0, G.cooldowns[k] - dt);
    for (const a of ABILITY_ORDER) G.abilityCds[a] = Math.max(0, G.abilityCds[a] - dt);
    enemyAI(dt);
    updateCombat(dt);
    updateProjectiles(dt);
    updateFx(dt);
    updateUnitBar();
    updateAbilityBar();
    updateHud();
  } else if (G.state === 'menu') {
    G.time += dt * 0.3;
    G.bgOffset += dt * 4;
  }

  render();
}

function render() {
  ctx.save();
  if (G.shake > 0) ctx.translate(randi(-G.shake, G.shake), randi(-G.shake, G.shake));
  drawSky();
  drawParallax();
  drawBase('enemy');
  drawBase('player');
  const sorted = [...G.units].sort((a, b) => a.y - b.y);
  for (const u of sorted) drawUnit(u);
  drawProjectiles();
  drawParticles();
  drawFloaters();
  ctx.restore();
}

/* ---------- الواجهة ---------- */
let toastTimer = null;
function showToast(text) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    $('stage').appendChild(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function updateHud() {
  $('gold-val').textContent = Math.floor(G.gold);
  $('wave-val').textContent = G.wave;
  $('kills-val').textContent = G.kills;
  $('level-val').textContent = G.level;
  $('xp-fill').style.width = clamp(G.xp / xpNeed() * 100, 0, 100) + '%';
  $('player-base-fill').style.width = clamp(G.playerBase.hp / G.playerBase.max * 100, 0, 100) + '%';
  $('enemy-base-fill').style.width = clamp(G.enemyBase.hp / G.enemyBase.max * 100, 0, 100) + '%';
}

function buildUnitBar() {
  const bar = $('unit-bar');
  bar.innerHTML = '';
  BAR_UNITS.forEach((type, i) => {
    const t = UNIT_TYPES[type];
    const btn = document.createElement('button');
    btn.className = 'unit-btn';
    btn.id = 'ub-' + type;
    btn.innerHTML = `<span class="u-key">${i + 1}</span><span class="u-icon">${t.icon}</span><span class="u-name">${t.name}</span><span class="u-cost">🪙 <b class="u-cost-v">${t.cost}</b></span><div class="u-cd" style="transform:scaleY(0)"></div>`;
    btn.addEventListener('click', () => trySpawn(type));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); trySpawn(type); }, { passive: false });
    bar.appendChild(btn);
  });
}

function updateUnitBar() {
  for (const type of BAR_UNITS) {
    const btn = $('ub-' + type);
    if (!btn) continue;
    const cost = unitCost(type);
    const cd = G.cooldowns[type];
    const cdMax = unitCd(type);
    btn.disabled = cd > 0 || G.gold < cost;
    btn.querySelector('.u-cd').style.transform = `scaleY(${cdMax > 0 ? cd / cdMax : 0})`;
    const cv = btn.querySelector('.u-cost-v');
    if (cv && cv.textContent != cost) cv.textContent = cost;
  }
}

function updateAbilityBar() {
  for (const id of ABILITY_ORDER) {
    const btn = $('ab-' + id);
    if (!btn) continue;
    const cd = G.abilityCds[id];
    const cdMax = abilityCd(id);
    btn.disabled = cd > 0;
    btn.classList.toggle('ready', cd <= 0);
    btn.querySelector('.a-cd').style.transform = `scaleY(${cdMax > 0 ? cd / cdMax : 0})`;
  }
}

/* ---------- لوحة الترقيات + القلعة ---------- */
function buildUpgPanel() {
  const panel = $('upg-panel');
  let html = '<h2>🛠️ ترقيات المملكة</h2>';

  /* بطاقة القلعة */
  const cc = castleCost();
  const cl = CASTLE_LEVELS[G.castle];
  html += `
    <div class="upg-item castle-item">
      <span style="font-size:24px">🏰</span>
      <div class="upg-info">
        <div class="up-name">${cl.name} <span class="up-lv">مستوى ${G.castle + 1}/3</span></div>
        <div class="up-desc">${cc ? `طوّر إلى ${CASTLE_LEVELS[G.castle + 1].name}: +${CASTLE_LEVELS[G.castle + 1].hpBonus} صحة` : 'أقصى مستوى ✓'}</div>
      </div>
      <button class="upg-buy" id="castle-buy" ${cc === null || G.gold < cc ? 'disabled' : ''}>
        ${cc === null ? 'مكتمل ✓' : '🪙 ' + cc}
      </button>
    </div>`;

  UPGRADES.forEach((u) => {
    const lv = G.upg[u.id];
    const maxed = lv >= u.max;
    const cost = upgCost(u);
    html += `
      <div class="upg-item">
        <span style="font-size:24px">${u.icon}</span>
        <div class="upg-info">
          <div class="up-name">${u.name} <span class="up-lv">مستوى ${lv}/${u.max}</span></div>
          <div class="up-desc">${u.desc}</div>
        </div>
        <button class="upg-buy" data-upg="${u.id}" ${maxed || G.gold < cost ? 'disabled' : ''}>
          ${maxed ? 'مكتمل ✓' : '🪙 ' + cost}
        </button>
      </div>`;
  });
  html += '<button id="upg-close" class="upg-close">إغلاق ✕</button>';
  panel.innerHTML = html;
  panel.querySelectorAll('.upg-buy[data-upg]').forEach((b) => {
    b.addEventListener('click', () => buyUpgrade(b.dataset.upg));
    b.addEventListener('touchstart', (e) => { e.preventDefault(); buyUpgrade(b.dataset.upg); }, { passive: false });
  });
  const cb = $('castle-buy');
  if (cb) {
    cb.addEventListener('click', buyCastle);
    cb.addEventListener('touchstart', (e) => { e.preventDefault(); buyCastle(); }, { passive: false });
  }
  $('upg-close').addEventListener('click', closeUpg);
  $('upg-close').addEventListener('touchstart', (e) => { e.preventDefault(); closeUpg(); }, { passive: false });
}

function buyUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || G.upg[id] >= u.max) return;
  const cost = upgCost(u);
  if (G.gold < cost) return;
  G.gold -= cost;
  G.upg[id]++;
  if (id === 'basehp') {
    G.playerBase.max += 250;
    G.playerBase.hp += 250;
  }
  Sfx.coin();
  showToast(`${u.icon} ${u.name} → مستوى ${G.upg[id]}`);
  buildUpgPanel();
  updateHud();
}

function buyCastle() {
  const cc = castleCost();
  if (cc === null || G.gold < cc) return;
  G.gold -= cc;
  G.castle++;
  const bonus = CASTLE_LEVELS[G.castle].hpBonus - CASTLE_LEVELS[G.castle - 1].hpBonus;
  G.playerBase.max += bonus;
  G.playerBase.hp += bonus;
  Sfx.lvl();
  showToast(`🏰 ${CASTLE_LEVELS[G.castle].name}! +${bonus} صحة`);
  buildUpgPanel();
  updateHud();
}

let upgPrevState = null;
function openUpg() {
  if (G.state !== 'playing') return;
  buildUpgPanel();
  $('upg-panel').classList.remove('hidden');
  upgPrevState = G.state;
  G.state = 'paused';
}
function closeUpg() {
  $('upg-panel').classList.add('hidden');
  if (upgPrevState === 'playing' && G.state === 'paused') G.state = 'playing';
  upgPrevState = null;
}

/* ---------- بداية/نهاية ---------- */
function startGame(diff) {
  Sfx.ensure();
  if (diff) G.diff = diff;
  resetGame();
  G.state = 'playing';
  $('start-screen').classList.add('hidden');
  $('end-screen').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('upg-panel').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('base-bars').classList.remove('hidden');
  $('ability-bar').classList.remove('hidden');
  $('bottom-bar').classList.remove('hidden');
  const b = biome();
  $('biome-chip').textContent = b.icon + ' ' + b.name;
  updateHud();
}

function endGame(won) {
  if (G.state === 'over') return;
  G.state = 'over';
  won ? Sfx.win() : Sfx.lose();
  $('end-title').textContent = won ? 'انتصار! 🏆' : 'هزيمة 💀';
  $('end-title').style.color = won ? 'var(--gold)' : '#e05555';
  $('end-sub').textContent = won
    ? `دمّرت قاعدة العدو في ${biome().name}!`
    : 'سقطت قاعدتك... أعد التنظيم وحاول مجدداً!';
  const mins = Math.floor(G.time / 60), secs = Math.floor(G.time % 60);
  $('end-stats').innerHTML = `
    <span>الموجات: <b>${G.wave}</b></span>
    <span>القتلى: <b>${G.kills}</b></span>
    <span>المستوى: <b>${G.level}</b></span>
    <span>الزمن: <b>${mins}:${String(secs).padStart(2, '0')}</b></span>`;
  $('end-screen').classList.remove('hidden');
  $('bottom-bar').classList.add('hidden');
  $('ability-bar').classList.add('hidden');
  $('base-bars').classList.add('hidden');
  $('upg-panel').classList.add('hidden');
}

function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; $('pause-screen').classList.remove('hidden'); }
  else if (G.state === 'paused') { G.state = 'playing'; $('pause-screen').classList.add('hidden'); }
}

/* ---------- شعار شاشة البداية ---------- */
function drawEmblem() {
  const c = $('emblem'), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const S = 10;
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x * S, y * S, S, S); };
  const leaf = '#5f8f3f', leafD = '#43682c';
  for (let i = 0; i < 7; i++) {
    px(2 + (i < 4 ? i : 3 - (i - 4) * 0), 13 - i, i % 2 ? leaf : leafD);
    px(13, 13 - i, i % 2 ? leafD : leaf);
  }
  const bronze = '#c98a3d', bronzeD = '#8a5a20', gold = '#f4c542';
  for (let y = 3; y <= 12; y++) {
    const wdt = y <= 5 ? (y - 1) : (y >= 10 ? 13 - y : 5);
    for (let x = 8 - wdt; x <= 7 + wdt; x++) px(x, y, (x === 8 - wdt || x === 7 + wdt || y === 12) ? bronzeD : bronze);
  }
  const steel = '#d8dee6';
  for (let i = 0; i < 7; i++) { px(5 + i, 5 + i, steel); px(10 - i, 5 + i, steel); }
  px(4, 4, gold); px(11, 4, gold); px(4, 11, gold); px(11, 11, gold);
  px(7, 8, gold); px(8, 8, gold); px(7, 7, gold); px(8, 7, gold);
}

/* ---------- بناء شبكة الخرائط ---------- */
function buildBiomeGrid() {
  const grid = $('biome-grid');
  grid.innerHTML = '';
  BIOMES.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = 'biome-btn' + (i === G.biome ? ' selected' : '');
    btn.innerHTML = `<span class="b-ic">${b.icon}</span><span class="b-name">${b.name}</span><span class="b-lv">صعوبة ×${(1 + i * 0.18).toFixed(1)}</span>`;
    btn.addEventListener('click', () => { G.biome = i; buildBiomeGrid(); });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); G.biome = i; buildBiomeGrid(); }, { passive: false });
    grid.appendChild(btn);
  });
}

/* ---------- الجوال: ملء شاشة + تلميح تدوير ---------- */
function isTouch() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }
function isPortrait() { return window.innerHeight > window.innerWidth; }

function tryFullscreenLandscape() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) req.call(el).then(() => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }).catch(() => {});
}

function checkRotateHint() {
  if (isTouch() && isPortrait() && G.state === 'menu' && $('rotate-hint').classList.contains('hidden') && !sessionStorage.getItem('rhDismissed')) {
    $('rotate-hint').classList.remove('hidden');
  }
}
window.addEventListener('resize', () => {
  if (!isPortrait()) $('rotate-hint').classList.add('hidden');
  else checkRotateHint();
});

/* ---------- الإدخال ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '9') trySpawn(BAR_UNITS[+e.key - 1]);
  else if (e.key === 'q' || e.key === 'Q') castAbility('fire');
  else if (e.key === 'w' || e.key === 'W') castAbility('bolt');
  else if (e.key === 'e' || e.key === 'E') castAbility('heal');
  else if (e.key === 'r' || e.key === 'R') castAbility('freeze');
  else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (e.key === 'm' || e.key === 'M') toggleMute();
});
document.querySelectorAll('.diff-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach((x) => x.classList.remove('selected'));
    b.classList.add('selected');
    G.diff = b.dataset.diff;
  });
});
$('start-btn').addEventListener('click', () => startGame());
$('start-btn').addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); }, { passive: false });
$('restart-btn').addEventListener('click', () => startGame());
$('resume-btn').addEventListener('click', togglePause);
$('pause-btn').addEventListener('click', togglePause);
$('mute-btn').addEventListener('click', toggleMute);
$('upg-btn').addEventListener('click', openUpg);
ABILITY_ORDER.forEach((id) => {
  const btn = $('ab-' + id);
  btn.addEventListener('click', () => castAbility(id));
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); castAbility(id); }, { passive: false });
});
$('fs-btn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else tryFullscreenLandscape();
});
$('rotate-ok').addEventListener('click', () => { tryFullscreenLandscape(); $('rotate-hint').classList.add('hidden'); });
$('rotate-dismiss').addEventListener('click', () => {
  sessionStorage.setItem('rhDismissed', '1');
  $('rotate-hint').classList.add('hidden');
});

function toggleMute() {
  Sfx.ensure();
  Sfx.muted = !Sfx.muted;
  $('mute-btn').textContent = Sfx.muted ? '🔇' : '🔊';
}

/* ---------- وضع العرض التلقائي (?demo=1) ---------- */
function startDemo() {
  startGame('normal');
  G.gold = 9999;
  const pSpawn = ['swordsman', 'spearman', 'knight', 'archer', 'healer', 'mage', 'shieldman', 'elephant'];
  const eSpawn = ['swordsman', 'archer', 'spearman', 'knight', 'mage'];
  pSpawn.forEach((t, i) => { spawnUnit(t, 'player'); G.units[G.units.length - 1].x = 680 - i * 52; });
  eSpawn.forEach((t, i) => { spawnUnit(t, 'enemy'); G.units[G.units.length - 1].x = 280 + i * 52; });
  spawnUnit('megaBoss', 'enemy');
  G.units[G.units.length - 1].x = 150;
  spawnUnit('boss', 'enemy');
  G.units[G.units.length - 1].x = 210;
  [[2500, 'catapult'], [4000, 'knight'], [5500, 'bolt'], [7000, 'freeze'], [8500, 'fire']].forEach(([t, type]) =>
    setTimeout(() => {
      if (G.state !== 'playing') return;
      if (type === 'bolt' || type === 'freeze' || type === 'fire') { G.abilityCds[type] = 0; castAbility(type); return; }
      G.gold = Math.max(G.gold, unitCost(type) + 100);
      trySpawn(type);
    }, t));
}
if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1') {
  startDemo();
  const tod = parseFloat(new URLSearchParams(location.search).get('tod'));
  if (!isNaN(tod)) G.time = tod;
  const bio = parseInt(new URLSearchParams(location.search).get('biome'), 10);
  if (!isNaN(bio) && bio >= 0 && bio < BIOMES.length) { G.biome = bio; resetGame(); startDemo(); }
} else {
  checkRotateHint();
}

/* ---------- تشغيل ---------- */
buildUnitBar();
buildBiomeGrid();
drawEmblem();
updateHud();
requestAnimationFrame(loop);
