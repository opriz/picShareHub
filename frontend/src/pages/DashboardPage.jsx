import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { albumAPI } from '../utils/api';
import { Plus, Image, Eye, Download, Clock, QrCode, Trash2, Settings, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const fetchAlbums = useCallback(async () => {
    try {
      const res = await albumAPI.getMyAlbums();
      setAlbums(res.data.albums);
    } catch (err) {
      toast.error('获取影集失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await albumAPI.create({});
      toast.success('影集已创建');
      navigate(`/albums/${res.data.album.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确定要删除这个影集吗？所有照片将被永久删除。')) return;

    try {
      await albumAPI.delete(id);
      toast.success('影集已删除');
      setAlbums(albums.filter((a) => a.id !== id));
    } catch {
      toast.error('删除失败');
    }
  };

  const formatExpiry = (expiresAt, isExpired) => {
    if (isExpired) return '已过期';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${mins}分钟`;
    return `${mins}分钟`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的影集</h1>
          <p className="text-sm text-gray-500 mt-1">共 {albums.length} 个影集</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200 text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {creating ? '创建中...' : '一键创建影集'}
        </button>
      </div>

      {albums.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有影集</h3>
          <p className="text-gray-500 mb-6">点击上方按钮创建你的第一个影集</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            创建影集
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/albums/${album.id}`}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all hover:border-indigo-100"
            >
              {/* Cover */}
              <div className="aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                {album.cover_url ? (
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                {album.isExpired && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">已过期</span>
                  </div>
                )}
                {!album.isExpired && (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-gray-600 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatExpiry(album.expires_at, album.isExpired)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">{album.title}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Image className="w-3.5 h-3.5 mr-1" />
                    {album.photo_count}
                  </span>
                  <span className="flex items-center">
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    {album.view_count}
                  </span>
                  <span className="flex items-center">
                    <Download className="w-3.5 h-3.5 mr-1" />
                    {album.download_count}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">
                    {new Date(album.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  <button
                    onClick={(e) => handleDelete(album.id, e)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
