import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, success, error, no-token
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('no-token');
      return;
    }

    authAPI.verifyEmail(token)
      .then(async (res) => {
        setStatus('success');
        setMessage(res.data.message);
        // 验证成功后刷新用户信息
        try {
          await refreshProfile();
        } catch {
          // 如果用户未登录，忽略错误
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || '验证失败');
      });
  }, [searchParams, refreshProfile]);

  const handleResend = async () => {
    if (!email || !email.includes('@')) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    setResending(true);
    try {
      const res = await authAPI.resendVerification({ email });
      toast.success(res.data.message || '验证邮件已发送，请查收');
    } catch (err) {
      toast.error(err.response?.data?.error || '发送失败，请稍后重试');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 max-w-md w-full text-center" style={{ maxWidth: '28rem' }}>
        {status === 'loading' && (
          <>
            <Loader className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900">验证中...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{message}</h2>
            <p className="text-gray-500 mb-6">您现在可以登录了</p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              去登录
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">验证失败</h2>
            <p className="text-gray-500 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="inline-block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                返回登录
              </Link>
            </div>
          </>
        )}
        {status === 'no-token' && (
          <>
            <Mail className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">邮箱验证</h2>
            <p className="text-gray-500 mb-6">请输入您的邮箱地址，我们将重新发送验证邮件</p>
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={handleResend}
                disabled={resending || !email}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resending ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    重新发送验证邮件
                  </>
                )}
              </button>
              <Link
                to="/login"
                className="inline-block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                返回登录
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
