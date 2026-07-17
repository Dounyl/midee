## Context

当前 learn 体系已经具备较完整的五线谱练习底座之外能力：MIDI 导入与 handoff、learn runtime 生命周期、play/pause/seek/loop、guided mode、practice wait-mode、左右手伴奏路由、和弦分组、summary 与 recent MIDI 页面壳都已存在。缺的不是 transport，而是一个独立于瀑布谱路由的传统双手五线谱展示面。

本次变更已经明确几个外部约束：

- 五线谱模式必须走独立 learn route，不能继续叠加到现有瀑布谱页面里。
- 五线谱展示优先采用现成 SDK，而不是在第一阶段自研完整 engraving。
- 现有 `MidiFile`、左右手拆分与和弦 grouping 能力应尽量复用，避免重新发明练习语义。
- 当前仓库的 `runtime` 是生命周期对象，不等于渲染技术；因此 staff practice 仍应拥有独立 page runtime，由它去驱动 SDK 视图。

## Goals / Non-Goals

**Goals:**

- 为 learn 新增独立的 `staff-practice` 路由与 page runtime。
- 采用 OSMD 作为五线谱渲染方案，并将其放在 DOM/SVG 宿主中，而不是并入现有 Pixi render layer。
- 复用现有 learn handoff、transport、guided mode、loop、hand filter、summary、recent MIDI 入口。
- 在五线谱视图中支持双谱表展示、当前位置高亮与自动滚动。
- 以 adapter 方式桥接现有 `MidiFile`、左右手拆分结果与和弦 grouping 结果，尽量降低新模式对现有 learn 内核的侵入。

**Non-Goals:**

- 不在本次变更中替换、删除或重写现有瀑布谱与简谱模式。
- 不追求出版级谱面编辑与 engraving 完整度，例如复杂装饰音、跨系统布局精修、交互式记谱编辑。
- 不在 V1 中实现谱面内拖拽 seek 或谱面编辑。
- 不在本次变更中重写 MIDI parser 或引入新的全局 transport 体系。

## Decisions

### 1. 使用 OSMD 作为五线谱渲染依赖

选择 OSMD，而不是先直接以 VexFlow 自研完整五线谱层。

原因：

- 当前需求是“传统钢琴谱练习模式”，最难的是谱面排版而不是播放控制。
- OSMD 更接近现成乐谱渲染器，能显著减少双谱表、谱号、音符排版的自研量。
- VexFlow 更适合做底层绘制引擎，但如果直接选择它，第一阶段会把大量时间消耗在排版能力上。

替代方案：

- 直接扩展现有 sight-reading Pixi layer：能复用 render loop，但不足以承担通用 MIDI 双手钢琴谱的排版复杂度。
- 直接以 VexFlow 手写布局：自由度高，但首期成本明显更高。

### 2. 五线谱宿主使用 DOM/SVG 容器，而不是 Pixi RenderLayer

五线谱视图将挂在 learn 页面自己的 DOM host / `ui-overlay` 中，由 runtime 负责驱动其状态。

原因：

- OSMD 的自然输出是 DOM/SVG；强行塞进 Pixi canvas 体系会增加不必要的桥接与渲染复杂度。
- 当前仓库已经验证“不同 notation surface 应该拆分显示路径”，否则滚动、拖拽、旧 roll 语义会互相干扰。
- 让五线谱留在 DOM 层，更容易做元素级高亮、滚动容器控制与后续调试。

替代方案：

- 将五线谱渲染结果截图或纹理化后放入 Pixi：实现复杂，且丢失 DOM/SVG 交互优势。
- 将 staff 逻辑做成 RenderLayer：更适合简化训练视图，不适合首期接入 OSMD。

### 3. 新增独立的 StaffPracticePageRuntime，作为 PlayAlongPageRuntime 的 sibling

新的五线谱模式不扩展现有 `PlayAlongPageRuntime`，而是创建平行 runtime。

原因：

- 独立路由、独立页面、独立视图宿主已经说明它具备单独的 enter/exit、订阅与清理边界。
- 继续把 staff 模式塞进现有 play-along runtime，会把视图分支、宿主分支与命名耦合进一步放大。
- 当前 learn runtime 设计本来就是为 feature/page runtime 并列存在准备的。

替代方案：

- 在 `PlayAlongPageRuntime` 内新增 `notationMode=staff`：短期改动少，但长期会继续堆积条件分支与宿主差异。

### 4. 复用现有 learn MIDI 会话与控制语义，新增 staff notation adapter

五线谱模式将复用现有 learn 会话装载、clock、synth、guided mode、loop 和 hand filter 语义；新代码聚焦在 adapter 与 DOM host。

原因：

- 现有 learn transport 与 handoff 已经稳定，重复实现风险高于收益。
- 当前已有的左右手拆分与和弦 grouping 足以作为 V1 的 notation 输入基础。
- adapter 模式可以把最容易变化的“谱面输入整形”隔离出来，减少对核心 runtime 的侵入。

替代方案：

- 在 staff 模式里自建一套 session/transport state：会重复已有能力，且更难保持和现有 learn 行为一致。

### 5. V1 中保留现有 guided mode / hand / loop 交互，但不做谱面内 seek

五线谱模式在第一阶段沿用现有 guided mode、左右手、loop 与 replay 行为；谱面内 seek 留到后续。

原因：

- 当前最有价值的是把传统谱面练习走通，而不是一次性覆盖所有瀑布谱交互。
- 谱面滚动与谱面内拖拽 seek 有较高冲突概率，先不把复杂交互一起引入更稳。

替代方案：

- 在 V1 里实现谱面点击/拖拽 seek：可行，但会显著拉长交互打磨周期。

## Risks / Trade-offs

- [MIDI 到谱面输入的量化结果不够自然] → 先复用现有和弦 grouping 与 BPM/拍号信息，V1 以“练习可用”优先，后续再细化量化策略。
- [左右手拆分在复杂 MIDI 上不完全等价于真实钢琴谱分手] → 先沿用现有启发式与轨道平均音高规则，后续再决定是否引入 note-level 手部分配。
- [OSMD 只负责谱面，不理解 loopRegion / guidedMode] → 在 runtime 和 host 之间维护独立的时间映射与滚动状态，不把练习语义硬塞进 SDK。
- [现有 prepared MIDI 命名偏 play-along，会加剧语义债务] → 在实现时顺手泛化 prepared learn MIDI 命名，避免 staff 模式继续继承旧命名。
- [DOM/SVG 视图与现有 canvas 并存可能带来布局同步问题] → 让 staff 页面独立管理自己的宿主与滚动容器，不复用 roll 的拖拽/可视区域语义。

## Migration Plan

1. 以新增路由与新增 runtime 的方式引入 staff practice，不替换现有 play-along 页面。
2. 接入 OSMD 依赖与 notation host，但默认仅由新路由使用。
3. 复用现有 learn handoff，将导入的 learn MIDI 可交给 staff runtime 消费。
4. 在 V1 中先交付静态谱面、当前位置高亮、自动滚动、guided mode 与 loop 的基础联动。
5. 如需回滚，可直接移除新路由与新 runtime，不影响既有 play-along / jianpu / sight-reading 流程。

## Open Questions

- guided mode 偏好是否与现有 play-along 共用同一份本地存储，还是按 route 分桶持久化。
- loop 高亮在五线谱中按“音符范围”还是按“小节范围”表达更合适。
- V1 是否需要在 staff mode 中保留屏幕底部键盘可视化，还是默认仅展示谱面与 HUD。
