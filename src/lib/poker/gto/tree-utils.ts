// ============================================
// GTO Tree Traversal & Utilities
// ============================================

import { GameNode, NodeType, DecisionNode, ChanceNode, TerminalNode } from './tree';

/**
 * 遍历统计信息
 */
export interface TreeStats {
    totalNodes: number;
    decisionNodes: number;
    chanceNodes: number;
    terminalNodes: number;
    maxDepth: number;
}

/**
 * 执行深度优先搜索(DFS)遍历整个博弈树，并统计节点信息
 * 用于验证生成树的大小和形状是否符合预期
 * 
 * @param root 树的根节点
 * @returns 统计信息
 */
export function traverseTreeStats(root: GameNode): TreeStats {
    const stats: TreeStats = {
        totalNodes: 0,
        decisionNodes: 0,
        chanceNodes: 0,
        terminalNodes: 0,
        maxDepth: 0
    };

    // 使用非递归 DFS 防止调用栈溢出
    // 栈中保存 [节点, 当前深度]
    const stack: { node: GameNode, depth: number }[] = [{ node: root, depth: 0 }];
    const visited = new Set<string>(); // 防循环，理论上是 DAG 但安全第一

    while (stack.length > 0) {
        const current = stack.pop()!;
        const node = current.node;
        const depth = current.depth;

        if (visited.has(node.id)) continue;
        visited.add(node.id);

        stats.totalNodes++;
        if (depth > stats.maxDepth) {
            stats.maxDepth = depth;
        }

        if (node.type === NodeType.Decision) {
            stats.decisionNodes++;
            const dNode = node as DecisionNode;
            for (const child of dNode.children.values()) {
                stack.push({ node: child, depth: depth + 1 });
            }
        } else if (node.type === NodeType.Chance) {
            stats.chanceNodes++;
            const cNode = node as ChanceNode;
            for (const outcome of cNode.outcomes.values()) {
                stack.push({ node: outcome.node, depth: depth + 1 });
            }
        } else if (node.type === NodeType.Terminal) {
            stats.terminalNodes++;
        }
    }

    return stats;
}

/**
 * 提取并返回按 InfoSet 归类的所有决策节点
 * 这是准备 CFR Solver 矩阵的关键步骤
 */
export function gatherInfoSets(root: GameNode, forPlayer: number): Map<string, DecisionNode[]> {
    const infoSets = new Map<string, DecisionNode[]>();

    const stack: GameNode[] = [root];
    const visited = new Set<string>();

    while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        if (node.type === NodeType.Terminal) continue;

        if (node.type === NodeType.Decision) {
            const dNode = node as DecisionNode;
            if (dNode.player === forPlayer) {
                if (!infoSets.has(dNode.infoSetKey)) {
                    infoSets.set(dNode.infoSetKey, []);
                }
                infoSets.get(dNode.infoSetKey)!.push(dNode);
            }

            for (const child of dNode.children.values()) {
                stack.push(child);
            }
        } else if (node.type === NodeType.Chance) {
            const cNode = node as ChanceNode;
            for (const outcome of cNode.outcomes.values()) {
                stack.push(outcome.node);
            }
        }
    }

    return infoSets;
}
