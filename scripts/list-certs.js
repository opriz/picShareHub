const RPCClient = require('@alicloud/pop-core');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const AK = process.env.ACCESS_KEY_ID;
const SK = process.env.ACCESS_KEY_SECRET;

// CAS 证书服务
const casClient = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'https://cas.aliyuncs.com',
  apiVersion: '2020-04-07'
});

(async () => {
  // 1. 列出所有已签发的证书
  console.log('📋 查询所有证书...\n');
  const result = await casClient.request('ListUserCertificateOrder', {
    CurrentPage: 1,
    ShowSize: 50,
    OrderType: 'CERT'
  }, { method: 'POST' });

  const certs = result.CertificateOrderList || [];
  console.log('找到 ' + certs.length + ' 个证书:\n');

  certs.forEach((cert, i) => {
    console.log((i+1) + '. ' + cert.Name);
    console.log('   CertificateId: ' + cert.CertificateId);
    console.log('   InstanceId: ' + cert.InstanceId);
    console.log('   域名: ' + cert.Domain);
    console.log('   状态: ' + cert.Status);
    console.log('   SANs: ' + (cert.Sans || 'N/A'));
    if (cert.CertStartTime) {
      console.log('   有效: ' + new Date(cert.CertStartTime).toLocaleDateString() + ' ~ ' + new Date(cert.CertEndTime).toLocaleDateString());
    }
    console.log('');
  });

  // 2. 也查询未签发的（待部署的）
  console.log('\n📋 查询待部署证书...\n');
  const result2 = await casClient.request('ListUserCertificateOrder', {
    CurrentPage: 1,
    ShowSize: 50,
    OrderType: 'UPLOAD'
  }, { method: 'POST' });

  const certs2 = result2.CertificateOrderList || [];
  console.log('找到 ' + certs2.length + ' 个上传证书:\n');
  certs2.forEach((cert, i) => {
    console.log((i+1) + '. ' + cert.Name);
    console.log('   CertificateId: ' + cert.CertificateId);
    console.log('   域名: ' + cert.Domain);
    console.log('   状态: ' + cert.Status);
    console.log('');
  });
})();
