import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'https://okx-tracker-backend.onrender.com/api';

function App() {
  const [balance, setBalance] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [positionsExpanded, setPositionsExpanded] = useState(
    localStorage.getItem('positionsExpanded') === 'false' ? false : true
  );
  const [historyExpanded, setHistoryExpanded] = useState(
    localStorage.getItem('historyExpanded') === 'false' ? false : true
  );

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'false') setIsDarkMode(false);
    else setIsDarkMode(true);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };

  const fetchBalance = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/balance`);
      setBalance(response.data);
    } catch (error) {
      console.error('잔고 조회 실패:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions`);
      setPositions(response.data.data || []);
    } catch (error) {
      console.error('포지션 조회 실패:', error);
    }
  };

  const fetchPositionHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions-history?limit=50`);
      
      if (response.data && response.data.data?.length > 0) {
        console.log('포지션 히스토리 데이터:', response.data.data);
        // ✅ 실제 데이터 구조에 맞게 변환
        const formattedHistory = response.data.data.map((item: any) => ({
          instId: item.instId || 'N/A',
          posSide: item.direction || 'unknown',
          openTime: item.openTime || item.cTime, // cTime을 openTime으로 사용
          closeTime: item.cTime, // cTime을 closeTime으로 사용
          openAvgPx: item.openAvgPx || '0',
          closeAvgPx: item.closeAvgPx || '0',
          realizedPnl: item.realizedPnl || '0',
          sz: item.closeTotalPos || '0'
        }));
        setPositionHistory(formattedHistory);
        return;
      }
    } catch (error) {
      console.log('포지션 히스토리 실패:', error);
    }

    try {
      const response = await axios.get(`${API_BASE}/account/fills?limit=100`);
      if (response.data?.data) {
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
      }
    } catch (error) {
      console.log('체결 내역 실패:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchBalance(), fetchPositions(), fetchPositionHistory()]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 120000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // ✅ 수정된 formatTime 함수
  const formatTime = (timestamp: any): string => {
    if (!timestamp && timestamp !== 0) return '-';
    
    try {
      let timeValue: number;

      if (typeof timestamp === 'string') {
        timeValue = parseInt(timestamp);
      } else if (typeof timestamp === 'number') {
        timeValue = timestamp;
      } else {
        return '-';
      }
      
      if (isNaN(timeValue) || timeValue <= 0) return '-';
      
      // 밀리초 단위 확인 및 변환
      if (timeValue < 1000000000000) {
        timeValue = timeValue * 1000;
      }
      
      const date = new Date(timeValue);
      
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleString('ko-KR', {
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      });
    } catch (error) {
      console.error('시간 변환 오류:', timestamp);
      return '-';
    }
  };

  const formatInstrument = (instId: string) => instId?.replace('-USDT-SWAP', 'USDT Perp').replace('-', '') || '-';

  if (loading) {
    return (
      <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        <div className="loading-screen">
          데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  const depositAmount = 464.97;
  const totalBalance = parseFloat(balance?.data?.[0]?.totalEq || 0);
  const totalUnrealizedPnl = totalBalance - depositAmount;
  const profitPercentage = (totalUnrealizedPnl / depositAmount) * 100;

  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="dashboard-header">
        <div className="logo-section">
          <h1 className="logo">뚝딱홀딩스</h1>
          <span className="logo-subtitle">Trading Dashboard</span>
        </div>
        <div className="mode-toggle-section">
          <button className="mode-toggle-btn" onClick={toggleDarkMode}>
            {isDarkMode ? '🔆 라이트 모드' : '🌙 다크 모드'}
          </button>
        </div>
      </div>

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

      <div className="section-card">
        <div className="section-header">
          <h2>Active Positions ({positions.length})</h2>
          <button
            className="toggle-btn"
            onClick={() => {
              const newState = !positionsExpanded;
              setPositionsExpanded(newState);
              localStorage.setItem('positionsExpanded', newState.toString());
            }}
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
              {positions.map((p, i) => (
                <div key={i} className="table-row">
                  <div>{formatInstrument(p.instId)}</div>
                  <div>{formatTime(p.cTime)}</div>
                  <div>${formatNumber(parseFloat(p.avgPx || 0))}</div>
                  <div>${formatNumber(parseFloat(p.markPx || 0))}</div>
                  <div className={`side ${p.posSide?.toLowerCase()}`}>{p.posSide}</div>
                  <div>{p.lever || 1}x</div>
                  <div>${formatNumber(parseFloat(p.liqPx || 0))}</div>
                  <div>${formatNumber(parseFloat(p.margin || 0))}</div>
                  <div className={parseFloat(p.upl || 0) >= 0 ? 'profit' : 'loss'}>
                    {parseFloat(p.upl || 0) >= 0 ? '+' : ''}{formatNumber(parseFloat(p.upl || 0))} USDT
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-header">
          <h2>Position History ({positionHistory.length})</h2>
          <button
            className="toggle-btn"
            onClick={() => {
              const newState = !historyExpanded;
              setHistoryExpanded(newState);
              localStorage.setItem('historyExpanded', newState.toString());
            }}
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
              {positionHistory.map((h, i) => (
                <div key={i} className="table-row">
                  <div>{formatTime(h.openTime)}</div>
                  <div>{formatTime(h.closeTime)}</div>
                  <div>{formatInstrument(h.instId)}</div>
                  <div className={`side ${h.posSide?.toLowerCase()}`}>{h.posSide}</div>
                  <div>${formatNumber(parseFloat(h.openAvgPx || 0))}</div>
                  <div>${formatNumber(parseFloat(h.closeAvgPx || 0))}</div>
                  <div className={parseFloat(h.realizedPnl || 0) >= 0 ? 'profit' : 'loss'}>
                    {parseFloat(h.realizedPnl || 0) >= 0 ? '+' : ''}{formatNumber(parseFloat(h.realizedPnl || 0))} USDT
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="refresh-section">
        <button onClick={fetchAllData} className="refresh-btn">🔄 수동 업데이트</button>
        <div className="last-updated">
          Last updated: {lastUpdated.toLocaleString('ko-KR')}
          <span style={{ marginLeft: '10px', color: '#888' }}>(2분마다 자동 업데이트)</span>
        </div>
      </div>
    </div>
  );
}

export default App;