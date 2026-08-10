# Crush 80 控制中心（RGB 旗舰版）

本项目是面向 **Crush 80 RGB 旗舰版**的本地中文 WebHID 控制工具，是对官方的via驱动的美化版本。它只依据随项目保存的两份官方 VIA JSON，并只发送标准 VIA 协议中用于读取/配置的命令。

> **硬件验收状态：待验收。** 本项目已完成构建、模拟 HID 单元测试和浏览器 UI 审查，首次实体操作必须按本文的分阶段验收流程执行。

## 官方定义与支持范围

| 连接方式 | 官方 VID:PID | 官方 JSON |
| --- | --- | --- |
| USB 有线 | `0x320F:0x5055` | `public/definitions/crush80-rgb-usb.json` |
| 2.4G 接收器 | `0x320F:0x5088` | `public/definitions/crush80-rgb-2.4g.json` |

两份定义都声明：

- 矩阵：`8 × 16`；
- 官方 KLE 物理布局：97 个布局条目、93 个唯一可寻址矩阵坐标；
- 灯光菜单：Brightness（0–9）、Effect（19 项）、Effect Speed（0–4）、Color；
- 16 个官方设备自定义键码；
- 标准 VIA keymap / macro 能力由连接后的设备协议实际返回决定。

工具不会根据外观、Telink/RDR 字符串或其他公版猜测任何能力。

## 严格安全边界

### 允许的命令

仅调用标准 VIA：

```text
GET_PROTOCOL_VERSION
DYNAMIC_KEYMAP_GET/SET_KEYCODE
DYNAMIC_KEYMAP_GET_BUFFER
CUSTOM_MENU_GET/SET_VALUE
CUSTOM_MENU_SAVE
DYNAMIC_KEYMAP_MACRO_GET/SET_BUFFER
DYNAMIC_KEYMAP_MACRO_GET_COUNT / GET_BUFFER_SIZE / RESET
DYNAMIC_KEYMAP_GET_LAYER_COUNT
```

### 明确禁止

本工具**没有且永远不调用**：

- 固件刷写；
- Bootloader 跳转；
- EEPROM reset；
- 接收器配对猜测；
- WOB 私有协议；
- 未写入官方 JSON 的灯区、性能、扫描率或电池私有命令；
- 无读回验证的“成功”提示；
- 模拟或替代 `Fn+Esc` 恢复出厂、`Fn+Tab` 切换连接模式、蓝牙/2.4G 配对、Win 键锁定、省电模式或超低延迟模式的任何操作。

连接后会先验证：

1. 选择的模式对应官方 VID/PID；
2. HID collection 必须为 VIA：`Usage Page 0xFF60` / `Usage 0x61`；
3. 设备返回标准 VIA 协议版本；
4. Layer 数处于 1–16 的安全范围。

任一检查失败时不会发送配置写入。

## 功能与写入语义

### 键位

- 物理键位和 `row,column` 坐标只从官方 JSON 的 `layouts.keymap` 解析；
- ISO/ANSI 兼容布局中的重复矩阵坐标会去重，绝不产生重复写入；
- 键位草稿保留在浏览器内存；
- 写入时仅逐一发送实际变更，并对每一个键立即 `GET_KEYCODE` 读回校验；
- 任一项读回不一致会停止后续写入，并明确报告失败位置。

### 灯光

只使用官方 JSON 的 channel `3`：

```text
1 Brightness
2 Effect
3 Effect Speed
4 Color (Hue/Saturation)
```

写入后执行 `CUSTOM_MENU_SAVE(3)`，并重新读取四项值确认。

### 宏

- 先读取设备实际报告的宏数量和缓冲区大小；
- 宏数为 `0` 时 UI 直接显示未启用，不猜测、不强开；
- 缓冲区写入使用 VIA 官方的最后一字节写入保护；
- 写完重新读取整个宏缓冲区并逐字节比较；
- 旧协议不允许宏延迟；文本限定 ASCII，避免用浏览器 UTF-16 误写设备。

### 档案

- 可导出/导入 JSON 档案；
- 导入前验证格式版本、矩阵 `8×16`、当前 VID/PID、Layer 数、宏容量；
- 导入只成为本地草稿，仍要点击“写入并读回验证”。

## 首次实体验收流程

请使用最新版 Chrome 或 Edge，并通过 `http://127.0.0.1` / `http://localhost` 打开，而不是双击 `file://`。

1. 先使用 **USB 有线模式**，选择 `0x320F:0x5055`；
2. 在浏览器原生 HID 弹窗中选择带 VIA vendor collection 的接口；
3. 确认概览页显示协议版本、Layer 数，并确认键位页读到的布局不是空值；
4. 导出一次备份；
5. 只选一个不影响输入的键，改成另一个可恢复的标准键码；
6. 点击“写入并读回验证”，确认页面提示全部读回通过，再确认实际按键行为；
7. 改回原值并再次读回；
8. 仅在上述成功后测试一项灯光参数；
9. 宏最后测试，并先导出备份。

USB 验收通过前不要测试 2.4G。2.4G 需要单独重复同一套只读 → 小范围写入 → 读回 → 实际行为的流程。

## 启动

### Windows

1. 安装 Node.js 20 或更高版本；
2. 解压项目；
3. 双击 `启动控制中心.bat`；
4. 浏览器打开 `http://127.0.0.1:4178`。

### 开发命令

```bash
npm install
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4178
```

## 许可证与来源说明

本项目的 WebHID/VIA 协议行为、宏缓冲区保护、JSON/KLE 处理参考并兼容 VIA 官方开源实现：

- https://github.com/the-via/app
- https://github.com/the-via/reader
- https://github.com/the-via/keyboards

VIA App 与 `@the-via/reader` 均以 **GPL-3.0** 发布。本项目因此以 **GPL-3.0-only** 发布；完整许可证文本见 `LICENSE`，来源与归属见 `NOTICE`。官方 Crush 80 JSON 原样保存在 `public/definitions/`，它们是功能边界，不被本项目修改或扩展。

## 当前验证记录

已完成：

- 官方 USB / 2.4G JSON 对比；
- TypeScript 类型检查；
- Vite production build；
- 18 项自动化测试：官方定义、协议常量、WebHID 帧、完整回显匹配、HID 安全校验、官方布局、协议版本键码字典、宏编码与档案范围校验；
- 浏览器连接页可视审查。

尚未完成：

- 实体 Crush 80 USB 读取与写入读回；
- 实体 Crush 80 2.4G 读取与写入读回；
- 用户按键与灯光实际行为验收；
- 说明书所列的前/侧灯条、充电与电量、Win 锁、省电、超低延迟、连接模式和配对能力均不在本工具的协议范围内；工具不会尝试管理或推断它们。
