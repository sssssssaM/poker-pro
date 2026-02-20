// ============================================
// 德州扑克专业引擎 — 7 张牌评估器
// ============================================
// 输入: 7 个 CardIndex (0-51)
// 输出: 可比较整数 (高 = 强)
//
// 手牌分类 * 基数:
//   8: Straight Flush  8_000_000 + highCard
//   7: Four of a Kind  7_000_000 + quadRank*15 + kicker
//   6: Full House      6_000_000 + tripRank*15 + pairRank
//   5: Flush           5_000_000 + 5 位 base-15 编码
//   4: Straight        4_000_000 + highCard
//   3: Three of a Kind 3_000_000 + tripRank*225 + k1*15 + k2
//   2: Two Pair        2_000_000 + hi*225 + lo*15 + kicker
//   1: One Pair        1_000_000 + pairRank*3375 + k1*225 + k2*15 + k3
//   0: High Card       0          + 5 位 base-15 编码

import type { CardIndex } from './types';

// 工作缓冲区 — 避免每次调用分配
const _rc = new Int8Array(13);  // rank counts
const _sc = new Int8Array(4);   // suit counts
const _sr0: number[] = [];      // suit 0 ranks
const _sr1: number[] = [];
const _sr2: number[] = [];
const _sr3: number[] = [];
const _suitRanks = [_sr0, _sr1, _sr2, _sr3];
const _has = new Uint8Array(14); // for straight detection

/**
 * 🔥 评估 7 张牌, 返回可比较整数 (越大越强)
 *
 * 完整支持 9 种牌型 + kicker 精确排名.
 * 使用 Int8Array 工作缓冲区, 零堆分配热路径.
 */
export function evaluate7(cards: CardIndex[]): number {
    // 清空缓冲区
    _rc.fill(0);
    _sc.fill(0);
    _sr0.length = 0;
    _sr1.length = 0;
    _sr2.length = 0;
    _sr3.length = 0;

    for (let i = 0; i < 7; i++) {
        const c = cards[i];
        const r = c >> 2;    // rank 0-12
        const s = c & 3;     // suit 0-3
        _rc[r]++;
        _sc[s]++;
        _suitRanks[s].push(r);
    }

    // === 找 flush suit ===
    let fSuit = -1;
    for (let s = 0; s < 4; s++) {
        if (_sc[s] >= 5) { fSuit = s; break; }
    }

    // === 找 straight (从所有 rank) ===
    const straightH = _findStraight(_rc);

    // === Straight Flush 检测 ===
    if (fSuit >= 0) {
        const sfH = _findStraightFromList(_suitRanks[fSuit]);
        if (sfH >= 0) {
            // Royal Flush (sfH === 12) 和 Straight Flush 共用分值区间
            return 8_000_000 + sfH;
        }
    }

    // === 多张计数 ===
    let quads = -1, trips1 = -1, trips2 = -1;
    const pairs: number[] = [];

    for (let r = 12; r >= 0; r--) {
        const cnt = _rc[r];
        if (cnt === 4) quads = r;
        else if (cnt === 3) { if (trips1 < 0) trips1 = r; else trips2 = r; }
        else if (cnt === 2) pairs.push(r);
    }

    // === Four of a Kind ===
    if (quads >= 0) {
        // Best kicker from remaining ranks
        let k = 0;
        for (let r = 12; r >= 0; r--) {
            if (r !== quads && _rc[r] > 0) { k = r; break; }
        }
        return 7_000_000 + quads * 15 + k;
    }

    // === Full House ===
    if (trips1 >= 0 && (pairs.length > 0 || trips2 >= 0)) {
        // Best pair (could be trips2 acting as pair)
        const bestPair = trips2 >= 0
            ? Math.max(trips2, pairs.length > 0 ? pairs[0] : -1)
            : pairs[0];
        return 6_000_000 + trips1 * 15 + bestPair;
    }

    // === Flush ===
    if (fSuit >= 0) {
        const fr = _suitRanks[fSuit];
        // Sort descending, take top 5
        fr.sort((a, b) => b - a);
        return 5_000_000 + _encode5(fr[0], fr[1], fr[2], fr[3], fr[4]);
    }

    // === Straight ===
    if (straightH >= 0) {
        return 4_000_000 + straightH;
    }

    // === Three of a Kind ===
    if (trips1 >= 0) {
        const kickers = _topKickers(2, trips1, -1);
        return 3_000_000 + trips1 * 225 + kickers[0] * 15 + kickers[1];
    }

    // === Two Pair ===
    if (pairs.length >= 2) {
        const kickers = _topKickers(1, pairs[0], pairs[1]);
        return 2_000_000 + pairs[0] * 225 + pairs[1] * 15 + kickers[0];
    }

    // === One Pair ===
    if (pairs.length === 1) {
        const kickers = _topKickers(3, pairs[0], -1);
        return 1_000_000 + pairs[0] * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2];
    }

    // === High Card ===
    const hc = _topKickers(5, -1, -1);
    return _encode5(hc[0], hc[1], hc[2], hc[3], hc[4]);
}

// ============================================
// 内部工具
// ============================================

/** 从 rank counts 找最高顺子的 high card, -1 = 无 */
function _findStraight(rc: Int8Array): number {
    _has.fill(0);
    for (let r = 0; r < 13; r++) {
        if (rc[r] > 0) _has[r] = 1;
    }
    // 检查 A-high(12) → 5-high(3)
    for (let top = 12; top >= 4; top--) {
        if (_has[top] && _has[top - 1] && _has[top - 2] && _has[top - 3] && _has[top - 4]) {
            return top;
        }
    }
    // Wheel: A-2-3-4-5 (high = 3, 代表 5)
    if (_has[12] && _has[0] && _has[1] && _has[2] && _has[3]) {
        return 3;
    }
    return -1;
}

/** 从 rank 列表找顺子 (用于同花顺检测) */
function _findStraightFromList(ranks: number[]): number {
    if (ranks.length < 5) return -1;
    _has.fill(0);
    for (const r of ranks) _has[r] = 1;
    for (let top = 12; top >= 4; top--) {
        if (_has[top] && _has[top - 1] && _has[top - 2] && _has[top - 3] && _has[top - 4]) {
            return top;
        }
    }
    if (_has[12] && _has[0] && _has[1] && _has[2] && _has[3]) {
        return 3;
    }
    return -1;
}

/** 获取 top N kickers (跳过 exclude1, exclude2) */
function _topKickers(n: number, exclude1: number, exclude2: number): number[] {
    const result: number[] = [];
    for (let r = 12; r >= 0 && result.length < n; r--) {
        if (r !== exclude1 && r !== exclude2 && _rc[r] > 0) {
            result.push(r);
        }
    }
    // 补零 (安全)
    while (result.length < n) result.push(0);
    return result;
}

/** 5 张牌 base-15 编码 (r0 > r1 > r2 > r3 > r4) */
function _encode5(r0: number, r1: number, r2: number, r3: number, r4: number): number {
    return r0 * 50625 + r1 * 3375 + r2 * 225 + r3 * 15 + r4;
}
