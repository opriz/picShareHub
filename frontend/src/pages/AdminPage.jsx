import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../utils/api';
import PhotoGrid from '../components/PhotoGrid';
import {
  Users, Image, Eye, Download, Clock, ChevronRight, ChevronLeft,
  BarChart3, Activity, Camera, X
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAlbums, setUserAlbums] = useState([]);
  // Album detail view
  const [viewAlbum, setViewAlbum] = useState(null);
  const [viewPhotos, setViewPhotos] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sR, uR, aR] = await Promise.all([adminAPI.getStats(), adminAPI.getUsers(), adminAPI.getAllAlbums()]);
      setStats(sR.data.stats);
      setUsers(uR.data.users);
      setAlbums(aR.data.albums);
    } catch { toast.error('获取数据失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchUserAlbums = async (userId) => {
    if (selectedUser === userId) { setSelectedUser(null); return; }
    try {
      const res = await adminAPI.getUserAlbums(userId);
      setUserAlbums(res.data.albums);
      setSelectedUser(userId);
    } catch { toast.error('获取影集失败'); }
  };

  const openAlbumDetail = async (albumId) => {
    setViewLoading(true);
    try {
      const res = await adminAPI.viewAlbum(albumId);
      setViewAlbum(res.data.album);
      setViewPhotos(res.data.photos);
    } catch { toast.error('获取影集详情失败'); }
    finally { setViewLoading(false); }
  };

  const handleAdminDownload = async (photoId, fileName) => {
    if (!viewAlbum) return;
    try {
      const res = await adminAPI.downloadPhoto(viewAlbum.id, photoId);
      const a = document.createElement('a');
      a.href = res.data.downloadUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { toast.error('下载失败'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;

  // Album detail view
  if (viewAlbum) {
    return (
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <button onClick={() => { setViewAlbum(null); setViewPhotos([]); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{viewAlbum.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{viewAlbum.photographer_name} ({viewAlbum.photographer_email})</span>
              <span className="flex items-center"><Image className="w-3.5 h-3.5 mr-1" />{viewAlbum.photo_count} 张</span>
              <span className="flex items-center"><Eye className="w-3.5 h-3.5 mr-1" />{viewAlbum.view_count}</span>
              <span className="flex items-center"><Download className="w-3.5 h-3.5 mr-1" />{viewAlbum.download_count}</span>
              <span className={viewAlbum.isExpired ? 'text-red-500' : 'text-green-600'}>
                {viewAlbum.isExpired ? '已过期' : '活跃'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: 16, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
          管理员查看模式 — 不计入访问和下载统计
        </div>
        {viewPhotos.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Image className="w-12 h-12 mx-auto mb-2" />暂无照片</div>
        ) : (
          <PhotoGrid photos={viewPhotos} onDownload={handleAdminDownload} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
        <p className="text-sm text-gray-500 mt-1">平台数据总览和管理</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {[
          { key: 'overview', label: '总览', icon: BarChart3 },
          { key: 'users', label: '用户', icon: Users },
          { key: 'albums', label: '影集', icon: Image },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          ><Icon className="w-4 h-4 mr-1.5" />{label}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="总用户数" value={stats.totalUsers} sub={`+${stats.recentUsers} 本周`} color="indigo" />
          <StatCard icon={Image} label="总影集数" value={stats.totalAlbums} sub={`+${stats.recentAlbums} 本周`} color="purple" />
          <StatCard icon={Activity} label="活跃影集" value={stats.activeAlbums} color="green" />
          <StatCard icon={Camera} label="总照片数" value={stats.totalPhotos} color="blue" />
          <StatCard icon={Eye} label="总查看次数" value={stats.totalViews} color="amber" />
          <StatCard icon={Download} label="总下载次数" value={stats.totalDownloads} color="rose" />
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">用户</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">影集</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">照片</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">查看</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">下载</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">注册</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900 text-sm">{user.name}</div><div className="text-xs text-gray-500">{user.email}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{user.album_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{user.total_photos}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{user.total_views}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{user.total_downloads}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString('zh-CN')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => fetchUserAlbums(user.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                        <ChevronRight className="w-4 h-4" style={{ transform: selectedUser === user.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Expanded user albums row */}
                {users.map((user) => selectedUser === user.id && (
                  <tr key={`${user.id}-exp`}>
                    <td colSpan="7" className="bg-gray-50 px-4 py-3">
                      {userAlbums.length === 0 ? <p className="text-sm text-gray-500 text-center py-2">暂无影集</p> : (
                        <div className="space-y-2">
                          {userAlbums.map((a) => (
                            <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50" onClick={() => openAlbumDetail(a.id)}>
                              <div>
                                <span className="font-medium text-gray-900">{a.title}</span>
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${a.isExpired ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{a.isExpired ? '已过期' : '活跃'}</span>
                              </div>
                              <div className="flex items-center space-x-3 text-xs text-gray-500">
                                <span>{a.photo_count} 张</span>
                                <span><Eye className="w-3 h-3 inline mr-0.5" />{a.view_count}</span>
                                <span><Download className="w-3 h-3 inline mr-0.5" />{a.download_count}</span>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <div className="text-center py-10"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">暂无用户</p></div>}
        </div>
      )}

      {/* Albums */}
      {activeTab === 'albums' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">影集</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">摄影师</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">照片</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">查看</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">下载</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">过期</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {albums.map((album) => (
                  <tr key={album.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openAlbumDetail(album.id)}>
                    <td className="px-4 py-3"><div className="font-medium text-gray-900 text-sm">{album.title}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{album.photographer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{album.photo_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{album.view_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{album.download_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{new Date(album.expires_at).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${album.isExpired ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{album.isExpired ? '已过期' : '活跃'}</span></td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {albums.length === 0 && <div className="text-center py-10"><Image className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">暂无影集</p></div>}
        </div>
      )}

      {viewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(255,255,255,.8)' }}>
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
