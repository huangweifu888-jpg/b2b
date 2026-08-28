# 旧版出差开发工作包兼容说明

`tools/Export-B2BTravelWorkspace.ps1` 和 `tools/Import-B2BTravelWorkspace.ps1` 仅用于识别、导出或回收旧版 `b2b-travel-workspace-v1/v2` 工作包。它们不是当前七角色发布器，也不是完整工作区备份方案；正常开发、服务器部署和正式备份不得依赖这两个脚本。

当前工作区的源码、角色、数据和运行时边界见 [工作区总入口](../../../README.md)。新电脑迁移应分别处理版本受控源码、经校验的本地数据副本和可重建运行时，不能把旧旅行包当作生产镜像。

## 使用前提

仅在以下情况使用旧脚本：

- 必须读取或回收以前已经生成的旅行工作包。
- 已确认包格式、来源电脑、Git 提交、数据库快照和素材归属。
- 已确认脚本引用的旧兼容目录真实存在；不能为了运行脚本重新创建旧目录结构。
- 目标是新建目录，不会覆盖当前工作区。

如果当前任务只是换盘、继续开发或部署服务器，应停止使用本兼容流程，改走当前工作区 README、PathRegistry 和部署中心。

## 参数化外部路径

不要照抄盘符，也不要依赖导入脚本的历史默认目标。由操作者显式提供加密外部介质、包目录和新建导入根：

```powershell
$externalRoot = Read-Host '输入加密外部介质上的目标目录'
$packagePath = Read-Host '输入已核验的旧旅行工作包目录'
$importRoot = Read-Host '输入当前工作区之外的新建导入根目录'
```

兼容导出必须从 `00-platform-source` 仓库根运行，并显式传入外部目标：

```powershell
.\tools\Export-B2BTravelWorkspace.ps1 -DestinationRoot $externalRoot
```

兼容导入必须同时显式传入包路径和目标根，禁止使用脚本的历史默认值：

```powershell
.\tools\Import-B2BTravelWorkspace.ps1 `
  -PackagePath $packagePath `
  -DestinationRoot $importRoot
```

## 受保护目录边界

以下位置不得作为旅行包扫描源、导出目标或导入目标：

- 当前 `00-platform-source` 内部的任意子目录
- 工作区 `local-data/protected-misc`
- 工作区 `local-data/backup-staging`
- 工作区 `local-runtime/secrets`
- 正在使用的数据库、正式备份、生产挂载和密钥目录
- 任何来源不明或未加密的共享盘目录

目标必须位于当前工作区之外。导出前应解析并人工确认源、目标的绝对位置，但不得把该电脑的绝对路径写回文档、源码或 manifest 模板。

## 密钥规则

- 默认禁止 `-IncludeSecrets` 和 `-RestoreSecrets`。
- 只有明确的离线恢复任务、加密介质和授权人员同时具备时才允许临时启用。
- 导入后立即轮换已携带的开发密钥，并删除外部介质上的明文副本。
- 生产密钥、服务器凭据和正式备份密钥永远不得进入旅行包。

## 导入与合并

1. 校验 `TRAVEL_MANIFEST.json`、Git 提交、数据库快照和素材清单。
2. 导入到全新目录；不得覆盖当前工作区。
3. 先比较源码差异，再通过 Git 选择性合并。
4. 数据库和素材单独核对租户、客户、计划及校验值，禁止整目录覆盖。
5. 用当前 `local-runtime` 重新安装依赖，不复制旧运行时或缓存。
6. 通过源码锁、平台布局、租户边界和浏览器验收后，才能把合并结果视为当前开发输入。

旧旅行包完成回收后应转为只读迁移证据，不能继续参与角色打包或服务器发布。

