import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'https://okx-tracker-backend.onrender.com/api';

function App() {
  const [balance, setBalance] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>({ data: [], totalDeposit: 0, totalWithdrawal: 0, netDeposit: 0 });
  const [loading, setLoading] = useState(true);

  // 입력 폼 상태
  const [cashflowInput, setCashflowInput] = useState({
    amount: '',
    type: 'deposit',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const [positionsExpanded, setPositionsExpanded] = useState(localStorage.getItem('positionsExpanded') !== 'false');
  const [historyExpanded, setHistoryExpanded] = useState(localStorage.getItem('historyExpanded') !== 'false');
  const [cashflowExpanded, setCashflowExpanded] = useState(localStorage.getItem('cashflowExpanded') !== 'false');

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    setIsDarkMode(saved !== 'false');
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
    } catch (error) { console.error('잔고 조회 실패:', error); }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions`);
      setPositions(response.data.data || []);
    } catch (error) { console.error('포지션 조회 실패:', error); }
  };

  const fetchPositionHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/positions-history?limit=10`);
      if (response.data?.data?.length > 0) {
        setPositionHistory(response.data.data);
      }
    } catch (error) { console.log('포지션 히스토리 실패:', error); }
  };

  // 🆕 입출금 내역 가져오기
  const fetchCashflow = async () => {
    try {
      const response = await axios.get(`${API_BASE}/account/cashflow`);
      setCashflow(response.data);
    } catch (error) { console.error('입출금 조회 실패:', error); }
  };

  // 🆕 입출금 내역 추가하기
  const handleCashflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/account/cashflow`, cashflowInput);
      setCashflowInput({ ...cashflowInput, amount: '', note: '' });
      fetchCashflow(); // 목록 새로고침
    } catch (error) { alert('저장 실패'); }
  };

  // 🆕 입출금 내역 삭제하기
  const handleCashflowDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE}/account/cashflow/${id}`);
      fetchCashflow();
    } catch (error) { alert('삭제 실패'); }
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchBalance(), fetchPositions(), fetchPositionHistory(), fetchCashflow()]);
      setLastUpdated(new Date());
    } catch (error) { console.error('데이터 불러오기 실패:', error); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 120000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp && timestamp !== 0) return '-';
    let timeValue = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    if (timeValue < 1000000000000) timeValue *= 1000;
    const date = new Date(timeValue);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatInstrument = (instId: string) => instId?.replace('-USDT-SWAP', 'USDT Perp').replace('-', '') || '-';

  if (loading) {
    return <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}><div className="loading-screen">데이터를 불러오는 중...</div></div>;
  }

  // 🧮 핵심 수익률 계산 로직 (순 입금액 기반)
  const totalBalance = parseFloat(balance?.data?.[0]?.totalEq || 0);
  const netDeposit = cashflow.netDeposit || 423.80; // 데이터 없으면 기본값 유지
  const totalProfit = totalBalance - netDeposit;
  const profitPercentage = netDeposit !== 0 ? (totalProfit / netDeposit) * 100 : 0;

  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="dashboard-header">
        <div className="logo-section">
          <h1 className="logo">뚝딱홀딩스</h1>
          <span className="logo-subtitle">Trading Dashboard</span>
        </div>
        <button className="mode-toggle-btn" onClick={toggleDarkMode}>
          {isDarkMode ? '🔆 라이트 모드' : '🌙 다크 모드'}
        </button>
      </div>

      <div className="account-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-label">Net Deposit (입금-출금)</div>
            <div className="summary-value">${formatNumber(netDeposit)}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Account Value</div>
            <div className="summary-value">${formatNumber(totalBalance)}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total P&L (실시간 수익)</div>
            <div className={`summary-value ${totalProfit >= 0 ? 'profit' : 'loss'}`}>
              ${formatNumber(totalProfit)} ({profitPercentage >= 0 ? '+' : ''}{formatNumber(profitPercentage, 2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 1. 입출금 관리 섹션 (수정하기 가장 편한 위치) */}
      <div className="section-card">
        <div className="section-header">
          <h2>Cashflow Management (입출금 관리)</h2>
          <button className="toggle-btn" onClick={() => {
            const newState = !cashflowExpanded;
            setCashflowExpanded(newState);
            localStorage.setItem('cashflowExpanded', newState.toString());
          }}>{cashflowExpanded ? '▲' : '▼'}</button>
        </div>

        {cashflowExpanded && (
          <div className="cashflow-content">
            {/* 입력 폼 */}
            <form className="cashflow-form" onSubmit={handleCashflowSubmit}>
              <input type="date" value={cashflowInput.date} onChange={e => setCashflowInput({...cashflowInput, date: e.target.value})} required />
              <select value={cashflowInput.type} onChange={e => setCashflowInput({...cashflowInput, type: e.target.value})}>
                <option value="deposit">입금 (+)</option>
                <option value="withdrawal">출금 (-)</option>
              </select>
              <input type="number" placeholder="금액 ($)" value={cashflowInput.amount} onChange={e => setCashflowInput({...cashflowInput, amount: e.target.value})} required />
              <input type="text" placeholder="메모" value={cashflowInput.note} onChange={e => setCashflowInput({...cashflowInput, note: e.target.value})} />
              <button type="submit" className="add-btn">기록 추가</button>
            </form>

            {/* 내역 테이블 */}
            <div className="cashflow-table" style={{marginTop: '20px'}}>
              <div className="table-header">
                <div>Date</div>
                <div>Type</div>
                <div>Amount</div>
                <div>Note</div>
                <div>Action</div>
              </div>
              <div className="table-body">
                {cashflow.data.map((c: any) => (
                  <div key={c.id} className="table-row">
                    <div>{c.date}</div>
                    <div className={c.type === 'deposit' ? 'profit' : 'loss'}>{c.type.toUpperCase()}</div>
                    <div>${formatNumber(c.amount)}</div>
                    <div style={{fontSize: '0.9em', color: '#888'}}>{c.note || '-'}</div>
                    <div><button onClick={() => handleCashflowDelete(c.id)} className="delete-mini-btn">삭제</button></div>
                  </div>
                ))}
                {cashflow.data.length === 0 && <div className="no-data">기록된 입출금 내역이 없습니다.</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 기존 Active Positions 섹션 */}
      <div className="section-card">
        <div className="section-header">
          <h2>Active Positions ({positions.length})</h2>
          <button className="toggle-btn" onClick={() => {
            const newState = !positionsExpanded;
            setPositionsExpanded(newState);
            localStorage.setItem('positionsExpanded', newState.toString());
          }}>{positionsExpanded ? '▲' : '▼'}</button>
        </div>
        {positionsExpanded && (
          <div className="positions-table">
            <div className="table-header">
              <div>Instrument</div><div>Entry Time</div><div>Entry Price</div><div>Mark Price</div><div>Side</div><div>Leverage</div><div>Liquidation</div><div>Margin</div><div>Unrealized P&L</div>
            </div>
            <div className="table-body">
              {positions.map((p, i) => {
                const upl = parseFloat(p.upl || 0);
                const margin = parseFloat(p.margin || 0);
                return (
                  <div key={i} className="table-row">
                    <div>{formatInstrument(p.instId)}</div>
                    <div>{formatTime(p.cTime)}</div>
                    <div>${formatNumber(parseFloat(p.avgPx || 0))}</div>
                    <div>${formatNumber(parseFloat(p.markPx || 0))}</div>
                    <div className={`side ${p.posSide?.toLowerCase()}`}>{p.posSide}</div>
                    <div>{p.lever || 1}x</div>
                    <div>${formatNumber(parseFloat(p.liqPx || 0))}</div>
                    <div>${formatNumber(margin)}</div>
                    <div className={upl >= 0 ? 'profit' : 'loss'}>
                      ${formatNumber(upl)} ({upl >= 0 ? '+' : ''}{formatNumber(margin !== 0 ? (upl/margin)*100 : 0, 2)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 기존 Recent Histories 섹션 */}
      <div className="section-card">
        <div className="section-header">
          <h2>Most Recent 10 Position Histories</h2>
          <button className="toggle-btn" onClick={() => {
            const newState = !historyExpanded;
            setHistoryExpanded(newState);
            localStorage.setItem('historyExpanded', newState.toString());
          }}>{historyExpanded ? '▲' : '▼'}</button>
        </div>
        {historyExpanded && (
          <div className="positions-history-table">
            <div className="table-header">
              <div>Open Time</div><div>Close Time</div><div>Instrument</div><div>Side</div><div>Open Price</div><div>Close Price</div><div>Realized P&L</div>
            </div>
            <div className="table-body">
              {positionHistory.map((h, i) => {
                const realizedPnl = parseFloat(h.realizedPnl || 0);
                const pnlRatio = parseFloat(h.pnlRatio || 0) * 100;
                return (
                  <div key={i} className="table-row">
                    <div>{formatTime(h.openTime)}</div><div>{formatTime(h.closeTime)}</div>
                    <div>{formatInstrument(h.instId)}</div>
                    <div className={`side ${h.posSide?.toLowerCase()}`}>{h.posSide}</div>
                    <div>${formatNumber(parseFloat(h.openAvgPx || 0))}</div>
                    <div>${formatNumber(parseFloat(h.closeAvgPx || 0))}</div>
                    <div className={realizedPnl >= 0 ? 'profit' : 'loss'}>
                      ${formatNumber(realizedPnl)} ({realizedPnl >= 0 ? '+' : ''}{formatNumber(pnlRatio, 2)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="refresh-section">
        <button onClick={fetchAllData} className="refresh-btn">🔄 수동 업데이트</button>
        <div className="last-updated">Last updated: {lastUpdated.toLocaleString('ko-KR')}</div>
      </div>
    </div>
  );
}

export default App;
