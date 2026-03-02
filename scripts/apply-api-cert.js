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
  const instanceId = 'cas_dv-cn-0w74nj9tg0ar';
  const domain = 'api.picshare.com.cn';

  // Step 1: 提交证书申请
  console.log('🔒 Step 1: 提交证书申请...');
  console.log('  实例:', instanceId);
  console.log('  域名:', domain);

  try {
    const result = await casClient.request('CreateCertificateForPackageRequest', {
      ProductCode: 'digicert-free-1-free',
      Domain: domain,
      ValidateType: 'DNS',
    }, { method: 'POST', timeout: 15000 });

    console.log('\n✅ 证书申请已提交!');
    console.log('  OrderId:', result.OrderId);
    console.log('  CertificateId:', result.CertificateId);

    // Step 2: 查询 DNS 验证信息
    console.log('\n🔍 Step 2: 查询 DNS 验证信息...');
    const state = await casClient.request('DescribeCertificateState', {
      OrderId: result.OrderId
    }, { method: 'POST', timeout: 15000 });

    console.log('  验证类型:', state.Type);
    console.log('  验证域名:', state.Domain);
    console.log('  记录类型:', state.RecordType);
    console.log('  主机记录:', state.RecordDomain);
    console.log('  记录值:', state.RecordValue);
    console.log('  验证状态:', state.ValidateType);

  } catch (e) {
    console.error('❌ 错误:', e.code || e.name);
    console.error('   消息:', e.message);
    if (e.data) console.error('   详情:', JSON.stringify(e.data, null, 2));
  }
})();
