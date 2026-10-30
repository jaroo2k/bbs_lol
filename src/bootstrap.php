<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Seoul');
ini_set('display_errors', '0');
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax', 'use_strict_mode' => true]);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
function e(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function input(string $key, array $source): string { return isset($source[$key]) && is_string($source[$key]) ? trim($source[$key]) : ''; }
function redirect(string $url): never { header('Location: ' . $url, true, 303); exit; }
function fail(int $status, string $message): never {
    http_response_code($status);
    echo '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>안내 · 자유게시판</title><link rel="stylesheet" href="/style.css"><main class="shell"><section class="card empty"><h1>' . e($message) . '</h1><a class="button" href="/">목록으로</a></section></main></html>';
    exit;
}
set_exception_handler(function (Throwable $error): void { error_log((string) $error); fail(500, '일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'); });
$pdo = new PDO(
    'mysql:host=' . (getenv('DB_HOST') ?: 'mysql') . ';dbname=' . (getenv('DB_DATABASE') ?: 'mp') . ';charset=utf8mb4',
    getenv('DB_USERNAME') ?: 'mp', getenv('DB_PASSWORD') ?: 'mp',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
);
$pdo->exec("CREATE TABLE IF NOT EXISTS posts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    image_path VARCHAR(255) NULL,
    views BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$pdo->exec("CREATE TABLE IF NOT EXISTS event_signups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(20) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$_SESSION['csrf'] ??=bin2hex(random_bytes(32));
