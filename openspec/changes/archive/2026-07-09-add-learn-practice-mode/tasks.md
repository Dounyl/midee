## 1. Guided mode state and naming

- [x] 1.1 在 play-along 状态层新增可持久化的 `guidedMode` 偏好，并以保持当前可发声行为的默认值初始化。
- [x] 1.2 扩展 play-along runtime/engine 状态，使 guided mode 可以在 session 内切换，而不重新加载 MIDI、也不离开 `play-along` 路由。
- [x] 1.3 更新 learn play-along 控件与 i18n 文案，以 `示范模式` 和 `练习模式` 呈现可切换的 guided modes。
- [x] 1.4 调整控制区布局，将新的 switch 按钮放在进度条右侧，并相应收窄进度条宽度。

## 2. Practice-mode audio policy

- [x] 2.1 引入派生的伴奏发声策略，将所选练习手映射为“对侧发声”或“完全静音”的练习模式规则。
- [x] 2.2 通过 play-along engine 与 synth 集成应用该发声策略，确保模式切换和 hand 切换后伴奏声音能立即正确刷新。
- [x] 2.3 补充聚焦测试，覆盖 guided mode 默认值、持久化恢复，以及 left/right/both 三种练习发声行为。

## 3. Practice success feedback

- [x] 3.1 将练习成功反馈的触发点改为 `PracticeEngine` 的 accepted-step outcome，而不是被动 playback/render 时机。
- [x] 3.2 增加仅用于练习模式的强化 spark/burst 效果，使其比当前基线效果更大、更明显。
- [x] 3.3 确保错误音与被动 transport 运动不会触发练习成功反馈，并正确处理和弦完成语义。

## 4. Verification

- [x] 4.1 增加或更新集成式测试，覆盖已加载 play-along session 中的模式切换行为。
- [x] 4.2 运行 `pnpm run test`，验证 play-along/runtime 相关覆盖并修复回归。
- [x] 4.3 运行 `pnpm run check`，在实现完成前做整体验证。
