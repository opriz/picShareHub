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

  // 尝试用已有实例提交证书申请
  console.log('🔒 尝试用已有实例提交证书申请...');
  console.log('  InstanceId:', instanceId);

  try {
    const result = await casClient.request('ApplyCertificate', {
      InstanceId: instanceId,
      Domain: 'api.picshare.com.cn',
      ValidateType: 'DNS'
    }, { method: 'POST', timeout: 15000 });

    console.log('✅ 申请已提交!');
    console.log('  OrderId:', result.OrderId);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('ApplyCertificate 失败:', e.code, e.message);
  }

  // 尝试另一个 API
  try {
    console.log('\n尝试 CreateCertificateRequest...');
    const result2 = await casClient.request('CreateCertificateRequest', {
      ProductCode: 'digicert-free-1-free',
      Domain: 'api.picshare.com.cn',
      ValidateType: 'DNS',
      InstanceId: instanceId
    }, { method: 'POST', timeout: 15000 });

    console.log('✅ 申请已提交!');
    console.log(JSON.stringify(result2, null, 2));
  } catch (e) {
    console.log('CreateCertificateRequest 失败:', e.code, e.message);
  }

  // 尝试查看是否有未完成的订单
  try {
    console.log('\n查询实例关联的订单...');
    const detail = await casClient.request('GetInstanceDetail', {
      InstanceId: instanceId
    }, { method: 'POST', timeout: 10000 });
    console.log('完整详情:');
    console.log(JSON.stringify(detail, null, 2));
  } catch (e) {
    console.log('查询失败:', e.code, e.message);
  }

  // 尝试用 DescribeCertificateState 查看是否有待验证的
  try {
    console.log('\n查询证书状态 (OrderId=0)...');
    const state = await casClient.request('DescribeCertificateState', {
      OrderId: 0
    }, { method: 'POST', timeout: 10000 });
    console.log(JSON.stringify(state, null, 2));
  } catch (e) {
    console.log('查询失败:', e.code, e.message);
  }
})();
