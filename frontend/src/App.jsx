import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ReceiptText, BarChart3, LogOut, Wallet } from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reports from './components/Reports';

export default function App() {
  const [token, setToken] = useState('single-user-session');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Validate session token on startup
  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Fallback user details if API fails or backend is initializing
          setUser({ username: 'Expenditure Manager', email: 'active' });
        }
      } catch (err) {
        console.error("Error validating session", err);
        setUser({ username: 'Expenditure Manager', email: 'active' });
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, [token]);

  const handleLoginSuccess = (newToken, loggedUser) => {
    setToken(newToken);
    setUser(loggedUser);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: '48px', height: '48px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Wallet size={24} />
          </div>
          <p style={{ fontWeight: '500', color: 'var(--color-text-sub)' }}>Loading Tracker...</p>
        </div>
      </div>
    );
  }

  // If no authenticated user, show registration/login page (fallback, though we default user above)
  if (!token || !user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">
            <Wallet size={20} />
          </div>
          <span className="brand-name">Expenditure Manager</span>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <ReceiptText size={18} />
            <span>Transactions</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={18} />
            <span>Reports & Exports</span>
          </button>
        </nav>

        {/* Simplified Branding footer */}
        <div className="user-profile-section" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="user-info">
            <span className="username">Expenditure Tracker</span>
            <span className="user-email">Single User Mode</span>
          </div>
        </div>
      </aside>

      {/* Main Dashboard Panel */}
      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard token={token} />}
        {activeTab === 'transactions' && <Transactions token={token} />}
        {activeTab === 'reports' && <Reports token={token} />}
      </main>
    </div>
  );
}
