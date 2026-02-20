'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, OpponentType, EquityResult, HandRank } from '@/lib/poker/pro-types';

// Worker 消息类型定义
interface ProgressUpdate {
  type: 'progress';
  progress: number;
  currentWins: number;
  currentTies: number;
  currentLosses: number;
  currentSimulations: number;
}

interface SimulationComplete {
  type: 'complete';
  win: number;
  tie: number;
  lose: number;
  simulations: number;
  confidence: number;
  handRank?: HandRank;
  outs?: number;
}

type WorkerResponse = ProgressUpdate | SimulationComplete;

// Hook 返回类型
interface UseSimulationWorkerReturn {
  equityResult: EquityResult | null;
  isSimulating: boolean;
  progress: number;
  error: string | null;
  runSimulation: (
    playerHand: Card[],
    communityCards: Card[],
    opponentType: OpponentType,
    opponentCount: number,
    simulations: number
  ) => void;
  cancelSimulation: () => void;
  progressDetail: {
    wins: number;
    ties: number;
    losses: number;
    currentSimulations: number;
  } | null;
}

/**
 * Web Worker Hook - 蒙特卡洛模拟
 * 
 * 核心优化：
 * 1. 每次计算前强制 terminate 旧 Worker，防止丧尸任务排队
 * 2. UI 永不阻塞，Loading 动画流畅运行
 * 3. 实时进度更新，可随时取消
 */
export function useSimulationWorker(): UseSimulationWorkerReturn {
  const [equityResult, setEquityResult] = useState<EquityResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<{
    wins: number;
    ties: number;
    losses: number;
    currentSimulations: number;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // 运行模拟
  const runSimulation = useCallback(
    (
      playerHand: Card[],
      communityCards: Card[],
      opponentType: OpponentType,
      opponentCount: number,
      simulations: number
    ) => {
      // ============================================
      // 【防卡顿核心1】每次计算前，一枪崩掉旧的 Worker
      // 防止丧尸任务排队卡死通道
      // ============================================
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // 新建一个干净的 Worker 专属此次计算
      const worker = new Worker('/simulation-worker.js');
      workerRef.current = worker;

      // 错误处理
      worker.onerror = (event) => {
        console.error('Worker error:', event);
        setError('模拟计算出错，请重试');
        setIsSimulating(false);
      };

      // 消息处理
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === 'progress') {
          // 进度更新
          setProgress(data.progress);
          setProgressDetail({
            wins: data.currentWins,
            ties: data.currentTies,
            losses: data.currentLosses,
            currentSimulations: data.currentSimulations
          });
        } else if (data.type === 'complete') {
          // 模拟完成
          setEquityResult({
            win: data.win,
            tie: data.tie,
            lose: data.lose,
            simulations: data.simulations,
            confidence: data.confidence,
            handRank: data.handRank,
            outs: data.outs
          });
          setIsSimulating(false);
          setProgress(100);
          setProgressDetail(null);
        }
      };

      // 验证输入
      if (!playerHand || playerHand.length !== 2) {
        setError('请选择有效的手牌');
        return;
      }

      // 重置状态
      setIsSimulating(true);
      setProgress(0);
      setError(null);
      setEquityResult(null);
      setProgressDetail(null);

      // 立即发送请求到 Worker
      worker.postMessage({
        type: 'simulate',
        playerHand,
        communityCards: communityCards || [],
        opponentType,
        opponentCount,
        simulations
      });
    },
    []
  );

  // 取消模拟
  const cancelSimulation = useCallback(() => {
    if (workerRef.current) {
      // 终止当前 Worker
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setIsSimulating(false);
    setProgress(0);
    setProgressDetail(null);
  }, []);

  return {
    equityResult,
    isSimulating,
    progress,
    error,
    runSimulation,
    cancelSimulation,
    progressDetail
  };
}
