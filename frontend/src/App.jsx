import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ReceiptText, BarChart3, LogOut, Wallet } from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reports from './components/Reports';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Validate session token on startup
  useEffect(() => {
    const validateSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

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
          // Token expired or invalid, logout client-side
          handleLogout();
        }
      } catch (err) {
        console.error("Error validating session", err);
        // Keep session for offline state but stop loading
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, [token]);

  const handleLoginSuccess = (newToken, loggedUser) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(loggedUser);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error("Logout request failed", err);
      }
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: '48px', height: '48px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Wallet size={24} />
          </div>
          <p style={{ fontWeight: '500', color: 'var(--color-text-sub)' }}>Validating Session...</p>
        </div>
      </div>
    );
  }

  // If no authenticated user, show registration/login page
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

        {/* Logged in User Status */}
        <div className="user-profile-section">
          <div className="user-info">
            <span className="username">{user.username}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
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
