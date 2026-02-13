import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { Camera, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('请输入邮箱');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ email });
      setSent(true);
      if (res.data._devResetLink) setDevLink(res.data._devResetLink);
      toast.success('已发送');
    } catch (err) {
      toast.error(err.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PicShare</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {!sent ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">找回密码</h2>
              <p className="text-sm text-gray-500 mb-6">输入注册时使用的邮箱，我们将发送重置密码链接</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" required />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 shadow-lg shadow-indigo-200">
                  {loading ? '发送中...' : '发送重置链接'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">邮件已发送</h2>
              <p className="text-sm text-gray-500 mb-4">如果该邮箱已注册，重置链接将发送到您的邮箱，请查收。</p>
              {devLink && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-xs text-amber-700 mb-1">测试模式重置链接:</p>
                  <a href={devLink} className="text-xs text-indigo-600 break-all hover:underline">{devLink}</a>
                </div>
              )}
              <button onClick={() => { setSent(false); setDevLink(''); }} className="mt-4 text-sm text-indigo-600 hover:text-indigo-700">重新发送</button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> 返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
