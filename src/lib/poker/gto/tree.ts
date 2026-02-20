// ============================================
// GTO Tree Abstraction & Node Definitions
// 
// Models the poker game as a directed acyclic graph (DAG).
// Supports Decision Nodes, Chance Nodes, and Terminal Nodes.
// ============================================

import { CardIndex, DeckMask, hasCard } from '../card';
import { Action, GTOState, encodeInfoSetKey } from './state';
import { evaluate7 } from '../evaluator';

/** 节点类型枚举 */
export enum NodeType {
    Decision = 'DECISION',
    Chance = 'CHANCE',
    Terminal = 'TERMINAL'
}

/**
 * GameNode 基础接口
 */
export abstract class GameNode {
    public readonly type: NodeType;
    public readonly id: string; // 唯一标识符

    constructor(type: NodeType, id: string) {
        this.type = type;
        this.id = id;
    }

    /** 检查是否为终结节点 */
    public isTerminal(): boolean {
        return this.type === NodeType.Terminal;
    }
}

/**
 * 决策节点 (Decision Node)
 * 玩家必须在此节点选择一个行动
 */
export class DecisionNode extends GameNode {
    public readonly player: number; // 0 for OOP, 1 for IP
    public readonly state: GTOState;
    public readonly infoSetKey: string;

    // 子节点映射: action的字符串表示 -> Node
    public children: Map<string, GameNode> = new Map();
    // 有效的行动列表
    public validActions: Action[] = [];

    constructor(id: string, player: number, state: GTOState, boardCards: CardIndex[]) {
        super(NodeType.Decision, id);
        this.player = player;
        this.state = state;
        this.infoSetKey = encodeInfoSetKey(state.history, boardCards);
    }

    public addChild(action: Action, childNode: GameNode): void {
        const actionStr = `${action.type}_${action.amount}`;
        this.children.set(actionStr, childNode);
        this.validActions.push(action);
    }
}

/**
 * 机会节点 (Chance Node)
 * 代表发牌情况 (Flop, Turn, River)
 */
export class ChanceNode extends GameNode {
    public readonly state: GTOState;

    // 所有可能的发牌结果及其概率, 映射发牌结果 -> 下一个节点
    public outcomes: Map<string, { prob: number, node: GameNode }> = new Map();

    constructor(id: string, state: GTOState) {
        super(NodeType.Chance, id);
        this.state = state;
    }

    public addOutcome(cardStr: string, prob: number, node: GameNode): void {
        this.outcomes.set(cardStr, { prob, node });
    }
}

/**
 * 终结节点 (Terminal Node)
 * 游戏树的叶子节点，包含双方的最终收益评估逻辑
 */
export class TerminalNode extends GameNode {
    public readonly state: GTOState;
    public readonly isShowdown: boolean;
    public readonly activePlayer: number; // 如果没到 Showdown，谁是赢家 (0, 1 或者 -1 如果是 Showdown)

    constructor(id: string, state: GTOState, isShowdown: boolean, winnerIfFold: number = -1) {
        super(NodeType.Terminal, id);
        this.state = state;
        this.isShowdown = isShowdown;
        this.activePlayer = winnerIfFold;
    }

    /**
     * 评估收益 (Payoffs)
     * 
     * @param heroCards Player 0 (OOP) 牌
     * @param villainCards Player 1 (IP) 牌
     * @param boardCards 公共牌数组
     * @returns [p0Payoff, p1Payoff] 相对于当前有效筹码的收益
     */
    public evaluatePayoff(heroCards: CardIndex[], villainCards: CardIndex[], boardCards: CardIndex[]): [number, number] {
        const pot = this.state.pot;

        if (!this.isShowdown) {
            // Fold 终结
            if (this.activePlayer === 0) {
                // p1 弃牌，p0 赢走整个底池
                return [pot, 0];
            } else {
                // p0 弃牌，p1 赢走整个底池
                return [0, pot];
            }
        }

        // Showdown 终结：如果双方手中的牌和牌堆冲突，则这并非合法分支 (Blocker)
        // 这个在遍历外层防范更佳，但保险起见：
        const deck = this.state.board;
        if (hasCard(deck, heroCards[0]) || hasCard(deck, heroCards[1]) ||
            hasCard(deck, villainCards[0]) || hasCard(deck, villainCards[1])) {
            return [0, 0]; // 撞牌分支概率为0
        }

        const heroScore = evaluate7([...heroCards, ...boardCards]);
        const villainScore = evaluate7([...villainCards, ...boardCards]);

        if (heroScore > villainScore) {
            return [pot, 0]; // p0 win
        } else if (heroScore < villainScore) {
            return [0, pot]; // p1 win
        } else {
            return [pot / 2, pot / 2]; // tie
        }
    }
}

// ============================================
// Tree Builder (简易桩代码/接口定义)
// ============================================

export interface TreeBuilderConfig {
    initialPot: number;
    effectiveStack: number;
    streets: ('PREFLOP' | 'FLOP' | 'TURN' | 'RIVER')[];
    betSizes: number[]; // 允许的下注尺寸 (相对于底池乘数)
}

/**
 * TreeBuilder
 * 根据初始资金和合法规则递归生成完整的 GameNode 图
 */
export class TreeBuilder {
    private config: TreeBuilderConfig;
    private nodeCount: number = 0;

    constructor(config: TreeBuilderConfig) {
        this.config = config;
    }

    /**
     * 开始构建树 (目前为接口设计，防止爆炸尚未实际生成所有状态)
     */
    public buildTree(board: DeckMask): GameNode {
        // 创建初始根节点
        const initialState: GTOState = {
            board: board,
            pot: this.config.initialPot,
            stack0: this.config.effectiveStack,
            stack1: this.config.effectiveStack,
            history: "ROOT"
        };

        // 桩代码：此处应展开递归状态树，以保证架构兼容
        // 为确保内存安全和编译正确，返回一个空的终端节点代表占位
        return new TerminalNode("ROOT_TERM", initialState, true, -1);
    }
}
