const RPCClient = require('@alicloud/pop-core');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const AK = process.env.ACCESS_KEY_ID;
const SK = process.env.ACCESS_KEY_SECRET;

const client = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'https://alb.cn-shanghai.aliyuncs.com',
  apiVersion: '2020-06-16'
});

const albId = 'alb-14trlrvmsf59tp8id4';
const certId = '23510263';
const serverGroupId = 'sgp-rtp8zuywv0bl5hchaz';

(async () => {
  console.log('Creating HTTPS 443 listener on ALB...');
  console.log('  ALB:', albId);
  console.log('  Cert:', certId);
  console.log('  ServerGroup:', serverGroupId);

  try {
    const result = await client.request('CreateListener', {
      LoadBalancerId: albId,
      ListenerProtocol: 'HTTPS',
      ListenerPort: 443,
      Description: 'HTTPS Listener',
      'Certificates.1.CertificateId': certId,
      'DefaultActions.1.Type': 'ForwardGroup',
      'DefaultActions.1.ForwardGroupConfig.ServerGroupTuples.1.ServerGroupId': serverGroupId,
      XForwardedForEnabled: 'true'
    }, { method: 'POST', timeout: 15000 });

    console.log('\nHTTPS Listener created!');
    console.log('  ListenerId:', result.ListenerId);
    console.log('  RequestId:', result.RequestId);
  } catch (e) {
    console.error('Error:', e.code, e.message);
    if (e.data) console.error('Details:', JSON.stringify(e.data, null, 2));
  }
})();
