import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { albumAPI } from '../utils/api';
import { formatFileSize } from '../utils/format';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Upload, QrCode, Clock, Eye, Download, Image, Trash2,
  Share2, X, Settings, Copy, Check, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);
  const [copied, setCopied] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  const fetchAlbum = useCallback(async () => {
    try {
      const res = await albumAPI.getDetail(id);
      setAlbum(res.data.album);
      setPhotos(res.data.photos);
    } catch (err) {
      toast.error('影集不存在');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await albumAPI.uploadPhotos(id, formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });

      toast.success(res.data.message);
      fetchAlbum(); // Refresh
    } catch (err) {
      toast.error(err.response?.data?.error || '上传失败');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('确定删除这张照片？')) return;
    try {
      await albumAPI.deletePhoto(id, photoId);
      setPhotos(photos.filter((p) => p.id !== photoId));
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleDownload = async (photoId, fileName) => {
    try {
      const res = await albumAPI.getPhotoOriginal(id, photoId);
      const link = document.createElement('a');
      link.href = res.data.downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error('获取下载链接失败');
    }
  };

  const handleUpdateExpiry = async () => {
    try {
      await albumAPI.update(id, { expiresInHours: expiryHours });
      toast.success('过期时间已更新');
      setShowSettings(false);
      fetchAlbum();
    } catch {
      toast.error('更新失败');
    }
  };

  const shareUrl = album ? `${window.location.origin}/s/${album.share_code}` : '';

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('链接已复制');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!album) return null;

  const isExpired = album.isExpired || new Date(album.expires_at) < new Date();

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start space-x-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
              <span className="flex items-center"><Image className="w-3.5 h-3.5 mr-1" />{album.photo_count} 张</span>
              <span className="flex items-center"><Eye className="w-3.5 h-3.5 mr-1" />{album.view_count} 次查看</span>
              <span className="flex items-center"><Download className="w-3.5 h-3.5 mr-1" />{album.download_count} 次下载</span>
              <span className={`flex items-center ${isExpired ? 'text-red-500' : 'text-green-600'}`}>
                <Clock className="w-3.5 h-3.5 mr-1" />
                {isExpired ? '已过期' : `${new Date(album.expires_at).toLocaleString('zh-CN')}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {!isExpired && (
          <label className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 cursor-pointer transition-all shadow-lg shadow-indigo-200">
            <Upload className="w-4 h-4 mr-1.5" />
            上传照片
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}

        <button
          onClick={() => setShowQR(true)}
          className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
        >
          <QrCode className="w-4 h-4 mr-1.5" />
          二维码
        </button>

        <button
          onClick={copyShareUrl}
          className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
        >
          {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
          {copied ? '已复制' : '复制链接'}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
        >
          <Settings className="w-4 h-4 mr-1.5" />
          设置
        </button>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">上传中...</span>
            <span className="text-sm font-medium text-indigo-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有照片</h3>
          <p className="text-gray-500 mb-6">上传照片到这个影集</p>
          {!isExpired && (
            <label className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium cursor-pointer hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200">
              <Plus className="w-5 h-5 mr-2" />
              上传照片
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      ) : (
        <div className="masonry-container">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="masonry-item group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="cursor-pointer relative" onClick={() => setPreviewImg(photo)}>
                <img
                  src={photo.thumbnail_url}
                  alt={photo.original_name}
                  className="masonry-image"
                  loading="lazy"
                />
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end opacity-0 group-hover:opacity-100 rounded-xl">
                  <div className="w-full p-2 flex justify-between bg-gradient-to-t from-black/50 to-transparent rounded-b-xl">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(photo.id, photo.original_name); }}
                      className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white text-xs flex items-center"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      下载原图
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                      className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <p className="text-xs text-gray-500 truncate">
                  {photo.original_name}
                  {photo.file_size && (
                    <span className="ml-1.5 text-gray-400">
                      ({formatFileSize(photo.file_size)})
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">扫码查看影集</h3>
            <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-2xl">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
            <p className="text-sm text-gray-500 mt-4 break-all">{shareUrl}</p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={copyShareUrl}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                复制链接
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">影集设置</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">延长有效期</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 6, 12, 24, 48, 72].map((h) => (
                  <button
                    key={h}
                    onClick={() => setExpiryHours(h)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                      expiryHours === h
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {h < 24 ? `${h}小时` : `${h / 24}天`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="自定义小时数"
                min="1"
                max="720"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdateExpiry}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImg(null)}>
          <button
            onClick={() => setPreviewImg(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImg.thumbnail_url}
            alt={previewImg.original_name}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(previewImg.id, previewImg.original_name); }}
              className="px-4 py-2.5 bg-white text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-100 flex items-center"
            >
              <Download className="w-4 h-4 mr-1.5" />
              下载原图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
