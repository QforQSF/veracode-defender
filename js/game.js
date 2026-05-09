(() => {
'use strict';

// ============================================================
//  VERACODE DEFENDER - 2026
//  A modern, brand-aligned rebuild of the 2012 Flash original.
// ============================================================

const BRAND = {
    black: '#0D1117',
    white: '#FFFFFF',
    blue: '#0065DD',
    brightBlue: '#00B9FF',
    lightBlue: '#B8EEFF',
    green: '#00CC5E',
    brightGreen: '#00E060',
    pink: '#CC4C81',
    brightPink: '#FF2B83',
    purple: '#9938AD',
    brightPurple: '#CD3ACE',
    yellow: '#FECF05',
    orange: '#EE7623',
    red: '#DE2027',
    brightRed: '#F30004',
};

const VIRTUAL_W = 960;
const VIRTUAL_H = 540;

// ---------- Canvas & scaling ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // We scale to virtual coords in drawFrame.
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- Input ----------
const keys = new Set();
const keyPressedThisFrame = new Set();

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright',' ','space'].includes(e.key.toLowerCase()) ||
        [' '].includes(e.key)) {
        e.preventDefault();
    }
    if (!keys.has(k)) keyPressedThisFrame.add(k);
    keys.add(k);
});
window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
});
window.addEventListener('blur', () => keys.clear());

// ---------- Audio (Web Audio simple synth) ----------
let audioCtx = null;
function ensureAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.08) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function sfxShoot() { beep(760, 0.06, 'square', 0.04); }
function sfxHit()   { beep(220, 0.07, 'sawtooth', 0.05); }
function sfxKill()  { beep(140, 0.14, 'triangle', 0.08); beep(260, 0.09, 'square', 0.04); }
function sfxPower() { beep(660, 0.08, 'triangle', 0.06); beep(990, 0.12, 'triangle', 0.05); }
function sfxDeath() { beep(110, 0.30, 'sawtooth', 0.1); beep(82, 0.4, 'triangle', 0.08); }
function sfxWave()  { beep(520, 0.1, 'triangle', 0.05); beep(780, 0.1, 'triangle', 0.04); }
function sfxBomb()  { beep(160, 0.35, 'sawtooth', 0.12); beep(90, 0.4, 'triangle', 0.1); }

// ---------- Utility ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; };

// ---------- Entities ----------
class Entity {
    constructor(x, y, r) { this.x = x; this.y = y; this.r = r; this.dead = false; }
}

class Player extends Entity {
    constructor() {
        super(120, VIRTUAL_H / 2, 18);
        this.vx = 0; this.vy = 0;
        this.speed = 320;
        this.cooldown = 0;
        this.fireRate = 0.18;
        this.lives = 3;
        this.invuln = 1.5;
        this.firewalls = 1;
        this.hasShield = false;
        this.tripleUntil = 0;
        this.rapidUntil = 0;
        this.pierceUntil = 0;
    }

    update(dt, t) {
        const left = keys.has('arrowleft') || keys.has('a');
        const right = keys.has('arrowright') || keys.has('d');
        const up = keys.has('arrowup') || keys.has('w');
        const down = keys.has('arrowdown') || keys.has('s');

        let dx = 0, dy = 0;
        if (left) dx -= 1;
        if (right) dx += 1;
        if (up) dy -= 1;
        if (down) dy += 1;
        if (dx || dy) { const m = Math.hypot(dx, dy); dx /= m; dy /= m; }

        this.x = clamp(this.x + dx * this.speed * dt, 40, VIRTUAL_W * 0.55);
        this.y = clamp(this.y + dy * this.speed * dt, 40, VIRTUAL_H - 40);

        this.cooldown -= dt;
        this.invuln -= dt;

        const rapid = t < this.rapidUntil;
        const triple = t < this.tripleUntil;
        const rate = rapid ? this.fireRate * 0.5 : this.fireRate;

        if ((keys.has(' ') || keys.has('space')) && this.cooldown <= 0) {
            this.fire(triple);
            this.cooldown = rate;
        }

        if (keyPressedThisFrame.has('shift') && this.firewalls > 0) {
            game.deployFirewall();
            this.firewalls--;
        }
    }

    fire(triple) {
        const pierce = game.time < this.pierceUntil;
        const shots = triple ? [-0.18, 0, 0.18] : [0];
        for (const a of shots) {
            const vx = Math.cos(a) * 780;
            const vy = Math.sin(a) * 780;
            game.bullets.push(new Bullet(this.x + 28, this.y, vx, vy, true, pierce));
        }
        sfxShoot();
    }

    hit() {
        if (this.invuln > 0) return false;
        if (this.hasShield) {
            this.hasShield = false;
            this.invuln = 1.2;
            sfxHit();
            game.flashColor = BRAND.brightBlue;
            game.flash = 0.3;
            return false;
        }
        this.lives--;
        this.invuln = 2.0;
        sfxDeath();
        game.flashColor = BRAND.red;
        game.flash = 0.5;
        game.shake = 12;
        game.explode(this.x, this.y, BRAND.brightBlue, 30);
        if (this.lives <= 0) game.gameOver();
        return true;
    }

    draw(ctx, t) {
        const blink = this.invuln > 0 && Math.floor(t * 14) % 2 === 0;
        if (blink) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Shield halo
        if (this.hasShield) {
            ctx.save();
            const pulse = 1 + Math.sin(t * 6) * 0.06;
            ctx.strokeStyle = BRAND.brightBlue;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 28 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = BRAND.brightBlue;
            ctx.fill();
            ctx.restore();
        }

        // Engine glow trail
        const gradGlow = ctx.createRadialGradient(-18, 0, 0, -18, 0, 32);
        gradGlow.addColorStop(0, 'rgba(0,185,255,0.7)');
        gradGlow.addColorStop(1, 'rgba(0,185,255,0)');
        ctx.fillStyle = gradGlow;
        ctx.beginPath();
        ctx.arc(-18, 0, 32, 0, Math.PI * 2);
        ctx.fill();

        // Veracode V-mark styled ship
        // White left polygon + gradient right polygon, rotated 90° so point faces right
        ctx.rotate(Math.PI / 2);
        ctx.scale(0.22, 0.22);
        ctx.translate(-70, -70);

        // White wing (left side of V)
        ctx.fillStyle = BRAND.white;
        ctx.beginPath();
        ctx.moveTo(31.32, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(48.63, 134.55);
        ctx.lineTo(63.08, 92.42);
        ctx.closePath();
        ctx.fill();

        // Gradient wing (right side of V)
        const g = ctx.createLinearGradient(99.76, 0, 99.76, 139);
        g.addColorStop(0, BRAND.brightBlue);
        g.addColorStop(1, BRAND.blue);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(70.62, 109.12);
        ctx.lineTo(60.07, 139.65);
        ctx.lineTo(88.97, 139.65);
        ctx.lineTo(139.45, 0);
        ctx.lineTo(108.13, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy, friendly, pierce = false) {
        super(x, y, friendly ? 4 : 6);
        this.vx = vx; this.vy = vy;
        this.friendly = friendly;
        this.life = 1.6;
        this.pierce = pierce;
        this.trail = [];
    }
    update(dt) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 6) this.trail.shift();
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0 || this.x < -40 || this.x > VIRTUAL_W + 40 || this.y < -40 || this.y > VIRTUAL_H + 40) this.dead = true;
    }
    draw(ctx) {
        if (this.friendly) {
            for (let i = 0; i < this.trail.length; i++) {
                const p = this.trail[i];
                const a = (i / this.trail.length) * 0.5;
                ctx.fillStyle = `rgba(0, 185, 255, ${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, this.r * (i / this.trail.length), 0, Math.PI * 2);
                ctx.fill();
            }
            const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 12);
            g.addColorStop(0, BRAND.white);
            g.addColorStop(0.4, BRAND.brightBlue);
            g.addColorStop(1, 'rgba(0,185,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = BRAND.red;
            ctx.shadowColor = BRAND.brightRed;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

// ---------- Enemy base and variants ----------
class Enemy extends Entity {
    constructor(x, y, r, hp, speed, score, label, color) {
        super(x, y, r);
        this.hp = hp;
        this.maxHp = hp;
        this.speed = speed;
        this.score = score;
        this.label = label;
        this.color = color;
        this.age = 0;
        this.flash = 0;
    }
    baseUpdate(dt) {
        this.age += dt;
        this.flash = Math.max(0, this.flash - dt * 4);
    }
    takeDamage(n) {
        this.hp -= n;
        this.flash = 1;
        sfxHit();
        game.explode(this.x, this.y, this.color, 4);
        if (this.hp <= 0) {
            this.dead = true;
            game.score += this.score;
            game.kills++;
            sfxKill();
            game.explode(this.x, this.y, this.color, 16);
            this.onDeath();
            if (Math.random() < 0.09) game.spawnPowerup(this.x, this.y);
        }
    }
    onDeath() {}
    drawLabel(ctx) {
        if (this.hp < this.maxHp) {
            const w = 34;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w, 3);
            ctx.fillStyle = BRAND.brightBlue;
            ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w * (this.hp / this.maxHp), 3);
        }
        ctx.save();
        ctx.font = '700 9px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(this.label, this.x, this.y + this.r + 12);
        ctx.restore();
    }
}

class SqlInjection extends Enemy {
    constructor(x, y, speedMult = 1) {
        super(x, y, 14, 1, 180 * speedMult, 100, 'SQLi', BRAND.red);
    }
    update(dt) {
        this.baseUpdate(dt);
        this.x -= this.speed * dt;
        this.y += Math.sin(this.age * 3 + this.x * 0.01) * 30 * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4);
        const g = ctx.createLinearGradient(-16, -16, 16, 16);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.brightRed);
        g.addColorStop(1, BRAND.red);
        ctx.fillStyle = g;
        ctx.shadowColor = BRAND.red;
        ctx.shadowBlur = 14;
        ctx.fillRect(-14, -14, 28, 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = BRAND.white;
        ctx.font = '900 10px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.rotate(-Math.PI / 4);
        ctx.fillText('SQL', 0, 0);
        ctx.restore();
        this.drawLabel(ctx);
    }
}

class XssBug extends Enemy {
    constructor(x, y, speedMult = 1) {
        super(x, y, 16, 2, 140 * speedMult, 150, 'XSS', BRAND.orange);
        this.phase = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.baseUpdate(dt);
        this.x -= this.speed * dt;
        this.y += Math.sin(this.age * 4 + this.phase) * 140 * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.yellow);
        g.addColorStop(1, BRAND.orange);
        ctx.fillStyle = g;
        ctx.shadowColor = BRAND.orange;
        ctx.shadowBlur = 12;
        // Bracketed script symbol
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = BRAND.black;
        ctx.font = '900 12px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('<>', 0, 1);
        ctx.restore();
        this.drawLabel(ctx);
    }
}

class RceThreat extends Enemy {
    constructor(x, y, speedMult = 1) {
        super(x, y, 22, 5, 90 * speedMult, 400, 'RCE', BRAND.purple);
        this.fireCd = rand(1.5, 2.5);
    }
    update(dt) {
        this.baseUpdate(dt);
        this.x -= this.speed * dt;
        this.fireCd -= dt;
        if (this.fireCd <= 0 && this.x < VIRTUAL_W - 60 && this.x > 0) {
            // Fire at player
            const dx = game.player.x - this.x, dy = game.player.y - this.y;
            const m = Math.hypot(dx, dy) || 1;
            game.bullets.push(new Bullet(this.x, this.y, dx / m * 240, dy / m * 240, false));
            this.fireCd = rand(1.8, 3.2);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.age * 1.5);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.brightPurple);
        g.addColorStop(1, BRAND.purple);
        ctx.fillStyle = g;
        ctx.shadowColor = BRAND.brightPurple;
        ctx.shadowBlur = 16;
        // Hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const r = 22;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.rotate(-this.age * 1.5);
        ctx.fillStyle = BRAND.white;
        ctx.font = '900 11px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RCE', 0, 1);
        ctx.restore();
        this.drawLabel(ctx);
    }
}

class SupplyChain extends Enemy {
    constructor(x, y, speedMult = 1, small = false) {
        super(x, y, small ? 10 : 18, small ? 1 : 3, (small ? 200 : 110) * speedMult, small ? 80 : 250, small ? 'npm pkg' : 'Supply Chain', BRAND.pink);
        this.small = small;
        this.bobPhase = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.baseUpdate(dt);
        this.x -= this.speed * dt;
        this.y += Math.cos(this.age * 2 + this.bobPhase) * 40 * dt;
    }
    onDeath() {
        if (!this.small) {
            for (let i = -1; i <= 1; i++) {
                game.enemies.push(new SupplyChain(this.x, this.y + i * 20, 1, true));
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const r = this.small ? 9 : 17;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 4);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.brightPink);
        g.addColorStop(1, BRAND.pink);
        ctx.fillStyle = g;
        ctx.shadowColor = BRAND.brightPink;
        ctx.shadowBlur = 10;
        // Package box
        ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = BRAND.white;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-r, -r * 0.8, r * 2, r * 1.6);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8);
        ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.stroke();
        ctx.restore();
        if (!this.small) this.drawLabel(ctx);
    }
}

class AiHallucination extends Enemy {
    constructor(x, y, speedMult = 1) {
        super(x, y, 18, 3, 150 * speedMult, 350, 'AI Hallucination', BRAND.brightPurple);
        this.teleCd = rand(1.5, 2.5);
    }
    update(dt) {
        this.baseUpdate(dt);
        this.x -= this.speed * dt;
        this.teleCd -= dt;
        if (this.teleCd <= 0) {
            game.explode(this.x, this.y, BRAND.brightPurple, 8);
            this.x += rand(-40, 40);
            this.y = clamp(this.y + rand(-120, 120), 40, VIRTUAL_H - 40);
            game.explode(this.x, this.y, BRAND.brightPurple, 8);
            this.teleCd = rand(1.3, 2.3);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Shimmering diamond
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.lightBlue);
        g.addColorStop(0.5, BRAND.brightPurple);
        g.addColorStop(1, BRAND.purple);
        ctx.fillStyle = g;
        ctx.shadowColor = BRAND.brightPurple;
        ctx.shadowBlur = 16;
        ctx.rotate(this.age * 3);
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(14, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.rotate(-this.age * 3);
        ctx.fillStyle = BRAND.white;
        ctx.font = '900 10px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AI', 0, 1);
        ctx.restore();
        this.drawLabel(ctx);
    }
}

class ZeroDayBoss extends Enemy {
    constructor(waveNum) {
        const hp = 40 + waveNum * 8;
        super(VIRTUAL_W + 60, VIRTUAL_H / 2, 54, hp, 50, 3000, 'ZERO-DAY', BRAND.brightRed);
        this.entry = true;
        this.fireCd = 2.0;
        this.pattern = 0;
    }
    update(dt) {
        this.baseUpdate(dt);
        if (this.entry) {
            this.x -= 80 * dt;
            if (this.x <= VIRTUAL_W - 120) this.entry = false;
        } else {
            this.y += Math.sin(this.age * 1.2) * 220 * dt;
            this.y = clamp(this.y, 80, VIRTUAL_H - 80);
        }
        this.fireCd -= dt;
        if (this.fireCd <= 0) {
            this.pattern = (this.pattern + 1) % 3;
            if (this.pattern === 0) {
                for (let i = -2; i <= 2; i++) {
                    const a = Math.PI + i * 0.12;
                    game.bullets.push(new Bullet(this.x - 40, this.y, Math.cos(a) * 260, Math.sin(a) * 260, false));
                }
            } else if (this.pattern === 1) {
                const dx = game.player.x - this.x, dy = game.player.y - this.y;
                const m = Math.hypot(dx, dy) || 1;
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (!this.dead) game.bullets.push(new Bullet(this.x - 40, this.y, dx/m * 320, dy/m * 320, false));
                    }, i * 90);
                }
            } else {
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    game.bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 200, Math.sin(a) * 200, false));
                }
            }
            this.fireCd = this.pattern === 1 ? 1.2 : 1.8;
        }
    }
    onDeath() {
        // Big explosion
        for (let i = 0; i < 6; i++) {
            setTimeout(() => game.explode(this.x + rand(-40, 40), this.y + rand(-40, 40), BRAND.brightBlue, 30), i * 80);
        }
        game.shake = 18;
        game.flash = 0.8;
        game.flashColor = BRAND.white;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Outer ring
        ctx.strokeStyle = BRAND.brightRed;
        ctx.lineWidth = 3;
        ctx.shadowColor = BRAND.red;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
        // Inner core
        const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 44);
        g.addColorStop(0, this.flash > 0 ? BRAND.white : BRAND.brightRed);
        g.addColorStop(0.6, BRAND.red);
        g.addColorStop(1, BRAND.black);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Rotating gears
        ctx.rotate(this.age * 1.2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.rotate(Math.PI / 3);
            ctx.moveTo(22, 0);
            ctx.lineTo(38, 0);
            ctx.stroke();
        }
        ctx.rotate(-Math.PI * 2 - this.age * 1.2);
        ctx.fillStyle = BRAND.white;
        ctx.font = '900 13px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0-DAY', 0, 1);
        ctx.restore();

        // HP bar
        const bw = 200;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - bw / 2, this.y - 70, bw, 6);
        ctx.fillStyle = BRAND.brightRed;
        ctx.fillRect(this.x - bw / 2, this.y - 70, bw * (this.hp / this.maxHp), 6);
    }
}

// ---------- Powerups ----------
const POWERUPS = {
    SAST:     { label: 'SAST',  name: 'Static Scan',     color: BRAND.brightBlue, dur: 0 },
    DAST:     { label: 'DAST',  name: 'Dynamic Shield',  color: BRAND.brightGreen, dur: 0 },
    SCA:      { label: 'SCA',   name: 'Supply Scan',     color: BRAND.brightPink, dur: 0 },
    FW:       { label: 'FW',    name: 'Package Firewall', color: BRAND.brightRed, dur: 0 },
    RAPID:    { label: 'AI-R',  name: 'AI Rapid Fix',    color: BRAND.brightPurple, dur: 8 },
    TRIPLE:   { label: 'FIX',   name: 'Triple Patch',    color: BRAND.yellow, dur: 8 },
};

class Powerup extends Entity {
    constructor(x, y, type) {
        super(x, y, 14);
        this.type = type;
        this.age = 0;
        this.life = 10;
        this.vx = -80;
        this.vy = rand(-20, 20);
    }
    update(dt) {
        this.age += dt;
        this.life -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.life <= 0 || this.x < -40) this.dead = true;
    }
    draw(ctx) {
        const def = POWERUPS[this.type];
        const blink = this.life < 3 && Math.floor(this.age * 8) % 2 === 0;
        if (blink) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.sin(this.age * 3) * 0.15);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        g.addColorStop(0, BRAND.white);
        g.addColorStop(1, def.color);
        ctx.fillStyle = g;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = BRAND.black;
        ctx.font = '900 8px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.label, 0, 1);
        ctx.restore();
    }
}

// ---------- Particles ----------
class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.dead = false;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
        const a = this.life / this.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ---------- Starfield / code rain background ----------
const stars = [];
for (let i = 0; i < 120; i++) {
    stars.push({
        x: Math.random() * VIRTUAL_W,
        y: Math.random() * VIRTUAL_H,
        s: Math.random() * 2 + 0.2,
        speed: Math.random() * 40 + 20,
    });
}
const CODE_CHARS = '01{}[]()<>;=+*/!?#$&|~^.:'.split('');
const codeDrops = [];
for (let i = 0; i < 22; i++) {
    codeDrops.push({
        x: Math.random() * VIRTUAL_W,
        y: Math.random() * VIRTUAL_H,
        speed: Math.random() * 60 + 40,
        chars: Array.from({ length: 14 }, () => CODE_CHARS[randInt(0, CODE_CHARS.length - 1)]),
        headShift: 0,
    });
}

function updateBackground(dt) {
    for (const s of stars) {
        s.x -= s.speed * dt;
        if (s.x < 0) { s.x = VIRTUAL_W; s.y = Math.random() * VIRTUAL_H; }
    }
    for (const d of codeDrops) {
        d.y += d.speed * dt;
        d.headShift += dt;
        if (d.headShift > 0.12) {
            d.headShift = 0;
            d.chars.pop();
            d.chars.unshift(CODE_CHARS[randInt(0, CODE_CHARS.length - 1)]);
        }
        if (d.y - 14 * 14 > VIRTUAL_H) {
            d.y = -20;
            d.x = Math.random() * VIRTUAL_W;
        }
    }
}

function drawBackground(ctx) {
    // Vignette background already on canvas; paint grid lines
    ctx.save();
    // Subtle horizontal scanlines
    ctx.strokeStyle = 'rgba(0, 185, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < VIRTUAL_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VIRTUAL_W, y);
        ctx.stroke();
    }
    // Vertical lines
    for (let x = 0; x < VIRTUAL_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, VIRTUAL_H);
        ctx.stroke();
    }
    // Stars
    for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + s.s * 0.25})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // Code rain
    ctx.font = '12px "Public Sans", monospace';
    for (const d of codeDrops) {
        for (let i = 0; i < d.chars.length; i++) {
            const alpha = Math.max(0, 1 - i / d.chars.length);
            ctx.fillStyle = i === 0
                ? `rgba(0,185,255,${alpha})`
                : `rgba(0,101,221,${alpha * 0.5})`;
            ctx.fillText(d.chars[i], d.x, d.y - i * 14);
        }
    }
    ctx.restore();
}

// ---------- Game ----------
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover', WAVE_INTRO: 'wave_intro' };

const WAVE_NAMES = [
    { name: 'LEGACY VULNS',     sub: 'Wave 01' },
    { name: 'RUNTIME EXPLOITS', sub: 'Wave 02' },
    { name: 'MODERN THREATS',   sub: 'Wave 03' },
    { name: 'AI-ERA THREATS',   sub: 'Wave 04' },
    { name: 'ZERO-DAY STORM',   sub: 'Boss Wave' },
];

const game = {
    state: STATE.MENU,
    time: 0,
    dt: 0,
    player: null,
    bullets: [],
    enemies: [],
    particles: [],
    powerups: [],
    score: 0,
    wave: 0,
    kills: 0,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    waveIntroTimer: 0,
    flash: 0,
    flashColor: '#fff',
    shake: 0,
    activePowerups: [],

    reset() {
        this.player = new Player();
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.score = 0;
        this.wave = 0;
        this.kills = 0;
        this.spawnQueue = [];
        this.activePowerups = [];
        this.flash = 0;
        this.shake = 0;
        this.time = 0;
    },

    startGame() {
        this.reset();
        this.state = STATE.WAVE_INTRO;
        this.beginWave(1);
        ui.showScreen(null);
        ui.showHud(true);
    },

    gameOver() {
        this.state = STATE.GAMEOVER;
        ui.showHud(false);
        document.getElementById('stat-score').textContent = this.score.toLocaleString();
        document.getElementById('stat-waves').textContent = Math.max(0, this.wave - 1);
        document.getElementById('stat-kills').textContent = this.kills;
        ui.showScreen('screen-gameover');
    },

    beginWave(n) {
        this.wave = n;
        this.waveActive = false;
        this.waveIntroTimer = 2.4;
        const info = WAVE_NAMES[Math.min(n - 1, WAVE_NAMES.length - 1)];
        const isBoss = n % 5 === 0;
        ui.showWaveBanner(isBoss ? 'ZERO-DAY BOSS' : info.name, isBoss ? `Wave ${String(n).padStart(2, '0')}` : info.sub);
        sfxWave();
        this.state = STATE.WAVE_INTRO;

        // Build spawn queue
        const q = [];
        const mult = 1 + (n - 1) * 0.12;
        if (isBoss) {
            q.push({ delay: 1.0, type: 'boss' });
        } else {
            const count = 8 + n * 3;
            const types = [];
            if (n >= 1) types.push('sqli', 'sqli');
            if (n >= 2) types.push('xss', 'xss');
            if (n >= 3) types.push('rce', 'supply');
            if (n >= 4) types.push('ai', 'supply');
            if (n >= 5) types.push('rce', 'ai');
            for (let i = 0; i < count; i++) {
                q.push({
                    delay: 0.5 + i * rand(0.45, 0.8) / mult,
                    type: types[randInt(0, types.length - 1)],
                });
            }
        }
        this.spawnQueue = q;
        this.spawnTimer = 0;
    },

    beginActive() {
        this.waveActive = true;
        this.state = STATE.PLAYING;
    },

    spawnEnemy(type) {
        const y = rand(60, VIRTUAL_H - 60);
        const x = VIRTUAL_W + 30;
        const mult = 1 + (this.wave - 1) * 0.06;
        switch (type) {
            case 'sqli':   this.enemies.push(new SqlInjection(x, y, mult)); break;
            case 'xss':    this.enemies.push(new XssBug(x, y, mult)); break;
            case 'rce':    this.enemies.push(new RceThreat(x, y, mult)); break;
            case 'supply': this.enemies.push(new SupplyChain(x, y, mult)); break;
            case 'ai':     this.enemies.push(new AiHallucination(x, y, mult)); break;
            case 'boss':   this.enemies.push(new ZeroDayBoss(this.wave)); break;
        }
    },

    spawnPowerup(x, y) {
        const keys = Object.keys(POWERUPS);
        const type = keys[randInt(0, keys.length - 1)];
        this.powerups.push(new Powerup(x, y, type));
    },

    applyPowerup(type) {
        sfxPower();
        const def = POWERUPS[type];
        switch (type) {
            case 'SAST': {
                // Instant damage line from left to right - kill enemies in horizontal band of player
                const by = this.player.y;
                for (const e of this.enemies) {
                    if (Math.abs(e.y - by) < 60) e.takeDamage(3);
                }
                this.flash = 0.3; this.flashColor = BRAND.brightBlue;
                break;
            }
            case 'DAST': {
                this.player.hasShield = true;
                break;
            }
            case 'SCA': {
                // Kill supply chain variants anywhere
                for (const e of this.enemies) {
                    if (e instanceof SupplyChain) e.takeDamage(999);
                }
                break;
            }
            case 'FW': {
                this.player.firewalls += 1;
                break;
            }
            case 'RAPID': {
                this.player.rapidUntil = this.time + def.dur;
                this.activePowerups.push({ type, label: def.name, until: this.player.rapidUntil });
                break;
            }
            case 'TRIPLE': {
                this.player.tripleUntil = this.time + def.dur;
                this.activePowerups.push({ type, label: def.name, until: this.player.tripleUntil });
                break;
            }
        }
    },

    deployFirewall() {
        // Screen-clear: damage all enemies on screen
        sfxBomb();
        this.flash = 0.6;
        this.flashColor = BRAND.brightBlue;
        this.shake = 10;
        for (const e of this.enemies) {
            e.takeDamage(e instanceof ZeroDayBoss ? 12 : 999);
        }
        // Also nuke enemy bullets
        for (const b of this.bullets) if (!b.friendly) b.dead = true;
        // Big visual
        for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            this.particles.push(new Particle(this.player.x, this.player.y, Math.cos(a) * rand(200, 400), Math.sin(a) * rand(200, 400), BRAND.brightBlue, 0.8, 6));
        }
    },

    explode(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = rand(60, 260);
            this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(0.3, 0.7), rand(2, 5)));
        }
    },

    update(dt, now) {
        this.dt = dt;
        this.time = now;
        updateBackground(dt);

        if (this.state === STATE.PLAYING || this.state === STATE.WAVE_INTRO) {
            this.player.update(dt, this.time);

            // Spawn from queue
            if (this.spawnQueue.length > 0) {
                this.spawnTimer += dt;
                while (this.spawnQueue.length > 0 && this.spawnQueue[0].delay <= this.spawnTimer) {
                    const s = this.spawnQueue.shift();
                    this.spawnEnemy(s.type);
                    if (!this.waveActive) this.beginActive();
                }
            }

            // Wave intro timer (banner shows first, spawns start whenever)
            if (this.state === STATE.WAVE_INTRO) {
                this.waveIntroTimer -= dt;
                if (this.waveIntroTimer <= 0) {
                    ui.hideWaveBanner();
                    this.state = STATE.PLAYING;
                }
            }

            // Update entities
            for (const b of this.bullets) b.update(dt);
            for (const e of this.enemies) e.update(dt);
            for (const p of this.particles) p.update(dt);
            for (const p of this.powerups) p.update(dt);

            // Off-screen enemies cost a life
            for (const e of this.enemies) {
                if (e.x + e.r < -20 && !(e instanceof ZeroDayBoss)) {
                    e.dead = true;
                    this.player.hit();
                }
            }

            // Collisions
            for (const b of this.bullets) {
                if (b.dead) continue;
                if (b.friendly) {
                    for (const e of this.enemies) {
                        if (e.dead) continue;
                        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
                            e.takeDamage(1);
                            if (!b.pierce) b.dead = true;
                            break;
                        }
                    }
                } else {
                    if (dist2(b.x, b.y, this.player.x, this.player.y) < (b.r + this.player.r) ** 2) {
                        b.dead = true;
                        this.player.hit();
                    }
                }
            }

            // Powerup pickup
            for (const p of this.powerups) {
                if (p.dead) continue;
                if (dist2(p.x, p.y, this.player.x, this.player.y) < (p.r + this.player.r) ** 2) {
                    p.dead = true;
                    this.applyPowerup(p.type);
                }
            }

            // Clean up
            this.bullets = this.bullets.filter(o => !o.dead);
            this.enemies = this.enemies.filter(o => !o.dead);
            this.particles = this.particles.filter(o => !o.dead);
            this.powerups = this.powerups.filter(o => !o.dead);
            this.activePowerups = this.activePowerups.filter(p => p.until > this.time);

            // Next wave?
            if (this.state === STATE.PLAYING && this.spawnQueue.length === 0 && this.enemies.length === 0) {
                this.beginWave(this.wave + 1);
            }

            // Flash / shake decay
            this.flash = Math.max(0, this.flash - dt);
            this.shake = Math.max(0, this.shake - dt * 30);

            // HUD
            ui.updateHud();
        }

        keyPressedThisFrame.clear();
    },

    draw() {
        const cw = canvas.width, ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        ctx.save();
        // Scale to virtual coords
        const scale = Math.min(cw / VIRTUAL_W, ch / VIRTUAL_H);
        const ox = (cw - VIRTUAL_W * scale) / 2;
        const oy = (ch - VIRTUAL_H * scale) / 2;
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Camera shake
        if (this.shake > 0) {
            ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
        }

        drawBackground(ctx);

        // Player safe-zone marker on left edge (the "application")
        ctx.save();
        const gradZone = ctx.createLinearGradient(0, 0, 50, 0);
        gradZone.addColorStop(0, 'rgba(0, 101, 221, 0.3)');
        gradZone.addColorStop(1, 'rgba(0, 101, 221, 0)');
        ctx.fillStyle = gradZone;
        ctx.fillRect(0, 0, 50, VIRTUAL_H);
        ctx.strokeStyle = 'rgba(0, 185, 255, 0.35)';
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(50, 0); ctx.lineTo(50, VIRTUAL_H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(18, VIRTUAL_H / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(0, 185, 255, 0.5)';
        ctx.font = '900 11px "Public Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('// PRODUCTION', 0, 0);
        ctx.restore();
        ctx.restore();

        if (this.player) {
            for (const p of this.particles) p.draw(ctx);
            for (const p of this.powerups) p.draw(ctx);
            for (const e of this.enemies) e.draw(ctx);
            for (const b of this.bullets) b.draw(ctx);
            this.player.draw(ctx, this.time);
        }

        // Flash overlay
        if (this.flash > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = Math.min(0.6, this.flash);
            ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    },
};

// ---------- UI controller ----------
const ui = {
    screens: {
        'screen-start': document.getElementById('screen-start'),
        'screen-pause': document.getElementById('screen-pause'),
        'screen-gameover': document.getElementById('screen-gameover'),
    },
    hud: document.getElementById('hud'),
    waveBanner: document.getElementById('hud-wave-banner'),
    hudScore: document.getElementById('hud-score'),
    hudWave: document.getElementById('hud-wave'),
    hudLives: document.getElementById('hud-lives'),
    hudFirewalls: document.getElementById('hud-firewalls'),
    hudPowerups: document.getElementById('hud-powerups'),

    showScreen(id) {
        for (const k in this.screens) this.screens[k].classList.toggle('active', k === id);
    },
    showHud(show) {
        this.hud.classList.toggle('hidden', !show);
    },
    showWaveBanner(name, sub) {
        this.waveBanner.innerHTML = `<span class="sub">${sub}</span>${name}`;
        this.waveBanner.classList.add('show');
    },
    hideWaveBanner() {
        this.waveBanner.classList.remove('show');
    },
    updateHud() {
        if (!game.player) return;
        this.hudScore.textContent = game.score.toLocaleString();
        this.hudWave.textContent = String(game.wave).padStart(2, '0');
        this.hudLives.textContent = '\u2666'.repeat(Math.max(0, game.player.lives)) || '\u2014';
        this.hudFirewalls.textContent = String(game.player.firewalls);
        const chips = game.activePowerups.map(p => {
            const remain = Math.max(0, p.until - game.time).toFixed(1);
            return `<div class="powerup-chip">${p.label}<span class="timer">${remain}s</span></div>`;
        });
        if (game.player.hasShield) chips.unshift(`<div class="powerup-chip">DAST Shield</div>`);
        this.hudPowerups.innerHTML = chips.join('');
    },
};

// ---------- Button handlers ----------
document.getElementById('btn-start').addEventListener('click', () => {
    ensureAudio();
    game.startGame();
});
document.getElementById('btn-retry').addEventListener('click', () => {
    ensureAudio();
    game.startGame();
});
document.getElementById('btn-resume').addEventListener('click', () => {
    game.state = STATE.PLAYING;
    ui.showScreen(null);
    ui.showHud(true);
});
document.getElementById('btn-quit').addEventListener('click', () => {
    ui.showScreen('screen-start');
    ui.showHud(false);
    game.state = STATE.MENU;
});

// Pause hotkey
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((k === 'p' || k === 'escape') && (game.state === STATE.PLAYING || game.state === STATE.WAVE_INTRO)) {
        game.state = STATE.PAUSED;
        ui.showScreen('screen-pause');
        ui.showHud(false);
    } else if ((k === 'p' || k === 'escape') && game.state === STATE.PAUSED) {
        game.state = STATE.PLAYING;
        ui.showScreen(null);
        ui.showHud(true);
    }
});

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state !== STATE.PAUSED) {
        game.update(dt, now / 1000);
    }
    game.draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Boot: show start screen
ui.showScreen('screen-start');
ui.showHud(false);

})();
