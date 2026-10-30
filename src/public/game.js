'use strict';
(() => {
    const W = 480, H = 640, MAX_LIVES = 5, BEST_KEY = 'rift-snack-best', CHAMP_KEY = 'rift-snack-champ';
    const SHIELD_COOLDOWN = 20;
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
        // 도토리 모자
        g.fillStyle = '#7a4a22';
        g.beginPath();
        g.ellipse(0, -r * 0.6, r * 0.5, r * 0.3, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = '#a8743e';
        for (const [dx, dy] of [[-0.25, -0.68], [0, -0.75], [0.25, -0.68], [-0.12, -0.8], [0.12, -0.8]]) circle(g, dx * r, dy * r, r * 0.045);
        g.fillStyle = '#5a3418';
        g.fillRect(-r * 0.04, -r * 1.02, r * 0.08, r * 0.14);
    }

    function drawCoco(g, r, o) {
        g.fillStyle = '#e06a98';
        circle(g, 0, -r * 0.02, r * 0.95);
        g.fillStyle = '#ff8ab5';
        circle(g, 0, -r * 0.02, r * 0.92);
        outlined(g, 0, r * 0.05, r * 0.78, '#ffe4cf', '#e8bfa2');
        bangs(g, r * 0.9, '#ff8ab5', 0.14);
        face(g, r, o, { eyeY: r * 0.1, mouthY: r * 0.42, eye: '#8a4fd6' });
        // 마법사 모자
        g.fillStyle = '#5b37a8';
        oval(g, 0, -r * 0.62, r * 0.95, r * 0.16);
        g.fillStyle = '#7a4fd1';
        poly(g, [[-r * 0.55, -r * 0.64], [r * 0.15, -r * 1.55], [r * 0.55, -r * 0.64]]);
        g.fillStyle = '#ffd34d';
        star(g, -r * 0.02, -r * 0.92, r * 0.13);
        // 불꽃 정령 (충전 중엔 회색)
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
    }

    function drawLumi(g, r, o) {
        g.fillStyle = '#a99fd6';
        circle(g, 0, -r * 0.05, r * 0.98);
        g.fillStyle = '#e4ddfb';
        circle(g, 0, -r * 0.05, r * 0.95);
        for (const k of [-1, 1]) oval(g, k * r * 0.8, r * 0.4, r * 0.2, r * 0.45, k * -0.12);
        outlined(g, 0, r * 0.04, r * 0.78, '#ffe8d8', '#e7c4ac');
        bangs(g, r * 0.95, '#e4ddfb', 0.15);
        // 초승달 핀
        g.fillStyle = '#ffd34d';
        circle(g, r * 0.62, -r * 0.55, r * 0.17);
        g.fillStyle = '#e4ddfb';
        circle(g, r * 0.7, -r * 0.6, r * 0.14);
        face(g, r, o, { eyeY: r * 0.08, mouthY: r * 0.4, eye: '#7a5cd6' });
        g.globalAlpha *= 0.6 + 0.4 * Math.abs(Math.sin((o.t || 0) * 0.004));
        g.fillStyle = '#fff6c2';
        star(g, -r * 0.95, -r * 0.7, r * 0.14);
        star(g, r * 1.0, -r * 0.15, r * 0.09);
    }

    function drawMomo(g, r, o) {
        g.save();
        g.rotate(Math.sin((o.t || 0) * 0.005) * 0.25);
        g.strokeStyle = '#f2a03d';
        g.lineWidth = r * 0.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-o.face * r * 0.5, r * 0.4);
        g.quadraticCurveTo(-o.face * r * 1.3, r * 0.3, -o.face * r * 1.1, -r * 0.4);
        g.stroke();
        g.restore();
        for (const k of [-1, 1]) {
            g.fillStyle = '#d9832a';
            poly(g, [[k * r * 0.2, -r * 0.72], [k * r * 0.62, -r * 1.12], [k * r * 0.76, -r * 0.42]]);
            g.fillStyle = '#ffc2d4';
            poly(g, [[k * r * 0.34, -r * 0.7], [k * r * 0.58, -r * 0.95], [k * r * 0.66, -r * 0.55]]);
        }
        outlined(g, 0, 0, r * 0.84, '#ffd9a8', '#d9832a');
        g.fillStyle = '#f2a03d';
        g.beginPath();
        g.arc(0, 0, r * 0.84, Math.PI * 1.1, Math.PI * 1.9);
        g.closePath();
        g.fill();
        g.fillStyle = '#d9832a';
        for (const dx of [-0.2, 0, 0.2]) oval(g, dx * r, -r * 0.62, r * 0.05, r * 0.12);
        g.fillStyle = '#fff4e6';
        oval(g, 0, r * 0.32, r * 0.45, r * 0.3);
        face(g, r, o, { eyeY: r * 0.02, mouthY: r * 0.32, eye: '#3fae66' });
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
        outlined(g, 0, 0, r * 0.84, '#a7a9b8', '#6f7182');
        g.fillStyle = '#9295a6';
        circle(g, -r * 0.35, r * 0.45, r * 0.2);
        circle(g, r * 0.5, -r * 0.1, r * 0.14);
        g.strokeStyle = '#6f7182';
        g.lineWidth = Math.max(1, r * 0.05);
        g.beginPath();
        g.moveTo(-r * 0.6, -r * 0.3);
        g.lineTo(-r * 0.45, -r * 0.15);
        g.lineTo(-r * 0.55, 0);
        g.stroke();
        // 머리 위 이끼와 꽃
        g.fillStyle = '#6fbf73';
        g.beginPath();
        g.arc(0, 0, r * 0.84, Math.PI * 1.2, Math.PI * 1.8);
        g.quadraticCurveTo(r * 0.2, -r * 0.5, 0, -r * 0.58);
        g.quadraticCurveTo(-r * 0.2, -r * 0.5, -r * 0.49, -r * 0.68);
        g.fill();
        g.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) circle(g, r * 0.25 + Math.cos(i * 1.257) * r * 0.08, -r * 0.88 + Math.sin(i * 1.257) * r * 0.08, r * 0.06);
        g.fillStyle = '#ffd34d';
        circle(g, r * 0.25, -r * 0.88, r * 0.05);
        face(g, r, o, { eyeY: r * 0.02, mouthY: r * 0.3, eye: '#46c3d1' });
    }

    function drawBackground(g) {
        const grass = g.createLinearGradient(0, 0, 0, H);
        grass.addColorStop(0, '#78c47a');
        grass.addColorStop(1, '#3f8f55');
        g.fillStyle = grass;
        g.fillRect(0, 0, W, H);

        g.fillStyle = '#5aa964';
        for (let i = 0; i < 70; i++) {
            const x = (i * 97) % W, y = (i * 53 + (i % 7) * 31) % (H - 120);
            g.fillRect(x, y, 2, 7);
            g.fillRect(x + 4, y + 2, 2, 5);
        }

        g.save();
        g.translate(W / 2, H * 0.42);
        g.rotate(-0.35);
        const river = g.createLinearGradient(0, -48, 0, 48);
        river.addColorStop(0, '#8fdcf3');
        river.addColorStop(1, '#4aa8d8');
        g.fillStyle = river;
        g.fillRect(-W, -46, W * 2, 92);
        g.fillStyle = '#ffffff66';
        for (let i = 0; i < 14; i++) g.fillRect(-W + i * 80, -14 + (i % 3) * 14, 30, 4);
        g.restore();

        g.fillStyle = '#d6c08b';
        g.fillRect(0, H - 104, W, 104);
        g.fillStyle = '#c4ad76';
        for (let x = 12; x < W; x += 46) circle(g, x, H - 70 + (x % 3) * 14, 5);

        const bush = (x, y, s) => {
            g.fillStyle = '#2f7a45';
            circle(g, x, y, s);
            circle(g, x - s * 0.8, y + s * 0.25, s * 0.75);
            circle(g, x + s * 0.8, y + s * 0.25, s * 0.75);
            g.fillStyle = '#3f9a5a';
            circle(g, x - s * 0.25, y - s * 0.25, s * 0.45);
        };
        bush(60, 110, 26);
        bush(415, 180, 22);
        bush(80, 430, 20);
        bush(405, 470, 26);
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
