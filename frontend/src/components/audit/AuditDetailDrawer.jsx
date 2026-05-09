import React from 'react';
import { 
  X, 
  Shield, 
  Database, 
  Cpu, 
  Activity, 
  Settings, 
  Copy, 
  ExternalLink,
  Clock,
  User,
  Globe,
  Terminal,
  AlertCircle
} from 'lucide-react';

const AuditDetailDrawer = ({ isOpen, onClose, log }) => {
  if (!log) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'auth': return <Shield className="w-5 h-5 text-purple-600" />;
      case 'data': return <Database className="w-5 h-5 text-blue-600" />;
      case 'ai': return <Cpu className="w-5 h-5 text-indigo-600" />;
      case 'admin': return <Settings className="w-5 h-5 text-orange-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-[500px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                {getCategoryIcon(log.action_category)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{log.action_label}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  log.status === 'success' ? 'bg-green-100 text-green-700' :
                  log.status === 'failure' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {log.status_label}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Event Overview */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                <Clock className="w-3 h-3 mr-1.5" /> Event Overview
              </h3>
              <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
                  <div className="p-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Timestamp</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(log.created_at).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">{log.time_ago}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Duration</p>
                    <p className="text-sm font-medium text-gray-900">{log.duration_label || 'N/A'}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Action ID</p>
                    <p className="text-[10px] font-mono text-gray-600 truncate">{log.id}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Category</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{log.action_category}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Actor */}
            <section>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                <User className="w-3 h-3 mr-1.5" /> Actor Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      {(log.user_email || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{log.user_email || 'System'}</p>
                      <p className="text-xs text-gray-500 capitalize">{log.user_role || 'Background Task'}</p>
                    </div>
                  </div>
                  {log.user_id && (
                    <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                      <Globe className="w-3 h-3 mr-1" /> IP Address
                    </p>
                    <p className="text-xs font-mono text-gray-700">{log.ip_address || 'Internal'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                      <Terminal className="w-3 h-3 mr-1" /> User Agent
                    </p>
                    <p className="text-[10px] font-mono text-gray-700 truncate" title={log.user_agent}>
                      {log.user_agent || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Entity */}
            {log.entity_type && (
              <section>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                  <ExternalLink className="w-3 h-3 mr-1.5" /> Related Entity
                </h3>
                <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase mb-1 inline-block">
                      {log.entity_type}
                    </span>
                    <p className="text-sm font-bold text-gray-900">{log.entity_name || 'Unnamed Entity'}</p>
                    <p className="text-[10px] font-mono text-gray-400">{log.entity_id}</p>
                  </div>
                  <button className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                    View Entity <ChevronRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </section>
            )}

            {/* Metadata */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                  <Database className="w-3 h-3 mr-1.5" /> Action Metadata
                </h3>
                <button 
                  onClick={() => copyToClipboard(JSON.stringify(log.metadata, null, 2))}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 shadow-xl overflow-hidden relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-gray-500 font-mono">JSONB</span>
                </div>
                <pre className="text-xs font-mono text-blue-300 overflow-x-auto max-h-[300px]">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </section>

            {/* Error Message */}
            {log.error_message && (
              <section>
                <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1.5" /> Error Payload
                </h3>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
                    {log.error_message}
                  </pre>
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button 
              onClick={onClose}
              className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ChevronRight = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default AuditDetailDrawer;
