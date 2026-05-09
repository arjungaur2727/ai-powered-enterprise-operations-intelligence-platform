import React from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const SystemHealthPanel = ({ health, snapshots, isLoading }) => {
  if (isLoading && !health) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>)}
        </div>
        <div className="h-64 bg-gray-50 rounded-xl"></div>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    return status === 'healthy' || status === 'running' || status === 'connected' ? 
      <CheckCircle className="w-5 h-5 text-green-500" /> : 
      <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusBg = (status) => {
    return status === 'healthy' || status === 'running' || status === 'connected' ? 
      'bg-green-50 border-green-100' : 'bg-red-50 border-red-100';
  };

  const formattedSnapshots = snapshots?.map(s => ({
    ...s,
    time: new Date(s.snapshot_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    error_rate: parseFloat(s.error_rate_pct || 0),
    query_time: parseFloat(s.avg_query_ms || 0)
  })).reverse() || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">System Health</h2>
        </div>
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-green-50 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Live Monitoring</span>
        </div>
      </div>

      <div className="p-6">
        {/* Core Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className={`p-4 border rounded-2xl ${getStatusBg(health?.database?.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <Database className="w-5 h-5 text-gray-400" />
              {getStatusIcon(health?.database?.status)}
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Database</p>
            <p className="text-lg font-black text-gray-900">{health?.database?.pool_active || 0} / {health?.database?.pool_size || 20}</p>
            <p className="text-[10px] text-gray-400 mt-1">Connections Active</p>
          </div>

          <div className={`p-4 border rounded-2xl ${getStatusBg(health?.scheduler?.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-gray-400" />
              {getStatusIcon(health?.scheduler?.status)}
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scheduler</p>
            <p className="text-lg font-black text-gray-900">{health?.scheduler?.jobs_count || 0} Jobs</p>
            <p className="text-[10px] text-gray-400 mt-1">{health?.scheduler?.running_since || 'Active'}</p>
          </div>

          <div className={`p-4 border rounded-2xl ${health?.error_rate_pct < 5 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              {health?.error_rate_pct < 5 ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />}
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Error Rate</p>
            <p className="text-lg font-black text-gray-900">{health?.error_rate_pct || 0}%</p>
            <p className="text-[10px] text-gray-400 mt-1">Last 60 minutes</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Error Rate (24h)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedSnapshots}>
                  <defs>
                    <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    unit="%"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="error_rate" 
                    stroke="#ef4444" 
                    fillOpacity={1} 
                    fill="url(#colorError)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Query Latency (24h)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedSnapshots}>
                  <defs>
                    <linearGradient id="colorQuery" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    unit="ms"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="query_time" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorQuery)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-xs text-gray-500">
            <Server className="w-3 h-3 mr-1" />
            <span>Environment: <span className="font-bold text-gray-700">Production</span></span>
          </div>
          <div className="flex items-center text-xs text-gray-500">
            <Cpu className="w-3 h-3 mr-1" />
            <span>API Version: <span className="font-bold text-gray-700">v1.0.4-stable</span></span>
          </div>
        </div>
        <button className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
          View Detailed Metrics →
        </button>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
