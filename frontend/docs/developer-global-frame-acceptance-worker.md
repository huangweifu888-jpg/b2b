# 统一页面框架可信验收 Worker

该 Worker 是浏览器草稿与发布链之间的独立可信边界。浏览器只能申请验收，不能给自己签发“已通过”。Worker 从服务端领取冻结任务，使用任务中的 `developer_global_frame`、草稿摘要和 5 项部署摘要运行完整的 201 页 × 3 视口验收。只有 603 项全部为 `passed` 或预先登记的 `isolated`，且 `failed/flaky/skipped` 均为 0，才会生成 HMAC 签名的 snake_case v1 artifact 并提交完成。

## 安全边界

- HMAC 密钥只从 Worker 进程环境读取；启动验收 runner 时会显式剥离密钥注册表与 key id，不会传给浏览器、Playwright、候选文件、报告或日志。
- claim、fail 和 complete 均严格复用后端 canonical 与 snake_case wire。
- 服务端冻结的 `template_id`、候选 section、`base_draft_hash`、`frame_section_hash`、页面登记、适配器、隔离策略、测试规格和 source build 摘要必须全部一致。
- Playwright 仍先生成 `trustLevel=untrusted-local` 的 v2 完整报告；Worker 独立校验 603 项后才构造带 `acceptance_job_id` 的可信 v1 artifact。
- 每次运行建立唯一目录，所有阶段文件使用排他创建；不会覆盖旧证据。
- source 漂移、runner 非零、failure/flaky/skipped、签名自检失败或 complete 回执不匹配，都会 fail-closed，并调用任务的 fail 端点。

## 环境

```powershell
$env:DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS = '{"prod-worker-01":{"issuer":"trusted-playwright-worker","secret":"replace-with-secret-from-secret-manager-32-bytes-minimum"}}'
$env:DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_KEY_ID = 'prod-worker-01'
$env:DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_API_BASE_URL = 'https://control.example.com/api/template-snapshot'
$env:B2B_E2E_BASE_URL = 'https://acceptance-preview.example.com'
```

生产密钥必须由密钥管理器注入，不能写入 `.env`、命令历史、仓库或浏览器配置。

## 单任务模式

```powershell
npm run acceptance:developer-global-frame:worker -- --once --template-id=client-source-global --job-id=00000000-0000-4000-8000-000000000000
```

可选参数：

- `--workers=2`（本地 16 GB 沙盘的可信内存上限；仍保留真实浏览器重试抖动检测）
- `--retries=1`（首次失败、重试通过仍记为 flaky，因此不能完成任务）
- `--artifact-root=...`
- `--request-timeout-ms=30000`
- `--http-retries=2`
- `--heartbeat-interval-ms=90000`（不得超过 120000）
- `--minimum-job-ttl-ms=3600000`

## 长期轮询模式

```powershell
npm run acceptance:developer-global-frame:worker -- --poll
```

轮询只调用服务端固定的 `claim-next` 原子领取端点。返回 204 时使用指数退避和随机抖动，避免空队列时产生请求风暴；不会读取自定义 feed。每个任务串行处理，避免同一 Worker 争抢本机浏览器资源。可用 `--poll-interval-ms=5000` 和 `--poll-max-interval-ms=30000` 调整空队列退避。

## 快速契约验证

```powershell
npm run verify:developer-global-frame-acceptance-worker
npm run acceptance:developer-global-frame:worker -- --help
```

## 本地沙盘自动监督

`local-runtime/Start-LocalSandbox.ps1` 使用 canonical runner 的 `--print-derived-hashes` 单源派生 5 项部署摘要。已配置 HMAC 注册表时复用指定 key；本地 demo 未配置时只在本轮进程内生成临时 key。Backend 与独立 Worker supervisor 继承同一冻结配置，随后启动器在创建 Vite/浏览器侧进程前清除这些环境变量，并在 `finally` 恢复调用方原环境。密钥不会写入 `services.json`、状态、日志或验收证据。

Worker supervisor 先运行无网络、无 Playwright 的 `--dry-run --poll`，再等待 8000 Backend 与 3003 预览健康后才开始领取任务。`Check-LocalSandbox.ps1` 验证 supervisor/child PID 与状态绑定；`Stop-LocalSandbox.ps1` 先按绝对 PID、可执行文件、脚本命令行和父子树停止 Worker，再停止 Backend。

不影响当前 3003/8000/3004 的隔离生命周期验证：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ..\local-runtime\Test-DeveloperGlobalFrameAcceptanceWorkerLifecycle.ps1
npm run verify:local-acceptance-worker-lifecycle
```

该测试使用独立 state root，只执行真实摘要派生、Worker dry-run、supervisor 健康检查与精确树停止，不会运行 Playwright；证据保存在 `local-runtime/health-tests/acceptance-worker-*/`，且不含 HMAC secret。

无网络 dry-run 需要同样的密钥环境，但不会调用 HTTP 或 Playwright：

```powershell
npm run acceptance:developer-global-frame:worker -- --dry-run --api-base-url=http://127.0.0.1:8000/api/template-snapshot --template-id=client-source-global --job-id=00000000-0000-4000-8000-000000000000
```

## 证据目录

默认目录为 `playwright-report/developer-global-frame-worker/<unique-run-token>/`，阶段文件按数字前缀排列：claim、冻结任务、冻结候选、runner 退出、v2 报告、可信 artifact、complete 回执；失败时追加 failure/fail 回执。文件中不包含 HMAC secret。

## 运行时限

603 项在 4 个 Worker 上的实测约为 45 分钟。服务端任务绝对 TTL 为 120 分钟，Worker 默认每 90 秒发送一次 HMAC heartbeat 续租，且启动前要求至少保留 60 分钟绝对 TTL。任何 heartbeat 失败都会终止整个 Playwright 子进程树；Windows 会等待精确 PID 的 `taskkill /T /F` 完成并校验退出码，然后进入 fail-closed，不能继续 complete。若 fail 也因租约或网络失效而被拒，Worker 仍保留本地证据并以非 0 状态退出。
