# 第三方来源与归属

## VIA 官方开源项目

本项目以独立 TypeScript 实现方式兼容以下 VIA 官方开源项目的公开协议行为与数据格式：

- VIA App：<https://github.com/the-via/app>
  - 参考范围：标准 VIA 命令编号、WebHID 报告 ID 0 / 32 字节帧、请求队列、完整请求回显匹配、宏缓冲区写入保护与读回策略。
- VIA Reader：<https://github.com/the-via/reader>
  - 参考范围：VIA JSON/KLE 布局的数据模型和校验语义。
- VIA Keyboards：<https://github.com/the-via/keyboards>
  - 参考范围：VIA 定义文件的公开生态约定。

上述项目以 GPL-3.0 发布。本项目同样采用 **GPL-3.0-only**；完整许可证见 `LICENSE`。

## Crush 80 官方定义

下列文件来自用户提供的 Crush 80 官方下载内容，并以原始形式保留：

- `public/definitions/crush80-rgb-usb.json`
- `public/definitions/crush80-rgb-2.4g.json`

本工具仅使用定义中已经明确存在的：VID/PID、矩阵、KLE 布局、Lighting 菜单、customKeycodes。它不会从这些文件推导未声明的厂商命令或固件行为。

## 非保证声明

本软件不隶属于 VIA、QMK、RDR、Telink 或 Crush 80 的制造/销售方。实体硬件兼容性必须按 README 的分阶段流程实际验收；在读回验证完成前，不应将任何写入操作视为已经生效。
