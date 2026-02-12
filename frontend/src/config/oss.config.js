// 阿里云OSS配置
// 注意：生产环境中，这些配置应该通过环境变量或后端API获取，不要直接暴露在前端代码中
export const OSS_CONFIG = {
  region: import.meta.env.VITE_OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID || '',
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET || '',
  bucket: import.meta.env.VITE_OSS_BUCKET || '',
  // CDN域名（如果配置了CDN）
  cdnDomain: import.meta.env.VITE_CDN_DOMAIN || '',
}

// 检查OSS配置是否完整
export const isOSSConfigured = () => {
  return Boolean(
    OSS_CONFIG.accessKeyId &&
    OSS_CONFIG.accessKeySecret &&
    OSS_CONFIG.bucket
  )
}
