import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  TrendingUp, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

export default function Dashboard({ token }) {
  const [metrics, setMetrics] = useState({ balance: 0, income: 0, expense: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // 1. Fetch transactions
      const txRes = await fetch('/api/transactions', { headers });
      if (!txRes.ok) throw new Error('Failed to load transactions');
      const transactions = await txRes.json();
      
      // Calculate metrics from all transactions
      let totalIncome = 0;
      let totalExpense = 0;
      transactions.forEach(t => {
        const amt = parseFloat(t.amount);
        if (t.type === 'income') {
          totalIncome += amt;
        } else {
          totalExpense += amt;
        }
      });
      
      setMetrics({
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense
      });
      
      setRecentTx(transactions.slice(0, 5));

      // 2. Fetch monthly trend analytics
      const monthlyRes = await fetch('/api/analytics/monthly', { headers });
      if (monthlyRes.ok) {
        const mData = await monthlyRes.json();
        setMonthlyData(mData);
      }

      // 3. Fetch expense category breakdown
      const catRes = await fetch('/api/analytics/category?type=expense', { headers });
      if (catRes.ok) {
        const cData = await catRes.json();
        setCategoryData(cData);
      }

    } catch (err) {
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your financial performance</p>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-sub)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} />
          <span>Last Updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Net Balance</span>
            <div className="metric-icon balance">
              <Wallet size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: metrics.balance >= 0 ? 'var(--color-text-main)' : 'var(--color-expense)' }}>
            {formatCurrency(metrics.balance)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Income</span>
            <div className="metric-icon income">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--color-income)' }}>
            {formatCurrency(metrics.income)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Expenses</span>
            <div className="metric-icon expense">
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--color-expense)' }}>
            {formatCurrency(metrics.expense)}
          </div>
        </div>
      </div>

      {recentTx.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <TrendingUp size={48} className="empty-state-icon" />
            <h3>No Transactions Tracked Yet</h3>
            <p style={{ marginTop: '8px', maxWidth: '400px' }}>
              Add your first transaction in the "Transactions" tab to generate visual trends and summaries.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Visualizations Section */}
          <div className="layout-columns" style={{ marginBottom: '24px' }}>
            <div className="card">
              <h2 className="card-title">Monthly Trend</h2>
              <div className="chart-container-inner">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fill: 'var(--color-text-sub)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--color-text-sub)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          fontFamily: 'inherit'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="income" name="Income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <p style={{ color: 'var(--color-text-muted)' }}>Not enough data for trend</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Expense Categories</h2>
              <div className="chart-container-inner">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          fontFamily: 'inherit'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <p style={{ color: 'var(--color-text-muted)' }}>No expense data</p>
                  </div>
                )}
              </div>
              
              {/* Category Color Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', maxHeight: '100px', overflowY: 'auto' }}>
                {categoryData.slice(0, 4).map((entry, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ backgroundColor: entry.color, width: '10px', height: '10px', borderRadius: '50%' }}></span>
                      <span style={{ color: 'var(--color-text-sub)', fontWeight: '500' }}>{entry.name}</span>
                    </div>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Transactions List */}
          <div className="card">
            <h2 className="card-title">Recent Transactions</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: '500' }}>{tx.date}</td>
                      <td>{tx.description || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No description</span>}</td>
                      <td>
                        <span className="category-tag">
                          <span 
                            className="category-dot" 
                            style={{ backgroundColor: tx.category_color || '#94a3b8' }}
                          ></span>
                          {tx.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${tx.type}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td 
                        style={{ 
                          fontWeight: '700', 
                          color: tx.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'
                        }}
                      >
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
