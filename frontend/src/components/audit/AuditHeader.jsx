import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  X,
  Shield
} from 'lucide-react';

const AuditHeader = ({ 
  filters, 
  setFilters, 
  onRefresh, 
  onExport, 
  isRefreshing, 
  isExporting 
}) => {
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      category: '',
      status: '',
      date_range: '24h',
      page: 1
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, val]) => 
    key !== 'page' && val !== '' && val !== '24h'
  ).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Title & Stats */}
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Audit Logs</h1>
            <p className="text-sm text-gray-500 font-medium flex items-center">
              Immutable platform activity ledger & monitoring
              <span className="mx-2 w-1 h-1 bg-gray-300 rounded-full"></span>
              <span className="text-green-600">Active</span>
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] lg:min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="query"
              placeholder="Search by email, entity, or action..."
              value={filters.query}
              onChange={handleFilterChange}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-50 flex flex-wrap items-center gap-4">
        {/* Category Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Categories</option>
            <option value="auth">Security & Auth</option>
            <option value="data">Data Ingestion</option>
            <option value="sql">SQL Engine</option>
            <option value="ai">AI Assistant</option>
            <option value="report">Reporting</option>
            <option value="admin">Administration</option>
          </select>
        </div>

        {/* Status Filter */}
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="warning">Warning</option>
        </select>

        {/* Date Filter */}
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            name="date_range"
            value={filters.date_range}
            onChange={handleFilterChange}
            className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Clear Filters ({activeFiltersCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AuditHeader;
