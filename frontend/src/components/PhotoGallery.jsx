import { motion } from 'framer-motion'
import Masonry from 'react-masonry-css'
import PhotoCard from './PhotoCard'
import './PhotoGallery.css'

function PhotoGallery({ photos, onDeletePhoto }) {
  const breakpointColumns = {
    default: 4,
    1400: 3,
    1000: 2,
    700: 1
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="gallery-container"
    >
      <Masonry
        breakpointCols={breakpointColumns}
        className="masonry-grid"
        columnClassName="masonry-column"
      >
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            onDelete={onDeletePhoto}
          />
        ))}
      </Masonry>
    </motion.div>
  )
}

export default PhotoGallery
