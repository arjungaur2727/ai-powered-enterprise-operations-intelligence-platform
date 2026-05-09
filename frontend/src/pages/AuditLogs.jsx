import React, { useState, useEffect, useCallback } from 'react';
import AuditHeader from '../components/audit/AuditHeader';
import AuditSummaryCards from '../components/audit/AuditSummaryCards';
import AuditLogTable from '../components/audit/AuditLogTable';
import AuditDetailDrawer from '../components/audit/AuditDetailDrawer';
import SystemHealthPanel from '../components/audit/SystemHealthPanel';
import { getAuditLogs, getAuditSummary, getSystemHealth, getHealthSnapshots, exportAuditLogs } from '../api/auditApi';
import { Activity, ShieldCheck, History } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeLog, setActiveLog] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' | 'health'

  const [filters, setFilters] = useState({
    query: '',
    category: '',
    status: '',
    date_range: '24h',
    page: 1
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [logsData, summaryData, healthData, snapshotsData] = await Promise.all([
        getAuditLogs(filters),
        getAuditSummary(),
        getSystemHealth(),
        getHealthSnapshots(24)
      ]);

      setLogs(logsData.items);
      setTotal(logsData.total);
      setPages(logsData.pages);
      setSummary(summaryData);
      setHealth(healthData);
      setSnapshots(snapshotsData);
    } catch (error) {
      console.error('Error fetching audit data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh health every 60s
    const healthInterval = setInterval(async () => {
      try {
        const h = await getSystemHealth();
        setHealth(h);
      } catch (e) {}
    }, 60000);

    return () => clearInterval(healthInterval);
  }, [fetchData]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAuditLogs(filters);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const openDetail = (log) => {
    setActiveLog(log);
    setIsDrawerOpen(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      {/* Header Section */}
      <AuditHeader 
        filters={filters}
        setFilters={setFilters}
        onRefresh={fetchData}
        onExport={handleExport}
        isRefreshing={isLoading}
        isExporting={isExporting}
      />

      {/* Summary Row */}
      <AuditSummaryCards summary={summary} isLoading={isLoading} />

      {/* Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-gray-100 rounded-xl w-fit mb-6 shadow-inner">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'activity' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Activity Log</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'health' 
              ? 'bg-white text-green-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'activity' ? (
          <AuditLogTable 
            logs={logs}
            total={total}
            isLoading={isLoading}
            page={filters.page}
            pages={pages}
            onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
            onViewDetail={openDetail}
          />
        ) : (
          <SystemHealthPanel 
            health={health}
            snapshots={snapshots}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <AuditDetailDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        log={activeLog}
      />

      {/* Footer Info */}
      <div className="mt-12 flex flex-col md:flex-row items-center justify-between py-6 border-t border-gray-100">
        <div className="flex items-center space-x-2 text-gray-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs font-medium">Audit logs are immutable and permanent. Data retention policy: 365 days.</span>
        </div>
        <div className="text-xs text-gray-400 mt-4 md:mt-0">
          System Time: {new Date().toUTCString()}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
