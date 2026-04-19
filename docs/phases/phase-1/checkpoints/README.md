# Checkpoint System — Agentic Room / Phase 1

## Tổng quan luồng làm việc

```text
[Implementation Agent]      [User / PM]         [Validator Agent]
        │                       │                      │
        │  implement CP-N       │                      │
        │──────────────────────>│                      │
        │  write result.json    │                      │
        │  run notify.py        │                      │
        │──────────────────────>│ notification         │
        │                       │ trigger validator ──>│
        │                       │                      │ run CHECKLIST
        │                       │                      │ write validation.json
        │                       │<──── notification ───│
        │ [PASS] trigger CP+1   │                      │
        │<──────────────────────│                      │
        │ [FAIL] fix & re-run   │                      │
```

## Mục tiêu

Checkpoint system này biến `phase-1` thành chuỗi milestone nhỏ, verify được độc lập, để:

- implementation agent không phải tự chia lại toàn bộ project
- validator có checklist chạy được bằng command
- PM/tech lead nhìn vào biết CP nào đang blocked
- việc handoff giữa nhiều agent không làm trôi definition of done

## Checkpoints

| CP | Tên | Nội dung | Depends On | Effort |
|----|-----|-----------|------------|--------|
| CP0 | Environment & Repo Bootstrap | monorepo TypeScript, app shells, Docker, env baseline | — | 0.5 ngày |
| CP1 | Contracts, Schema & Ledger Foundation | contracts, DB schema, room event ledger, replay primitives | CP0 | 1 ngày |
| CP2 | Room Formation & Charter | mission intake, invite flow, charter draft/sign/expire/activate | CP1 | 1 ngày |
| CP3 | Task Execution & Review Loop | claim, deliver, artifact metadata, review, timeout jobs | CP2 | 1.5 ngày |
| CP4 | Settlement Engine & Voting | ratings, contribution records, settlement proposal, vote/finalize, signing | CP3 | 1.5 ngày |
| CP5 | Disputes & Admin Operations | dispute intake, panel workflow, manual review, admin queues | CP4 | 1.5 ngày |
| CP6 | Replay, Integrity & Pilot Hardening | replay, hash verification, observability, exports, staging scenarios | CP5 | 1 ngày |

**Tổng effort:** khoảng `7–8 ngày` implementation thuần trước polish và pilot feedback.

## Nguồn sự thật phải đọc trước

Trước khi implement bất kỳ CP nào, đọc theo đúng thứ tự:

1. [docs/phase1/01-brd.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/01-brd.md)
2. [docs/phase1/02-user-stories.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/02-user-stories.md)
3. [docs/phase1/03-solution-architecture.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/03-solution-architecture.md)
4. [docs/phase1/04-system-design.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/04-system-design.md)
5. [docs/phase1/05-development-organization.md](/Users/nguyenquocthong/project/agentic-room/docs/phase1/05-development-organization.md)

## Cấu trúc mỗi CP folder

```text
docs/phases/phase-1/checkpoints/cp{N}-{name}/
├── README.md          # dashboard import / quick parse
├── INSTRUCTIONS.md    # hướng dẫn cho implementation agent
├── CHECKLIST.md       # hướng dẫn cho validator agent
├── result.json        # implementer viết khi xong
└── validation.json    # validator viết khi validate xong
```

## Setup

```bash
cd /Users/nguyenquocthong/project/agentic-room

cp docs/phases/phase-1/checkpoints/config.example.json \
   docs/phases/phase-1/checkpoints/config.json

# Sửa ít nhất:
# - ntfy_topic
# - project_slug
# - dashboard_url nếu dashboard không chạy ở localhost:3000
```

## Scripts dùng chung

- `notify.py`: gửi ntfy notification và cố gắng sync dashboard
- `post-status.py`: đẩy `result.json` hoặc `validation.json` lên dashboard API

Nếu dashboard local không chạy, `post-status.py` sẽ in warning và tiếp tục. Đây không phải blocker cho implementation.

## Quy tắc vận hành

- `CP0` luôn phải pass trước khi đụng business logic.
- Không nhảy cóc CP trừ khi tech lead ghi rõ dependency relax.
- Mỗi CP phải có command validator chạy được.
- Nếu một rule business chưa rõ, update docs trong `docs/phase1/` trước khi viết code.
- `result.json` và `validation.json` là handoff contract giữa implementer và validator.
- `config.json`, `result.json`, và `validation.json` là generated state; không commit lên git.
