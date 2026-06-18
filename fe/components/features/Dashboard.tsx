import React from 'react';
import { UserStats } from '@/lib/types';

interface DashboardProps {
  stats: UserStats;
  heading?: string;
  subheading?: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  stats,
  heading = 'Welcome to Admin Dashboard',
  subheading = 'Manage your system and users from here.',
}) => {
  return (
    <div className="relative animate-fade-in">
      {/* Header Section */}
      <div className="relative z-10 mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">{heading}</h1>
        <p className="text-gray-600 text-lg">{subheading}</p>
      </div>
    </div>
  );
};

export default Dashboard;