import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    // If SMTP is not configured, use a mock transporter
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️  SMTP not configured, email verification will be skipped');
      return null;
    }

    const port = parseInt(process.env.SMTP_PORT || '465');
    const isSecure = port === 465;
    
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // 添加调试选项
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
      // 对于阿里云邮件推送，可能需要这些选项
      tls: {
        rejectUnauthorized: false,
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

  try {
    // 确保from字段与SMTP_USER一致（阿里云要求）
    const smtpUser = process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM || `PicShare <${smtpUser}>`;
    
    await transport.sendMail({
      from: fromAddress,
      to: email,
      subject: 'PicShare - 验证您的邮箱',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📸 PicShare</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">照片即时分享平台</p>
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
  } catch (error) {
    console.error(`⚠️  邮件发送失败 (${email}):`, error.message);
    console.log(`📧 [Fallback] Verification email for ${email}: ${verifyUrl}`);
    // 返回true，允许注册继续，但记录错误
    return true;
  }
}

export async function sendPasswordResetEmail(email, token) {
  const transport = getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  if (!transport) {
    console.log(`📧 [Mock] Password reset email for ${email}: ${resetUrl}`);
    return true;
  }

  try {
    // 确保from字段与SMTP_USER一致（阿里云要求）
    const smtpUser = process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM || `PicShare <${smtpUser}>`;
    
    await transport.sendMail({
      from: fromAddress,
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
  } catch (error) {
    console.error(`⚠️  密码重置邮件发送失败 (${email}):`, error.message);
    console.log(`📧 [Fallback] Password reset email for ${email}: ${resetUrl}`);
    // 密码重置邮件失败时，返回false，让调用方处理
    throw new Error('邮件发送失败，请检查SMTP配置或稍后重试');
  }
}

export async function sendFeedbackEmail(content, images, userInfo = null, contact = null) {
  const transport = getTransporter();
  const feedbackEmail = 'zhujianxyz@163.com';
  
  if (!transport) {
    console.log(`📧 [Mock] Feedback email to ${feedbackEmail}`);
    console.log(`Content: ${content}`);
    console.log(`Contact: ${contact || '未提供'}`);
    console.log(`Images: ${images?.length || 0} files`);
    return true;
  }

  try {
    const smtpUser = process.env.SMTP_USER;
    const fromAddress = process.env.SMTP_FROM || `PicShare <${smtpUser}>`;
    
    // 构建用户信息
    const userInfoText = userInfo 
      ? `<p style="color: #666; margin-bottom: 10px;"><strong>用户信息：</strong></p>
         <ul style="color: #666; margin-left: 20px; margin-bottom: 20px;">
           <li>姓名：${userInfo.name || '未提供'}</li>
           <li>邮箱：${userInfo.email || '未提供'}</li>
           <li>用户ID：${userInfo.id || '未提供'}</li>
         </ul>`
      : '<p style="color: #666; margin-bottom: 20px;"><em>（匿名用户）</em></p>';

    // 构建联系方式信息
    const contactText = contact
      ? `<p style="color: #666; margin-bottom: 10px;"><strong>联系方式：</strong></p>
         <p style="color: #666; margin-left: 20px; margin-bottom: 20px;">${contact}</p>`
      : '';

    // 构建图片附件
    const attachments = images?.map((img, index) => ({
      filename: img.originalname || `image-${index + 1}.jpg`,
      content: img.buffer,
      cid: `image-${index + 1}`
    })) || [];

    // 构建图片HTML
    const imagesHtml = images && images.length > 0
      ? `<div style="margin-top: 20px;">
           <p style="color: #666; margin-bottom: 10px;"><strong>附件图片：</strong></p>
           <div style="display: flex; flex-wrap: wrap; gap: 10px;">
             ${images.map((img, index) => 
               `<img src="cid:image-${index + 1}" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;" alt="图片 ${index + 1}" />`
             ).join('')}
           </div>
         </div>`
      : '';

    await transport.sendMail({
      from: fromAddress,
      to: feedbackEmail,
      subject: 'PicShare - 用户意见反馈',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📸 PicShare</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">用户意见反馈</p>
          </div>
          <div style="padding: 30px; background: #fff; border: 1px solid #eee; border-top: 0;">
            ${userInfoText}
            ${contactText}
            <p style="color: #666; margin-bottom: 10px;"><strong>反馈内容：</strong></p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; white-space: pre-wrap; color: #333; line-height: 1.6;">
              ${content.replace(/\n/g, '<br>')}
            </div>
            ${imagesHtml}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">此反馈来自 PicShare 平台</p>
          </div>
        </div>
      `,
      attachments: attachments,
    });
    return true;
  } catch (error) {
    console.error(`⚠️  反馈邮件发送失败:`, error.message);
    throw new Error('邮件发送失败，请检查SMTP配置或稍后重试');
  }
}
