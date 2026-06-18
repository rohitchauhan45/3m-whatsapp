import React, { useState } from 'react';
import { AppView } from '../lib/types';
import { LayoutDashboard, BookOpen, MessageSquare, Layers, Settings, LogOut, Menu, X, GraduationCap, Scale, Gavel, Calendar, FileText } from 'lucide-react';

interface LayoutProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, onLogout, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => (
    <button
      onClick={() => {
        onChangeView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
        currentView === view 
          ? 'bg-brand-primary text-white shadow-lg shadow-brand-pink/20 font-medium' 
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      <Icon size={20} className={`${currentView === view ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white'} transition-colors`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-brand-dark overflow-hidden transition-colors duration-300">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-brand-surface/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 z-40 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2.5">
          <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Admin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="p-2 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-95 transition-transform"
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
        fixed inset-y-0 left-0 z-50 w-72 glass-panel flex flex-col transition-transform duration-300 ease-out md:translate-x-0 md:static md:w-64 md:flex-shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div>
               <h1 className="font-bold text-lg leading-none tracking-tight text-gray-900 dark:text-white">Admin Dashboard</h1>
             </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto no-scrollbar">
          <div className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Learning</div>
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={AppView.SUBJECTS} icon={BookOpen} label="Subjects" />
          <NavItem view={AppView.CHAT_TUTOR} icon={MessageSquare} label="AI Tutor" />
          <NavItem view={AppView.FLASHCARDS} icon={Layers} label="Flashcards" />
          
          <div className="px-4 py-2 mt-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Resources</div>
          <NavItem view={AppView.CASES} icon={Scale} label="Case Library" />
          <NavItem view={AppView.STATUTES} icon={Gavel} label="Statutes" />
          <NavItem view={AppView.SCENARIO} icon={FileText} label="Scenarios" />
          <NavItem view={AppView.PLANNER} icon={Calendar} label="Study Plan" />
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-white/5 space-y-2 bg-gray-50/50 dark:bg-black/20">
           <button 
             onClick={() => { onChangeView(AppView.SETTINGS); setIsMobileMenuOpen(false); }}
             className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
               currentView === AppView.SETTINGS 
                 ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' 
                 : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
             }`}
           >
            <Settings size={20} />
            <span className="font-medium">Settings</span>
          </button>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>

          <div className="mt-4 flex items-center p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 border-2 border-white dark:border-brand-surface flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">LS</div>
             <div className="ml-3 overflow-hidden">
               <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Law Student</p>
               <p className="text-xs text-brand-pink truncate">LLB Year 2</p>
             </div>
          </div>

        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Background Texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth safe-area-bottom">
           <div className="p-5 md:p-8 lg:p-10 max-w-7xl mx-auto pt-20 md:pt-10 pb-24 md:pb-10 min-h-full">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;