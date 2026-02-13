import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { feedbackAPI } from '../utils/api';
import { MessageSquare, Upload, X, Image as ImageIcon, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FeedbackPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('请选择图片文件');
      return;
    }

    // 限制最多5张图片
    if (images.length + imageFiles.length > 5) {
      toast.error('最多只能上传5张图片');
      return;
    }

    // 检查每张图片大小（限制10MB）
    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    // 创建预览
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages(prev => [...prev, {
          file,
          preview: e.target.result,
          id: Date.now() + Math.random()
        }]);
      };
      reader.readAsDataURL(file);
    });

    // 清空input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('请输入反馈内容');
      return;
    }

    if (content.trim().length < 5) {
      toast.error('反馈内容至少需要5个字符');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      
      // 如果填写了联系方式，添加到表单数据中
      if (contact.trim()) {
        formData.append('contact', contact.trim());
      }
      
      images.forEach((img, index) => {
        formData.append('images', img.file);
      });

      await feedbackAPI.submit(formData);
      toast.success('反馈已提交，感谢您的建议！');
      
      // 清空表单
      setContent('');
      setContact('');
      setImages([]);
      
      // 延迟返回上一页
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div className="w-full max-w-md mx-auto" style={{ width: '100%', maxWidth: '28rem' }}>
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">意见反馈</h1>
          <p className="text-gray-500 mt-1">您的建议对我们很重要</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-8" style={{ width: '100%', maxWidth: '100%' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 反馈内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                反馈内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setContent(e.target.value);
                  }
                }}
                placeholder="请描述您遇到的问题或建议..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                style={{ fontSize: '16px' }}
                maxLength={500}
                required
              />
              <p className="text-xs text-gray-400 mt-1.5 text-right">
                {content.length}/500
              </p>
            </div>

            {/* 联系方式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                联系方式 <span className="text-gray-400 font-normal">(可选)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="邮箱、电话或微信"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  style={{ fontSize: '16px' }}
                  maxLength={100}
                />
              </div>
            </div>

            {/* 上传图片 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                上传图片 <span className="text-gray-400 font-normal">(可选)</span>
              </label>
              
              {/* 图片预览网格 */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      <img
                        src={img.preview}
                        alt="预览"
                        className="w-full h-full object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 上传按钮 */}
              {images.length < 5 && (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                  <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 mb-1.5 transition-colors" />
                  <span className="text-xs text-gray-500 group-hover:text-indigo-600">点击上传图片</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              {submitting ? '提交中...' : '提交反馈'}
            </button>
          </form>

          {/* 取消按钮 */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
