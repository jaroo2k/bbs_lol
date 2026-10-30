<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
$action = input('action', $_GET) ?: 'list';
if (!in_array($action, ['list', 'view', 'write', 'edit', 'delete'], true)) fail(404, '페이지를 찾을 수 없습니다.');
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 0;
$post = null;
if (in_array($action, ['view', 'edit', 'delete'], true)) {
    $stmt = $pdo->prepare('SELECT * FROM posts WHERE id = ?');
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    if (!$post) fail(404, '게시글을 찾을 수 없습니다.');
}
$errors = [];
$title = $post['title'] ?? '';
$author = $post['author'] ?? '';
$content = $post['content'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], input('csrf', $_POST))) fail(403, '요청이 만료되었습니다. 페이지를 새로 열어 주세요.');
    if (!in_array($action, ['write', 'edit', 'delete'], true)) fail(405, '허용되지 않은 요청입니다.');
    $password = input('password', $_POST);
    if ($action !== 'delete') {
        $title = input('title', $_POST);
        $author = input('author', $_POST);
        $content = input('content', $_POST);
        if ($title === '' || mb_strlen($title) > 200) $errors[] = '제목은 1~200자로 입력해 주세요.';
        if ($author === '' || mb_strlen($author) > 40) $errors[] = '작성자는 1~40자로 입력해 주세요.';
        if ($content === '' || mb_strlen($content) > 20000) $errors[] = '내용은 1~20,000자로 입력해 주세요.';
    }
    if ($action === 'write') {
        if (mb_strlen($password) < 4 || strlen($password) > 72) $errors[] = '비밀번호는 4자 이상, 72바이트 이하로 입력해 주세요.';
    } else {
        $attempts = $_SESSION['password_attempts'] ?? ['count' => 0, 'start' => time()];
        if (time() - $attempts['start'] >= 300) $attempts = ['count' => 0, 'start' => time()];
        if ($attempts['count'] >= 10) $errors[] = '비밀번호를 여러 번 잘못 입력했습니다. 5분 후 다시 시도해 주세요.';
        elseif (!password_verify($password, $post['password_hash'])) { $attempts['count']++; $errors[] = '비밀번호가 일치하지 않습니다.'; }
        $_SESSION['password_attempts'] = $attempts;
    }
    if (!$errors) {
        if ($action === 'write') {
            $stmt = $pdo->prepare('INSERT INTO posts (title, author, password_hash, content) VALUES (?, ?, ?, ?)');
            $stmt->execute([$title, $author, password_hash($password, PASSWORD_DEFAULT), $content]);
            $id = (int) $pdo->lastInsertId();
            $_SESSION['flash'] = '새 글이 등록되었습니다.';
        } elseif ($action === 'edit') {
            $stmt = $pdo->prepare('UPDATE posts SET title = ?, author = ?, content = ? WHERE id = ?');
            $stmt->execute([$title, $author, $content, $id]);
            $_SESSION['flash'] = '글이 수정되었습니다.';
        } else {
            $stmt = $pdo->prepare('DELETE FROM posts WHERE id = ?');
            $stmt->execute([$id]);
            $_SESSION['flash'] = '글이 삭제되었습니다.';
            redirect('/');
        }
        redirect('/?action=view&id=' . $id);
    }
}
if ($action === 'view' && empty($_SESSION['viewed']['post-' . $id])) {
    $stmt = $pdo->prepare('UPDATE posts SET views = views + 1 WHERE id = ?');
    $stmt->execute([$id]);
    $post['views']++;
    $_SESSION['viewed']['post-' . $id] = true;
    if (count($_SESSION['viewed']) > 500) array_shift($_SESSION['viewed']);
}
$q = mb_substr(input('q', $_GET), 0, 100);
$page = max(1, (int) input('page', $_GET));
$perPage = 10;
if ($action === 'list') {
    $where = $q === '' ? '' : " WHERE title LIKE ? ESCAPE '!' OR content LIKE ? ESCAPE '!' OR author LIKE ? ESCAPE '!'";
    $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $q) . '%';
    $params = $q === '' ? [] : [$pattern, $pattern, $pattern];
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM posts' . $where);
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();
    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $pages);
    $offset = ($page - 1) * $perPage;
    $stmt = $pdo->prepare('SELECT id, title, author, views, created_at FROM posts' . $where . " ORDER BY id DESC LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);
    $posts = $stmt->fetchAll();
}
$flash = $_SESSION['flash'] ?? '';
unset($_SESSION['flash']);
$pageTitle = match ($action) { 'view' => $post['title'], 'write' => '새 글 작성', 'edit' => '글 수정', 'delete' => '글 삭제', default => '자유게시판' };
?>
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($pageTitle) ?> · 모여</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <header class="topbar">
        <div class="shell nav">
            <a class="brand" href="/">
                <span class="brand-mark">m.</span> 모여<span class="brand-sub">함께 나누는 이야기</span>
            </a>
            <div class="nav-links">
                <a class="nav-link nav-event" href="/event.php">🎉 오픈 이벤트</a>
                <a class="nav-link" href="/game.php">미니게임</a>
                <a class="nav-link" href="/">자유게시판</a>
            </div>
        </div>
    </header>

    <main class="shell">
        <section class="intro">
            <p class="eyebrow">OUR COMMUNITY</p>
            <h1>자유게시판<span class="dot">.</span></h1>
            <p>가벼운 일상부터 새로운 생각까지, 편하게 나눠보세요.</p>
        </section>

        <?php if ($flash): ?>
            <div class="notice" role="status"><?= e($flash) ?></div>
        <?php endif; ?>

        <?php if ($errors): ?>
            <div class="errors" role="alert">
                <ul>
                    <?php foreach ($errors as $error): ?>
                        <li><?= e($error) ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <?php if ($action === 'list'): ?>
            <section class="card">
                <div class="toolbar">
                    <div>
                        <h2>롤 게시판</h2>
                        <span class="muted">전체 <strong><?= number_format($total) ?></strong>개<?= $q !== '' ? '의 검색 결과' : '의 글' ?></span>
                    </div>
                    <a class="button" href="/?action=write"><span aria-hidden="true">＋</span> 글쓰기</a>
                </div>

                <form class="search" method="get" action="/">
                    <label class="sr-only" for="q">게시글 검색</label>
                    <input
                        id="q"
                        name="q"
                        type="search"
                        maxlength="100"
                        placeholder="제목, 내용, 작성자로 검색해 보세요"
                        value="<?= e($q) ?>"
                    >
                    <button class="button secondary" type="submit">검색</button>
                    <?php if ($q !== ''): ?>
                        <a class="reset" href="/">초기화</a>
                    <?php endif; ?>
                </form>

                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="number">번호</th>
                                <th>제목</th>
                                <th>작성자</th>
                                <th>작성일</th>
                                <th class="number">조회</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($posts as $row): ?>
                                <tr>
                                    <td class="number muted"><?= e($row['id']) ?></td>
                                    <td class="subject">
                                        <a href="/?action=view&amp;id=<?= e($row['id']) ?>"><?= e($row['title']) ?></a>
                                        <?php if (strtotime($row['created_at']) >= time() - 86400): ?>
                                            <span class="new">N<span class="sr-only"> 새 글</span></span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?= e($row['author']) ?></td>
                                    <td class="muted date"><?= e(date('Y.m.d', strtotime($row['created_at']))) ?></td>
                                    <td class="number muted"><?= number_format((int) $row['views']) ?></td>
                                </tr>
                            <?php endforeach; ?>

                            <?php if (!$posts): ?>
                                <tr>
                                    <td colspan="5">
                                        <div class="empty">
                                            <span class="empty-mark" aria-hidden="true">✎</span>
                                            <h3><?= $q !== '' ? '검색 결과가 없습니다' : '첫 번째 이야기를 기다리고 있어요' ?></h3>
                                            <p><?= $q !== '' ? '다른 검색어로 다시 찾아보세요.' : '오늘의 생각을 첫 글로 남겨보세요.' ?></p>
                                            <?php if ($q === ''): ?>
                                                <a class="button secondary" href="/?action=write">첫 글 쓰기</a>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>

                <nav class="pagination" aria-label="페이지 이동">
                    <?php if ($page > 1): ?>
                        <a href="/?<?= e(http_build_query(['q' => $q, 'page' => $page - 1])) ?>">이전</a>
                    <?php endif; ?>

                    <?php for ($i = max(1, $page - 2); $i <= min($pages, $page + 2); $i++): ?>
                        <a
                            <?= $i === $page ? 'class="active" aria-current="page"' : '' ?>
                            href="/?<?= e(http_build_query(['q' => $q, 'page' => $i])) ?>"
                        ><?= $i ?></a>
                    <?php endfor; ?>

                    <?php if ($page < $pages): ?>
                        <a href="/?<?= e(http_build_query(['q' => $q, 'page' => $page + 1])) ?>">다음</a>
                    <?php endif; ?>
                </nav>
            </section>
        <?php elseif ($action === 'view'): ?>
            <article class="card article">
                <a class="back" href="/">← 목록으로</a>
                <h2><?= e($post['title']) ?></h2>
                <div class="metadata">
                    <strong><?= e($post['author']) ?></strong>
                    <time><?= e(date('Y.m.d H:i', strtotime($post['created_at']))) ?></time>
                    <span>조회 <?= number_format((int) $post['views']) ?></span>
                </div>
                <div class="post-content"><?= e($post['content']) ?></div>
                <?php if (!empty($post['image_path'])): ?>
                    <figure class="post-image">
                        <a href="<?= e($post['image_path']) ?>" target="_blank" rel="noopener">
                            <img src="<?= e($post['image_path']) ?>" alt="<?= e($post['title']) ?> 첨부 이미지">
                        </a>
                        <figcaption><?= str_contains($post['image_path'], '-ai-') ? '실제 경기 캡처가 아닌 AI 생성 이미지입니다. ' : '' ?>클릭하면 원본을 볼 수 있습니다.</figcaption>
                    </figure>
                <?php endif; ?>
                <div class="actions">
                    <a class="button secondary" href="/">목록</a>
                    <div>
                        <a class="button secondary" href="/?action=edit&amp;id=<?= $id ?>">수정</a>
                        <a class="button danger-outline" href="/?action=delete&amp;id=<?= $id ?>">삭제</a>
                    </div>
                </div>
            </article>
        <?php elseif ($action === 'delete'): ?>
            <section class="card editor">
                <a class="back" href="/?action=view&amp;id=<?= $id ?>">← 글로 돌아가기</a>
                <h2>글을 삭제할까요?</h2>
                <p class="muted">삭제한 글은 복구할 수 없습니다. 작성 시 입력한 비밀번호를 확인해 주세요.</p>
                <p class="delete-title"><?= e($post['title']) ?></p>

                <form method="post">
                    <input type="hidden" name="csrf" value="<?= e($_SESSION['csrf']) ?>">
                    <label for="password">비밀번호</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        maxlength="72"
                        autocomplete="current-password"
                    >
                    <div class="actions">
                        <a class="button secondary" href="/?action=view&amp;id=<?= $id ?>">취소</a>
                        <button class="button danger" type="submit">삭제하기</button>
                    </div>
                </form>
            </section>
        <?php else: ?>
            <section class="card editor">
                <a class="back" href="<?= $action === 'edit' ? '/?action=view&amp;id=' . $id : '/' ?>">← 돌아가기</a>
                <h2><?= $action === 'edit' ? '이야기 수정하기' : '새로운 이야기 쓰기' ?></h2>
                <p class="muted">서로를 존중하는 따뜻한 대화를 나눠주세요.</p>

                <form method="post">
                    <input type="hidden" name="csrf" value="<?= e($_SESSION['csrf']) ?>">

                    <label for="title">제목</label>
                    <input
                        id="title"
                        name="title"
                        maxlength="200"
                        value="<?= e($title) ?>"
                        placeholder="이야기의 제목을 입력해 주세요"
                        required
                    >

                    <div class="form-grid">
                        <div>
                            <label for="author">작성자</label>
                            <input
                                id="author"
                                name="author"
                                maxlength="40"
                                value="<?= e($author) ?>"
                                placeholder="사용할 이름"
                                required
                                autocomplete="nickname"
                            >
                        </div>
                        <div>
                            <label for="password">비밀번호</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                <?= $action === 'write' ? 'minlength="4"' : '' ?>
                                maxlength="72"
                                placeholder="<?= $action === 'edit' ? '작성 시 설정한 비밀번호' : '수정·삭제 시 사용 (4자 이상)' ?>"
                                required
                                autocomplete="<?= $action === 'edit' ? 'current-password' : 'new-password' ?>"
                            >
                        </div>
                    </div>

                    <label for="content">내용</label>
                    <textarea
                        id="content"
                        name="content"
                        rows="14"
                        maxlength="20000"
                        placeholder="어떤 이야기를 나누고 싶으신가요?"
                        required
                    ><?= e($content) ?></textarea>
                    <p class="hint">최대 20,000자 · 비밀번호는 잊어버리면 찾을 수 없으니 기억해 주세요.</p>

                    <div class="actions">
                        <a class="button secondary" href="<?= $action === 'edit' ? '/?action=view&amp;id=' . $id : '/' ?>">취소</a>
                        <button class="button" type="submit"><?= $action === 'edit' ? '수정 완료' : '글 등록하기' ?></button>
                    </div>
                </form>
            </section>
        <?php endif; ?>

        <aside class="community-note">
            <strong>함께 만드는 공간</strong>
            <span>생각은 자유롭게, 표현은 다정하게. 서로의 이야기에 귀 기울여 주세요.</span>
        </aside>
    </main>

    <footer class="shell footer">
        <span class="brand">모여<span class="dot">.</span></span>
        <span>작은 이야기가 모여, 우리의 공간이 됩니다.</span>
    </footer>
</body>
</html>
