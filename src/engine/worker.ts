// ============================================
// 德州扑克专业引擎 — Web Worker
// ============================================
// 将所有计算移出主线程, UI 只通过 postMessage 通信
// 禁止在主线程直接进行 equity 计算

import type {
    WorkerMessage,
    WorkerProgress,
    WorkerComplete,
    CardIndex
} from './types';
import { calculateRangeEquity } from './rangeEquity';
import { OPPONENT_RANGES } from './rangeParser';

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    if (msg.type === 'calculate') {
        const { range1, range2, board, iterations } = msg;

        // 解析对手 range
        const oppCombos = range2.length > 0
            ? range2
            : ([] as string[]);  // empty = random

        const result = calculateRangeEquity(
            range1,
            oppCombos,
            board as CardIndex[],
            iterations,
            (pct, wins, ties, losses, sims) => {
                self.postMessage({
                    type: 'progress',
                    progress: pct,
                    wins,
                    ties,
                    losses,
                    simulations: sims
                } as WorkerProgress);
            }
        );

        self.postMessage({
            type: 'complete',
            result
        } as WorkerComplete);
    }
};

export { };
