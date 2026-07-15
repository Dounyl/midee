# midee

English version: [README.en.md](./README.en.md)

`midee` 是一个运行在浏览器里的 MIDI 可视化、实时演奏、练习与导出工具。

在线地址：
[http://139.196.37.239/](http://139.196.37.239/)

GitHub：
[https://github.com/Dounyl/midee](https://github.com/Dounyl/midee)

## 项目来源

本仓库基于上游项目 fork 而来：

- 上游仓库：`aayushdutt/midee`
- 当前仓库：`Dounyl/midee`

已经获得原作者授权，可以在此基础上继续开发、调整和发布。

这个仓库会继续按照自己的产品方向独立演进，后续在功能、结构、文档和部署上都可能与上游仓库产生较大差异，因此不再以“上游镜像”作为目标。

## 当前定位

`midee` 当前仍然是一个静态部署的 Vite SPA。核心能力都在浏览器端完成，包括：

- MIDI 加载与播放
- 音频合成与实时输入
- Pixi 画面渲染
- 练习模式与交互反馈
- MP4 / MIDI 导出

也就是说，它不是传统的后端驱动应用，核心功能不依赖业务服务器。

## 主要特性

### MIDI 可视化

- 支持 MIDI 文件加载、播放与多轨展示
- 钢琴瀑布流、发光按键、粒子效果、和弦提示
- 支持 88 键完整键盘视图
- 新增 61 键模式，更适合紧凑键盘和部分移动端/小屏场景
- 支持暂停时移调，并在当前调性下更新显示
- 支持在音符与键盘上显示唱名 / 音名标签
- 支持主题、粒子、乐器、标签显示、画面比例与导出视图调整
- 支持最近本地 MIDI 库与最近练习入口，本地库最多保留 20 首最近文件

### 实时演奏

- 支持 Web MIDI 控制器接入
- 支持电脑键盘输入
- 支持点击屏幕键盘交互
- 支持实时可视化、录制与回放相关流程
- 支持节拍器
- 支持 Live 模式下的交互演奏与录制

### Loop 与录制

- 支持 loop station 式片段循环
- 支持叠录、撤销、清空
- 支持按小节吸附的循环体验
- 支持把录制结果导出为 `.mid`
- 支持把完整演奏流程继续用于视频导出

### Learn / 练习模式

- `Play along` 跟弹练习
- `Sight Reading` 视奏练习
- `Intervals` 音程训练

其中 `Play along` 提供的是完整的引导练习流程：

- 开始一轮跟弹前可先选择引导模式
- 支持 `Demo` 示范模式：保留完整引导伴奏，适合先听、先熟悉
- 支持 `Practice` 练习模式：按左右手策略保留辅助声部，更适合真正练习
- 支持 `Wait mode`等待：在关键和弦处等待你弹对再继续
- 支持左右手聚焦、循环段落、节奏/速度控制
- 支持练习结果总结与继续练习流程

`Sight Reading` 当前还支持：

- 高音谱号 / 低音谱号 / 双谱表切换
- 速度爬升、音符间距、重开与弱项练习等训练控制

`Intervals` 当前支持：

- 听辨后作答的音程训练流程
- 连击、结果反馈与重播

### 导出

- 支持浏览器内本地导出 MP4
- 支持 720p、1080p、竖屏、方形等导出规格
- 支持导出音频、视频以及 MIDI
- 导出流程仍然以浏览器端完成为主

## 技术栈

- `SolidJS`
- `TypeScript`
- `Vite`
- `PixiJS`
- `Tone.js`
- `@tonejs/midi`
- `Web MIDI`
- `WebCodecs`

## 开发方式

项目已经统一使用 `pnpm`。

建议环境：

- Node.js 24
- pnpm 11+

安装与启动：

```bash
pnpm install
pnpm run dev
```

本地开发地址：

```text
http://localhost:5173/
```

常用命令：

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run typecheck
pnpm run lint
pnpm run lint:fix
pnpm run format
pnpm run test
pnpm run check
```

## License

项目当前按 MIT 口径维护；如果你准备对外分发或进一步商业化使用，建议同时核对仓库顶层许可证文件与第三方资源许可证说明。
