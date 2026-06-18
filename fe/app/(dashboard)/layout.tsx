'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Settings, Menu, Users, ArrowRight, X, LogOut, ChevronsLeft, ChevronsRight, ClipboardList } from 'lucide-react';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import PageHeader from '@/components/layout/PageHeader';
import { PageHeaderProvider } from '@/lib/utils/page-header-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const NavItem = ({ path, icon: Icon, label, collapsed }: { path: string; icon: any; label: string; collapsed: boolean }) => {
    const isActive = pathname === path;
    const showLabel = !collapsed;
    return (
      <button
        onClick={() => {
          router.push(path);
          setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center justify-start px-3 py-3 rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-gray-100 text-gray-900 font-semibold shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        } ${collapsed ? 'md:px-2 md:py-2.5' : 'md:px-4'} border border-transparent`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'space-x-3'}`}>
          <Icon size={20} className={`${isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-900'} transition-colors`} />
          {showLabel && <span className="text-[14px]">{label}</span>}
        </div>
      </button>
    );
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <PageHeaderProvider>
    <div className="flex h-dvh overflow-hidden transition-colors duration-300 md:p-4 md:gap-4">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2.5">
          <span className="font-bold text-lg tracking-tight text-gray-900">Admin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="p-2 text-gray-500 hover:text-gray-900 active:scale-95 transition-transform"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[300px] 
        ${isCollapsed ? 'md:w-[86px]' : 'md:w-[280px]'} 
        bg-white 
        flex flex-col transition-all duration-300 ease-out 
        md:translate-x-0 md:static md:flex-shrink-0 
        overflow-hidden 
        rounded-r-2xl
        md:rounded-2xl md:shadow-lg md:border md:border-gray-200/60
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="relative h-full">
          <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className={`p-5 border-b border-gray-100 ${isCollapsed ? 'md:px-3 md:py-4' : ''}`}>
              <div className="w-full flex items-center justify-between">
                <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-2.5'}`}>
                  {!isCollapsed && <span className="text-lg font-bold text-gray-900 tracking-tight">Admin Dashboard</span>}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 text-gray-500"
                    aria-label="Close sidebar"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-200 bg-white shadow-soft hover:bg-gray-50 text-gray-500"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className={`flex-1 px-3 py-2 space-y-3 overflow-y-auto no-scrollbar ${isCollapsed ? 'md:px-2' : ''}`}>
              {!isCollapsed && <div className="px-3 pt-2 text-[11px] font-semibold text-gray-400 tracking-[0.2em]">GENERAL</div>}
              <div className="space-y-1">
                <NavItem path="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={isCollapsed} />
                <NavItem path="/tasks" icon={ClipboardList} label="Tasks" collapsed={isCollapsed} />
                
                {isAdmin(user) && (
                  <NavItem path="/users" icon={Users} label="User Management" collapsed={isCollapsed} />
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className={`p-4 border-t border-gray-100 space-y-2 bg-white ${isCollapsed ? 'md:px-2 md:py-3' : ''}`}>
              <button 
                onClick={() => { router.push('/settings'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors ${isCollapsed ? 'md:px-2 md:py-2.5' : ''}`}
              >
                <Settings size={18} className="text-gray-400" />
                {!isCollapsed && <span className="text-[14px]">Settings</span>}
              </button>
              
              <button 
                onClick={handleLogout}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors ${isCollapsed ? 'md:px-2 md:py-2.5' : ''}`}
              >
                <LogOut size={18} />
                {!isCollapsed && <span className="text-[14px]">Sign Out</span>}
              </button>

              {/* User Profile */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-3 hover:bg-gray-50 rounded-xl transition-colors group`}>
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary/20 to-brand-accent-blue/20 border-2 border-white flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-primary">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    {!isCollapsed && (
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">
                          {user?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user?.email || 'user@example.com'}
                        </p>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-900" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col pt-16 md:pt-0">
        {/* Page Header */}
        <PageHeader />

        {/* Dotted gap between header and content */}
        <div className="h-4 bg-[#f7f7f7] flex-shrink-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth safe-area-bottom bg-white md:rounded-t-2xl">
           <div className="px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-10 min-h-full">
             {children}
           </div>
        </div>
      </main>
    </div>
    </PageHeaderProvider>
  );
}
