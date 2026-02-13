import OSS from 'ali-oss';
import dotenv from 'dotenv';

dotenv.config();

let ossClient = null;

export function getOSSClient() {
  if (!ossClient) {
    ossClient = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_AK,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_SK,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com',
      secure: true,
    });
  }
  return ossClient;
}

export function getOSSBaseUrl() {
  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou';
  return `https://${bucket}.${region}.aliyuncs.com`;
}
