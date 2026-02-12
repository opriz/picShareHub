import { motion } from 'framer-motion'
import { FaCloudUploadAlt, FaCamera } from 'react-icons/fa'
import './Header.css'

function Header({ onUploadClick }) {
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
      className="header"
    >
      <div className="header-content">
        <motion.div 
          className="logo"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaCamera className="logo-icon" />
          <h1>PhotoShare</h1>
        </motion.div>

        <motion.button
          className="upload-btn"
          onClick={onUploadClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaCloudUploadAlt className="upload-icon" />
          上传照片
        </motion.button>
      </div>
    </motion.header>
  )
}

export default Header
