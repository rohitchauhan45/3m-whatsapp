import React, { useState } from 'react';
import { AppView } from '../../lib/types';
import { ArrowRight, Lock, Mail, User, Loader2, GraduationCap } from 'lucide-react';

interface AuthProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ currentView, onNavigate, onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const isLogin = currentView === AppView.LOGIN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1500);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gray-50 transition-colors duration-500">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-brand-purple rounded-full blur-[100px] opacity-10 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-brand-pink rounded-full blur-[100px] opacity-10 animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="w-full max-w-sm z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary shadow-2xl shadow-brand-pink/40 mb-5 transform hover:scale-105 transition-transform duration-300">
             <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage your system and users</p>
        </div>

        <div className="glass-card p-6 md:p-8 rounded-3xl border border-gray-200 shadow-2xl bg-white/80">
          <div className="grid grid-cols-2 gap-1 mb-8 bg-gray-100 p-1.5 rounded-xl">
            <button 
              onClick={() => onNavigate(AppView.LOGIN)}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-all duration-300 ${isLogin ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => onNavigate(AppView.SIGNUP)}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-all duration-300 ${!isLogin ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5 animate-slide-up">
                <label className="text-xs font-semibold text-gray-500 ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-brand-pink transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Baroness Hale"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-pink/50 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 animate-slide-up" style={{animationDelay: '0.1s'}}>
              <label className="text-xs font-semibold text-gray-500 ml-1">University Email</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-brand-pink transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  placeholder="student@law.ac.uk"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-pink/50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5 animate-slide-up" style={{animationDelay: '0.2s'}}>
              <label className="text-xs font-semibold text-gray-500 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-brand-pink transition-colors" size={18} />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-pink/50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3.5 bg-brand-primary rounded-xl text-white font-bold shadow-lg shadow-brand-pink/20 hover:shadow-brand-pink/40 hover:scale-[1.02] active:scale-[0.98] transition-all mt-6 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:hover:scale-100"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Access Platform' : 'Create Account'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {isLogin && (
            <div className="text-center mt-6">
              <button className="text-xs text-brand-pink hover:text-brand-orange transition-colors">Forgot Password?</button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default Auth;