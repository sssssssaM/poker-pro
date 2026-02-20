// ============================================
// Unit Tests for GTO Architecture Expansion
//
// These tests execute the logic defined in the Phase 4 planning.
// Run via pure standard library to avoid massive setup initially.
// ============================================

import { TerminalNode, DecisionNode, ChanceNode, TreeBuilder, NodeType } from './tree';
import { GTOState, ActionType, encodeInfoSetKey } from './state';
import { traverseTreeStats, gatherInfoSets } from './tree-utils';
import { makeCard, fullDeck, emptyDeck } from '../card';

// 用一个简单的运行器包装，这样 npm run test 时如果被直接包含能跑，
// 或者在浏览器环境也可以直接调用这个文件的方法进行验证。

export function runGTOTests() {
    console.log("Running Phase 4 GTO Architecture Tests...");

    testTerminalPayoffVerification();
    testInfoSetEncoding();
    testTreeTraversalAndInfoSets();

    console.log("All Phase 4 GTO Tests Passed ✓");
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

// ----------------------------------------------------
// 1. Terminal Payoff Verification
// ----------------------------------------------------
function testTerminalPayoffVerification() {
    const mockState: GTOState = {
        board: emptyDeck(),
        pot: 100,
        stack0: 950,
        stack1: 950,
        history: "0:Bet50,1:Call"
    };

    // 1(a). Fold Payoff (P0 folds, P1 wins entire pot)
    const foldNodeP0 = new TerminalNode("term_fold0", mockState, false, 1);
    const foldPayoff0 = foldNodeP0.evaluatePayoff([], [], []);
    assert(foldPayoff0[0] === 0, "P0 folds, P0 should get 0 from pot");
    assert(foldPayoff0[1] === 100, "P0 folds, P1 should get 100 from pot");

    // 1(b). Showdown Payoff
    const showdownNode = new TerminalNode("term_sd", mockState, true, -1);

    // As Ah vs Ks Kh
    const heroCards = [makeCard(12, 3), makeCard(12, 2)]; // As Ah
    const villainCards = [makeCard(11, 3), makeCard(11, 2)]; // Ks Kh
    const boardCards = [makeCard(2, 0), makeCard(3, 0), makeCard(4, 0), makeCard(9, 1), makeCard(5, 2)]; // 2c 3c 4c Jd 7h

    const sdPayoff = showdownNode.evaluatePayoff(heroCards, villainCards, boardCards);
    assert(sdPayoff[0] === 100, "AsAh should beat KsKh");
    assert(sdPayoff[1] === 0, "KsKh should lose to AsAh");
}

// ----------------------------------------------------
// 2. Isomorphic Form / InfoSet Verification
// ----------------------------------------------------
function testInfoSetEncoding() {
    const historyA = "0:B50,1:C";
    const historyB = "0:B50,1:C";

    const boardA = [makeCard(12, 3), makeCard(11, 3), makeCard(10, 3)]; // AsKsQs
    const boardB = [makeCard(12, 3), makeCard(11, 3), makeCard(10, 3)];
    const boardC = [makeCard(12, 2), makeCard(11, 2), makeCard(10, 2)]; // AhKhQh

    const keyA = encodeInfoSetKey(historyA, boardA);
    const keyB = encodeInfoSetKey(historyB, boardB);
    const keyC = encodeInfoSetKey(historyA, boardC);

    assert(keyA === keyB, "Identical history and board should yield identical InfoSet Key");
    assert(keyA !== keyC, "Different boards should yield different InfoSet Keys (even if strategically isomorphic, engine distinguishes specific suits)");
}

// ----------------------------------------------------
// 3. Tree Traversal & Builder Mock Verification
// ----------------------------------------------------
function testTreeTraversalAndInfoSets() {
    const builder = new TreeBuilder({
        initialPot: 10,
        effectiveStack: 100,
        streets: ['PREFLOP'],
        betSizes: [1.0]
    });

    const rootNode = builder.buildTree(fullDeck());

    // Currently the mock TreeBuilder just returns a single Terminal Node
    const stats = traverseTreeStats(rootNode);

    assert(stats.totalNodes === 1, "Mock tree should have 1 node");
    assert(stats.terminalNodes === 1, "Mock tree root should be terminal");
    assert(stats.maxDepth === 0, "Mock tree depth should be 0");

    // Manually construct a tiny tree to test traversal
    const s1: GTOState = { board: emptyDeck(), pot: 10, stack0: 100, stack1: 100, history: "R" };
    const p0Node = new DecisionNode("n1", 0, s1, []);

    const s2: GTOState = { board: emptyDeck(), pot: 10, stack0: 100, stack1: 100, history: "R,0:X" };
    const p1Node = new DecisionNode("n2", 1, s2, []);

    const s3Term: GTOState = { board: emptyDeck(), pot: 10, stack0: 100, stack1: 100, history: "R,0:X,1:X" };
    const termNode = new TerminalNode("t1", s3Term, true, -1);

    p0Node.addChild({ type: ActionType.CheckCall, amount: 0 }, p1Node);
    p1Node.addChild({ type: ActionType.CheckCall, amount: 0 }, termNode);

    const stats2 = traverseTreeStats(p0Node);
    assert(stats2.totalNodes === 3, "Mini tree has 3 nodes");
    assert(stats2.decisionNodes === 2, "Mini tree has 2 decision nodes");
    assert(stats2.terminalNodes === 1, "Mini tree has 1 terminal node");

    const infoSets0 = gatherInfoSets(p0Node, 0);
    const infoSets1 = gatherInfoSets(p0Node, 1);

    assert(infoSets0.size === 1, "P0 should have 1 InfoSet");
    assert(infoSets1.size === 1, "P1 should have 1 InfoSet");
}
