
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, color }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-xl ${color} text-white`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && <p className="text-xs mt-1 text-green-600 font-semibold">{trend}</p>}
      </div>
    </div>
  );
};

export default StatsCard;
