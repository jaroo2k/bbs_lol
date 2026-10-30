<?php
declare(strict_types=1);

// Run: docker compose exec -T php php /var/www/html/tests/board-smoke.php
// Creates only uniquely marked temporary posts, and removes them in finally.
$base = 'http://nginx';
$cookie = tempnam(sys_get_temp_dir(), 'board-test-');
$marker = 'smoke-' . bin2hex(random_bytes(8));
$pdo = new PDO('mysql:host=mysql;dbname=' . getenv('DB_DATABASE') . ';charset=utf8mb4', getenv('DB_USERNAME'), getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$ids = [];

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
    echo "PASS: $message\n";
}
function request(string $path, ?array $data = null): array {
    global $base, $cookie;
    $headers = [];
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $cookie, CURLOPT_COOKIEJAR => $cookie,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$headers): int {
            if (str_contains($line, ':')) { [$key, $value] = explode(':', $line, 2); $headers[strtolower(trim($key))] = trim($value); }
            return strlen($line);
        },
    ]);
    if ($data !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($data)]);
    $body = curl_exec($curl);
    if ($body === false) throw new RuntimeException(curl_error($curl));
    return ['status' => curl_getinfo($curl, CURLINFO_RESPONSE_CODE), 'headers' => $headers, 'body' => $body];
}
function token(array $response): string {
    if (!preg_match('/name="csrf" value="([a-f0-9]+)"/', $response['body'], $matches)) throw new RuntimeException('CSRF token missing');
    return $matches[1];
}
try {
    $form = request('/?action=write');
    check($form['status'] === 200, 'Write form loads');
    $csrf = token($form);
    check(request('/?action=write', ['csrf' => 'bad'])['status'] === 403, 'Invalid CSRF rejected');
    $invalid = request('/?action=write', ['csrf' => $csrf, 'title' => '', 'author' => '', 'content' => '', 'password' => 'a']);
    check(str_contains($invalid['body'], 'role="alert"'), 'Empty fields rejected');
    $data = ['csrf' => $csrf, 'title' => $marker . '<script>alert(1)</script>', 'author' => '테스트 작성자', 'password' => 'test-pass-123', 'content' => "한글 본문\n<script>alert(2)</script>"];
    $created = request('/?action=write', $data);
    check($created['status'] === 303, 'Post creation redirects');
    parse_str(parse_url($created['headers']['location'], PHP_URL_QUERY), $query);
    $id = (int) $query['id'];
    $ids[] = $id;
    $view = request('/?action=view&id=' . $id);
    check(str_contains($view['body'], '한글 본문') && str_contains($view['body'], '&lt;script&gt;alert(2)&lt;/script&gt;') && !str_contains($view['body'], '<script>'), 'Korean content and HTML escaping');
    request('/?action=view&id=' . $id);
    $stored = $pdo->query('SELECT password_hash, views FROM posts WHERE id = ' . $id)->fetch(PDO::FETCH_ASSOC);
    check(password_verify($data['password'], $stored['password_hash']) && $stored['password_hash'] !== $data['password'], 'Password stored as a hash');
    check((int) $stored['views'] === 1, 'Session refresh does not inflate views');
    $edit = $data;
    $edit['title'] = $marker . ' 수정';
    $edit['password'] = 'wrong';
    $wrong = request('/?action=edit&id=' . $id, $edit);
    check(str_contains($wrong['body'], '비밀번호가 일치하지 않습니다.'), 'Wrong edit password rejected');
    $edit['password'] = $data['password'];
    check(request('/?action=edit&id=' . $id, $edit)['status'] === 303, 'Correct password edits post');
    check(str_contains(request('/?action=view&id=' . $id)['body'], eTest($edit['title'])), 'Edited title persisted');
    $insert = $pdo->prepare('INSERT INTO posts (title, author, password_hash, content) VALUES (?, ?, ?, ?)');
    for ($i = 0; $i < 11; $i++) {
        $insert->execute([$marker . ' fixture ' . $i, '테스트', $stored['password_hash'], '페이지 이동 테스트']);
        $ids[] = (int) $pdo->lastInsertId();
    }
    $listing = request('/?q=' . urlencode($marker));
    check(str_contains($listing['body'], '<strong>12</strong>') && substr_count($listing['body'], 'class="subject"') === 10, 'Search returns matching posts with ten per page');
    $second = request('/?q=' . urlencode($marker) . '&page=2');
    check(substr_count($second['body'], 'class="subject"') === 2, 'Second page contains remaining posts');
    $literal = request('/?q=' . urlencode($marker . '%'));
    check(str_contains($literal['body'], '검색 결과가 없습니다'), 'LIKE wildcard is treated literally');
    $injection = request('/?q=' . urlencode("' OR 1=1 -- " . $marker));
    check($injection['status'] === 200 && str_contains($injection['body'], '검색 결과가 없습니다'), 'SQL injection search is harmless');
    check(request('/?action=view&id=999999999999')['status'] === 404, 'Missing post returns 404');
    check(request('/?action=unknown')['status'] === 404, 'Unknown route returns 404');
    check(request('/style.css')['status'] === 200, 'Stylesheet served');
    check(request('/bootstrap.php')['status'] === 404, 'Bootstrap is outside web root');
    request('/?action=delete&id=' . $id);
    check(request('/?action=view&id=' . $id)['status'] === 200, 'GET does not delete post');
    $wrongDelete = request('/?action=delete&id=' . $id, ['csrf' => $csrf, 'password' => 'wrong']);
    check(str_contains($wrongDelete['body'], '비밀번호가 일치하지 않습니다.'), 'Wrong delete password rejected');
    check(request('/?action=delete&id=' . $id, ['csrf' => $csrf, 'password' => $data['password']])['status'] === 303, 'Correct password deletes post');
    check(request('/?action=view&id=' . $id)['status'] === 404, 'Deleted post no longer accessible');
    echo "All board smoke checks passed.\n";
} finally {
    if ($ids) {
        $cleanup = $pdo->prepare('DELETE FROM posts WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
        $cleanup->execute($ids);
    }
    unlink($cookie);
}
function eTest(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
