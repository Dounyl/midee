## Context

当前 `play-along` 学习流已经具备大部分引导练习所需机制：`PracticeEngine` 负责正确按键判定与等待推进，`PlayAlongEngine` 负责 transport 与手部分配，本地偏好通过 `play-along/state.ts` 持久化，roll 渲染器也已经具备粒子反馈能力。现在的问题是，这些能力被打包在一个“会发声”的单一模式里，用户无法在同一条学习链路中自然切换“系统示范”与“静音练习”。

这次变更会同时影响几层：

- 学习模式的 UI 命名与控件布局
- play-along runtime 状态与本地持久化
- 引导伴奏的 synth 发声策略
- roll 反馈的触发时机与视觉强调

由于用户希望新模式与当前跟弹模式可以直接互换，本设计会保留现有 `play-along` 路由与 runtime，不新增页面，而是在现有流内增加一个 guided-mode 维度。

## Goals / Non-Goals

**Goals:**

- 在现有 play-along 学习流中加入 guided-mode 切换，明确区分“示范模式”和“练习模式”。
- 保持当前 route、runtime 和 session 生命周期不变，使模式切换足够轻量，不触发 MIDI 重新加载。
- 为练习模式定义确定性的手部发声规则：
  - 练左手时，只让右手发声
  - 练右手时，只让左手发声
  - 练双手时，双手都不发声
- 将练习模式中的成功反馈从“跟随播放出现的通用视觉效果”改为“由正确输入驱动的视觉奖励”，并显著增强可见性。
- 将新模式选择与现有 play-along 偏好一起持久化。
- 新增的 switch 按钮放在进度条右侧，同时让进度条变窄，为模式切换控件留出稳定位置。

**Non-Goals:**

- 不为练习模式创建单独 route 或页面壳层。
- 不重做整个 play-along HUD、summary 或评分模型。
- 不改写全站范围内现有粒子效果的个性化配置。
- 不在本次内加入超出“按左右手静音/发声”之外的复杂逐音教学策略。

## Decisions

### 1. Keep one `play-along` runtime and add a `guidedMode` preference

新行为应当落在现有 `PlayAlongPageRuntime` 与 `PlayAlongEngine` 内，而不是拆分出第二套 runtime。路由仍保持 `play-along`，通过新增可持久化的 `guidedMode` 字段来区分 `demo` 与 `practice`。

Why:

- 现有 runtime 已经拥有 MIDI 加载、transport、loop、速度预设、手部筛选和 summary 生命周期。
- 用户想要的是两个模式之间“互换”，更适合建模为状态切换，而不是页面跳转。
- 这样可以避免重复维护 local-storage replay state、runtime 生命周期钩子和 learn overlay。

Alternative considered:

- 单独拆出 `practice` route/runtime。放弃原因是它会复制大部分 play-along 生命周期实现，也会让模式切换比用户期待的“互换”更重。

### 2. Rename the current audible mode to `示范模式` and define `练习模式` as the guided-input mode

当前会发声的模式在 UI 上定义为 `示范模式`，因为它的本质特征是系统会把曲子示范出来，用户在示范声中跟随。新增模式定义为 `练习模式`，用户输入将成为进度推进与成功反馈的主来源。

Why:

- `示范模式` 能直接说明“会发声”是刻意设计的教学行为，而不是当前模式的缺陷。
- `欣赏模式` 听起来更像被动聆听，会弱化这个模式依然属于 guided follow-along 的事实。
- `示范模式 / 练习模式` 这组名称能直接描述行为差异，也不需要引入英文术语。

Alternative considered:

- `欣赏模式`。放弃原因是它对仍在使用滚动谱和引导式 transport 控件的模式来说过于被动。

### 3. Decouple practice target hand from audible accompaniment hand through a playback policy layer

现有 `hand` 选择已经会影响 play-along 行为。对于练习模式，需要正式引入一个派生概念：audible accompaniment policy。练习模式根据目标练习手自动推导“哪只手应该发声”，在 `both` 时推导为完全静音。

Expected mapping:

- `hand = left` => 用户练左手，系统只发右手
- `hand = right` => 用户练右手，系统只发左手
- `hand = both` => 用户练双手，系统双手都不发声

这一逻辑应实现为独立的策略函数，并在 synth track filter 或 note scheduling 规则生效前统一应用，而不是把条件判断零散分布在 HUD 与 engine 中。

Why:

- 当前 `hand` 字段已经具备 UI 入口与持久化能力。
- 将发声规则做成派生策略，可以保持 `AppRuntime` 和 route state 简洁，同时让 engine 只有一套权威音频规则。
- 这也为未来可能加入的“静音示范”“仅节拍器练习”等扩展留出空间，而不必再次重命名核心状态。

Alternative considered:

- 再加一个独立的伴奏手选择器。放弃原因是 UI 会更复杂，而且对这次要求的 left/right/both 规则来说没有必要。

### 4. Gate practice spark feedback from `PracticeEngine` acceptance outcomes, not generic playback/render events

练习模式下的成功视觉反馈应当在用户完成正确音或和弦时触发，而不是在 transport 经过 roll 上的某个音符时触发。最稳定的触发点是 `PracticeEngine.notePressed()` 产生的 accepted/advanced 结果，这些结果已经通过 `PlayAlongEngine.onNoteOn()` 暴露出来。

Why:

- 这与用户需求完全一致：只有按下正确的键，才出现奖励效果。
- 它天然能抑制错误按键反馈，因为 rejected 已经在 engine 中被清晰区分。
- 它也能避免示范模式播放或被动 transport 运动触发同样的教学奖励信号。

Alternative considered:

- 在 renderer 层通过 live notes 与 roll notes 比较来做 gating。放弃原因是 engine 已经掌握了权威的 accepted/rejected 结果，在渲染层重复判定时序逻辑更容易出错。

### 5. Make practice feedback a distinct emphasized burst, not a global particle-style change

这次视觉变化是有上下文的：在练习模式里，正确输入应触发更大、更明显、接近“奖励型烟火”的效果。因此它应被建模为 practice success 专用 burst 路径，或粒子系统中的专用强化变体，而不是直接全局改写 `sparks` 的默认含义。

Why:

- 应用其他部分仍可能依赖现有粒子风格调参。
- 练习成功需要更强提示，但不应影响其他页面或被动播放中的普通视觉表现。
- 专用强化 burst 比修改全局 `sparks` 默认含义更好测试，也更容易推理。

Alternative considered:

- 直接全局重调 `sparks` 预设。放弃原因是它会影响无关播放体验，也会削弱对“仅练习模式强化”的控制力。

### 6. Place the new mode switch to the right of the progress bar and narrow the bar

新增加的 mode switch 按钮应放在进度条右侧，进度条本身相应收窄，为切换控件留出稳定空间。布局目标是：在不打断当前播放控制心智模型的前提下，让模式切换始终可见、可点、且不挤压现有主要操作按钮。

Why:

- 用户已经明确指定希望 switch 按钮放在进度条右边。
- 把切换控件放在进度条旁边，意味着模式切换与“当前练习进度上下文”天然绑定，查找成本更低。
- 进度条适度变窄是比新增一整行控件更轻的改动，对现有 HUD 扰动更小。

Alternative considered:

- 把 switch 放到二级菜单或现有按钮组中。放弃原因是可见性不足，无法满足“可直接互换模式”的交互目标。

## Risks / Trade-offs

- [模式命名未来仍可能调整] -> 内部实现继续使用稳定值 `demo` / `practice`，这样中文标签未来即便调整也不需要重构逻辑。
- [左右手到 MIDI track 的映射在特殊文件上可能不完美] -> 复用当前 play-along hand filtering 已使用的手部分类来源，并为 left/right/both 加代表性测试。
- [反馈放大后可能显得过吵或视觉过密] -> 将强化 burst 的参数独立出来，后续可单独调参，而不影响 transport 或 scoring 逻辑。
- [播放中切换模式可能导致 synth 状态短暂不同步] -> 通过单一 engine 方法重新应用 playback policy，并从当前 transport 时间点确定性恢复。
- [进度条缩窄可能影响拖拽或读数体验] -> 需要在桌面与移动端同时验证可点击面积和可读性，必要时通过最小宽度与响应式断点控制退化方式。

## Migration Plan

1. 扩展 play-along 持久化偏好，加入 `guidedMode`，并让老用户默认落到 `demo`，保证现有行为不被意外改变。
2. 在 learn HUD 中加入模式 switcher，并将其放在进度条右侧，同时缩窄进度条宽度，不改变现有 route。
3. 引入派生的 practice accompaniment policy，并在模式切换或手部切换时重新应用 synth 发声状态。
4. 将练习成功反馈迁移到 accepted-note/chord outcome 上，并加入强化版视觉 burst 路径。
5. 通过聚焦的 engine/runtime 测试验证持久化、发声策略、反馈 gating，以及新布局下的交互可用性。

Rollback strategy:

- 移除 `guidedMode` UI，并忽略新增存储字段；runtime 可以安全回退到 `demo` 语义，从而恢复当前行为。

## Open Questions

- 第一版是否只保留中文模式标签，还是同步补齐其他 locale 下的 `demo/practice` 翻译键。
- 练习模式中的“正确按键”反馈，是每个被接受的音都触发一次，还是仅在整个和弦 step 完成时触发一次。按当前需求理解，更自然的是“完整 step 清除时触发一次更强奖励”，但实现时仍需要最终确认。
