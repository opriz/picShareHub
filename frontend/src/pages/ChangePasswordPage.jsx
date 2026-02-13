import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { ArrowLeft, Lock, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=send code, 2=enter code+password
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devCode, setDevCode] = useState('');

  const handleSendCode = async () => {
    setSending(true);
    try {
      const res = await authAPI.sendChangePasswordCode();
      setMaskedEmail(res.data.message);
      if (res.data._devCode) setDevCode(res.data._devCode);
      setStep(2);
      toast.success('验证码已发送');
    } catch (err) {
      toast.error(err.response?.data?.error || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code) return toast.error('请输入验证码');
    if (newPassword.length < 6) return toast.error('新密码至少6位');
    if (newPassword !== confirmPassword) return toast.error('两次密码不一致');

    setSubmitting(true);
    try {
      await authAPI.changePassword({ code, newPassword });
      toast.success('密码修改成功');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || '修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">修改密码</h1>
      </div>

      <div className="max-w-md mx-auto">
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl mb-3">
                <Mail className="w-7 h-7 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">邮箱验证</h2>
              <p className="text-sm text-gray-500 mt-1">修改密码需要先验证您的邮箱</p>
            </div>
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {sending ? '发送中...' : '发送验证码到邮箱'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-50 rounded-xl mb-3">
                <Shield className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">{maskedEmail}</p>
              {devCode && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                  测试模式验证码: <span className="font-mono font-bold text-lg">{devCode}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="输入6位验证码" maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少6位" className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码" className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 mt-2">
                {submitting ? '提交中...' : '确认修改'}
              </button>
              <button type="button" onClick={handleSendCode} className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700">
                重新发送验证码
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
