# Lab Workspace

연구실 구성원이 가볍게 접속해 현재 작업 상태를 공유하는 실시간 픽셀 워크스페이스입니다. 현재 앱은 `pixellab` 하위에 있으며, Express + Socket.io 서버가 Phaser 클라이언트를 함께 제공합니다.

## 주요 기능

- 실시간 연구실 현황: 접속한 구성원을 픽셀 캐릭터와 책상 위치로 표시
- 출근/퇴근: 닉네임으로 입장하고 퇴근 시 자리 해제
- 상태 표시: `작업중`, `자리비움`, `회의중`, `실험중`을 명시 버튼으로 선택
- 프로필 유지: 닉네임별 색상과 선호 자리를 `pixellab/data/profiles.json`에 저장
- 반응형 워크스페이스: PC에서는 우측 고정 패널, 모바일에서는 하단 탭 패널 사용
- 현황 패널 연동: 출근자 수, 상태별 인원, 출근자 목록을 실시간 상태와 함께 갱신
- 가독성 개선: 한국어 조작 UI는 시스템 폰트를 사용하고 상태별 색상 규칙을 적용
- 공지 분리: 공지 영역을 메시지/투두와 분리된 탭으로 제공
- 메시지/말풍선: 개인 메시지를 보낼 수 있고, 내 상태나 짧은 말을 캐릭터 말풍선으로 표시
- 공유 투두: 예시 투두를 기본 제공하고, 실제 투두를 담당자/마감일과 함께 추가/완료/삭제
- 오류 처리: 공백/중복 닉네임 거절, 6명 만석 제한

`pixellab/data/`는 개인/운영 데이터가 들어가는 런타임 폴더이므로 Git에 올리지 않습니다.

## 현재 구조

- `pixellab/server.js`: Express + Socket.io 서버, 사용자/책상/프로필/메시지/투두 상태 관리
- `pixellab/public/index.html`: 브라우저 진입점, 반응형 app shell, 실시간 현황/소형 기능 패널
- `pixellab/public/game.js`: Phaser 기반 연구실 UI, 실시간 상태 동기화, 패널 상태 이벤트 전달
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

Socket.io smoke test:

```powershell
cd D:\CodexCodeProj\LabWorkspace\pixellab
node scripts\smoke.js
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

## Cloud Run 배포

2026-06-06 기준 1차 수동 배포가 완료되었고, 배포된 URL에서 기본 동작 확인도 마쳤습니다.

- GCP project: `lab-workspace-498607`
- Region: `asia-northeast3` (Seoul)
- Cloud Run service: `pixellab`
- Service URL: https://pixellab-922543866704.asia-northeast3.run.app
- Artifact Registry image: `asia-northeast3-docker.pkg.dev/lab-workspace-498607/pixellab/pixellab:latest`
- Deployed source checkpoint: `39a41f2 feat: refine todo and attendance UX`
- Cloud Build image build: `56182734-ad89-404a-b66d-dd7ced283379`, `SUCCESS`

수동 빌드/배포 흐름:

```bash
gcloud builds submit ./pixellab \
  --tag asia-northeast3-docker.pkg.dev/lab-workspace-498607/pixellab/pixellab:latest

gcloud run deploy pixellab \
  --image asia-northeast3-docker.pkg.dev/lab-workspace-498607/pixellab/pixellab:latest \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

운영 메모:

- 현재 서버 상태 일부는 메모리와 `pixellab/data/` 파일에 의존합니다. Cloud Run 파일시스템은 영구 저장소가 아니므로 실제 연구실 운영 전에는 공지/투두/메시지/프로필 저장소를 Firestore, Cloud SQL, Redis 등으로 옮기는 것이 좋습니다.
- 파일/메모리 기반 상태를 유지하는 동안에는 Cloud Run `max-instances=1` 운영이 더 단순합니다.
- 협업 배포는 `main` push 이후 Cloud Build 트리거가 빌드, smoke check, Cloud Run 배포를 자동 수행하는 방식이 가장 관리하기 쉽습니다.

### 자동 배포

`cloudbuild.yaml`은 GitHub `main` 브랜치 push/merge 후 다음 순서로 실행되도록 준비되어 있습니다.

1. `npm ci`
2. `node --check server.js`
3. `node --check public/game.js`
4. `node --check scripts/smoke.js`
5. `node scripts/smoke.js`
6. Docker image build/push
7. Cloud Run deploy

Cloud Build 콘솔에서 GitHub 저장소 `cnupsydevp-lab/lab-workspace`를 연결한 뒤, `main` 브랜치 push를 조건으로 하는 트리거를 만들고 빌드 구성 파일을 `cloudbuild.yaml`로 지정합니다.

Cloud Build 서비스 계정에는 최소한 다음 권한이 필요합니다.

- Cloud Run Admin
- Artifact Registry Writer
- Service Account User

`main` push가 곧 배포가 되므로, GitHub에서는 `main` 직접 push보다 PR merge 중심으로 운영하고 branch protection을 켜는 것이 좋습니다.

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
- `node scripts\smoke.js`

## 다음 개발 후보

연구실 워크스페이스라는 목적을 생각하면 다음 단계는 게임 요소보다 실제 연구실 사용 흐름을 우선하는 것이 좋습니다.

- 상태 UX 개선: 상태 버튼을 순환형에서 명시적 메뉴/토글로 개선
- 공지/메시지: 오늘의 공지, 실험 일정, 짧은 말풍선 메시지
- 운영 저장소: 파일 기반 JSON에서 SQLite/Redis 같은 운영용 저장소로 전환
- 배포 안정성: Cloud Build 트리거, smoke check, Cloud Run 인스턴스 정책 결정
- 협업 자동화: `main` 보호 규칙, PR 리뷰, 자동 배포 전 검증 단계 구성
