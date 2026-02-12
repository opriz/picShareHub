import OSS from 'ali-oss'
import { OSS_CONFIG, isOSSConfigured } from '../config/oss.config'

let ossClient = null

// 初始化OSS客户端
export const getOSSClient = () => {
  if (!isOSSConfigured()) {
    console.warn('OSS未配置，使用本地存储模式')
    return null
  }

  if (!ossClient) {
    try {
      ossClient = new OSS({
        region: OSS_CONFIG.region,
        accessKeyId: OSS_CONFIG.accessKeyId,
        accessKeySecret: OSS_CONFIG.accessKeySecret,
        bucket: OSS_CONFIG.bucket,
      })
    } catch (error) {
      console.error('OSS客户端初始化失败:', error)
      return null
    }
  }

  return ossClient
}

// 上传文件到OSS
export const uploadToOSS = async (file) => {
  const client = getOSSClient()
  
  if (!client) {
    // 如果OSS未配置，返回本地预览URL
    console.log('使用本地模式，不上传到OSS')
    return URL.createObjectURL(file)
  }

  try {
    // 生成唯一文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const ext = file.name.split('.').pop()
    const fileName = `photos/${timestamp}_${randomStr}.${ext}`

    // 上传文件
    const result = await client.put(fileName, file)

    // 如果配置了CDN，返回CDN地址
    if (OSS_CONFIG.cdnDomain) {
      return `https://${OSS_CONFIG.cdnDomain}/${fileName}`
    }

    // 返回OSS直连地址
    return result.url
  } catch (error) {
    console.error('上传到OSS失败:', error)
    throw error
  }
}

// 删除OSS上的文件
export const deleteFromOSS = async (fileUrl) => {
  const client = getOSSClient()
  
  if (!client) {
    console.log('使用本地模式，无需删除OSS文件')
    return
  }

  try {
    // 从URL中提取文件名
    const urlObj = new URL(fileUrl)
    const fileName = urlObj.pathname.substring(1) // 去掉开头的 '/'

    await client.delete(fileName)
    console.log('文件删除成功:', fileName)
  } catch (error) {
    console.error('从OSS删除文件失败:', error)
    throw error
  }
}

// 获取临时访问URL（用于私有bucket）
export const getTemporaryURL = async (fileName, expires = 3600) => {
  const client = getOSSClient()
  
  if (!client) {
    return fileName
  }

  try {
    const url = client.signatureUrl(fileName, {
      expires, // 默认1小时
    })
    return url
  } catch (error) {
    console.error('获取临时URL失败:', error)
    return fileName
  }
}
