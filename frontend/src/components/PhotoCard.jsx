import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaHeart, FaTrash, FaExpand } from 'react-icons/fa'
import './PhotoCard.css'

function PhotoCard({ photo, index, onDelete }) {
  const [liked, setLiked] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <>
      <motion.div
        className="photo-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ y: -5 }}
      >
        <div className="photo-image-container">
          {!imageLoaded && (
            <div className="image-skeleton" />
          )}
          <img
            src={photo.url}
            alt={photo.title}
            className="photo-image"
            onLoad={() => setImageLoaded(true)}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
          
          <div className="photo-overlay">
            <motion.button
              className="overlay-btn expand-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowFullscreen(true)}
            >
              <FaExpand />
            </motion.button>
          </div>
        </div>

        <div className="photo-info">
          <h3 className="photo-title">{photo.title}</h3>
          {photo.description && (
            <p className="photo-description">{photo.description}</p>
          )}
          
          <div className="photo-actions">
            <motion.button
              className={`action-btn like-btn ${liked ? 'liked' : ''}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setLiked(!liked)}
            >
              <FaHeart />
            </motion.button>

            <motion.button
              className="action-btn delete-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (confirm('确定要删除这张照片吗？')) {
                  onDelete(photo.id)
                }
              }}
            >
              <FaTrash />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showFullscreen && (
          <motion.div
            className="fullscreen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullscreen(false)}
          >
            <motion.div
              className="fullscreen-content"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={photo.url} alt={photo.title} />
              <div className="fullscreen-info">
                <h2>{photo.title}</h2>
                {photo.description && <p>{photo.description}</p>}
              </div>
              <button
                className="fullscreen-close"
                onClick={() => setShowFullscreen(false)}
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default PhotoCard
