import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import PhotoUpload from './components/PhotoUpload'
import PhotoGallery from './components/PhotoGallery'
import './App.css'

function App() {
  const [photos, setPhotos] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(false)

  // 从localStorage加载照片数据
  useEffect(() => {
    const savedPhotos = localStorage.getItem('photoGallery')
    if (savedPhotos) {
      setPhotos(JSON.parse(savedPhotos))
    }
  }, [])

  // 保存照片数据到localStorage
  useEffect(() => {
    if (photos.length > 0) {
      localStorage.setItem('photoGallery', JSON.stringify(photos))
    }
  }, [photos])

  const handleUploadComplete = (photoData) => {
    setPhotos([photoData, ...photos])
    setShowUpload(false)
  }

  const handleDeletePhoto = (photoId) => {
    setPhotos(photos.filter(photo => photo.id !== photoId))
  }

  return (
    <div className="app">
      <Header onUploadClick={() => setShowUpload(true)} />
      
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowUpload(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <PhotoUpload
                onUploadComplete={handleUploadComplete}
                onClose={() => setShowUpload(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-content">
        {photos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="empty-state"
          >
            <h2>📸 还没有照片</h2>
            <p>点击上传按钮开始分享您的精彩瞬间</p>
            <button 
              className="upload-btn-large"
              onClick={() => setShowUpload(true)}
            >
              上传第一张照片
            </button>
          </motion.div>
        ) : (
          <PhotoGallery 
            photos={photos} 
            onDeletePhoto={handleDeletePhoto}
          />
        )}
      </main>
    </div>
  )
}

export default App
