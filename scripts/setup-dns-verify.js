const RPCClient = require('@alicloud/pop-core');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const AK = process.env.ACCESS_KEY_ID;
const SK = process.env.ACCESS_KEY_SECRET;

const alidnsClient = new RPCClient({
  accessKeyId: AK,
  accessKeySecret: SK,
  endpoint: 'https://alidns.cn-shanghai.aliyuncs.com',
  apiVersion: '2015-01-09'
});

(async () => {
  const domain = 'picshare.com.cn';
  const subDomain = '_dnsauth.api';
  const rr = '_dnsauth.api';
  const recordValue = '202602130000000r8miaywsoqi7pk7iut53p16ouo62gyxz3io1o2xm5ce93mv8y';

  console.log('🔍 Step 1: 查询现有 DNS 记录...');
  try {
    const existing = await alidnsClient.request('DescribeSubDomainRecords', {
      DomainName: domain,
      SubDomain: subDomain,
      Type: 'TXT'
    }, { method: 'POST' });

    const records = existing.DomainRecords?.Record || [];
    console.log('  现有 ' + records.length + ' 条记录');

    // 删除旧记录（如果有）
    for (const rec of records) {
      console.log('  删除旧记录:', rec.RecordId);
      await alidnsClient.request('DeleteDomainRecord', {
        RecordId: rec.RecordId
      }, { method: 'POST' });
    }
  } catch (e) {
    console.log('  没有旧记录，或查询失败');
  }

  console.log('\n📝 Step 2: 添加 DNS TXT 记录...');
  console.log('  域名: ' + rr + '.' + domain);
  console.log('  类型: TXT');
  console.log('  值: ' + recordValue);

  const result = await alidnsClient.request('AddDomainRecord', {
    DomainName: domain,
    RR: rr,
    Type: 'TXT',
    Value: recordValue,
    TTL: '600'
  }, { method: 'POST', timeout: 15000 });

  console.log('\n✅ DNS 记录已添加!');
  console.log('  RecordId:', result.RecordId);

  console.log('\n⏳ Step 3: 等待 DNS 传播 (约 30-60 秒)...');
  await new Promise(r => setTimeout(r, 30000));

  console.log('\n🔍 Step 4: 验证 DNS...');
  const verify = await alidnsClient.request('DescribeSubDomainRecords', {
    DomainName: domain,
    SubDomain: subDomain,
    Type: 'TXT'
  }, { method: 'POST' });

  const records = verify.DomainRecords?.Record || [];
  if (records.length > 0) {
    console.log('⚠️  DNS 记录还未生效，可能需要再等一会');
  } else {
    console.log('✅ DNS 已生效!');
    records.forEach(r => {
      console.log('  ' + r.RR + ' -> ' + r.Value);
    });
  }
})();
