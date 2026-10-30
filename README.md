# 모여 · 롤 커뮤니티

PHP와 MySQL로 만든 비회원 자유게시판에 오픈 이벤트 페이지와 Canvas 미니게임을 더한 로컬 개발 프로젝트입니다. Docker Compose로 Rocky Linux 기반 PHP-FPM, Nginx, MySQL을 함께 실행합니다.

## 주요 기능

### 자유게시판

- 비회원 글 작성·목록·상세 조회·수정·삭제
- 작성 시 설정한 비밀번호로 수정·삭제, 비밀번호는 해시로 저장
- 제목·내용·작성자 검색, 페이지당 10개 표시
- 세션별 조회 수 집계, 새 글 표시, 모바일 대응
- 등록된 이미지 경로를 이용한 본문 이미지 표시 및 원본 보기
- CSRF 토큰, PDO 매개변수 바인딩, HTML 이스케이프, 서버 입력 검증

일반 글쓰기 폼에는 이미지 업로드 기능이 없습니다. 이미지 게시글은 DB의 `image_path`와 웹 루트의 이미지 파일을 연결해 표시합니다. 비밀번호 복구·회원 로그인·관리자 기능은 제공하지 않습니다.

### 오픈 이벤트

- 이벤트 소개와 사전 가입 폼
- 닉네임·이메일·개인정보 수집 동의 검증
- 이메일 중복 가입 방지와 가입 결과 안내
- 창립 멤버 1,000명 기준 잔여 자리 표시

이메일 발송 기능은 구현되어 있지 않습니다. 페이지의 일정·혜택·개인정보 안내 문구는 실제 운영 전에 운영 정책과 맞춰 확인해야 합니다.

### 미니게임: 협곡 간식 대작전

- 도리·코코·루미·모모·단단 중 선택, 캐릭터별 특성
- 골드·쿠키 획득, 하트 회복, 폭탄 회피, 연속 획득 보너스
- 정글·돌길·강·수정 석탑 배경과 빛·물결·반딧불 효과
- 일시정지·재시작, 브라우저 `localStorage`에 최고 점수와 챔피언 선택 저장

| 조작 | 동작 |
| --- | --- |
| `←` / `→`, `A` / `D` | 좌우 이동 |
| 마우스 또는 터치 드래그 | 캐릭터 이동 |
| `P` / `Esc` | 일시정지 |

LoL에서 영감을 받은 비공식 팬 미니게임으로 Riot Games와 관련이 없습니다. 이미지 게시글과 이벤트에 사용한 생성 이미지는 실제 게임 캡처와 구분해 안내합니다.

## 실행 환경

| 구성 | 설정 |
| --- | --- |
| PHP 컨테이너 OS | Rocky Linux 9 (`rockylinux:9`) |
| PHP | 8.5.12 소스 빌드, PHP-FPM |
| 웹 서버 | Nginx (`nginx:stable-alpine`) |
| 데이터베이스 | MySQL 8.4 계열 (`mysql:8.4`) |
| Composer | 2 계열 |
| 문자셋 / 정렬 | `utf8mb4` / `utf8mb4_unicode_ci` |
| 시간대 | `Asia/Seoul`, MySQL `+09:00` |
| 웹 루트 | `src/public` |

PHP에는 PDO MySQL, mysqli, mbstring, intl, bcmath, GD, ZIP, OPcache 등을 포함합니다. PHP 이외의 이미지 태그는 패치 버전이 고정되어 있지 않아 다시 받는 시점에 실제 버전이 달라질 수 있습니다.

## 시작하기

Windows에서는 Docker Desktop의 Linux 컨테이너 엔진과 Docker Compose를 준비합니다. 호스트에 PHP나 MySQL을 별도로 설치할 필요는 없습니다.

```powershell
cd D:\fsd\mp
Copy-Item .env.example .env
docker compose up -d --build
```

이미 `.env`가 있다면 복사 명령은 생략합니다. 첫 빌드는 PHP 소스 컴파일 때문에 시간이 걸립니다. 별도 Composer 또는 npm 패키지 설치는 필요하지 않습니다.

| 페이지 | 기본 주소 |
| --- | --- |
| 롤 게시판 | http://localhost:8080/ |
| 글쓰기 | http://localhost:8080/?action=write |
| 오픈 이벤트 | http://localhost:8080/event.php |
| 미니게임 | http://localhost:8080/game.php |

`src`는 컨테이너에 연결되어 있어 PHP·CSS·JavaScript 수정은 새로고침으로 확인할 수 있습니다. Dockerfile을 변경했다면 다시 빌드합니다.

## 환경변수와 Windows DB 접속

`.env.example`의 기본값은 다음과 같습니다. `.env`는 Git 추적에서 제외합니다.

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `DB_ROOT_PASSWORD` | `root` | MySQL root 비밀번호 |
| `DB_DATABASE` | `mp` | DB 이름 |
| `DB_USERNAME` | `mp` | 애플리케이션 DB 사용자 |
| `DB_PASSWORD` | `mp` | 사용자 비밀번호 |
| `HTTP_PORT` | `8080` | Windows 웹 접속 포트 |
| `DB_PORT` | `3306` | Windows DB 접속 포트 |

Windows의 DBeaver·HeidiSQL·MySQL Workbench에서는 MySQL TCP/IP 연결을 선택하고 아래 값을 입력합니다.

| 항목 | 기본 접속값 |
| --- | --- |
| 호스트 | `127.0.0.1` |
| 포트 | `3306` |
| 데이터베이스 | `mp` |
| 사용자 / 비밀번호 | `mp` / `mp` |

PHP 컨테이너 내부에서는 `mysql:3306`으로 접속합니다. 웹·DB 포트는 `127.0.0.1`에 바인딩되어 같은 PC에서 접근합니다. 포트 충돌 시 `.env`의 포트를 변경한 뒤 `docker compose up -d`로 반영합니다. 기본 비밀번호는 로컬 개발용입니다.

## 데이터 초기화와 보존

첫 애플리케이션 접속 시 `posts`와 `event_signups` 테이블을 자동 생성합니다. MySQL 데이터는 `mysql_data` 볼륨에 보존되며, 이미지 파일은 `src/public/images`에 저장합니다.

- DB 초기화 환경변수는 빈 볼륨의 첫 실행에 적용됩니다. 기존 DB의 계정·비밀번호는 `.env`만 바꿔도 자동으로 변경되지 않습니다.
- 새 환경에는 기존 로컬 DB의 게시글·테스트 글·이벤트 신청 내역이 복사되지 않습니다. 저장된 이미지 파일과 DB 레코드는 별개입니다.
- 이미지 컬럼 추가 이전의 DB를 사용하는 경우에만 아래 마이그레이션을 한 번 실행합니다. 새 DB에는 실행하지 않습니다.

```sql
ALTER TABLE posts ADD COLUMN image_path VARCHAR(255) NULL AFTER content;
```

DB 클라이언트에서 대상 DB를 선택하고 위 SQL을 실행합니다. 동일한 SQL은 `src/migrations/001_post_image.sql`에 있습니다. 기존 컬럼 여부는 `SHOW COLUMNS FROM posts LIKE 'image_path';`로 확인할 수 있습니다.

## 운영 명령

```powershell
# 상태 및 로그
docker compose ps
docker compose logs -f

# PHP 버전 및 서버 설정 확인
docker compose exec php php -v
docker compose exec php php-fpm -t
docker compose exec nginx nginx -t

# 중지 및 재실행: DB 볼륨 유지
docker compose down
docker compose up -d

# 이미지 재빌드
docker compose up -d --build
```

`docker compose down -v`는 DB 볼륨까지 삭제하므로 데이터 초기화가 필요한 경우에만 사용합니다.

## 테스트

실행 중인 컨테이너에서 다음 명령으로 게시판 HTTP 기능 검증을 수행합니다.

```powershell
docker compose exec -T php php /var/www/html/tests/board-smoke.php
```

22개 항목으로 글 등록·수정·삭제, 한글·HTML 이스케이프, 비밀번호 해시, 잘못된 비밀번호, CSRF 차단, 조회 수, 검색·페이지 이동, 없는 페이지 처리 등을 확인합니다. 고유한 임시 게시글을 생성하고 테스트 종료 시 정리합니다. 이벤트·게임 동작과 시각적 배치는 이 테스트의 검증 범위에 포함되지 않습니다.

오르카 내장 브라우저에서는 `http://localhost:8080/`를 열고 목록 → 검색 → 글쓰기 → 수정 → 삭제 순으로 실제 입력·클릭 테스트를 진행할 수 있습니다. 기존 글 대신 별도 테스트 글을 만들어 검증하고 마지막에 삭제합니다.

## 디렉터리 구조

```text
.
├── docker-compose.yml
├── .env.example
├── docker/
│   ├── nginx/default.conf       # 웹 루트·PHP-FPM 연결
│   └── php/                     # Rocky Linux PHP 빌드·PHP-FPM 설정
├── src/
│   ├── bootstrap.php            # DB·세션·보안 헤더·테이블 초기화
│   ├── migrations/              # 기존 DB 업데이트 SQL
│   ├── public/
│   │   ├── index.php            # 게시판 요청 처리 및 HTML 템플릿
│   │   ├── style.css            # 공통·게시판 스타일
│   │   ├── event.php / event.css # 오픈 이벤트
│   │   ├── game.php             # 미니게임 페이지
│   │   ├── game.js / game.css   # Canvas 게임 로직·스타일
│   │   └── images/              # 게시글·이벤트 이미지
│   └── tests/board-smoke.php    # 게시판 HTTP 기능 검증
└── README.md
```
