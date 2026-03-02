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

const apiCertInstanceId = 'cas_dv-cn-0w74nj9tg0ar';
const albId = 'alb-14trlrvmsf59tp8id4';
const serverGroupId = 'sgp-rtp8zuywv0bl5hchaz';

(async () => {
  try {
    // 1. 先获取证书实例详情
    console.log('📋 获取证书实例详情...');
    const certDetail = await casClient.request('GetInstanceDetail', {
      InstanceId: apiCertInstanceId
    }, { method: 'POST', timeout: 10000 });

    console.log('证书状态:', certDetail.Status);
    console.log('证书域名:', certDetail.Domain || certDetail.Domains);

    // 2. 获取证书ID（从实例关联）
    const certId = certDetail.CertificateId;
    if (!certId) {
      console.error('❌ 证书未关联到签发订单，无法使用');
      console.log('请先在阿里云 SSL 证书控制台完成证书签发');
      return;
    }
    console.log('证书 ID:', certId);

    // 3. 查询当前 HTTPS 监听器
    console.log('\n📋 查询当前 HTTPS 监听器...');
    try {
      const listeners = await albClient.request('ListListeners', {
        LoadBalancerIds: [albId],
        ListenerProtocols: ['HTTPS']
      }, { method: 'POST', timeout: 10000 });

      const httpsListeners = listeners.Listeners || [];
      console.log('找到 ' + httpsListeners.length + ' 个 HTTPS 监听器');

      // 删除旧的 HTTPS 监听器（如果有的话）
      for (const listener of httpsListeners) {
        console.log('删除旧监听器:', listener.ListenerId);
        await albClient.request('DeleteListener', {
          ListenerId: listener.ListenerId
        }, { method: 'POST', timeout: 10000 });
      }
    } catch (e) {
      console.log('查询/删除监听器时出错:', e.message || e.code);
    }

    // 4. 创建新的 HTTPS 监听器
    console.log('\n🔒 创建新的 HTTPS 443 监听器...');
    const result = await albClient.request('CreateListener', {
      LoadBalancerId: albId,
      ListenerProtocol: 'HTTPS',
      ListenerPort: 443,
      Description: 'HTTPS Listener for api.picshare.com.cn',
      'Certificates.1.CertificateId': certId,
      'DefaultActions.1.Type': 'ForwardGroup',
      'DefaultActions.1.ForwardGroupConfig.ServerGroupTuples.1.ServerGroupId': serverGroupId,
      XForwardedForEnabled: 'true'
    }, { method: 'POST', timeout: 15000 });

    console.log('\n✅ HTTPS 监听器创建成功!');
    console.log('  ListenerId:', result.ListenerId);
    console.log('  ListenerStatus:', result.ListenerStatus);

    // 5. 验证
    console.log('\n🔍 验证 HTTPS 访问...');
    console.log('  请稍等 30 秒后测试: curl -k https://api.picshare.com.cn/api/health');

  } catch (e) {
    console.error('❌ 错误:', e.code || e.name);
    console.error('   消息:', e.message);
    if (e.data) {
      console.error('   详情:', JSON.stringify(e.data, null, 2));
    }
  }
})();
