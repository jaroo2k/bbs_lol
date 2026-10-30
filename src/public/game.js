'use strict';
(() => {
    const W = 480, H = 640, MAX_LIVES = 5, BEST_KEY = 'rift-snack-best', CHAMP_KEY = 'rift-snack-champ';
    const SHIELD_COOLDOWN = 20;
    const LANE_Y = H - 104, RIVER_Y = H * 0.42, RIVER_ANGLE = 0.35;
    const SHRINES = [[78, 215], [400, 440]];
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    const overlay = $('overlay'), overlayTitle = $('overlay-title'), overlayText = $('overlay-text');
    const startBtn = $('start'), pauseBtn = $('pause'), champSelect = $('champ-select'), champPerk = $('champ-perk');
    const scoreEl = $('score'), bestEl = $('best'), livesEl = $('lives');
    const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    const KILLS = { 2: '더블킬!', 3: '트리플킬!', 4: '쿼드라킬!', 5: '펜타킬!!' };
    const TYPES = { coin: { r: 14, points: 10 }, cookie: { r: 18, points: 30 }, heart: { r: 16, points: 0 }, bomb: { r: 19, points: 0 } };
    const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    const CHAMPS = {
        dori: { name: '도리', role: '날쌘 정찰병', perk: '날쌘 발: 이동 속도 +30%', speed: 1.3, draw: drawDori },
        coco: { name: '코코', role: '꼬마 마법사', perk: '불꽃 정령: 폭탄을 1번 막아줌 (20초마다 충전)', shield: true, draw: drawCoco },
        lumi: { name: '루미', role: '별빛 수호자', perk: '별빛 결계: 간식 획득 범위 +35%', reach: 1.35, draw: drawLumi },
        momo: { name: '모모', role: '장난꾸러기 냥이', perk: '냥냥 펀치: 근처 간식을 끌어당김', charm: true, draw: drawMomo },
        dandan: { name: '단단', role: '든든한 돌 골렘', perk: '바위 피부: 목숨 4개로 시작', lives: 4, draw: drawDandan },
    };

    let best = 0, champId = 'dori';
    try {
        best = Number(localStorage.getItem(BEST_KEY)) || 0;
        const saved = localStorage.getItem(CHAMP_KEY);
        if (saved && CHAMPS[saved]) champId = saved;
    } catch (e) { /* 저장소를 쓸 수 없으면 이번 방문 기록만 유지 */ }
    let state = 'ready', score = 0, lives = 3, combo = 0, elapsed = 0, spawnIn = 0, shake = 0, last = 0;
    let shieldReady = false, shieldIn = 0;
    let items = [], particles = [], popups = [];
    const player = { x: W / 2, y: H - 64, r: 34, target: null, face: 1, squash: 0, hurt: 0 };
    const keys = new Set();
    const champ = () => CHAMPS[champId];

    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    drawBackground(bg.getContext('2d'));

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function reset() {
        score = 0; lives = champ().lives || 3; combo = 0; elapsed = 0; spawnIn = 0.6; shake = 0;
        shieldReady = !!champ().shield; shieldIn = 0;
        items = []; particles = []; popups = [];
        player.x = W / 2; player.target = null; player.hurt = 0;
        updateHud();
    }

    function fmt(n) { return n.toLocaleString('ko-KR'); }

    function updateHud() {
        scoreEl.textContent = fmt(score);
        bestEl.textContent = fmt(best);
        livesEl.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(MAX_LIVES - Math.max(0, lives));
        livesEl.setAttribute('aria-label', `목숨 ${Math.max(0, lives)}개`);
    }

    function show(title, text, button) {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        startBtn.textContent = button;
        overlay.hidden = false;
        startBtn.focus({ preventScroll: true });
    }

    function readyText() { return `${champ().name} 선택 · ${champ().perk}`; }

    function selectChamp(id) {
        if (!CHAMPS[id] || state === 'play' || state === 'pause') return;
        champId = id;
        try { localStorage.setItem(CHAMP_KEY, id); } catch (e) { /* 저장 실패는 무시 */ }
        champPerk.textContent = champ().perk;
        if (state === 'ready') { reset(); overlayText.textContent = readyText(); }
        else if (state === 'over') overlayText.textContent = readyText();
    }

    function start() {
        if (state !== 'pause') reset();
        state = 'play';
        champSelect.disabled = true;
        overlay.hidden = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = '일시정지';
        canvas.focus({ preventScroll: true });
    }

    function pause() {
        if (state !== 'play') return;
        state = 'pause';
        keys.clear();
        pauseBtn.textContent = '계속하기';
        show('잠깐 쉬는 중', '준비되면 다시 협곡으로!', '계속하기');
    }

    function gameOver() {
        state = 'over';
        keys.clear();
        pauseBtn.disabled = true;
        champSelect.disabled = false;
        const record = score > best;
        if (record) {
            best = score;
            try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 저장 실패는 무시 */ }
        }
        updateHud();
        show(record ? '최고 기록 달성! 🎉' : '게임 오버', `${champ().name} · ${fmt(score)}점 · ${record ? '협곡의 전설이 되었어요!' : '챔피언을 바꿔서 한 판 더?'}`, '다시 하기');
    }

    function spawn() {
        const bombChance = Math.min(0.4, 0.16 + elapsed * 0.004);
        const roll = Math.random();
        let type = 'coin';
        if (roll < bombChance) type = 'bomb';
        else if (roll < bombChance + 0.025 && lives < MAX_LIVES) type = 'heart';
        else if (Math.random() < 0.22) type = 'cookie';
        const r = TYPES[type].r;
        const speed = Math.min(520, 150 + elapsed * 5) * (0.85 + Math.random() * 0.3);
        items.push({ type, r, x: r + Math.random() * (W - 2 * r), y: -r, vy: speed, spin: Math.random() * 6 });
    }

    function burst(x, y, color, n = 10) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
            particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6 + Math.random() * 0.3, color });
        }
    }

    function popup(text, x, y, color, size = 20) {
        popups.push({ text, x, y, color, size, life: 1 });
    }

    function catchItem(it) {
        if (it.type === 'bomb') {
            combo = 0;
            if (shieldReady) {
                shieldReady = false;
                shieldIn = SHIELD_COOLDOWN;
                burst(it.x, it.y, '#ff9a3d', 16);
                popup('정령이 막았다!', it.x, it.y - 20, '#ffb15c', 22);
                updateHud();
                return;
            }
            lives--; player.hurt = 0.6; shake = 0.35;
            burst(it.x, it.y, '#4a4a5a', 16);
            popup('앗!', it.x, it.y - 20, '#ff6b6b', 24);
            if (navigator.vibrate) navigator.vibrate(80);
            if (lives <= 0) { updateHud(); gameOver(); return; }
        } else if (it.type === 'heart') {
            lives = Math.min(MAX_LIVES, lives + 1);
            burst(it.x, it.y, '#ff7aa8');
            popup('+1 ♥', it.x, it.y - 20, '#ff8fb5');
        } else {
            combo++;
            const pts = Math.round(TYPES[it.type].points * (1 + Math.floor(combo / 5) * 0.5));
            score += pts;
            player.squash = 0.25;
            burst(it.x, it.y, it.type === 'coin' ? '#ffd34d' : '#c98a4b');
            popup(`+${pts}`, it.x, it.y - 18, '#fff');
            const kill = KILLS[combo] || (combo % 5 === 0 ? `${combo}연속! 전설의 출현!` : '');
            if (kill) popup(kill, W / 2, H * 0.35, '#ffd34d', combo >= 5 ? 34 : 28);
        }
        updateHud();
    }

    function update(dt) {
        const c = champ();
        elapsed += dt;
        spawnIn -= dt;
        if (spawnIn <= 0) {
            spawn();
            spawnIn = Math.max(0.3, 0.85 - elapsed * 0.01) * (0.7 + Math.random() * 0.6);
        }
        if (c.shield && !shieldReady) {
            shieldIn -= dt;
            if (shieldIn <= 0) {
                shieldReady = true;
                popup('정령 충전 완료!', player.x, player.y - 60, '#ffb15c', 18);
            }
        }
        const speed = c.speed || 1;
        const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        if (dir) {
            player.target = null;
            player.x += dir * 420 * speed * dt;
            player.face = dir;
        } else if (player.target !== null) {
            const d = player.target - player.x;
            player.x += d * Math.min(1, dt * 12 * speed);
            if (Math.abs(d) > 2) player.face = Math.sign(d);
        }
        player.x = Math.max(player.r, Math.min(W - player.r, player.x));
        player.squash = Math.max(0, player.squash - dt);
        player.hurt = Math.max(0, player.hurt - dt);
        shake = Math.max(0, shake - dt);

        const reach = player.r * 0.85 * (c.reach || 1);
        for (const it of items) {
            it.y += it.vy * dt;
            it.spin += dt * 3;
            const dx = player.x - it.x;
            if (c.charm && it.type !== 'bomb' && Math.abs(dx) < 120 && player.y - it.y < 220) {
                it.x += Math.sign(dx) * Math.min(Math.abs(dx), 170 * dt);
                it.charmed = true;
            }
            if (Math.hypot(it.x - player.x, it.y - (player.y - 6)) < it.r + reach) {
                it.done = true;
                catchItem(it);
                if (state !== 'play') return;
            } else if (it.y - it.r > H) {
                it.done = true;
                if (it.type === 'coin' || it.type === 'cookie') combo = 0;
            }
        }
        items = items.filter(it => !it.done);
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }
        particles = particles.filter(p => p.life > 0);
        for (const p of popups) { p.y -= 40 * dt; p.life -= dt * 0.9; }
        popups = popups.filter(p => p.life > 0);
    }

    function circle(g, x, y, r) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    }

    function oval(g, x, y, rx, ry, rot = 0) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fill();
    }

    function outlined(g, x, y, r, fill, stroke) {
        g.fillStyle = stroke;
        circle(g, x, y, r + 2);
        g.fillStyle = fill;
        circle(g, x, y, r);
    }

    function poly(g, points) {
        g.beginPath();
        g.moveTo(points[0][0], points[0][1]);
        for (const [x, y] of points.slice(1)) g.lineTo(x, y);
        g.closePath();
        g.fill();
    }

    function bangs(g, r, color, depth) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(0, 0, r * 0.84, Math.PI, Math.PI * 2);
        const tips = [[0.84, -0.05], [0.6, -depth], [0.4, -0.38], [0.18, -depth - 0.04], [0, -0.42], [-0.18, -depth - 0.04], [-0.4, -0.38], [-0.6, -depth], [-0.84, -0.05]];
        for (const [x, y] of tips) g.lineTo(x * r, y * r);
        g.closePath();
        g.fill();
    }

    function star(g, x, y, s) {
        g.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, d = i % 2 ? s * 0.35 : s;
            g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        g.closePath();
        g.fill();
    }

    // 눈·볼·입 공통 표정
    function face(g, r, o, s = {}) {
        const eyeY = s.eyeY ?? -r * 0.12, mouthY = s.mouthY ?? r * 0.14, look = o.look;
        if (s.cheeks !== false) {
            g.fillStyle = '#ff9fb566';
            for (const k of [-1, 1]) oval(g, k * r * 0.52 + look, eyeY + r * 0.28, r * 0.15, r * 0.09);
        }
        g.strokeStyle = '#2a2233';
        g.lineWidth = Math.max(1.5, r * 0.08);
        g.lineCap = 'round';
        for (const k of [-1, 1]) {
            const ex = k * r * 0.3 + look;
            if (o.hurt) {
                g.beginPath();
                g.moveTo(ex - k * r * 0.11, eyeY - r * 0.09);
                g.lineTo(ex + k * r * 0.07, eyeY);
                g.lineTo(ex - k * r * 0.11, eyeY + r * 0.09);
                g.stroke();
            } else if (o.blink) {
                g.beginPath();
                g.moveTo(ex - r * 0.12, eyeY);
                g.lineTo(ex + r * 0.12, eyeY);
                g.stroke();
            } else {
                g.fillStyle = s.eye || '#2a2233';
                oval(g, ex, eyeY, r * 0.14, r * 0.18);
                if (s.eye) {
                    g.fillStyle = '#2a2233';
                    oval(g, ex, eyeY + r * 0.02, r * 0.08, r * 0.11);
                }
                g.fillStyle = '#fff';
                circle(g, ex + r * 0.05, eyeY - r * 0.07, r * 0.055);
                circle(g, ex - r * 0.05, eyeY + r * 0.06, r * 0.03);
            }
            if (s.tears && !o.blink) {
                g.fillStyle = '#7cc8f2';
                g.beginPath();
                g.moveTo(ex - k * r * 0.12, eyeY + r * 0.14);
                g.quadraticCurveTo(ex - k * r * 0.2, eyeY + r * 0.32, ex - k * r * 0.12, eyeY + r * 0.34);
                g.quadraticCurveTo(ex - k * r * 0.04, eyeY + r * 0.32, ex - k * r * 0.12, eyeY + r * 0.14);
                g.fill();
            }
        }
        g.lineWidth = Math.max(1.2, r * 0.06);
        if (o.open) {
            g.fillStyle = '#e86a7f';
            oval(g, look, mouthY + r * 0.04, r * 0.09, r * 0.11);
        } else if (s.sad) {
            g.beginPath();
            g.arc(look, mouthY + r * 0.1, r * 0.09, Math.PI * 1.2, Math.PI * 1.8);
            g.stroke();
        } else {
            g.beginPath();
            g.arc(look - r * 0.065, mouthY, r * 0.065, 0, Math.PI);
            g.arc(look + r * 0.065, mouthY, r * 0.065, 0, Math.PI);
            g.stroke();
        }
    }

    function drawDori(g, r, o) {
        for (const k of [-1, 1]) {
            g.fillStyle = '#9a6534';
            circle(g, k * r * 0.62, -r * 0.62, r * 0.22);
            g.fillStyle = '#f2c7a0';
            circle(g, k * r * 0.62, -r * 0.62, r * 0.12);
        }
        outlined(g, 0, 0, r * 0.84, '#c98b52', '#9a6534');
        g.fillStyle = '#f6e0c0';
        oval(g, 0, r * 0.3, r * 0.52, r * 0.36);
        g.fillStyle = '#6e4423';
        for (const dx of [-0.16, 0, 0.16]) oval(g, dx * r, -r * 0.42, r * 0.04, r * 0.14);
        face(g, r, o, { eyeY: -r * 0.04, mouthY: r * 0.32 });
        g.fillStyle = '#4a2c18';
        oval(g, o.look, r * 0.2, r * 0.07, r * 0.05);
        // 티모의 녹색 정찰 모자와 붉은 렌즈 고글.
        g.fillStyle = '#567943';
        g.beginPath();
        g.ellipse(0, -r * 0.55, r * 0.82, r * 0.48, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = '#375234';
        oval(g, 0, -r * 0.55, r * 0.92, r * 0.13);
        g.fillStyle = '#533b27';
        g.fillRect(-r * 0.66, -r * 0.87, r * 1.32, r * 0.19);
        for (const k of [-1, 1]) {
            outlined(g, k * r * 0.31, -r * 0.77, r * 0.22, '#c64d35', '#d6ae64');
            g.fillStyle = '#ffb488';
            oval(g, k * r * 0.31 - r * 0.05, -r * 0.82, r * 0.07, r * 0.04);
        }
        g.fillStyle = '#d84c3c';
        poly(g, [[r * 0.55, -r * 0.95], [r * 0.72, -r * 1.3], [r * 0.9, -r * 1.12], [r * 0.68, -r * 0.86]]);
        g.fillStyle = '#b34232';
        poly(g, [[-r * 0.45, r * 0.7], [r * 0.45, r * 0.7], [0, r * 1.0]]);
    }

    function drawCoco(g, r, o) {
        g.fillStyle = '#8d2435';
        circle(g, 0, -r * 0.02, r * 0.95);
        g.fillStyle = '#d45043';
        circle(g, 0, -r * 0.02, r * 0.92);
        outlined(g, 0, r * 0.05, r * 0.78, '#ffe4cf', '#e8bfa2');
        bangs(g, r * 0.9, '#d45043', 0.14);
        face(g, r, o, { eyeY: r * 0.1, mouthY: r * 0.42, eye: '#8a4fd6' });
        // 애니의 보라색 고양이 귀 머리띠와 티버 인형.
        g.strokeStyle = '#674078';
        g.lineWidth = r * 0.16;
        g.beginPath(); g.arc(0, 0, r * 0.9, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        for (const k of [-1, 1]) {
            g.fillStyle = '#674078';
            poly(g, [[k * r * 0.35, -r * 0.8], [k * r * 0.65, -r * 1.2], [k * r * 0.87, -r * 0.55]]);
            g.fillStyle = '#ec97af';
            poly(g, [[k * r * 0.49, -r * 0.83], [k * r * 0.64, -r * 1.02], [k * r * 0.73, -r * 0.7]]);
        }
        const sx = -o.face * r * 1.0, sy = r * 0.45 + Math.sin((o.t || 0) * 0.006) * r * 0.06;
        g.fillStyle = o.shield ? '#ff7a3d' : '#9a9a9a';
        g.beginPath();
        g.moveTo(sx, sy - r * 0.42);
        g.quadraticCurveTo(sx + r * 0.3, sy - r * 0.05, sx + r * 0.2, sy + r * 0.12);
        g.arc(sx, sy + r * 0.08, r * 0.2, 0.2, Math.PI - 0.2);
        g.quadraticCurveTo(sx - r * 0.3, sy - r * 0.05, sx, sy - r * 0.42);
        g.fill();
        g.fillStyle = o.shield ? '#ffd34d' : '#c4c4c4';
        oval(g, sx, sy + r * 0.04, r * 0.11, r * 0.16);
        g.fillStyle = '#2a2233';
        circle(g, sx - r * 0.05, sy + r * 0.04, r * 0.03);
        circle(g, sx + r * 0.05, sy + r * 0.04, r * 0.03);
        for (const k of [-1, 1]) outlined(g, sx + k * r * 0.19, sy - r * 0.17, r * 0.1, '#a56336', '#653c26');
        outlined(g, sx, sy, r * 0.23, o.shield ? '#a56336' : '#858080', '#653c26');
        g.fillStyle = '#e1b585';
        oval(g, sx, sy + r * 0.08, r * 0.12, r * 0.09);
        g.fillStyle = '#241c22';
        circle(g, sx - r * 0.08, sy - r * 0.03, r * 0.035);
        circle(g, sx + r * 0.08, sy - r * 0.03, r * 0.035);
        circle(g, sx, sy + r * 0.05, r * 0.035);
    }

    function drawLumi(g, r, o) {
        g.fillStyle = '#bc8a35';
        circle(g, 0, -r * 0.05, r * 0.98);
        g.fillStyle = '#f5d477';
        circle(g, 0, -r * 0.05, r * 0.95);
        for (const k of [-1, 1]) oval(g, k * r * 0.8, r * 0.4, r * 0.2, r * 0.45, k * -0.12);
        outlined(g, 0, r * 0.04, r * 0.78, '#ffe8d8', '#e7c4ac');
        bangs(g, r * 0.95, '#f5d477', 0.15);
        // 럭스의 데마시아 왕관과 푸른 보석, 빛의 지팡이.
        g.fillStyle = '#d9e6ee';
        poly(g, [[-r * 0.75, -r * 0.65], [-r * 0.58, -r * 0.92], [-r * 0.27, -r * 0.73], [0, -r * 1.05], [r * 0.27, -r * 0.73], [r * 0.58, -r * 0.92], [r * 0.75, -r * 0.65], [0, -r * 0.48]]);
        g.fillStyle = '#4b9edb';
        poly(g, [[0, -r * 0.88], [r * 0.12, -r * 0.72], [0, -r * 0.55], [-r * 0.12, -r * 0.72]]);
        g.strokeStyle = '#cfb16a'; g.lineWidth = r * 0.09;
        g.beginPath(); g.moveTo(r * 0.95, r * 0.75); g.lineTo(r * 0.95, -r * 0.4); g.stroke();
        g.fillStyle = '#fff4b5'; star(g, r * 0.95, -r * 0.4, r * 0.24);
        face(g, r, o, { eyeY: r * 0.08, mouthY: r * 0.4, eye: '#4b9edb' });
        g.globalAlpha *= 0.6 + 0.4 * Math.abs(Math.sin((o.t || 0) * 0.004));
        g.fillStyle = '#fff6c2';
        star(g, -r * 0.95, -r * 0.7, r * 0.14);
        star(g, r * 1.0, -r * 0.15, r * 0.09);
    }

    function drawMomo(g, r, o) {
        // 유미가 타고 다니는 금빛 마법책.
        g.fillStyle = '#b28a41';
        poly(g, [[-r * 1.03, r * 0.55], [0, r * 0.72], [r * 1.03, r * 0.55], [r * 0.94, r * 1.03], [0, r * 1.15], [-r * 0.94, r * 1.03]]);
        g.fillStyle = '#fff0c3';
        poly(g, [[-r * 0.91, r * 0.57], [0, r * 0.76], [r * 0.91, r * 0.57], [r * 0.82, r * 0.91], [0, r * 1.02], [-r * 0.82, r * 0.91]]);
        g.strokeStyle = '#c4a466'; g.lineWidth = r * 0.04;
        g.beginPath(); g.moveTo(0, r * 0.76); g.lineTo(0, r * 1.02); g.stroke();
        g.save();
        g.rotate(Math.sin((o.t || 0) * 0.005) * 0.25);
        g.strokeStyle = '#789ac6';
        g.lineWidth = r * 0.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-o.face * r * 0.5, r * 0.4);
        g.quadraticCurveTo(-o.face * r * 1.3, r * 0.3, -o.face * r * 1.1, -r * 0.4);
        g.stroke();
        g.restore();
        for (const k of [-1, 1]) {
            g.fillStyle = '#789ac6';
            poly(g, [[k * r * 0.2, -r * 0.72], [k * r * 0.62, -r * 1.12], [k * r * 0.76, -r * 0.42]]);
            g.fillStyle = '#d2a8df';
            poly(g, [[k * r * 0.34, -r * 0.7], [k * r * 0.58, -r * 0.95], [k * r * 0.66, -r * 0.55]]);
        }
        outlined(g, 0, 0, r * 0.84, '#f4e5ce', '#789ac6');
        g.fillStyle = '#789ac6';
        g.beginPath();
        g.arc(0, 0, r * 0.84, Math.PI * 1.1, Math.PI * 1.9);
        g.closePath();
        g.fill();
        g.fillStyle = '#e7bd58';
        poly(g, [[0, -r * 0.93], [r * 0.16, -r * 0.66], [0, -r * 0.42], [-r * 0.16, -r * 0.66]]);
        g.fillStyle = '#7fd3ec';
        circle(g, 0, -r * 0.65, r * 0.07);
        g.fillStyle = '#fff4e6';
        oval(g, 0, r * 0.32, r * 0.45, r * 0.3);
        face(g, r, o, { eyeY: r * 0.02, mouthY: r * 0.32, eye: '#4988cf' });
        g.fillStyle = '#e8566b';
        oval(g, o.look, r * 0.2, r * 0.06, r * 0.045);
        g.strokeStyle = '#c9744a';
        g.lineWidth = Math.max(1, r * 0.035);
        for (const k of [-1, 1]) {
            for (const dy of [0.22, 0.32]) {
                g.beginPath();
                g.moveTo(k * r * 0.5, r * dy);
                g.lineTo(k * r * 0.82, r * (dy - 0.04));
                g.stroke();
            }
        }
        g.fillStyle = '#ffd34d';
        circle(g, 0, r * 0.82, r * 0.12);
    }

    function drawDandan(g, r, o) {
        // 말파이트의 뾰족한 바위 어깨와 층진 암석 얼굴.
        for (const k of [-1, 1]) {
            g.fillStyle = '#514b3d';
            poly(g, [[k * r * 0.35, r * 0.6], [k * r * 1.04, r * 0.72], [k * r * 1.15, -r * 0.08], [k * r * 0.77, -r * 0.58], [k * r * 0.62, -r * 0.08]]);
            g.fillStyle = '#92836a';
            poly(g, [[k * r * 0.65, r * 0.2], [k * r * 1.04, -r * 0.08], [k * r * 0.77, -r * 0.58], [k * r * 0.62, -r * 0.08]]);
        }
        g.fillStyle = '#514b3d';
        poly(g, [[-r * 0.8, r * 0.32], [-r * 0.72, -r * 0.57], [-r * 0.28, -r * 0.81], [0, -r * 1.15], [r * 0.3, -r * 0.78], [r * 0.72, -r * 0.57], [r * 0.8, r * 0.32], [r * 0.37, r * 0.88], [-r * 0.37, r * 0.88]]);
        g.fillStyle = '#9c8b6f';
        poly(g, [[-r * 0.63, -r * 0.47], [0, -r * 0.99], [r * 0.63, -r * 0.47], [r * 0.55, r * 0.25], [0, r * 0.65], [-r * 0.55, r * 0.25]]);
        g.fillStyle = '#73644f';
        poly(g, [[0, -r * 0.99], [r * 0.63, -r * 0.47], [r * 0.55, r * 0.25], [0, r * 0.65], [r * 0.12, -r * 0.22]]);
        g.fillStyle = o.hurt ? '#ffb066' : '#ffdd68';
        for (const k of [-1, 1]) poly(g, [[k * r * 0.12, -r * 0.08], [k * r * 0.49, -r * 0.24], [k * r * 0.4, -r * 0.01], [k * r * 0.15, r * 0.06]]);
        g.strokeStyle = '#403c32'; g.lineWidth = r * 0.07; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-r * 0.3, r * 0.35); g.lineTo(0, r * 0.29); g.lineTo(r * 0.3, r * 0.35); g.stroke();
        g.strokeStyle = '#c4ae86'; g.lineWidth = r * 0.035;
        g.beginPath(); g.moveTo(-r * 0.5, -r * 0.47); g.lineTo(-r * 0.3, -r * 0.32); g.lineTo(-r * 0.36, -r * 0.2); g.stroke();
    }

    // 매번 같은 배경이 나오도록 고정 시드 난수 사용
    function rng(seed) {
        return () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // 강 중심선: 화면 중앙을 지나 -0.35rad 기울어진 직선
    function riverY(x) { return RIVER_Y + (W / 2 - x) * Math.tan(RIVER_ANGLE); }

    function wavyBand(g, half, amp, phase) {
        g.beginPath();
        for (let x = -W; x <= W; x += 8) g.lineTo(x, -half + Math.sin(x * 0.045 + phase) * amp);
        for (let x = W; x >= -W; x -= 8) g.lineTo(x, half + Math.sin(x * 0.05 + phase + 2) * amp);
        g.closePath();
        g.fill();
    }

    function drawRock(g, x, y, w, h, rand) {
        const pts = [];
        for (let i = 0; i < 9; i++) {
            const a = Math.PI + i / 8 * Math.PI;
            pts.push([x + Math.cos(a) * w * (0.85 + rand() * 0.2), y + Math.sin(a) * h * (0.8 + rand() * 0.3)]);
        }
        g.fillStyle = '#00000026';
        oval(g, x + 4, y + 4, w * 1.02, h * 0.25);
        g.fillStyle = '#5c584f';
        poly(g, [...pts, [x + w, y + h * 0.2], [x - w, y + h * 0.2]]);
        g.fillStyle = '#7b766b';
        poly(g, pts.map(([px, py]) => [x + (px - x) * 0.85, y + (py - y) * 0.85 - h * 0.08]));
        g.fillStyle = '#958f82';
        poly(g, pts.slice(2, 7).map(([px, py]) => [x + (px - x) * 0.55, y + (py - y) * 0.75 - h * 0.12]));
        g.fillStyle = '#4f8a4acc';
        oval(g, x - w * 0.15, y - h * 0.78, w * 0.4, h * 0.14);
    }

    function drawTree(g, x, y, s) {
        g.fillStyle = '#0000002e';
        oval(g, x + s * 0.2, y + s * 0.75, s * 1.1, s * 0.35);
        g.fillStyle = '#5a3d27';
        g.fillRect(x - s * 0.12, y + s * 0.2, s * 0.24, s * 0.55);
        for (const [dx, dy, r, c] of [[0, 0, 1, '#2a5e38'], [-0.55, 0.15, 0.7, '#2a5e38'], [0.55, 0.1, 0.72, '#2a5e38'], [-0.15, -0.25, 0.6, '#367a46'], [0.3, -0.1, 0.45, '#438c50'], [-0.4, -0.05, 0.35, '#438c50']]) {
            g.fillStyle = c;
            circle(g, x + dx * s, y + dy * s, r * s);
        }
    }

    function drawBrush(g, x, y, w, rand) {
        g.fillStyle = '#00000022';
        oval(g, x, y + 4, w * 0.6, w * 0.16);
        g.lineCap = 'round';
        for (let i = 0; i < w * 0.9; i++) {
            const bx = x + (rand() - 0.5) * w, h = w * (0.35 + rand() * 0.4), lean = (rand() - 0.5) * w * 0.4;
            g.strokeStyle = rand() < 0.5 ? '#2c6b3e' : '#347a46';
            g.lineWidth = 2 + rand() * 2;
            g.beginPath();
            g.moveTo(bx, y);
            g.quadraticCurveTo(bx + lean * 0.3, y - h * 0.6, bx + lean, y - h);
            g.stroke();
            if (rand() < 0.4) {
                g.fillStyle = '#7fc27a';
                circle(g, bx + lean, y - h, 1.5);
            }
        }
    }

    function drawShrine(g, x, y) {
        g.fillStyle = '#00000030';
        oval(g, x + 4, y + 6, 30, 9);
        g.fillStyle = '#6d6a74';
        g.fillRect(x - 24, y - 8, 48, 14);
        g.fillStyle = '#85828d';
        g.fillRect(x - 17, y - 52, 34, 46);
        g.strokeStyle = '#6d6a74';
        g.lineWidth = 1.5;
        for (const by of [-40, -28, -16]) {
            g.beginPath();
            g.moveTo(x - 17, y + by);
            g.lineTo(x + 17, y + by);
            g.stroke();
        }
        g.fillStyle = '#9c99a6';
        g.fillRect(x - 21, y - 58, 42, 8);
        g.fillStyle = '#4f8a4a';
        oval(g, x - 10, y - 57, 12, 3);
        g.fillStyle = '#3fb7d6';
        poly(g, [[x, y - 92], [x + 11, y - 72], [x, y - 60], [x - 11, y - 72]]);
        g.fillStyle = '#a8ecfa';
        poly(g, [[x, y - 92], [x + 4, y - 74], [x, y - 62], [x - 5, y - 72]]);
    }

    function drawBackground(g) {
        const rand = rng(20261030);
        const grass = g.createLinearGradient(0, 0, 0, H);
        grass.addColorStop(0, '#6cb86f');
        grass.addColorStop(1, '#3d8a52');
        g.fillStyle = grass;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 45; i++) {
            g.fillStyle = rand() < 0.5 ? '#ffffff0c' : '#0000000e';
            oval(g, rand() * W, rand() * LANE_Y, 30 + rand() * 60, 14 + rand() * 26, rand() * Math.PI);
        }
        for (let i = 0; i < 140; i++) {
            const x = rand() * W, y = rand() * LANE_Y;
            g.fillStyle = rand() < 0.5 ? '#5aa964' : '#86c985';
            g.fillRect(x, y, 2, 5 + rand() * 4);
            g.fillRect(x + 3, y + 2, 2, 4);
        }

        // 강과 강둑
        g.save();
        g.translate(W / 2, RIVER_Y);
        g.rotate(-RIVER_ANGLE);
        g.fillStyle = '#b7a57a';
        wavyBand(g, 60, 5, 0);
        g.fillStyle = '#a08f66';
        wavyBand(g, 54, 4, 1);
        const water = g.createLinearGradient(0, -48, 0, 48);
        water.addColorStop(0, '#8ad8ef');
        water.addColorStop(0.5, '#4fa9d6');
        water.addColorStop(1, '#3a8fc4');
        g.fillStyle = water;
        wavyBand(g, 47, 4, 1.5);
        g.fillStyle = '#2f7fb526';
        wavyBand(g, 18, 3, 3);
        g.strokeStyle = '#ffffff55';
        g.lineWidth = 2;
        g.lineCap = 'round';
        for (let i = 0; i < 18; i++) {
            const x = -W + rand() * W * 2, y = (rand() - 0.5) * 70;
            g.beginPath();
            g.arc(x, y, 8 + rand() * 8, Math.PI * 1.15, Math.PI * 1.85);
            g.stroke();
        }
        for (const [x, y, s] of [[-170, 30, 9], [-150, 36, 6], [60, -32, 8], [190, 22, 10]]) {
            g.fillStyle = '#ffffff40';
            oval(g, x, y + s * 0.4, s * 1.5, s * 0.5);
            g.fillStyle = '#6f7a80';
            oval(g, x, y, s, s * 0.7);
            g.fillStyle = '#93a0a6';
            oval(g, x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.3);
        }
        for (const [x, y] of [[-60, 14], [-40, 28], [120, -10], [240, -26]]) {
            g.fillStyle = '#4c9a52';
            g.beginPath();
            g.arc(x, y, 9, 0.5, Math.PI * 2);
            g.lineTo(x, y);
            g.fill();
            g.fillStyle = '#6dbb6a';
            circle(g, x - 2, y - 2, 3);
        }
        g.fillStyle = '#ffb3d1';
        circle(g, -40, 26, 3);
        circle(g, 240, -28, 3);
        g.restore();

        // 정글 벽: 나무와 절벽 바위
        drawTree(g, 30, 30, 34);
        drawTree(g, 95, 10, 28);
        drawTree(g, 455, 270, 30);
        drawTree(g, 20, 470, 32);
        drawTree(g, 440, 20, 26);
        drawRock(g, 395, 60, 50, 34, rand);
        drawRock(g, 330, 40, 30, 22, rand);
        drawRock(g, 70, 545, 46, 30, rand);
        drawRock(g, 250, 470, 26, 18, rand);

        drawBrush(g, 210, 140, 60, rand);
        drawBrush(g, 330, 470, 64, rand);
        drawBrush(g, 130, 410, 48, rand);

        for (const [x, y] of SHRINES) drawShrine(g, x, y);

        for (let i = 0; i < 26; i++) {
            const x = rand() * W, y = rand() * LANE_Y;
            if (Math.abs(y - riverY(x)) < 70) continue;
            if (rand() < 0.6) {
                const c = ['#fff3a8', '#ffc2dc', '#c9b8ff', '#ffffff'][Math.floor(rand() * 4)];
                g.fillStyle = c;
                for (let p = 0; p < 5; p++) circle(g, x + Math.cos(p * 1.257) * 2.6, y + Math.sin(p * 1.257) * 2.6, 2);
                g.fillStyle = '#f2b632';
                circle(g, x, y, 1.6);
            } else {
                g.fillStyle = '#8a8478';
                oval(g, x, y, 4 + rand() * 3, 3);
                g.fillStyle = '#a9a396';
                oval(g, x - 1, y - 1, 2, 1.4);
            }
        }

        // 돌길 레인
        g.fillStyle = '#7f7258';
        g.fillRect(0, LANE_Y, W, H - LANE_Y);
        for (let row = 0, y = LANE_Y + 4; y < H; row++, y += 20) {
            for (let x = -(row % 2) * 18 - rand() * 10; x < W; ) {
                const w = 26 + rand() * 18;
                g.fillStyle = ['#b6a887', '#c3b593', '#aa9c7d', '#bdb08d'][Math.floor(rand() * 4)];
                g.beginPath();
                g.roundRect(x + 2, y, w - 4, 16, 5);
                g.fill();
                g.fillStyle = '#ffffff1c';
                g.fillRect(x + 5, y + 2, w - 12, 3);
                x += w;
            }
        }
        g.fillStyle = '#6b8f4a';
        g.fillRect(0, LANE_Y - 3, W, 6);
        g.lineCap = 'round';
        for (let x = 0; x < W; x += 5) {
            g.strokeStyle = rand() < 0.5 ? '#4f9a58' : '#5fae63';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x, LANE_Y);
            g.lineTo(x + (rand() - 0.5) * 4, LANE_Y + 3 + rand() * 7);
            g.stroke();
        }

        const vignette = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        vignette.addColorStop(0, '#00000000');
        vignette.addColorStop(1, '#00000047');
        g.fillStyle = vignette;
        g.fillRect(0, 0, W, H);
    }

    // 석탑 수정 빛, 물결 반짝임, 반딧불
    function drawAmbient(t) {
        for (const [x, y] of SHRINES) {
            const pulse = 0.55 + 0.45 * Math.sin(t * 0.003 + x);
            const glow = ctx.createRadialGradient(x, y - 76, 2, x, y - 76, 34);
            glow.addColorStop(0, `rgba(140, 235, 255, ${0.55 * pulse})`);
            glow.addColorStop(1, 'rgba(140, 235, 255, 0)');
            ctx.fillStyle = glow;
            circle(ctx, x, y - 76, 34);
        }
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 7; i++) {
            const x = ((t * 0.025 + i * 83) % (W + 60)) - 30;
            const y = riverY(x) + Math.sin(i * 2.3) * 26;
            ctx.globalAlpha = 0.5 * Math.max(0, Math.sin(t * 0.004 + i * 1.7));
            oval(ctx, x, y, 6, 1.5, -RIVER_ANGLE);
        }
        for (let i = 0; i < 12; i++) {
            const x = (i * 131 + Math.sin(t * 0.0006 + i) * 40 + W) % W;
            const y = (i * 71) % (LANE_Y - 40) + 20 + Math.cos(t * 0.0008 + i * 2) * 20;
            ctx.globalAlpha = 0.35 + 0.5 * Math.max(0, Math.sin(t * 0.003 + i * 1.3));
            ctx.fillStyle = '#e8ff9a55';
            circle(ctx, x, y, 5);
            ctx.fillStyle = '#f4ffc2';
            circle(ctx, x, y, 1.8);
        }
        ctx.globalAlpha = 1;
    }

    function drawPlayer(t) {
        const { x, y, r } = player;
        const bob = Math.sin(t * 0.008) * 2;
        const sq = player.squash > 0 ? Math.sin(player.squash / 0.25 * Math.PI) * 0.18 : 0;
        const hurt = player.hurt > 0;

        ctx.fillStyle = '#00000030';
        oval(ctx, x, y + r * 0.95, r * 0.9, r * 0.22);
        if (champ().reach) {
            ctx.strokeStyle = '#fff6c24d';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.arc(x, y - 6, r * 0.85 * champ().reach, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.save();
        ctx.translate(x, y + bob);
        ctx.scale(1 + sq, 1 - sq);
        if (hurt && Math.floor(player.hurt * 20) % 2) ctx.globalAlpha = 0.5;
        champ().draw(ctx, r, {
            t, face: player.face, look: player.face * r * 0.06, hurt,
            blink: !hurt && t % 3600 < 130, open: sq > 0.02, shield: shieldReady,
        });
        ctx.restore();
    }

    function drawItem(it, t) {
        ctx.save();
        ctx.translate(it.x, it.y);
        if (it.charmed) {
            ctx.fillStyle = '#ff8fc0';
            ctx.globalAlpha = 0.7;
            ctx.font = `12px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.fillText('♥', it.r * 0.9, -it.r * 0.8);
            ctx.globalAlpha = 1;
        }
        if (it.type === 'coin') {
            ctx.scale(Math.max(0.25, Math.abs(Math.cos(it.spin))), 1);
            ctx.fillStyle = '#d99a1e';
            circle(ctx, 0, 0, it.r);
            ctx.fillStyle = '#ffd34d';
            circle(ctx, 0, 0, it.r - 3);
            ctx.fillStyle = '#d99a1e';
            ctx.font = `800 15px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', 0, 1);
        } else if (it.type === 'cookie') {
            ctx.rotate(it.spin * 0.3);
            ctx.fillStyle = '#b97a3e';
            circle(ctx, 0, 0, it.r);
            ctx.fillStyle = '#d9a05b';
            circle(ctx, -1, -1, it.r - 3);
            ctx.fillStyle = '#5a3418';
            for (const [cx, cy] of [[-6, -5], [5, -7], [7, 4], [-4, 6], [0, 0]]) circle(ctx, cx, cy, 2.6);
        } else if (it.type === 'heart') {
            const s = it.r * (1 + Math.sin(t * 0.01) * 0.08);
            ctx.fillStyle = '#ff5d93';
            ctx.beginPath();
            ctx.moveTo(0, s * 0.75);
            ctx.bezierCurveTo(-s * 1.25, -s * 0.1, -s * 0.5, -s * 1.05, 0, -s * 0.35);
            ctx.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.25, -s * 0.1, 0, s * 0.75);
            ctx.fill();
            ctx.fillStyle = '#ffffffaa';
            circle(ctx, -s * 0.4, -s * 0.35, s * 0.15);
        } else {
            ctx.strokeStyle = '#8a6a4a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -it.r);
            ctx.quadraticCurveTo(6, -it.r - 8, 3, -it.r - 13);
            ctx.stroke();
            ctx.fillStyle = Math.floor(t / 90) % 2 ? '#ffd34d' : '#ff7a3d';
            circle(ctx, 3, -it.r - 14, 4);
            ctx.fillStyle = '#2f2b45';
            circle(ctx, 0, 0, it.r);
            ctx.fillStyle = '#4a4568';
            circle(ctx, -it.r * 0.35, -it.r * 0.35, it.r * 0.3);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-9, -4); ctx.lineTo(-3, -1);
            ctx.moveTo(9, -4); ctx.lineTo(3, -1);
            ctx.moveTo(-4, 7); ctx.quadraticCurveTo(0, 3, 4, 7);
            ctx.stroke();
        }
        ctx.restore();
    }

    function outlinedText(text, x, y, size, color, align = 'center') {
        ctx.font = `800 ${size}px ${FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1b2a3a';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    function draw(t) {
        ctx.save();
        if (shake > 0) {
            const k = 12 * shake / 0.35;
            ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        }
        ctx.drawImage(bg, 0, 0, W, H);
        drawAmbient(t);
        for (const it of items) drawItem(it, t);
        drawPlayer(t);
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
            ctx.fillStyle = p.color;
            circle(ctx, p.x, p.y, 3.5);
        }
        for (const p of popups) {
            ctx.globalAlpha = Math.min(1, p.life * 2);
            outlinedText(p.text, p.x, p.y, p.size, p.color);
        }
        ctx.globalAlpha = 1;
        if (state === 'play' && combo >= 2) outlinedText(`${combo} 콤보`, 14, 30, 17, '#fff', 'left');
        if (state === 'play' && champ().shield) {
            outlinedText(shieldReady ? '정령 준비 완료' : `정령 충전 ${Math.ceil(shieldIn)}초`, W - 14, 30, 15, shieldReady ? '#ffb15c' : '#ccc', 'right');
        }
        ctx.restore();
    }

    function drawPreviews() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (const c of document.querySelectorAll('canvas[data-champ]')) {
            const size = 72, g = c.getContext('2d');
            c.width = size * dpr;
            c.height = size * dpr;
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.translate(size / 2, size * 0.56);
            CHAMPS[c.dataset.champ].draw(g, 22, { t: 0, face: 1, look: 0, hurt: false, blink: false, open: false, shield: true });
        }
    }

    function frame(t) {
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
        last = t;
        if (state === 'play') update(dt);
        draw(t);
        requestAnimationFrame(frame);
    }

    function toLogicalX(e) {
        const rect = canvas.getBoundingClientRect();
        return (e.clientX - rect.left) / rect.width * W;
    }

    addEventListener('keydown', e => {
        const dir = KEYMAP[e.code];
        if (dir && state === 'play') {
            keys.add(dir);
            e.preventDefault();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
            if (state === 'play') pause();
            else if (state === 'pause') start();
        } else if (e.code === 'Space' && state === 'play') {
            e.preventDefault();
        }
    });
    addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
    addEventListener('blur', () => keys.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    canvas.addEventListener('pointerdown', e => {
        if (state !== 'play') return;
        canvas.setPointerCapture(e.pointerId);
        player.target = toLogicalX(e);
    });
    canvas.addEventListener('pointermove', e => { if (state === 'play') player.target = toLogicalX(e); });
    champSelect.addEventListener('change', e => selectChamp(e.target.value));
    startBtn.addEventListener('click', start);
    pauseBtn.addEventListener('click', () => (state === 'play' ? pause() : start()));
    addEventListener('resize', resize);

    const checked = champSelect.querySelector(`input[value="${champId}"]`);
    if (checked) checked.checked = true;
    selectChamp(champId);
    resize();
    drawPreviews();
    requestAnimationFrame(frame);
})();
