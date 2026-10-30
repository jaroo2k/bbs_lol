<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
?>
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>협곡 간식 대작전 · 모여</title>
    <meta name="description" content="롤 챔피언과 함께 떨어지는 골드와 쿠키를 모으는 캐주얼 미니게임">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="/game.css">
    <script src="/game.js" defer></script>
</head>
<body>
    <header class="topbar">
        <div class="shell nav">
            <a class="brand" href="/">
                <span class="brand-mark">m.</span> 모여<span class="brand-sub">함께 나누는 이야기</span>
            </a>
            <div class="nav-links">
                <a class="nav-link nav-event" href="/event.php">🎉 오픈 이벤트</a>
                <a class="nav-link" href="/game.php" aria-current="page">미니게임</a>
                <a class="nav-link" href="/">자유게시판</a>
            </div>
        </div>
    </header>

    <main class="shell">
        <section class="intro">
            <p class="eyebrow">MINI GAME</p>
            <h1>협곡 간식 대작전<span class="dot">.</span></h1>
            <p>마음에 드는 챔피언을 골라 하늘에서 떨어지는 골드와 쿠키를 모아보세요. 폭탄은 조심!</p>
        </section>

        <fieldset class="champ-select" id="champ-select">
            <legend>챔피언 선택</legend>
            <div class="champ-list">
<?php foreach (['dori' => ['티모', '날쌘 정찰병'], 'coco' => ['애니', '꼬마 마법사'], 'lumi' => ['럭스', '별빛 수호자'], 'momo' => ['유미', '장난꾸러기 냥이'], 'dandan' => ['말파이트', '든든한 돌 골렘']] as $key => [$name, $role]): ?>
                <label class="champ">
                    <input type="radio" name="champ" value="<?= $key ?>">
                    <canvas data-champ="<?= $key ?>" width="72" height="72" aria-hidden="true"></canvas>
                    <strong><?= $name ?></strong>
                    <span><?= $role ?></span>
                </label>
<?php endforeach; ?>
            </div>
            <p class="champ-perk">특성 · <b id="champ-perk"></b></p>
        </fieldset>

        <section class="game-layout">
            <div class="card game-card">
                <div class="game-hud">
                    <div><span>점수</span><strong id="score">0</strong></div>
                    <div><span>목숨</span><strong id="lives" class="hud-lives">♥♥♥</strong></div>
                    <div><span>최고 기록</span><strong id="best">0</strong></div>
                    <button id="pause" class="button secondary" type="button" disabled>일시정지</button>
                </div>
                <div class="game-stage">
                    <canvas id="game" width="480" height="640" aria-label="협곡 간식 대작전 게임 화면">이 게임은 Canvas를 지원하는 브라우저에서 즐길 수 있어요.</canvas>
                    <div class="game-overlay" id="overlay">
                        <div class="overlay-box">
                            <h2 id="overlay-title">협곡 간식 대작전</h2>
                            <p id="overlay-text">챔피언을 고르고 시작해 보세요!</p>
                            <button id="start" class="button game-start" type="button">게임 시작</button>
                        </div>
                    </div>
                </div>
            </div>

            <aside class="game-side">
                <div class="card side-box">
                    <h3>이렇게 놀아요</h3>
                    <ul>
                        <li><kbd>←</kbd> <kbd>→</kbd> 또는 <kbd>A</kbd> <kbd>D</kbd>로 이동</li>
                        <li>마우스를 올리거나 화면을 터치해서 끌어도 OK</li>
                        <li><kbd>P</kbd> / <kbd>Esc</kbd>로 일시정지</li>
                    </ul>
                </div>
                <div class="card side-box">
                    <h3>아이템</h3>
                    <ul class="item-list">
                        <li><span aria-hidden="true">🪙</span> 골드 <b>+10</b></li>
                        <li><span aria-hidden="true">🍪</span> 쿠키 <b>+30</b></li>
                        <li><span aria-hidden="true">💗</span> 하트 <b>목숨 +1</b></li>
                        <li><span aria-hidden="true">💣</span> 폭탄 <b class="bad">목숨 −1</b></li>
                    </ul>
                </div>
                <div class="card side-box">
                    <h3>연속 획득 보너스</h3>
                    <p>간식을 놓치지 않고 계속 먹으면 <b>더블킬 → 트리플킬 → 펜타킬!</b> 5콤보마다 점수가 0.5배씩 올라가요.</p>
                </div>
            </aside>
        </section>

        <p class="game-note">LoL의 협곡 분위기에서 영감을 받은 비공식 팬 미니게임으로, Riot Games와 관련이 없습니다. 캐릭터 이름은 LoL 챔피언에서 가져왔으며, 이미지는 자체 제작했습니다.</p>
    </main>
</body>
</html>
