const RPCClient = require('@alicloud/pop-core');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const AK = process.env.ACCESS_KEY_ID;
const SK = process.env.ACCESS_KEY_SECRET;

const casClient = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'https://cas.aliyuncs.com',
  apiVersion: '2020-04-07'
});

(async () => {
  console.log('📋 查询 api.picshare.com.cn 证书详情...\n');

  const certDetail = await casClient.request('GetInstanceDetail', {
    InstanceId: 'cas_dv-cn-0w74nj9tg0ar'
  }, { method: 'POST', timeout: 10000 });

  console.log('证书详情:');
  console.log('  InstanceId:', certDetail.InstanceId);
  console.log('  状态:', certDetail.Status);
  console.log('  域名:', certDetail.Domain);
  console.log('  状态码:', certDetail.StatusCode);
  console.log('  订单ID:', certDetail.OrderId);
  console.log('  CertificateId:', certDetail.CertificateId);
  console.log('  创建时间:', certDetail.GmtCreate);
  console.log('  过期时间:', certDetail.GmtEnd);

  if (certDetail.Status === 'pending') {
    console.log('\n⚠️  证书状态为 pending，需要完成签发流程');
    console.log('\n可能的操作:');
    console.log('  1. 如果是 DV 证书，可能需要 DNS 验证');
    console.log('  2. 检查阿里云 SSL 证书控制台');
  }
})();
