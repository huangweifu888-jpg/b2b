# B2B 平台前端开发入口

本目录是总部端、代理源、客户源、代理端和客户端计划共用的 React + TypeScript + Vite 前端。依赖版本以 `package-lock.json` 为准，统一使用 npm；不要再使用旧文档中的 pnpm 命令或固定盘符路径。

## 本地开发

在本目录执行：

```powershell
npm ci
npm run dev
```

本地沙盘的统一启动、停止与健康检查应从工作区 `local-runtime` 入口执行；不要在源码目录保存运行日志、数据库、上传素材或密钥。

## 代码入口

- `src/main.tsx`：浏览器入口。
- `src/App.tsx`：总部、代理、客户及来源端的路由总壳。
- `src/pages`：业务页面。
- `src/components`：共享页面组件和业务组件。
- `src/components/ui`：项目已经接入的 shadcn/ui 基础组件。
- `src/lib`：共享契约、配置、API 和运行逻辑。
- `src/index.css`：全局样式与响应式基线。
- `scripts`：源码锁、共享契约和开发规范门禁。
- `e2e`：Playwright 浏览器验收。

`@/` 指向 `src/`。优先复用现有组件和共享契约，不要在总部端、代理源和客户源分别复制同一套页面实现。

## 修改前后固定检查

修改源码前先检查源码锁：

```powershell
npm run source-lock:check -- -- <目标文件>
```

提交或交付前至少执行：

```powershell
npx tsc --noEmit
npm run lint
npm run verify:development-standard
```

需要生成正式构建时再执行 `npm run build`。构建和发布不得绕过源码锁、共享契约、租户隔离或后端发布预检。

## shadcn/ui

常用组件已经位于 `src/components/ui`，新增前先确认是否已存在。需要补充组件或查看组件文档时执行：

```powershell
npm run ui:add -- button
npm run ui:docs -- button
```

把 `button` 换成实际组件名。若同名组件已存在，不要直接覆盖；先检查现有样式、行为和共享引用。

## 约束

- 技术栈固定为 TypeScript、React、Vite、Tailwind CSS 和现有 shadcn/ui 体系。
- 页面必须同时满足桌面端和小屏自适应，不得用页面私有样式破坏共享版面契约。
- 前端不得保存数据库地址、服务器地址、真实密钥或生产凭据。
- 总部端发布模板版本；代理端、客户端和计划保存自己的运行数据与允许的覆盖项，下游不得反写模板源。
