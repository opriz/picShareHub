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

const albClient = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'https://alb.cn-shanghai.aliyuncs.com',
  apiVersion: '2020-06-16'
});

const instanceId = 'cas_dv-cn-0w74nj9tg0ar';
const httpsListenerId = 'lsn-wr64okb5hz8k7u0qkz';

async function checkAndDeploy() {
  for (let i = 0; i < 20; i++) {
    console.log(`\n⏳ 第 ${i+1} 次检查证书状态...`);

    const detail = await casClient.request('GetInstanceDetail', {
      InstanceId: instanceId
    }, { method: 'POST', timeout: 10000 });

    console.log('  状态:', detail.Status);
    console.log('  PendingResult:', detail.PendingResult);

    if (detail.Status === 'normal' || detail.CertificateId) {
      console.log('\n✅ 证书已签发!');
      console.log('  CertificateId:', detail.CertificateId);

      // 查询证书详情获取可用于 ALB 的证书 ID
      const certResult = await casClient.request('ListUserCertificateOrder', {
        CurrentPage: 1,
        ShowSize: 50,
        OrderType: 'CERT'
      }, { method: 'POST' });

      const certs = certResult.CertificateOrderList || [];
      const apiCert = certs.find(c => c.Sans && c.Sans.includes('api.picshare.com.cn'));

      if (apiCert) {
        console.log('\n🔒 更新 ALB HTTPS 监听器证书...');
        console.log('  新证书 ID:', apiCert.CertificateId);

        // 更新 HTTPS 监听器的证书
        await albClient.request('UpdateListenerAttribute', {
          ListenerId: httpsListenerId,
          'Certificates.1.CertificateId': String(apiCert.CertificateId)
        }, { method: 'POST', timeout: 15000 });

        console.log('\n✅ ALB HTTPS 证书已更新!');
        console.log('  测试: curl https://api.picshare.com.cn/api/health');
      } else {
        console.log('⚠️  未找到 api.picshare.com.cn 的证书记录');
        console.log('  所有证书:', certs.map(c => c.Sans).join('; '));
      }
      return;
    }

    if (i < 19) {
      console.log('  等待 30 秒后重试...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  console.log('\n⚠️  证书签发超时（10分钟），请稍后手动检查');
}

checkAndDeploy().catch(e => {
  console.error('错误:', e.code, e.message);
  if (e.data) console.error(JSON.stringify(e.data, null, 2));
});
