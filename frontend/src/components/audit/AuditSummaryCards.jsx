import React from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Database, 
  Cpu, 
  TrendingUp, 
  TrendingDown,
  AlertCircle
} from 'lucide-react';

const AuditSummaryCards = ({ summary, isLoading }) => {
  if (isLoading && !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100"></div>)}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Events",
      value: summary?.total_events?.toLocaleString() || '0',
      change: "+12.5%",
      isPositive: true,
      icon: <Activity className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50"
    },
    {
      label: "Security Alerts",
      value: summary?.security_events?.toLocaleString() || '0',
      change: "-2.4%",
      isPositive: true,
      icon: <ShieldAlert className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50"
    },
    {
      label: "Data Operations",
      value: summary?.data_events?.toLocaleString() || '0',
      change: "+5.1%",
      isPositive: true,
      icon: <Database className="w-5 h-5 text-indigo-600" />,
      bg: "bg-indigo-50"
    },
    {
      label: "Failure Rate",
      value: `${summary?.failure_rate || 0}%`,
      change: "+0.2%",
      isPositive: false,
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      bg: "bg-red-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 ${card.bg} rounded-xl group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
              card.isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {card.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{card.change}</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{card.label}</p>
          <h3 className="text-2xl font-black text-gray-900">{card.value}</h3>
        </div>
      ))}
    </div>
  );
};

export default AuditSummaryCards;
