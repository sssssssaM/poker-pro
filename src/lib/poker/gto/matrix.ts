// ============================================
// GTO Strategy Matrices & Regret Tables
// 
// Uses TypedArrays (Float32Array) mapped to 1326
// possible combinations to avoid RAM exhaustion
// and GC pauses during CFR solving.
// ============================================

// 德州扑克起手牌总组合数
export const TOTAL_COMBOS = 1326;

/**
 * 策略矩阵
 * 
 * 对于给定的 InfoSet，存储每个特定起手牌 (0...1325) 选择每个可用 Action 的概率。
 * 使用连续的 Float32Array 提升 CPU 缓存命中率。
 */
export class StrategyMatrix {
    public readonly numActions: number;
    // P(action | combo) = data[combo * numActions + action_index]
    public readonly data: Float32Array;

    constructor(numActions: number) {
        this.numActions = numActions;
        this.data = new Float32Array(TOTAL_COMBOS * numActions);
        this.reset();
    }

    /** 初始化为均匀分布策略 */
    public reset(): void {
        const prob = 1.0 / this.numActions;
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] = prob;
        }
    }

    /**
     * 获取特定 Combo 选择特定 Action 的概率
     */
    public getProbability(comboId: number, actionIndex: number): number {
        return this.data[comboId * this.numActions + actionIndex];
    }

    /**
     * 更新特定 Combo 的策略概率 (CFR Regret-Matching 步骤)
     */
    public setProbability(comboId: number, actionIndex: number, prob: number): void {
        this.data[comboId * this.numActions + actionIndex] = prob;
    }
}

/**
 * 遗憾表 (Regret Table)
 * 
 * 存储每个 Combo 在每个 Action 上的累积 Counterfactual Regret。
 */
export class RegretTable {
    public readonly numActions: number;
    // R(action | combo) = data[combo * numActions + action_index]
    public readonly data: Float32Array;

    constructor(numActions: number) {
        this.numActions = numActions;
        this.data = new Float32Array(TOTAL_COMBOS * numActions); // 默认全0
    }

    public getRegret(comboId: number, actionIndex: number): number {
        return this.data[comboId * this.numActions + actionIndex];
    }

    public addRegret(comboId: number, actionIndex: number, regretToAdd: number): void {
        this.data[comboId * this.numActions + actionIndex] += regretToAdd;
    }

    /**
     * 使用 Regret-Matching 算法更新对应的 StrategyMatrix
     * 将所有非负的 regret 按比例转换为概率值。
     */
    public applyRegretMatching(strategy: StrategyMatrix): void {
        for (let c = 0; c < TOTAL_COMBOS; c++) {
            let sumPositiveRegret = 0;
            const offset = c * this.numActions;

            // 第一遍: 计算正 Regret 的总和
            for (let a = 0; a < this.numActions; a++) {
                const r = this.data[offset + a];
                if (r > 0) sumPositiveRegret += r;
            }

            // 第二遍: 归一化生成新策略 (正 Regret 的比例)
            for (let a = 0; a < this.numActions; a++) {
                if (sumPositiveRegret > 0) {
                    const r = this.data[offset + a];
                    strategy.data[offset + a] = r > 0 ? r / sumPositiveRegret : 0.0;
                } else {
                    // 如果所有 Regret 都是负数/0，则回退均匀分布
                    strategy.data[offset + a] = 1.0 / this.numActions;
                }
            }
        }
    }
}
