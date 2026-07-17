## Why

当前 learn 里的跟弹练习主要围绕瀑布谱与其衍生视图展开，已经能复用较多 transport、guided practice 与 MIDI 会话能力，但对习惯传统钢琴谱的用户而言，缺少一个可直接练习双手五线谱的入口。现在模具表、五线谱 SDK 路线与独立路由方案都已基本确定，适合趁边界清晰时把 staff practice 作为平行模式落下来，避免继续把新视觉与旧瀑布谱路由堆叠在一起。

## What Changes

- 新增独立的 learn 五线谱练习模式与独立路由，不与现有瀑布谱练习共用同一个页面入口。
- 新增五线谱练习页面 runtime，复用现有 learn 的 MIDI handoff、播放/暂停、循环、seek、guided practice、summary 与偏好管理能力。
- 引入基于五线谱 SDK 的谱面渲染宿主，使用 DOM/SVG 方案展示上下双谱表，而不是继续沿用瀑布谱 render path。
- 新增 staff notation adapter，将现有 `MidiFile`、左右手拆分结果与和弦分组结果桥接到五线谱渲染输入。
- 在五线谱视图中支持当前位置高亮、自动滚动到当前播放位置，以及与 loop / guided mode / hand filter 对齐的练习行为。
- 保留现有瀑布谱与简谱模式，不做破坏性替换。

## Capabilities

### New Capabilities
- `learn-staff-practice-mode`: 定义独立五线谱练习模式的路由、运行时、谱面展示、自动滚动与 transport 对齐行为。

### Modified Capabilities
- `learn-guided-modes`: 将 guided mode 的语义、切换与持久化边界扩展到新的 staff practice 模式，同时保持与现有 play-along 行为兼容。
- `learn-practice-hit-feedback`: 将练习成功反馈从 roll-score 语义扩展到五线谱视图，使正确练习输入在 staff practice 中也能触发清晰一致的奖励反馈。

## Impact

- 受影响代码将集中在 `src/pages/LearnPage/`、`src/features/learn/runtime/`、`src/features/learn/exercises/play-along/`、新的五线谱 adapter / host 模块，以及 learn 路由注册与 runtime 工厂。
- 需要新增五线谱 SDK 依赖与对应的 DOM/SVG 宿主集成。
- 需要调整现有 prepared learn MIDI handoff、guided mode 偏好与实践反馈的复用边界，避免继续固化为 play-along 专属命名。
