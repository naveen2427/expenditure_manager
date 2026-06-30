import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, PlusCircle, Filter } from 'lucide-react';

const COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899', 
  '#8B5CF6', '#3B82F6', '#06B6D4', '#14B8A6', '#84CC16',
  '#6B7280', '#D946EF', '#6366F1'
];

export default function Transactions({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering States
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Add Custom Category Form inside modal
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error loading categories", err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let url = '/api/transactions?';
      
      if (filterType) url += `type=${filterType}&`;
      if (filterCategory) url += `category_id=${filterCategory}&`;
      if (filterStart) url += `start_date=${filterStart}&`;
      if (filterEnd) url += `end_date=${filterEnd}&`;
      if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
      
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Could not fetch transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTransactions();
      fetchCategories();
    }
  }, [token, filterType, filterCategory, filterStart, filterEnd]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setAmount('');
    setTxType('expense');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setShowCatForm(false);
    
    // Pick first category of that type
    const defaultCats = categories.filter(c => c.type === 'expense');
    setCategoryId(defaultCats.length > 0 ? defaultCats[0].id : '');
    
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tx) => {
    setEditingId(tx.id);
    setAmount(tx.amount);
    setTxType(tx.type);
    setCategoryId(tx.category_id || '');
    setDescription(tx.description || '');
    setDate(tx.date);
    setShowCatForm(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCatName.trim(),
          type: txType,
          color: newCatColor
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      setCategories([...categories, data]);
      setCategoryId(data.id);
      setNewCatName('');
      setShowCatForm(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    const payload = {
      amount: parseFloat(amount),
      type: txType,
      category_id: categoryId ? parseInt(categoryId) : null,
      description: description.trim(),
      date
    };

    try {
      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/api/transactions/${editingId}` : '/api/transactions';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save transaction');
      }

      if (editingId) {
        setTransactions(transactions.map(t => t.id === editingId ? data : t));
      } else {
        setTransactions([data, ...transactions]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  // Keep category select dropdown updated when type changes
  const handleTypeChange = (newType) => {
    setTxType(newType);
    const filtered = categories.filter(c => c.type === newType);
    setCategoryId(filtered.length > 0 ? filtered[0].id : '');
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(val);
  };

  // Filter category options depending on type
  const transactionCategories = categories.filter(c => c.type === txType);

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Track and organize your cash flow</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} className="filter-bar">
          <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
            <span className="filter-label">Search Description</span>
            <div style={{ position: 'relative', display: 'flex' }}>
              <input
                type="text"
                className="filter-input"
                style={{ width: '100%', paddingRight: '40px' }}
                placeholder="Search description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn-icon" 
                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Type</span>
            <select 
              className="filter-input" 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-label">Category</span>
            <select 
              className="filter-input" 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.type.toUpperCase()}] {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-label">Start Date</span>
            <input
              type="date"
              className="filter-input"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">End Date</span>
            <input
              type="date"
              className="filter-input"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
          </div>

          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', height: '38px' }}
            onClick={() => {
              setFilterType('');
              setFilterCategory('');
              setFilterStart('');
              setFilterEnd('');
              setSearchTerm('');
              // Quick reset fetch
              setTimeout(() => {
                fetchTransactions();
              }, 50);
            }}
          >
            Reset
          </button>
        </form>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Ledger Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <Filter size={40} className="empty-state-icon" />
            <h3>No Transactions Found</h3>
            <p style={{ marginTop: '8px' }}>Try widening your search terms or filter criteria.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: '600' }}>{tx.date}</td>
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
                        textAlign: 'right',
                        color: tx.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleOpenEdit(tx)}
                          title="Edit transaction"
                        >
                          <Edit2 size={15} style={{ color: 'var(--color-text-sub)' }} />
                        </button>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleDelete(tx.id)}
                          title="Delete transaction"
                        >
                          <Trash2 size={15} style={{ color: 'var(--color-expense)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Entry Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '500' }}>
                    <input 
                      type="radio" 
                      name="txType" 
                      value="expense" 
                      checked={txType === 'expense'} 
                      onChange={() => handleTypeChange('expense')}
                    />
                    Expense
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '500' }}>
                    <input 
                      type="radio" 
                      name="txType" 
                      value="income" 
                      checked={txType === 'income'} 
                      onChange={() => handleTypeChange('income')}
                    />
                    Income
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="amount">Amount (₹)</label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: '0' }}>Category</label>
                  <button 
                    type="button" 
                    className="auth-toggle-link" 
                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '0' }}
                    onClick={() => setShowCatForm(!showCatForm)}
                  >
                    <PlusCircle size={14} />
                    <span>{showCatForm ? 'Cancel' : 'New Category'}</span>
                  </button>
                </div>

                {showCatForm ? (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Subscriptions"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <span className="form-label" style={{ fontSize: '0.75rem' }}>Select Theme Color</span>
                      <div className="category-dots-list">
                        {COLORS.map((col, index) => (
                          <div 
                            key={index} 
                            className={`color-dot-btn ${newCatColor === col ? 'selected' : ''}`}
                            style={{ backgroundColor: col }}
                            onClick={() => setNewCatColor(col)}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={handleCreateCategory}
                    >
                      Save Category
                    </button>
                  </div>
                ) : (
                  <select 
                    className="form-input" 
                    value={categoryId} 
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Uncategorized</option>
                    {transactionCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="description">Description</label>
                <input
                  id="description"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Weekly grocery shopping"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save Changes' : 'Create Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
