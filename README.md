# Lab Workspace

연구실 구성원이 가볍게 접속해 현재 작업 상태를 공유하는 실시간 픽셀 워크스페이스입니다. 현재 앱은 `pixellab` 하위에 있으며, Express + Socket.io 서버가 Phaser 클라이언트를 함께 제공합니다.

## 주요 기능

- 실시간 연구실 현황: 접속한 구성원을 픽셀 캐릭터와 책상 위치로 표시
- 출근/퇴근: 닉네임으로 입장하고 퇴근 시 자리 해제
- 상태 표시: `작업중`, `자리비움`, `회의중`, `실험중`
- 프로필 유지: 닉네임별 색상과 선호 자리를 `pixellab/data/profiles.json`에 저장
- 오류 처리: 공백/중복 닉네임 거절, 6명 만석 제한

`pixellab/data/`는 개인/운영 데이터가 들어가는 런타임 폴더이므로 Git에 올리지 않습니다.

## 현재 구조

- `pixellab/server.js`: Express + Socket.io 서버, 사용자/책상/프로필 상태 관리
- `pixellab/public/index.html`: 브라우저 진입점
- `pixellab/public/game.js`: Phaser 기반 연구실 UI와 실시간 상태 동기화
- `pixellab/package.json`: 실행 스크립트와 의존성
- `pixellab/Dockerfile`: Node 20 Alpine 기반 컨테이너 빌드
- `PROJECT_STATUS.md`: 현재 진행 상태, 검증 내역, 남은 작업을 기록하는 기준 문서

## 로컬 실행

Windows PowerShell에서는 실행 정책 때문에 `npm` 대신 `npm.cmd`를 사용하세요.

```powershell
cd D:\CodexCodeProj\LabWorkspace\pixellab
npm.cmd install
npm.cmd start
```

기본 포트는 `8080`입니다.

```text
http://127.0.0.1:8080
```

다른 포트로 실행하려면 `PORT`를 지정합니다.

```powershell
cd D:\CodexCodeProj\LabWorkspace\pixellab
$env:PORT = "18080"
npm.cmd start
```

## 검증 명령

문법 확인:

```powershell
cd D:\CodexCodeProj\LabWorkspace\pixellab
node --check server.js
node --check public\game.js
```

HTTP smoke check:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8080" -UseBasicParsing
```

## Docker

`pixellab/Dockerfile`은 `npm ci --omit=dev`를 사용합니다. Docker 배포를 유지하려면 `pixellab/package-lock.json`을 함께 관리해야 합니다.

```powershell
cd D:\CodexCodeProj\LabWorkspace\pixellab
docker build -t pixellab .
docker run --rm -p 8080:8080 pixellab
```

## GitHub 협업 권장 방식

이 저장소는 공동 작업용이므로 자동 커밋/푸시하지 않습니다. GitHub에 협업용으로 올릴 때는 다음 흐름을 권장합니다.

1. `main`은 항상 실행 가능한 기준 브랜치로 유지합니다.
2. 기능 작업은 `feature/...` 또는 `codex/...` 같은 별도 브랜치에서 진행합니다.
3. PR에는 변경 목적, 검증 명령, 브라우저 확인 여부, 남은 리스크를 적습니다.
4. `pixellab/data/`, `.env`, `node_modules/`는 커밋하지 않습니다.
5. `package-lock.json`은 Docker의 `npm ci` 재현성을 위해 커밋 대상으로 두는 편이 좋습니다.
6. 최소 1명 리뷰 후 merge하도록 branch protection을 설정하는 것이 좋습니다.

처음 올릴 때 체크할 항목:

- `.gitignore`에 로컬/런타임 데이터가 빠져 있는지 확인
- README와 `PROJECT_STATUS.md`가 현재 상태와 맞는지 확인
- `node --check server.js`
- `node --check public\game.js`
- 로컬 실행 후 기본 접속/출근/상태 변경/퇴근 확인

## 다음 개발 후보

연구실 워크스페이스라는 목적을 생각하면 다음 단계는 게임 요소보다 실제 연구실 사용 흐름을 우선하는 것이 좋습니다.

- 상태 UX 개선: 상태 버튼을 순환형에서 명시적 메뉴/토글로 개선
- 공지/메시지: 오늘의 공지, 실험 일정, 짧은 말풍선 메시지
- 운영 저장소: 파일 기반 JSON에서 SQLite/Redis 같은 운영용 저장소로 전환
- 배포 안정성: HTTPS, WebSocket 유지, Cloud Run 최소 인스턴스 정책 결정
- 협업 자동화: GitHub Actions로 문법 검사와 smoke check 자동화
