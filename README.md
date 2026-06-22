# Poker Pro

Poker Pro 是一个面向德州扑克学习和复盘的 Range / Equity 分析工具。它支持 13x13 起手牌矩阵、Hero 与 Villain Range 编辑、公共牌街道切换、蒙特卡洛胜率模拟、EV / Outs / Blocker / Nut 分析，以及移动端底部结果抽屉。

## 功能

- Range 矩阵选择：支持对子、同花、非同花区域区分。
- 预设范围：Top 5%、Top 10%、Top 20%、对子、Broadway、同花连牌。
- Range 文本输入：支持 `AA, KK, AKs+, JJ-TT` 这类标准写法。
- 对手建模：支持随机、TAG、LAG、松被动、Nit、自定义 Range。
- 公共牌选择：按翻前、翻牌、转牌、河牌切换。
- Equity 模拟：通过 Web Worker 执行 Monte Carlo，避免阻塞 UI。
- 高级分析：包含 Outs、EV、Blocker、Nut 与街道胜率变化。
- PWA：支持安装和基础离线缓存。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Recharts
- Vaul Drawer
- Web Worker
- next-pwa

## 开发

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:3000
```

## 质量检查

```bash
npm run lint
npm run typecheck
npm run build
```

`build` 会使用 Next.js 的生产构建。当前项目使用 `next/font/google`，首次构建可能需要访问 Google Fonts。

## 项目结构

```text
src/app                         Next.js 页面入口
src/components/poker/pro         主要交互界面与分析面板
src/hooks/useSimulationWorker.ts Web Worker 调度
src/lib/poker                    Poker 计算核心与分析模块
src/engine                       高性能 Range Equity 引擎草稿
public/simulation-worker.js      浏览器运行的模拟 worker
```

## 维护重点

- 用可复现测试验证 evaluator、range parser 和 equity 结果。
- 继续优化移动端 Range 矩阵的触控体验。
- 收敛 `src/lib/poker` 与 `src/engine` 两套计算实现，减少重复逻辑。
- 定期处理 npm audit 中的依赖安全提示。
