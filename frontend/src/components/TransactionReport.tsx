import React, { useState, useEffect } from 'react';
import { X, Download, Search, Filter, Calendar, CreditCard, User, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  _id: string;
  phone: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  amount: number;
  credits: number;
  paymentMode: string;
  status: string;
  transactionDate: string;
  packageId?: number;
  gstAmount?: number;
  totalAmount?: number;
}

interface TransactionSummary {
  phone: string;
  userName?: string;
  totalTransactions: number;
  totalAmount: number;
  totalCredits: number;
  lastTransaction: string;
  firstTransaction: string;
  currentCredits: number;
}

interface TransactionStats {
  totalTransactions: number;
  totalRevenue: number;
  totalCreditsSold: number;
  averageTransactionValue: number;
  uniqueUsers: number;
}

interface TransactionReportProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const TransactionReport: React.FC<TransactionReportProps> = ({ isOpen, onClose, isAdmin = false }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState<'transactions' | 'summary' | 'stats'>('transactions');
  const [searchPhone, setSearchPhone] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        if (currentView === 'transactions') {
          loadAllTransactions();
        } else if (currentView === 'summary') {
          loadSummary();
        } else if (currentView === 'stats') {
          loadStats();
        }
      } else {
        // Reset to transactions view for users
        setCurrentView('transactions');
        loadUserTransactions();
      }
    }
  }, [isOpen, isAdmin, currentView, currentPage, searchPhone]);

  // Reset view when switching between admin and user
  useEffect(() => {
    if (isOpen) {
      if (!isAdmin) {
        setCurrentView('transactions');
      }
    }
  }, [isOpen, isAdmin]);

  const loadUserTransactions = async () => {
    if (!user?.phone) return;
    
    setLoading(true);
    try {
      const response = await fetch(`https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/transactions/user/${user.phone}?page=${currentPage}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError('Failed to load transactions');
      }
    } catch (err) {
      setError('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadAllTransactions = async () => {
    setLoading(true);
    try {
      const url = new URL('https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/transactions/admin/all');
      url.searchParams.append('page', currentPage.toString());
      url.searchParams.append('limit', '20');
      if (searchPhone) {
        url.searchParams.append('phone', searchPhone);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalPages(data.pagination.totalPages);
      } else if (response.status === 403) {
        setError('Access denied. Admin role required.');
      } else {
        setError('Failed to load transactions');
      }
    } catch (err) {
      setError('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await fetch('https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/transactions/admin/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      } else if (response.status === 403) {
        setError('Access denied. Admin role required.');
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('https://ragamitra-backend-dev-873534819669.asia-south1.run.app/api/transactions/admin/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else if (response.status === 403) {
        setError('Access denied. Admin role required.');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const exportToCSV = () => {
    const csvData = transactions.map(t => ({
      'Transaction ID': t.razorpayPaymentId,
      'Phone': t.phone,
      'Amount': t.amount,
      'Credits': t.credits,
      'Payment Mode': t.paymentMode,
      'Status': t.status,
      'Date': formatDate(t.transactionDate)
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-7 h-7 text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">
                {isAdmin ? 'Transaction Reports' : 'My Transactions'}
              </h2>
              <p className="text-sm text-white/70">
                {isAdmin ? 'View all transaction data and analytics' : 'View your purchase history and transaction details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {isAdmin && (
          <div className="flex space-x-1 p-4 border-b border-white/20">
            <button
              onClick={() => setCurrentView('transactions')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentView === 'transactions'
                  ? 'bg-purple-600 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setCurrentView('summary')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentView === 'summary'
                  ? 'bg-purple-600 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              User Summary
            </button>
            <button
              onClick={() => setCurrentView('stats')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentView === 'stats'
                  ? 'bg-purple-600 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Statistics
            </button>
          </div>
        )}

        {/* Search and Filters - Admin Only */}
        {isAdmin && currentView === 'transactions' && (
          <div className="p-4 border-b border-white/20">
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  placeholder="Search by phone number..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={exportToCSV}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="ml-3 text-white/70">Loading...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
              {error}
            </div>
          )}

          {/* Transactions View */}
          {currentView === 'transactions' && !loading && (
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  {isAdmin ? 'No transactions found' : 'You have no transactions yet. Purchase credits to get started!'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {transactions.map((transaction) => (
                      <div key={transaction._id} className="card p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-white">
                                  {transaction.razorpayPaymentId}
                                </h3>
                                <p className="text-sm text-white/70">
                                  {transaction.phone} • {formatDate(transaction.transactionDate)}
                                </p>
                                <div className="flex items-center space-x-4 mt-1">
                                  <span className="text-sm text-purple-300">
                                    {transaction.credits} credits
                                  </span>
                                  <span className="text-sm text-green-400">
                                    {formatCurrency(transaction.amount)}
                                  </span>
                                  <span className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded">
                                    {transaction.paymentMode}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    transaction.status === 'completed' 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : 'bg-yellow-500/20 text-yellow-300'
                                  }`}>
                                    {transaction.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-6">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-white/70">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Summary View - Admin Only */}
          {isAdmin && currentView === 'summary' && !loading && (
            <div className="space-y-4">
              {summary.length === 0 ? (
                <div className="text-center py-8 text-white/70">
                  No user data found
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {summary.map((user, index) => (
                    <div key={user.phone} className="card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">
                              {user.userName || 'Unknown User'}
                            </h3>
                            <p className="text-sm text-white/70">{user.phone}</p>
                            <p className="text-xs text-white/60">
                              {user.totalTransactions} transactions • 
                              Last: {formatDate(user.lastTransaction)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-400">
                            {formatCurrency(user.totalAmount)}
                          </p>
                          <p className="text-sm text-white/70">
                            {user.totalCredits} credits
                          </p>
                          <p className="text-xs text-white/60">
                            Current: {user.currentCredits} credits
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats View - Admin Only */}
          {isAdmin && currentView === 'stats' && !loading && stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card p-6 text-center">
                <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-white">{stats.totalTransactions}</h3>
                <p className="text-white/70">Total Transactions</p>
              </div>
              <div className="card p-6 text-center">
                <CreditCard className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</h3>
                <p className="text-white/70">Total Revenue</p>
              </div>
              <div className="card p-6 text-center">
                <User className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-white">{stats.uniqueUsers}</h3>
                <p className="text-white/70">Unique Users</p>
              </div>
              <div className="card p-6 text-center">
                <TrendingUp className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <h3 className="text-2xl font-bold text-white">{formatCurrency(stats.averageTransactionValue)}</h3>
                <p className="text-white/70">Avg Transaction</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionReport;
