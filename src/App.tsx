// App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [balance, setBalance] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionsExpanded, setPositionsExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // ✅ 간단하고 확실한 방법
  const [isDarkMode, setIsDarkMode] = useState(true);

  // ✅ 컴포넌트 마운트 시 무조건 localStorage 확인
  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    console.log('🚀 앱 시작 - localStorage 값:', saved);
    if (saved === 'false') {
      console.log('🔁 라이트 모드로 설정');
      setIsDarkMode(false);
    } else {
      console.log('🔁 다크 모드로 설정');
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    console.log('🔄 모드 변경:', newMode ? '다크모드' : '라이트모드');
    setIsDarkMode(newMode);
    
    // 간단하게 문자열로 저장
    localStorage.setItem('darkMode', newMode.toString());
    console.log('💾 저장 완료:', localStorage.getItem('darkMode'));
  };

  // 잔고 조회
  const fetchBalance = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/balance`);
      setBalance(response.data);
    } catch (error: any) {
      console.error('잔고 조회 실패:', error);
    }
  };

  // 현재 포지션 조회
  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions`);
      setPositions(response.data.data || []);
    } catch (error: any) {
      console.error('포지션 조회 실패:', error);
    }
  };

  // 포지션 히스토리 조회
  const fetchPositionHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions-history?limit=50`);
      
      if (response.data && response.data.data && response.data.data.length > 0) {
        setPositionHistory(response.data.data);
        return;
      }
    } catch (error: any) {
      console.log('포지션 히스토리 실패:', error.message);
    }

    // 포지션 히스토리 실패 시 체결 내역으로 대체
    try {
      const response = await axios.get(`${API_BASE}/account/fills?limit=100`);
      
      if (response.data && response.data.data) {
        const convertedHistory = response.data.data
          .filter((fill: any) => fill.state === 'filled')
          .map((fill: any) => ({
            instId: fill.instId,
            posSide: fill.side === 'buy' ? 'long' : 'short',
            openTime: fill.cTime,
            closeTime: fill.uTime,
            openAvgPx: fill.fillPx,
            closeAvgPx: fill.fillPx,
            realizedPnl: fill.pnl || fill.fee || '0',
            sz: fill.fillSz,
            tradeId: fill.tradeId,
            orderId: fill.ordId
          }));
        
        setPositionHistory(convertedHistory);
        return;
      }
    } catch (error: any) {
      console.log('체결 내역 실패:', error.message);
    }

    setPositionHistory([]);
  };

  // 모든 데이터 불러오기
  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBalance(),
        fetchPositions(),
        fetchPositionHistory()
      ]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
    }
    setLoading(false);
  };

  // 컴포넌트 마운트 시 데이터 불러오기
  useEffect(() => {
    fetchAllData();

    // ✅ 2분(120초)마다 자동 업데이트
    const interval = setInterval(() => {
      fetchAllData();
    }, 120000); //120000ms = 2분

    return () => clearInterval(interval);
  }, []);

  // 시간 포맷팅 함수
  const formatDetailedTime = (timestamp: string) => {
    if (!timestamp) return '-';
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 진입 시간 계산 함수
  const calculateEntryTime = (position: any) => {
    if (position.cTime || position.openTime) {
      const timestamp = position.cTime || position.openTime;
      const date = new Date(parseInt(timestamp));
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    return new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 숫자 포맷팅 함수
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // 수익률 계산 함수
  const calculateProfitPercentage = (position: any) => {
    const upl = parseFloat(position.upl || position.realizedPnl || 0);
    const margin = parseFloat(position.margin || position.imr || 1);
    
    if (margin > 0) {
      return (upl / margin) * 100;
    }
    return 0;
  };

  // 심볼 포맷팅 함수
  const formatInstrument = (instId: string) => {
    if (!instId) return '-';
    return instId.replace('-USDT-SWAP', 'USDT Perp')
                .replace('-', '');
  };

  // 정확한 수익률 계산 함수 (포지션 히스토리용)
  const calculateRealizedPnlPercent = (history: any) => {
    const realizedPnl = parseFloat(history.realizedPnl || history.pnl || 0);
    
    if (history.realizedPnlRatio !== undefined) {
      return parseFloat(history.realizedPnlRatio) * 100;
    } else if (history.pnlRatio !== undefined) {
      return parseFloat(history.pnlRatio) * 100;
    } else if (history.openAvgPx && history.closeAvgPx && history.sz) {
      const openPrice = parseFloat(history.openAvgPx);
      const closePrice = parseFloat(history.closeAvgPx);
      const size = parseFloat(history.sz);
      const leverage = parseFloat(history.lever || 1);
      
      if (openPrice > 0 && size > 0) {
        if (history.posSide === 'long') {
          const profit = (closePrice - openPrice) * size;
          const investment = (openPrice * size) / leverage;
          return (profit / investment) * 100;
        } else if (history.posSide === 'short') {
          const profit = (openPrice - closePrice) * size;
          const investment = (openPrice * size) / leverage;
          return (profit / investment) * 100;
        }
      }
    } else if (history.margin && realizedPnl !== 0) {
      const margin = parseFloat(history.margin);
      if (margin > 0) {
        return (realizedPnl / margin) * 100;
      }
    }
    
    return 0;
  };

  if (loading) {
    return (
      <div className={`App trading-dashboard ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        <div className="loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  // 입금액 (2025-11-04 13:52 기준)
  const depositAmount = 464.97;
  
  const totalBalance = balance ? parseFloat(balance.data?.[0]?.totalEq || 0) : 0;
  const totalUnrealizedPnl = totalBalance - depositAmount;
  const profitPercentage = (totalUnrealizedPnl / depositAmount) * 100;

  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="trading-dashboard">
        {/* ✅ 상단 헤더에 로고와 모드 토글 버튼 추가 */}
        <div className="dashboard-header">
          <div className="logo-section">
            <h1 className="logo">뚝딱홀딩스</h1>
            <span className="logo-subtitle">Trading Dashboard</span>
          </div>
          <div className="mode-toggle-section">
            <button 
              className="mode-toggle-btn"
              onClick={toggleDarkMode}
              title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDarkMode ? '🔆 라이트 모드' : '🌙 다크 모드'}
            </button>
          </div>
        </div>

        {/* 상단 계정 요약 */}
        <div className="account-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-label">Deposit<br />원/달러환율 - 1440:1 / Upbit-OKX 김치프리미엄 - 4.44% (2025-11-04 13:52)</div>
              <div className="summary-value">${formatNumber(depositAmount)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Account Value</div>
              <div className="summary-value">${formatNumber(totalBalance)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total P&L</div>
              <div className={`summary-value ${totalUnrealizedPnl >= 0 ? 'profit' : 'loss'}`}>
                ${formatNumber(totalUnrealizedPnl)} ({profitPercentage >= 0 ? '+' : ''}{formatNumber(profitPercentage, 2)}%)
              </div>
            </div>
          </div>
        </div>

        {/* ✅ 변경: 메인 컨텐츠 구조 단순화 */}
        <div className="main-content-full">
          {/* 현재 포지션 현황 */}
          <div className="section-card">
            <div className="section-header">
              <h2>Active Positions ({positions.length})</h2>
              <button 
                className="toggle-btn"
                onClick={() => setPositionsExpanded(!positionsExpanded)}
              >
                {positionsExpanded ? '▲' : '▼'}
              </button>
            </div>
            
            {positionsExpanded && (
              <div className="positions-table">
                <div className="table-header">
                  <div>Instrument</div>
                  <div>Entry Time</div>
                  <div>Entry Price</div>
                  <div>Mark Price</div>
                  <div>Side</div>
                  <div>Leverage</div>
                  <div>Liquidation Price</div>
                  <div>Margin</div>
                  <div>Unrealized P&L</div>
                </div>
                <div className="table-body">
                  {positions.length > 0 ? (
                    positions.map((position, index) => {
                      const entryPrice = parseFloat(position.avgPx || position.openAvgPx || 0);
                      const markPrice = parseFloat(position.markPx || position.markPrice || entryPrice);
                      const upl = parseFloat(position.upl || 0);
                      const profitPercent = calculateProfitPercentage(position);
                      
                      return (
                        <div key={index} className="table-row">
                          <div className="instrument">{formatInstrument(position.instId)}</div>
                          <div>{calculateEntryTime(position)}</div>
                          <div>${formatNumber(entryPrice)}</div>
                          <div>${formatNumber(markPrice)}</div>
                          <div className={`side ${position.posSide?.toLowerCase()}`}>
                            {position.posSide}
                          </div>
                          <div>{parseFloat(position.lever || 1)}X</div>
                          <div className="liquidation">
                            ${formatNumber(parseFloat(position.liqPx || position.liqPrice || 0))}
                          </div>
                          <div>${formatNumber(parseFloat(position.margin || position.imr || 0))}</div>
                          <div className={upl >= 0 ? 'profit' : 'loss'}>
                            {upl >= 0 ? '+' : ''}{formatNumber(upl)} USDT ({upl >= 0 ? '+' : ''}{formatNumber(profitPercent, 2)}%)
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data">No active positions</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 포지션 히스토리 */}
          <div className="section-card">
            <div className="section-header">
              <h2>Position History ({positionHistory.length})</h2>
              <button 
                className="toggle-btn"
                onClick={() => setHistoryExpanded(!historyExpanded)}
              >
                {historyExpanded ? '▲' : '▼'}
              </button>
            </div>
            
            {historyExpanded && (
              <div className="positions-history-table">
                <div className="table-header">
                  <div>Open Time</div>
                  <div>Close Time</div>
                  <div>Instrument</div>
                  <div>Side</div>
                  <div>Open Price</div>
                  <div>Close Price</div>
                  <div>Realized P&L</div>
                </div>
                <div className="table-body">
                  {positionHistory.length > 0 ? (
                    positionHistory.map((history, index) => {
                      const realizedPnl = parseFloat(history.realizedPnl || history.pnl || 0);
                      const realizedPnlPercent = calculateRealizedPnlPercent(history);
                      
                      return (
                        <div key={index} className="table-row">
                          <div>{formatDetailedTime(history.openTime || history.cTime)}</div>
                          <div>{formatDetailedTime(history.closeTime || history.uTime)}</div>
                          <div className="instrument">{formatInstrument(history.instId)}</div>
                          <div className={`side ${history.posSide?.toLowerCase()}`}>
                            {history.posSide}
                          </div>
                          <div>${formatNumber(parseFloat(history.openAvgPx || history.avgPx || 0))}</div>
                          <div>${formatNumber(parseFloat(history.closeAvgPx || history.closePx || 0))}</div>
                          <div className={realizedPnl >= 0 ? 'profit' : 'loss'}>
                            {realizedPnl >= 0 ? '+' : ''}{formatNumber(realizedPnl)} USDT ({realizedPnl >= 0 ? '+' : ''}{formatNumber(realizedPnlPercent, 2)}%)
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-data">No position history available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 새로고침 섹션 */}
        <div className="refresh-section">
          <button onClick={fetchAllData} className="refresh-btn">
            🔄 수동 업데이트
          </button>
          <div className="last-updated">
            Last updated: {lastUpdated.toLocaleString('ko-KR')}
            <span style={{marginLeft: '10px', color: '#666', fontSize: 'em'}}>
              (2분마다 자동 업데이트)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;