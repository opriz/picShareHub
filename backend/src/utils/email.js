import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    // If SMTP is not configured, use a mock transporter
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured, email verification will be skipped');
      return null;
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendVerificationEmail(email, token) {
  const transport = getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  if (!transport) {
    console.log(`📧 [Mock] Verification email for ${email}: ${verifyUrl}`);
    return true;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || '"PicShare" <noreply@picshare.com.cn>',
    to: email,
    subject: 'PicShare - 验证您的邮箱',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📸 PicShare</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">摄影师照片分享平台</p>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #eee; border-top: 0;">
          <h2 style="color: #333; margin-top: 0;">验证您的邮箱</h2>
          <p style="color: #666; line-height: 1.6;">感谢注册 PicShare！请点击下方按钮验证您的邮箱地址：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
              验证邮箱
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">此链接将在 24 小时后过期。如果您没有注册 PicShare，请忽略此邮件。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">如果按钮无法点击，请复制以下链接到浏览器：<br>${verifyUrl}</p>
        </div>
      </div>
    `,
  });

  return true;
}

export async function sendPasswordResetEmail(email, token) {
  const transport = getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  if (!transport) {
    console.log(`📧 [Mock] Password reset email for ${email}: ${resetUrl}`);
    return true;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || '"PicShare" <noreply@picshare.com.cn>',
    to: email,
    subject: 'PicShare - 重置密码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📸 PicShare</h1>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #eee; border-top: 0;">
          <h2 style="color: #333; margin-top: 0;">重置密码</h2>
          <p style="color: #666;">请点击下方按钮重置您的密码：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
              重置密码
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">此链接将在 1 小时后过期。</p>
        </div>
      </div>
    `,
  });

  return true;
}
