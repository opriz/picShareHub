import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Camera, LogOut, LayoutDashboard, Menu, X, Shield, Key } from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/dashboard" className="flex items-center gap-2 no-underline shrink-0">
              <Camera className="w-6 h-6 text-indigo-600" />
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">PicShare</span>
            </Link>

            {/* Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive('/dashboard') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                <LayoutDashboard className="w-4 h-4 inline mr-1" />我的影集
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location.pathname.startsWith('/admin') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <Shield className="w-4 h-4 inline mr-1" />管理后台
                </Link>
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <span className="text-sm text-gray-500 px-1">{user?.name}</span>
              <Link to="/change-password" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="修改密码">
                <Key className="w-4 h-4" />
              </Link>
              <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="退出">
                <LogOut className="w-4 h-4" />
              </button>
            </nav>

            {/* Mobile toggle */}
            <button className="md:hidden p-2 text-gray-500" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4 space-y-1">
            <Link to="/dashboard" className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
              我的影集
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                管理后台
              </Link>
            )}
            <Link to="/change-password" className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
              修改密码
            </Link>
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="px-4 py-1.5 text-sm text-gray-500">{user?.name} ({user?.email})</div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50">退出登录</button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
