import React, { useState } from 'react';
import { 
  Shield, 
  Database, 
  Cpu, 
  Activity, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  Globe,
  Terminal
} from 'lucide-react';

const AuditLogRow = ({ log, onViewDetail }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'auth': return <Shield className="w-4 h-4 text-purple-600" />;
      case 'data': return <Database className="w-4 h-4 text-blue-600" />;
      case 'ai': return <Cpu className="w-4 h-4 text-indigo-600" />;
      case 'admin': return <Settings className="w-4 h-4 text-orange-600" />;
      case 'system':
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Success
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <AlertTriangle className="w-3 h-3 mr-1" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getDurationColor = (ms) => {
    if (!ms) return 'text-gray-400';
    if (ms < 500) return 'text-green-600';
    if (ms < 2000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'manager': return 'bg-blue-100 text-blue-700';
      case 'analyst': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <tr 
        className={`hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 ${isExpanded ? 'bg-blue-50/30' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">{log.time_ago}</span>
            <span className="text-[10px] text-gray-400 group-hover:block" title={new Date(log.created_at).toLocaleString()}>
              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${getRoleColor(log.user_role)}`}>
              {(log.user_email || 'S')[0].toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-900 max-w-[120px] truncate" title={log.user_email || 'System'}>
                {log.user_email || 'System'}
              </span>
              {log.user_role && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                  {log.user_role}
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="mr-2 p-1 bg-white rounded shadow-sm border border-gray-100">
              {getCategoryIcon(log.action_category)}
            </div>
            <span className={`text-sm font-semibold ${
              log.action_category === 'auth' ? 'text-purple-700' :
              log.action_category === 'data' ? 'text-blue-700' :
              log.action_category === 'ai' ? 'text-indigo-700' :
              log.action_category === 'admin' ? 'text-orange-700' : 'text-gray-700'
            }`}>
              {log.action_label}
            </span>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          {log.entity_type ? (
            <div className="flex flex-col">
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase w-fit mb-0.5">
                {log.entity_type}
              </span>
              <span className="text-sm text-gray-600 truncate max-w-[150px]" title={log.entity_name}>
                {log.entity_name || '—'}
              </span>
            </div>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          {getStatusBadge(log.status)}
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`text-sm font-mono font-medium ${getDurationColor(log.duration_ms)}`}>
            {log.duration_label || '—'}
          </span>
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail(log);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="View Full Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      
      {isExpanded && (
        <tr className="bg-gray-50/50">
          <td colSpan="7" className="px-8 py-4 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                  <Database className="w-3 h-3 mr-1" /> Metadata
                </h4>
                <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-[200px] overflow-auto shadow-inner">
                  <pre className="text-xs font-mono text-gray-700">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="space-y-3">
                {log.error_message && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center">
                      <XCircle className="w-3 h-3 mr-1" /> Error Details
                    </h4>
                    <p className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
                      {log.error_message}
                    </p>
                  </div>
                )}
                
                <div className="flex space-x-4">
                  <div className="flex items-center text-xs text-gray-500">
                    <Globe className="w-3 h-3 mr-1 text-gray-400" />
                    <span className="font-mono">{log.ip_address || 'Internal'}</span>
                  </div>
                  <div className="flex items-center text-xs text-gray-500 truncate max-w-[200px]">
                    <Terminal className="w-3 h-3 mr-1 text-gray-400" />
                    <span className="truncate" title={log.user_agent}>{log.user_agent || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => onViewDetail(log)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-4"
                  >
                    View in Drawer →
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AuditLogRow;
