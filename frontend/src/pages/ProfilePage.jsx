import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../utils/api';
import { User, Mail, Lock, Save, Key, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [sendingVerificationEmail, setSendingVerificationEmail] = useState(false);

  // 页面加载时刷新一次用户信息
  useEffect(() => {
    refreshProfile();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // user 变化时同步 name 输入框
  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  // 如果用户未验证邮箱，定期检查验证状态（每30秒）
  useEffect(() => {
    if (!user || user.emailVerified) {
      return;
    }

    const interval = setInterval(() => {
      refreshProfile().catch(() => {
        // 静默失败，避免错误提示
      });
    }, 30000); // 每30秒检查一次

    return () => clearInterval(interval);
  }, [user, refreshProfile]);

  // 当页面从隐藏变为可见时，刷新用户信息
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        refreshProfile().catch(() => {
          // 静默失败，避免错误提示
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshProfile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入昵称');
      return;
    }

    setLoading(true);
    try {
      await authAPI.updateProfile({ name: name.trim() });
      toast.success('更新成功');
      refreshProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('请填写完整');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密码至少6位');
      return;
    }

    setPasswordLoading(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      toast.success('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || '修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) {
      toast.error('无法获取邮箱地址');
      return;
    }

    setSendingResetEmail(true);
    try {
      await authAPI.forgotPassword({ email: user.email });
      toast.success('密码重置邮件已发送，请查收邮箱');
    } catch (err) {
      toast.error(err.response?.data?.error || '发送失败');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!user?.email) {
      toast.error('无法获取邮箱地址');
      return;
    }

    setSendingVerificationEmail(true);
    try {
      const res = await authAPI.resendVerification({ email: user.email });
      toast.success(res.data.message || '验证邮件已发送，请查收邮箱');
      // 不刷新用户信息，避免可能的401错误导致登出
      // 用户验证邮箱后会自动更新状态
    } catch (err) {
      toast.error(err.response?.data?.error || '发送失败，请稍后重试');
    } finally {
      setSendingVerificationEmail(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">个人设置</h1>

        <div className="space-y-6">
        {/* Profile Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-indigo-600" />
            个人信息
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {user.emailVerified ? (
                    <span className="text-green-600">✓ 邮箱已验证</span>
                  ) : (
                    <span className="text-amber-600">⚠ 邮箱未验证</span>
                  )}
                </p>
                {!user.emailVerified && (
                  <button
                    type="button"
                    onClick={handleResendVerificationEmail}
                    disabled={sendingVerificationEmail}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {sendingVerificationEmail ? '发送中...' : '重新发送验证邮件'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">昵称</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  style={{ fontSize: '16px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {loading ? '保存中...' : '保存'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Lock className="w-5 h-5 mr-2 text-indigo-600" />
            修改密码
          </h2>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm text-blue-800 mb-2">
              <strong>方式一：</strong>通过邮箱重置密码（推荐）
            </p>
            <button
              onClick={handleSendResetEmail}
              disabled={sendingResetEmail}
              className="inline-flex items-center px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              <Key className="w-4 h-4 mr-1.5" />
              {sendingResetEmail ? '发送中...' : '发送密码重置邮件'}
            </button>
            <p className="text-xs text-blue-600 mt-2">
              点击后我们会向您的邮箱发送重置链接，通过链接可以安全地重置密码
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            <p className="text-sm text-gray-600 mb-4">
              <strong>方式二：</strong>使用当前密码修改
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">当前密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="输入当前密码"
                    className="w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    style={{ fontSize: '16px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少6位，含字母和数字"
                    className="w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    style={{ fontSize: '16px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    style={{ fontSize: '16px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {passwordLoading ? '修改中...' : '修改密码'}
              </button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
