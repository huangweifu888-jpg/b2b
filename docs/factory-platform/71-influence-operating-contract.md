# 直播倡导运行契约

直播倡导将已确认接收的企业社群活动转为可审计的内部倡导简报与活动交接。它不保存专家、客户或员工的私人联系方式，不生成虚假客户评价或背书，也不会自动创建外部直播、发布帖子或发送邀请。

## 生命周期与权限

只有状态为 `acknowledged` 的社群活动可建立简报，并固定活动指纹。创建、独立核验、独立授权与接收确认分别受 `factory.deepen.influence.create`、`.verify`、`.authorize` 与 `.acknowledge` 控制；每一步使用项目权限、乐观锁与审计事件。

## 三端共享边界

总部定义可信倡导标准，代理端独立核验，客户项目端决定活动交接及接收。三端共享活动来源指纹、倡导角色、主题和交接状态；契约明确 `advocate_personal_data_stored=false`、`testimonial_or_endorsement_fabricated=false`、`external_livestream_started=false`、`external_publish_dispatched=false`。

## 迁移与回滚

迁移 `a3d9e6f8b012` 新增倡导简报、内部交接投影、四项权限和对象/事件契约。回滚仅移除这些新增投影、权限和契约，不删除既有社群活动、CRM 企业关系、审计记录或外部平台内容。
