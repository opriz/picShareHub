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
  // 查询所有类型的证书订单
  const types = ['CERT', 'UPLOAD', 'BUY', 'FREE', 'CPACK'];

  for (const orderType of types) {
    try {
      const result = await casClient.request('ListUserCertificateOrder', {
        CurrentPage: 1,
        ShowSize: 50,
        OrderType: orderType
      }, { method: 'POST' });

      const certs = result.CertificateOrderList || [];
      if (certs.length > 0) {
        console.log('📋 类型 ' + orderType + ' (' + certs.length + ' 个):');
        certs.forEach((cert, i) => {
          console.log('  ' + (i+1) + '. ' + (cert.Name || 'N/A') + ' | ID:' + cert.CertificateId + ' | 域名:' + (cert.Domain || cert.Sans || 'N/A') + ' | 状态:' + cert.Status);
        });
        console.log('');
      }
    } catch (e) {
      // skip invalid types
    }
  }

  // 查询证书实例
  console.log('📋 查询证书实例...');
  try {
    const result = await casClient.request('ListInstances', {
      CurrentPage: 1,
      ShowSize: 50
    }, { method: 'POST' });
    const instances = result.InstanceList || [];
    console.log('找到 ' + instances.length + ' 个实例:');
    instances.forEach((inst, i) => {
      console.log('  ' + (i+1) + '. ' + inst.InstanceId + ' | 状态:' + inst.Status + ' | 域名:' + (inst.Domain || 'N/A'));
    });
  } catch (e) {
    console.log('  查询失败:', e.code || e.message);
  }

  // 查询免费证书包
  console.log('\n📋 查询证书包状态...');
  try {
    const result = await casClient.request('DescribePackageState', {}, { method: 'POST' });
    console.log('  总数:', result.TotalCount);
    console.log('  已用:', result.UsedCount);
    console.log('  剩余:', result.TotalCount - result.UsedCount);
  } catch (e) {
    console.log('  查询失败:', e.code || e.message);
  }
})();
