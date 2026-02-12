import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FaUpload, FaTimes, FaImage } from 'react-icons/fa'
import { uploadToOSS } from '../utils/ossClient'
import './PhotoUpload.css'

function PhotoUpload({ onUploadComplete, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      // 如果配置了OSS，使用OSS上传
      // const ossUrl = await uploadToOSS(selectedFile)
      
      // 暂时使用本地预览URL（演示用）
      const photoData = {
        id: Date.now().toString(),
        url: previewUrl,
        title: title || '未命名照片',
        description: description || '',
        uploadTime: new Date().toISOString(),
      }

      onUploadComplete(photoData)
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="upload-modal">
      <div className="modal-header">
        <h2>上传照片</h2>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      <div className="modal-body">
        {!previewUrl ? (
          <div
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <FaImage className="upload-placeholder-icon" />
            <p>点击选择照片</p>
            <p className="upload-hint">支持 JPG, PNG, GIF 格式</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="preview-area">
            <img src={previewUrl} alt="预览" className="preview-image" />
            <button
              className="change-photo-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              更换照片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        )}

        <div className="form-fields">
          <div className="form-field">
            <label>标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="为照片添加标题"
            />
          </div>

          <div className="form-field">
            <label>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这张照片的故事..."
              rows="3"
            />
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button className="cancel-btn" onClick={onClose}>
          取消
        </button>
        <motion.button
          className="submit-btn"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {uploading ? '上传中...' : '上传'}
        </motion.button>
      </div>
    </div>
  )
}

export default PhotoUpload
