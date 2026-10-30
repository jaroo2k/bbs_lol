# 로컬 Docker 개발 환경

- PHP 컨테이너: Rocky Linux 9 기반, PHP 8.5.12 소스 빌드 및 PHP-FPM
- 웹 서버: Nginx, http://localhost:8080
- DB: MySQL 8.4, localhost:3306 (PHP 컨테이너에서는 mysql:3306)
- 웹 루트: `src/public`
- 시간대: Asia/Seoul

## 실행

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

`.env`에서 DB 계정과 HTTP_PORT, DB_PORT를 변경할 수 있습니다. 포트는 로컬에서만 접근하도록 바인딩합니다. 첫 PHP 빌드는 소스 컴파일 때문에 시간이 걸립니다.

기본 DB 이름, 사용자, 비밀번호는 `mp`이며 root 비밀번호는 `root`입니다. 개발용 기본값이므로 외부 서버에 배포하기 전 변경하세요.

```powershell
docker compose ps
docker compose exec php php -v
docker compose exec php php-fpm -t
docker compose logs -f
docker compose down
```

MySQL 데이터는 `mysql_data` 볼륨에 보존됩니다. DB 계정 환경변수는 데이터가 없는 첫 초기화 시 적용됩니다. 기존 데이터가 있다면 SQL로 계정을 변경해야 합니다. `docker compose down -v`는 DB 데이터까지 삭제합니다.

PHP에는 PDO MySQL, mysqli, mbstring, intl, bcmath, GD, ZIP 등을 포함합니다.

## 자유게시판

http://localhost:8080 에서 바로 사용할 수 있습니다. 별도 패키지 설치 없이 PHP와 MySQL로 동작하며, 첫 접속 시 `posts` 테이블을 자동 생성합니다.

- 비회원 글 작성, 목록, 상세 조회, 수정 및 삭제
- 작성 시 설정한 비밀번호로 수정·삭제 (해시로 저장, 비밀번호 복구 기능 없음)
- 제목·내용·작성자 검색 및 페이지당 10개 표시
- 세션별 조회 수 집계, 모바일 화면 대응
- CSRF 검증, PDO 매개변수 바인딩, 출력 HTML 이스케이프, 서버 입력 검증

소스는 `src/public/index.php`(화면·요청 처리), `src/public/style.css`(스타일), `src/bootstrap.php`(DB·세션·테이블 초기화)로 구성됩니다. 게시글은 기존 MySQL 볼륨에 보존됩니다.

기능 검증은 다음 명령으로 실행합니다. 임시 글을 만들고 등록·수정·삭제, 검색·페이지 이동, 잘못된 비밀번호 및 CSRF 차단을 확인한 뒤 테스트 글을 정리합니다.

```powershell
docker compose exec -T php php /var/www/html/tests/board-smoke.php
```
