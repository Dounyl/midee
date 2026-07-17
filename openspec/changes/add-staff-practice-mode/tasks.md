## 1. 路由与运行时骨架

- [ ] 1.1 新增 `staff-practice` learn route、页面入口与 learn hub / recent MIDI 导航接线
- [ ] 1.2 新增 `LearnStaffPracticePage` 页面壳，复用 learn 空状态、recent MIDI、返回与启动入口模式
- [ ] 1.3 新增 `StaffPracticePageRuntime` 与对应 runtime factory，保持独立于现有 `PlayAlongPageRuntime` 的 enter / exit / cleanup 生命周期
- [ ] 1.4 泛化 prepared learn MIDI handoff 与 active learn runtime registry 命名，避免新模式继续固化为 play-along 专属语义

## 2. 五线谱渲染与桥接

- [ ] 2.1 引入 OSMD 依赖，并创建 staff practice 专用的 DOM/SVG 谱面宿主组件
- [ ] 2.2 实现 `MidiFile` 到 staff notation 输入模型的 adapter，复用现有左右手拆分与和弦 grouping 结果
- [ ] 2.3 在 staff runtime 中完成 MIDI 加载后触发谱面生成与首帧渲染，并处理空谱面 / 加载失败状态
- [ ] 2.4 定义谱面元素与时间位置的映射结构，为后续高亮、loop 与自动滚动提供稳定索引

## 3. 练习交互与 transport 复用

- [ ] 3.1 复用现有 play / pause / seek / loop / replay 语义，使 staff practice 与 learn transport 保持一致
- [ ] 3.2 将 guided mode、hand filter、wait-mode 与伴奏发声规则接入 staff practice，并保持与现有 play-along 行为兼容
- [ ] 3.3 在 staff practice 中实现当前播放位置高亮与接近边界时的自动滚动
- [ ] 3.4 将练习成功反馈适配到五线谱视图，并保持整组和弦完成语义不变

## 4. 持久化、验证与收尾

- [ ] 4.1 为 staff practice 定义本地偏好恢复策略，明确 guided mode 等偏好与 play-along 的共享或分桶边界
- [ ] 4.2 补充针对 staff adapter、guided mode 持久化、当前位置高亮与自动滚动的聚焦测试
- [ ] 4.3 运行 `pnpm run typecheck`、相关聚焦测试与变更文件范围内的检查，确认 staff practice 变更达到 apply-ready 质量
