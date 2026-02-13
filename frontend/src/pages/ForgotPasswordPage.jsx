import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { Camera, Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
      toast.success('如果该邮箱已注册，我们已发送密码重置邮件');
    } catch (err) {
      toast.error(err.response?.data?.error || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div className="w-full max-w-md mx-auto" style={{ width: '100%', maxWidth: '28rem' }}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PicShare</h1>
          <p className="text-gray-500 mt-1">重置密码</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-8" style={{ width: '100%', maxWidth: '100%' }}>
          {!sent ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">忘记密码？</h2>
              <p className="text-sm text-gray-600 mb-6">
                请输入您的邮箱地址，我们将发送密码重置链接到您的邮箱。
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      style={{ fontSize: '16px' }}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                >
                  {loading ? '发送中...' : '发送重置邮件'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">邮件已发送</h2>
              <p className="text-sm text-gray-600 mb-6">
                如果该邮箱已注册，我们已向 <strong>{email}</strong> 发送了密码重置邮件。
                <br />
                请查收邮箱并点击链接重置密码。
              </p>
              <p className="text-xs text-gray-500 mb-6">
                没有收到邮件？请检查垃圾邮件文件夹，或稍后重试。
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-indigo-600 font-medium hover:text-indigo-700"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
