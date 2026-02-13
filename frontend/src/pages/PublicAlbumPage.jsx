import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../utils/api';
import { Camera, Download, Image, Clock, AlertCircle, X, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicAlbumPage() {
  const { shareCode } = useParams();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [downloading, setDownloading] = useState({});

  useEffect(() => {
    async function fetchAlbum() {
      try {
        const res = await publicAPI.viewAlbum(shareCode);
        setAlbum(res.data.album);
        setPhotos(res.data.photos);
      } catch (err) {
        const status = err.response?.status;
        if (status === 410) {
          setError('expired');
        } else if (status === 404) {
          setError('notfound');
        } else {
          setError('error');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchAlbum();
  }, [shareCode]);

  const handleDownload = async (photoId, fileName) => {
    setDownloading((prev) => ({ ...prev, [photoId]: true }));
    try {
      const res = await publicAPI.downloadPhoto(shareCode, photoId);
      const link = document.createElement('a');
      link.href = res.data.downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('开始下载');
    } catch {
      toast.error('下载失败');
    } finally {
      setDownloading((prev) => ({ ...prev, [photoId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error === 'expired' ? '影集已过期' : error === 'notfound' ? '影集不存在' : '加载失败'}
          </h2>
          <p className="text-gray-500">
            {error === 'expired'
              ? '这个影集的有效期已到，照片已被清理。'
              : error === 'notfound'
              ? '请检查链接是否正确。'
              : '请稍后重试。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              PicShare
            </span>
          </div>
        </div>
      </header>

      {/* Album info */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{album.title}</h1>
          {album.description && (
            <p className="text-gray-600 mt-2">{album.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center">
              <User className="w-3.5 h-3.5 mr-1" />
              {album.photographerName}
            </span>
            <span className="flex items-center">
              <Image className="w-3.5 h-3.5 mr-1" />
              {album.photoCount} 张照片
            </span>
            <span className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" />
              {new Date(album.expiresAt) > new Date()
                ? `有效期至 ${new Date(album.expiresAt).toLocaleString('zh-CN')}`
                : '即将过期'}
            </span>
          </div>
        </div>

        {/* Photos */}
        {photos.length === 0 ? (
          <div className="text-center py-20">
            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">影集中还没有照片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-all"
              >
                <div
                  className="aspect-square cursor-pointer"
                  onClick={() => setPreviewImg(photo)}
                >
                  <img
                    src={photo.thumbnail_url}
                    alt={photo.original_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end opacity-0 group-hover:opacity-100">
                  <div className="w-full p-2 bg-gradient-to-t from-black/50 to-transparent">
                    <button
                      onClick={() => handleDownload(photo.id, photo.original_name)}
                      disabled={downloading[photo.id]}
                      className="w-full py-2 bg-white/90 rounded-lg text-gray-700 hover:bg-white text-xs flex items-center justify-center font-medium disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {downloading[photo.id] ? '下载中...' : '下载原图'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image preview */}
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(previewImg.id, previewImg.original_name); }}
              className="px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 flex items-center shadow-xl"
            >
              <Download className="w-5 h-5 mr-2" />
              下载原图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
