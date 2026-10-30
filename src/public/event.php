<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
const FOUNDER_LIMIT = 1000;
$errors = [];
$nickname = '';
$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], input('csrf', $_POST))) fail(403, '요청이 만료되었습니다. 페이지를 새로 열어 주세요.');
    $nickname = input('nickname', $_POST);
    $email = mb_strtolower(input('email', $_POST));
    if (!mb_check_encoding($nickname, 'UTF-8')) $nickname = '';
    if (mb_strlen($nickname) < 2|| mb_strlen($nickname) > 20) $errors[] = '닉네임은 2~20자로 입력해 주세요.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) $errors[] = '올바른 이메일 주소를 입력해 주세요.';
    if (input('agree', $_POST) !== '1') $errors[] = '개인정보 수집·이용에 동의해 주세요.';
    if (($_SESSION['event_signup_count'] ?? 0) >= 5) $errors[] = '한 번에 너무 많이 신청했습니다. 잠시 후 다시 시도해 주세요.';
    if (!$errors) {
        try {
            $stmt = $pdo->prepare('INSERT INTO event_signups (nickname, email) VALUES (?, ?)');
            $stmt->execute([$nickname, $email]);
            $_SESSION['event_signup_count'] = ($_SESSION['event_signup_count'] ?? 0) + 1;
            $_SESSION['event_joined'] = ['nickname' => $nickname, 'number' => (int) $pdo->lastInsertId()];
            redirect('/event.php#join');
        } catch (PDOException $error) {
            if ($error->errorInfo[1] !== 1062) throw $error;
            $errors[] = '이미 사전 가입한 이메일입니다. 오픈 당일 안내 메일을 기다려 주세요!';
        }
    }
}
$joined = $_SESSION['event_joined'] ?? null;
unset($_SESSION['event_joined']);
$total = (int) $pdo->query('SELECT COUNT(*) FROM event_signups')->fetchColumn();
$left = max(0, FOUNDER_LIMIT - $total);
?>
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>오픈 이벤트 · 모여</title>
    <meta name="description" content="모여 그랜드 오픈 기념 사전 가입 이벤트. 선착순 1,000명에게 창립 멤버 배지를 드립니다.">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="/event.css">
</head>
<body class="event-page">
    <header class="topbar">
        <div class="shell nav">
            <a class="brand" href="/">
                <span class="brand-mark">m.</span> 모여<span class="brand-sub">함께 나누는 이야기</span>
            </a>
            <div class="nav-links">
                <a class="nav-link" href="/game.php">미니게임</a>
                <a class="nav-link" href="/">자유게시판</a>
            </div>
        </div>
    </header>

    <section class="ev-hero">
        <div class="shell ev-hero-grid">
            <div>
                <p class="ev-badge"><span class="ev-pulse" aria-hidden="true"></span> GRAND OPEN · 2026.11.01</p>
                <h1>혼자 보던 이야기,<br><em>이제 같이 떠들어요.</em></h1>
                <p class="ev-lead">취향이 맞는 사람들이 모이는 곳, <strong>모여</strong>가 문을 엽니다.<br>지금 사전 가입하면 오픈 첫날부터 남들보다 한 발 앞서 시작할 수 있어요.</p>
                <div class="ev-cta-row">
                    <a class="ev-cta" href="#join">30초 만에 사전 가입하기 →</a>
                    <span class="ev-cta-note">무료 · 이메일만 있으면 OK</span>
                </div>
            </div>
            <aside class="ev-counter" aria-label="창립 멤버 모집 현황">
                <p class="ev-counter-label">창립 멤버 남은 자리</p>
                <p class="ev-counter-num"><?= number_format($left) ?><small> / <?= number_format(FOUNDER_LIMIT) ?></small></p>
                <progress max="<?= FOUNDER_LIMIT ?>" value="<?= min($total, FOUNDER_LIMIT) ?>"><?= number_format($total) ?>명 참여</progress>
                <p class="ev-counter-foot">지금까지 <strong><?= number_format($total) ?>명</strong>이 먼저 모였어요</p>
            </aside>
        </div>
    </section>

    <main class="shell">
        <section class="ev-section">
            <p class="eyebrow">EARLY BIRD BENEFITS</p>
            <h2 class="ev-title">지금 가입하면, 이런 게 따라와요</h2>
            <div class="ev-perks">
                <article class="ev-perk">
                    <span class="ev-perk-icon" aria-hidden="true">🏅</span>
                    <h3>창립 멤버 배지</h3>
                    <p>선착순 1,000명에게만 주는 한정 배지. 닉네임 옆에 평생 남아요. 다시는 발급되지 않습니다.</p>
                    <span class="ev-tag">선착순 1,000명</span>
                </article>
                <article class="ev-perk">
                    <span class="ev-perk-icon" aria-hidden="true">✨</span>
                    <h3>원하는 닉네임 선점</h3>
                    <p>오픈 전에 가입한 분들께 먼저 닉네임 확정 기회를 드려요. 마음에 드는 이름, 뺏기기 전에 가져가세요.</p>
                    <span class="ev-tag">사전 가입자 전원</span>
                </article>
                <article class="ev-perk">
                    <span class="ev-perk-icon" aria-hidden="true">🎁</span>
                    <h3>오픈 기념 추첨 선물</h3>
                    <p>사전 가입자 중 추첨을 통해 커피 쿠폰과 굿즈를 보내드려요. 첫 글을 쓰면 당첨 확률이 2배!</p>
                    <span class="ev-tag">추첨 100명</span>
                </article>
            </div>
        </section>

        <section class="ev-section ev-steps">
            <p class="eyebrow">HOW IT WORKS</p>
            <h2 class="ev-title">참여는 딱 세 단계</h2>
            <ol>
                <li><strong>사전 가입</strong><span>닉네임과 이메일만 남기면 끝.</span></li>
                <li><strong>오픈 알림 받기</strong><span>11월 1일, 가장 먼저 메일로 알려드려요.</span></li>
                <li><strong>첫 글 남기기</strong><span>배지 받고, 추첨 확률은 두 배로.</span></li>
            </ol>
        </section>

        <section class="ev-join card" id="join">
            <?php if ($joined): ?>
                <div class="ev-done" role="status">
                    <span class="ev-done-icon" aria-hidden="true">🎉</span>
                    <h2><?= e($joined['nickname']) ?>님, 환영해요!</h2>
                    <p>모여의 <strong><?= number_format($joined['number']) ?>번째</strong> 사전 가입자가 되셨어요.<br>오픈 당일 메일로 가장 먼저 알려드릴게요.</p>
                    <a class="button" href="/">게시판 둘러보기</a>
                </div>
            <?php else: ?>
                <div class="ev-join-copy">
                    <p class="eyebrow">JOIN NOW</p>
                    <h2>자리가 다 차기 전에<br>먼저 모여요.</h2>
                    <p>창립 멤버 배지는 <strong><?= number_format($left) ?>자리</strong> 남았어요. 이벤트는 2026년 11월 30일까지 진행됩니다.</p>
                </div>
                <form class="ev-form" method="post" action="/event.php#join" novalidate>
                    <input type="hidden" name="csrf" value="<?= e($_SESSION['csrf']) ?>">
                    <?php if ($errors): ?>
                        <div class="errors" role="alert">
                            <ul>
                                <?php foreach ($errors as $error): ?>
                                    <li><?= e($error) ?></li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endif; ?>
                    <label for="nickname">닉네임</label>
                    <input id="nickname" name="nickname" maxlength="20" required placeholder="모여에서 불릴 이름 (2~20자)" value="<?= e($nickname) ?>">
                    <label for="email">이메일</label>
                    <input id="email" name="email" type="email" maxlength="254" required placeholder="오픈 알림을 받을 주소" value="<?= e($email) ?>">
                    <label class="ev-check">
                        <input type="checkbox" name="agree" value="1" required>
                        <span>[필수] 이벤트 안내를 위한 닉네임·이메일 수집·이용에 동의합니다. 수집한 정보는 이벤트 종료 후 6개월 내 파기합니다.</span>
                    </label>
                    <button class="ev-cta ev-submit" type="submit">창립 멤버로 사전 가입하기</button>
                </form>
            <?php endif; ?>
        </section>

        <section class="ev-section ev-faq">
            <p class="eyebrow">FAQ</p>
            <h2 class="ev-title">자주 묻는 질문</h2>
            <details>
                <summary>정말 무료인가요?</summary>
                <p>네, 사전 가입과 모든 혜택은 무료예요. 결제 정보는 요구하지 않습니다.</p>
            </details>
            <details>
                <summary>창립 멤버 배지는 언제 받나요?</summary>
                <p>11월 1일 오픈 후, 사전 가입한 이메일로 로그인하면 자동으로 지급돼요.</p>
            </details>
            <details>
                <summary>추첨 결과는 어디서 확인하나요?</summary>
                <p>이벤트 종료 후 12월 7일에 게시판 공지와 개별 메일로 안내해 드려요.</p>
            </details>
            <details>
                <summary>이미 가입했는데 다시 신청해도 되나요?</summary>
                <p>이메일 하나당 한 번만 참여할 수 있어요. 이미 신청하셨다면 오픈 알림만 기다려 주세요.</p>
            </details>
        </section>

        <footer class="footer">
            <span class="brand">m.</span>
            <span>이벤트 일정과 혜택은 운영 상황에 따라 변경될 수 있으며, 변경 시 게시판 공지로 안내합니다.</span>
        </footer>
    </main>
</body>
</html>
