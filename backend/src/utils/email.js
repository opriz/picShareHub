import China from '@alicloud/pop-core';

let dmClient = null;

function getDMClient() {
  if (!dmClient) {
    const ak = process.env.OSS_ACCESS_KEY_ID || process.env.ALIYUN_AK;
    const sk = process.env.OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_SK;
    if (!ak || !sk) {
      console.warn('⚠️  Aliyun AK/SK not configured, emails disabled');
      return null;
    }
    dmClient = new China({
      accessKeyId: ak,
      accessKeySecret: sk,
      endpoint: 'https://dm.aliyuncs.com',
      apiVersion: '2015-11-23',
    });
  }
  return dmClient;
}

const SENDER = process.env.DM_SENDER || 'noreply@picshare.com.cn';

const BRAND_HEADER = `
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">📸 PicShare</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px;">摄影师照片分享平台</p>
  </div>`;

function wrap(body) {
  return `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${BRAND_HEADER}<div style="padding:28px 24px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;">${body}</div></div>`;
}

async function send(to, subject, html) {
  const client = getDMClient();
  if (!client) {
    console.log(`📧 [No DM Client] To: ${to}, Subject: ${subject}`);
    return false;
  }

  try {
    await client.request('SingleSendMail', {
      AccountName: SENDER,
      AddressType: 1,
      ReplyToAddress: false,
      ToAddress: to,
      Subject: subject,
      HtmlBody: html,
    }, { method: 'POST' });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`📧 Email failed to ${to}:`, error.message || error);
    return false;
  }
}

export async function sendVerificationEmail(email, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  return send(email, 'PicShare - 验证您的邮箱', wrap(`
    <h2 style="color:#333;margin:0 0 12px;font-size:18px;">验证您的邮箱</h2>
    <p style="color:#666;line-height:1.6;margin:0 0 24px;">感谢注册 PicShare！请点击下方按钮验证您的邮箱地址：</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:12px 32px;text-decoration:none;border-radius:8px;font-size:15px;display:inline-block;">验证邮箱</a>
    </div>
    <p style="color:#999;font-size:12px;">此链接 24 小时内有效。</p>
  `));
}

export async function sendVerificationCode(email, code) {
  return send(email, `PicShare - 验证码 ${code}`, wrap(`
    <h2 style="color:#333;margin:0 0 12px;font-size:18px;">修改密码验证码</h2>
    <p style="color:#666;line-height:1.6;margin:0 0 20px;">您正在修改密码，验证码为：</p>
    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background:#f3f4f6;padding:16px 40px;border-radius:12px;font-size:32px;font-weight:700;letter-spacing:8px;color:#333;">${code}</span>
    </div>
    <p style="color:#999;font-size:13px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
  `));
}

export async function sendPasswordResetEmail(email, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  return send(email, 'PicShare - 重置密码', wrap(`
    <h2 style="color:#333;margin:0 0 12px;font-size:18px;">重置密码</h2>
    <p style="color:#666;line-height:1.6;margin:0 0 24px;">您请求了密码重置，请点击下方按钮设置新密码：</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:12px 32px;text-decoration:none;border-radius:8px;font-size:15px;display:inline-block;">重置密码</a>
    </div>
    <p style="color:#999;font-size:12px;">此链接 1 小时内有效。如果不是您的操作，请忽略此邮件。</p>
  `));
}
