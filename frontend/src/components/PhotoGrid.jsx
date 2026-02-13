import { useState, useRef, useEffect } from 'react';
import { Download, Trash2, X } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Simple masonry using column-based layout
function MasonryGrid({ children }) {
  const containerRef = useRef(null);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    function update() {
      const w = containerRef.current?.offsetWidth || 800;
      if (w < 480) setCols(2);
      else if (w < 768) setCols(3);
      else setCols(4);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const columns = Array.from({ length: cols }, () => []);
  const items = Array.isArray(children) ? children : [children];
  items.forEach((child, i) => {
    columns[i % cols].push(child);
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: '8px' }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {col}
        </div>
      ))}
    </div>
  );
}

export default function PhotoGrid({
  photos,
  onDownload,
  onDelete,
  showDelete = false,
}) {
  const [preview, setPreview] = useState(null);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <MasonryGrid>
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative bg-white rounded-xl overflow-hidden border border-gray-100"
            style={{ breakInside: 'avoid' }}
          >
            <div
              className="cursor-pointer"
              onClick={() => setPreview(photo)}
            >
              <img
                src={photo.thumbnail_url || photo.thumbnailUrl}
                alt={photo.original_name || photo.originalName}
                className="w-full block"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
              />
            </div>

            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex items-end"
              style={{
                background: 'transparent',
                opacity: 0,
                transition: 'opacity .2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'linear-gradient(to top, rgba(0,0,0,.45) 0%, transparent 60%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-full p-2 flex justify-between items-end">
                <button
                  onClick={(e) => { e.stopPropagation(); onDownload?.(photo.id, photo.original_name || photo.originalName); }}
                  className="px-2 py-1 bg-white rounded-lg text-gray-700 text-xs flex items-center font-medium"
                  style={{ fontSize: '11px', lineHeight: '16px' }}
                >
                  <Download style={{ width: 12, height: 12, marginRight: 4 }} />
                  原图
                </button>
                {showDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(photo.id); }}
                    className="p-1 bg-white rounded-lg text-red-500"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            </div>

            {/* File info */}
            <div className="px-2 py-1.5" style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 6 }}>
                {photo.original_name || photo.originalName}
              </span>
              <span style={{ flexShrink: 0, color: '#c0c0c0' }}>
                {formatSize(photo.file_size || photo.fileSize)}
              </span>
            </div>
          </div>
        ))}
      </MasonryGrid>

      {/* Fullscreen preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.92)' }}
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute"
            style={{ top: 16, right: 16, padding: 8, color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.1)', borderRadius: '50%' }}
          >
            <X style={{ width: 24, height: 24 }} />
          </button>
          <img
            src={preview.thumbnail_url || preview.thumbnailUrl}
            alt={preview.original_name || preview.originalName}
            style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute flex gap-3" style={{ bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload?.(preview.id, preview.original_name || preview.originalName); }}
              className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-medium flex items-center text-sm"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}
            >
              <Download style={{ width: 18, height: 18, marginRight: 8 }} />
              下载原图 ({formatSize(preview.file_size || preview.fileSize)})
            </button>
          </div>
        </div>
      )}
    </>
  );
}
