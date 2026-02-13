import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../utils/api';
import PhotoGrid from '../components/PhotoGrid';
import { Camera, Image, Clock, AlertCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicAlbumPage() {
  const { shareCode } = useParams();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicAPI.viewAlbum(shareCode)
      .then((res) => { setAlbum(res.data.album); setPhotos(res.data.photos); })
      .catch((err) => {
        const s = err.response?.status;
        setError(s === 404 ? 'notfound' : 'error');
      })
      .finally(() => setLoading(false));
  }, [shareCode]);

  const handleDownload = async (photoId, fileName) => {
    try {
      const res = await publicAPI.downloadPhoto(shareCode, photoId);
      const a = document.createElement('a');
      a.href = res.data.downloadUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('开始下载');
    } catch { toast.error('下载失败'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{error === 'notfound' ? '影集不存在' : '加载失败'}</h2>
        <p className="text-gray-500">{error === 'notfound' ? '请检查链接是否正确。' : '请稍后重试。'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center space-x-2">
          <Camera className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">PicShare</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
          {album.description && <p className="text-gray-600 mt-2">{album.description}</p>}
          {album.isExpired && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              该影集已过期，照片可能在未来被清理。请尽快下载需要的照片。
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center"><User className="w-3.5 h-3.5 mr-1" />{album.photographerName}</span>
            <span className="flex items-center"><Image className="w-3.5 h-3.5 mr-1" />{album.photoCount} 张照片</span>
            <span className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" />
              {album.isExpired ? '已过期' : `有效期至 ${new Date(album.expiresAt).toLocaleString('zh-CN')}`}
            </span>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-20"><Image className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">影集中还没有照片</p></div>
        ) : (
          <PhotoGrid photos={photos} onDownload={handleDownload} />
        )}
      </div>
    </div>
  );
}
