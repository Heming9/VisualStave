# MIDI钢琴实时五线可视化项目 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 初始化React+TypeScript项目
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 使用vite-init创建React+TypeScript项目
  - 配置Tailwind CSS和Zustand
  - 设置基本的项目结构
- **Acceptance Criteria Addressed**: None (基础设置)
- **Test Requirements**:
  - `programmatic` TR-1.1: 项目可以正常启动并显示初始页面
  - `human-judgement` TR-1.2: 目录结构符合规范要求
- **Notes**: 使用react-ts模板

## [ ] Task 2: 实现MIDI输入监听模块
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 创建Web MIDI API封装
  - 实现MIDI设备列表获取
  - 实现MIDI输入事件监听（note on/off, velocity）
  - 创建音符数据类型定义
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: MIDI设备可以被检测到
  - `programmatic` TR-2.2: 音符on/off事件可以被正确捕获
  - `programmatic` TR-2.3: 力度数据可以被正确读取
- **Notes**: 封装在src/hooks/useMidi.ts中

## [ ] Task 3: 实现五线谱渲染组件
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 创建Canvas组件作为渲染基础
  - 绘制高低音双线五线谱（大谱表）
  - 绘制高音谱号和低音谱号
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgement` TR-3.1: 五线谱显示正确
  - `human-judgement` TR-3.2: 谱号位置准确
- **Notes**: 组件放在src/components/Staff.tsx

## [ ] Task 4: 实现音高到Y坐标的转换
- **Priority**: P0
- **Depends On**: Task 3
- **Description**: 
  - 实现MIDI音高到五线谱位置的映射逻辑
  - 处理调号相关的位置计算（C4为中央C）
  - 添加音符位置辅助函数
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgement` TR-4.1: C4在高音谱表的下加一线位置
  - `human-judgement` TR-4.2: 其他音符位置对应准确
- **Notes**: 工具函数放在src/utils/music.ts

## [ ] Task 5: 实现和弦判定机制
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 实现和弦判定算法（基于时间阈值）
  - 实现和弦对齐逻辑
  - 添加可配置的阈值参数（默认60ms）
- **Acceptance Criteria Addressed**: AC-6, AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: 时差≤60ms的音符被识别为和弦
  - `programmatic` TR-5.2: 时差>60ms的音符作为琶音处理
  - `human-judgement` TR-5.3: 和弦音符X坐标对齐显示
- **Notes**: 逻辑放在src/utils/chord.ts

## [ ] Task 6: 实现音符渲染功能
- **Priority**: P0
- **Depends On**: Task 4, Task 5
- **Description**: 
  - 实现音符符头绘制（椭圆形）
  - 根据力度控制透明度/颜色
  - 绘制音符时长延伸条
  - 处理和弦音符的垂直叠放
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-6.1: 音符符头样式正确
  - `human-judgement` TR-6.2: 力度影响透明度效果明显
  - `human-judgement` TR-6.3: 音符时长条显示正确
- **Notes**: 渲染逻辑在Staff组件中

## [ ] Task 7: 实现时间轴和自动滚动
- **Priority**: P0
- **Depends On**: Task 6
- **Description**: 
  - 实现时间戳到X坐标的转换
  - 实现画面自动滚动逻辑
  - 处理滚动边界和性能优化
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `human-judgement` TR-7.1: 时间轴向右延伸正确
  - `human-judgement` TR-7.2: 自动滚动流畅，保持当前演奏在可视区域
- **Notes**: 使用requestAnimationFrame优化渲染

## [ ] Task 8: 实现节拍辅助线功能
- **Priority**: P1
- **Depends On**: Task 7
- **Description**: 
  - 添加节拍辅助线绘制
  - 实现开关控制
  - 配置BPM参数（默认60BPM）
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `human-judgement` TR-8.1: 辅助线显示正确
  - `human-judgement` TR-8.2: 开关功能正常
- **Notes**: 辅助线仅作参考，不吸附音符

## [ ] Task 9: 实现UI控制面板
- **Priority**: P1
- **Depends On**: Task 2, Task 8
- **Description**: 
  - 创建设备选择下拉菜单
  - 创建和弦阈值滑块
  - 创建节拍辅助线开关
  - 创建BPM配置（如果需要）
  - 显示演奏统计信息
- **Acceptance Criteria Addressed**: AC-1, AC-9
- **Test Requirements**:
  - `human-judgement` TR-9.1: 控制面板布局美观
  - `human-judgement` TR-9.2: 所有控件功能正常
- **Notes**: 组件放在src/components/ControlPanel.tsx

## [ ] Task 10: 状态管理和整体整合
- **Priority**: P0
- **Depends On**: Task 2, Task 3, Task 9
- **Description**: 
  - 创建Zustand store管理全局状态
  - 整合所有组件和功能
  - 实现主页面布局
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- **Test Requirements**:
  - `human-judgement` TR-10.1: 整体功能正常工作
  - `programmatic` TR-10.2: 状态管理正确
- **Notes**: store放在src/store/useAppStore.ts

## [ ] Task 11: 性能优化和测试
- **Priority**: P1
- **Depends On**: Task 10
- **Description**: 
  - 优化Canvas渲染性能
  - 添加边界检查和错误处理
  - 测试长时间演奏（10分钟）
  - 测试不同浏览器兼容性
- **Acceptance Criteria Addressed**: NFR-1, NFR-2, NFR-4
- **Test Requirements**:
  - `programmatic` TR-11.1: 延迟<50ms
  - `human-judgement` TR-11.2: 10分钟演奏无明显性能下降
  - `human-judgement` TR-11.3: 主流浏览器兼容
- **Notes**: 使用Chrome DevTools Performance面板分析

## [ ] Task 12: 美化UI和交互
- **Priority**: P2
- **Depends On**: Task 10
- **Description**: 
  - 优化整体视觉设计
  - 添加动画和过渡效果
  - 优化响应式布局
- **Acceptance Criteria Addressed**: NFR-3
- **Test Requirements**:
  - `human-judgement` TR-12.1: UI美观现代
  - `human-judgement` TR-12.2: 交互流畅
- **Notes**: 遵循web-artisan的设计原则
