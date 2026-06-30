import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, PieChart, Info } from 'lucide-react';

export default function Reports({ token }) {
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    transactionCount: 0,
    averageExpense: 0,
    averageIncome: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all transactions to build overall statistics
      const txRes = await fetch('/api/transactions', { headers });
      const transactions = await txRes.json();

      // Fetch category summaries (grouped totals)
      const catRes = await fetch('/api/analytics/category?type=expense', { headers });
      const catData = await catRes.json();

      let incSum = 0;
      let expSum = 0;
      let incCount = 0;
      let expCount = 0;

      transactions.forEach(t => {
        const val = parseFloat(t.amount);
        if (t.type === 'income') {
          incSum += val;
          incCount++;
        } else {
          expSum += val;
          expCount++;
        }
      });

      setSummary({
        totalIncome: incSum,
        totalExpense: expSum,
        transactionCount: transactions.length,
        averageIncome: incCount > 0 ? (incSum / incCount) : 0,
        averageExpense: expCount > 0 ? (expSum / expCount) : 0
      });

      setCategories(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReportsData();
    }
  }, [token]);

  const handleExportCSV = () => {
    // Open in a new tab/window which triggers direct download of the CSV stream
    window.open(`/api/reports/export?token=${token}`, '_blank');
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <p>Loading Reports & Analytics...</p>
      </div>
    );
  }

  // Calculate savings rate
  const savingsRate = summary.totalIncome > 0 
    ? ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100 
    : 0;

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Reports & Exports</h1>
          <p className="page-subtitle">Export data and analyze financial statistics</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          <Download size={18} />
          <span>Export CSV Report</span>
        </button>
      </div>

      <div className="layout-columns" style={{ marginBottom: '24px' }}>
        {/* Statistics Sheet */}
        <div className="card">
          <h2 className="card-title">
            <Info size={20} style={{ color: 'var(--color-primary)' }} />
            Financial Breakdown Summary
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
            <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                Savings Rate
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: savingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                {savingsRate.toFixed(1)}%
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', marginTop: '4px' }}>
                Percentage of income saved this month
              </p>
            </div>

            <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                Transactions Count
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)' }}>
                {summary.transactionCount}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', marginTop: '4px' }}>
                Total transaction entries recorded
              </p>
            </div>

            <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                Avg. Income size
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-income)' }}>
                {formatCurrency(summary.averageIncome)}
              </h3>
            </div>

            <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                Avg. Expense size
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-expense)' }}>
                {formatCurrency(summary.averageExpense)}
              </h3>
            </div>
          </div>
        </div>

        {/* Quick Export Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 className="card-title">
              <FileSpreadsheet size={20} style={{ color: '#10B981' }} />
              Export Options
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-sub)', marginBottom: '16px' }}>
              Download a comprehensive ledger of all transactions. Compatible with spreadsheet processors like Microsoft Excel and Google Sheets.
            </p>
            <ul style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Includes dates, types, amounts, and category mappings.</li>
              <li>Includes custom transaction descriptions.</li>
              <li>Instantly generated from live database tables.</li>
            </ul>
          </div>

          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ width: '100%', marginTop: '24px' }}>
            <Download size={16} />
            Download CSV Report
          </button>
        </div>
      </div>

      {/* Category Totals Sheet */}
      <div className="card">
        <h2 className="card-title">
          <PieChart size={20} style={{ color: 'var(--color-primary)' }} />
          Expenses by Category
        </h2>
        
        {categories.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px' }}>
            No expense transactions found to categorize.
          </p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Total Expense Amount</th>
                  <th style={{ textAlign: 'right' }}>Percentage Share</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => {
                  const percentage = summary.totalExpense > 0 
                    ? (cat.value / summary.totalExpense) * 100 
                    : 0;
                  return (
                    <tr key={index}>
                      <td>
                        <span className="category-tag">
                          <span 
                            className="category-dot" 
                            style={{ backgroundColor: cat.color }}
                          ></span>
                          {cat.name}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--color-expense)' }}>
                        {formatCurrency(cat.value)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                          <span>{percentage.toFixed(1)}%</span>
                          <div style={{ width: '100px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: cat.color }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
