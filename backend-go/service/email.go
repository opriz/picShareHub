package service

import (
	"fmt"
	"picshare/config"
	"picshare/util"
	"net/smtp"
	"strings"
)

type EmailService struct {
	smtpHost     string
	smtpPort     string
	smtpUser     string
	smtpPass     string
	frontendURL  string
}

var emailService *EmailService

// InitEmail initializes the email service
func InitEmail() {
	cfg := config.Get()

	emailService = &EmailService{
		smtpHost:    cfg.Email.SMTPHost,
		smtpPort:    cfg.Email.SMTPPort,
		smtpUser:    cfg.Email.SMTPUser,
		smtpPass:    cfg.Email.SMTPPass,
		frontendURL: cfg.Frontend.URL,
	}
}

// GetEmailService returns the email service instance
func GetEmailService() *EmailService {
	return emailService
}

// IsConfigured returns true if SMTP is properly configured
func (s *EmailService) IsConfigured() bool {
	return s.smtpHost != "" && s.smtpUser != "" && s.smtpPass != ""
}

// SendVerificationEmail sends an email verification email
func (s *EmailService) SendVerificationEmail(email, token string) error {
	if !s.IsConfigured() {
		util.Log("SMTP not configured, skipping verification email for: %s (token: %s)", email, token)
		return nil
	}

	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.frontendURL, token)
	subject := "PicShare - 验证您的邮箱"

	body := s.buildVerificationHTML(verifyURL)

	return s.send(email, subject, body)
}

// SendPasswordResetEmail sends a password reset email
func (s *EmailService) SendPasswordResetEmail(email, token string) error {
	if !s.IsConfigured() {
		util.Log("SMTP not configured, skipping password reset email for: %s", email)
		return nil
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.frontendURL, token)
	subject := "PicShare - 重置密码"

	body := s.buildPasswordResetHTML(resetURL)

	return s.send(email, subject, body)
}

// SendFeedbackEmail sends feedback notification to admin
func (s *EmailService) SendFeedbackEmail(feedbackEmail, userName, content, contactInfo string, imageUrls []string) error {
	if !s.IsConfigured() {
		util.Log("SMTP not configured, skipping feedback email")
		return nil
	}

	cfg := config.Get()
	toEmail := cfg.Email.FeedbackEmail
	if toEmail == "" {
		toEmail = "zhujianxyz@163.com"
	}

	subject := "PicShare - 用户意见反馈"

	body := s.buildFeedbackHTML(userName, content, contactInfo, imageUrls)

	return s.send(toEmail, subject, body)
}

// send sends an email using SMTP
func (s *EmailService) send(to, subject, htmlBody string) error {
	// Parse port
	port := 587
	if s.smtpPort == "465" {
		port = 465
	}

	// Build auth
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPass, s.smtpHost)

	// Build headers and body
	headers := make(map[string]string)
	headers["From"] = s.smtpUser
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	// Build message
	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	// Send
	addr := fmt.Sprintf("%s:%d", s.smtpHost, port)
	err := smtp.SendMail(addr, auth, s.smtpUser, []string{to}, []byte(message))

	return err
}

// buildVerificationHTML builds the HTML for verification email
func (s *EmailService) buildVerificationHTML(verifyURL string) string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
		.container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
		.header h1 { color: white; margin: 0; font-size: 24px; }
		.content { padding: 30px; }
		.button { display: inline-block; background: #667eea; color: white; padding: 12px 30px;
			text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
		.footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>PicShare 邮箱验证</h1>
		</div>
		<div class="content">
			<p>您好！</p>
			<p>感谢您注册 PicShare。请点击下方按钮验证您的邮箱地址：</p>
			<center><a href="` + verifyURL + `" class="button">验证邮箱</a></center>
			<p style="color: #666; font-size: 12px; margin-top: 30px;">
				如果按钮无法点击，请复制以下链接到浏览器打开：<br>
				` + verifyURL + `
			</p>
			<p style="color: #999; font-size: 12px; margin-top: 20px;">
				此链接将在24小时后失效。如果您没有注册 PicShare，请忽略此邮件。
			</p>
		</div>
		<div class="footer">
			© 2024 PicShare. All rights reserved.
		</div>
	</div>
</body>
</html>`
}

// buildPasswordResetHTML builds the HTML for password reset email
func (s *EmailService) buildPasswordResetHTML(resetURL string) string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
		.container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
		.header h1 { color: white; margin: 0; font-size: 24px; }
		.content { padding: 30px; }
		.button { display: inline-block; background: #667eea; color: white; padding: 12px 30px;
			text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: bold; }
		.footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>PicShare 密码重置</h1>
		</div>
		<div class="content">
			<p>您好！</p>
			<p>我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
			<center><a href="` + resetURL + `" class="button">重置密码</a></center>
			<p style="color: #666; font-size: 12px; margin-top: 30px;">
				如果按钮无法点击，请复制以下链接到浏览器打开：<br>
				` + resetURL + `
			</p>
			<p style="color: #999; font-size: 12px; margin-top: 20px;">
				此链接将在1小时后失效。如果您没有请求重置密码，请忽略此邮件。
			</p>
		</div>
		<div class="footer">
			© 2024 PicShare. All rights reserved.
		</div>
	</div>
</body>
</html>`
}

// buildFeedbackHTML builds the HTML for feedback email
func (s *EmailService) buildFeedbackHTML(userName, content, contactInfo string, imageUrls []string) string {
	userInfo := "匿名用户"
	if userName != "" {
		userInfo = userName
	}

	imagesHTML := ""
	if len(imageUrls) > 0 {
		imagesHTML = "<p><strong>附件图片：</strong></p>"
		for _, url := range imageUrls {
			imagesHTML += fmt.Sprintf(`<p><img src="%s" style="max-width: 100%%; border-radius: 4px;"></p>`, url)
		}
	}

	contactHTML := ""
	if contactInfo != "" {
		contactHTML = fmt.Sprintf("<p><strong>联系方式：</strong>%s</p>", contactInfo)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
		.container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
		.header h1 { color: white; margin: 0; font-size: 24px; }
		.content { padding: 30px; }
		.footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>PicShare 用户反馈</h1>
		</div>
		<div class="content">
			<p><strong>用户：</strong>%s</p>
			%s
			<p><strong>反馈内容：</strong></p>
			<p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">%s</p>
			%s
		</div>
		<div class="footer">
			© 2024 PicShare. All rights reserved.
		</div>
	</div>
</body>
</html>`, userInfo, contactHTML, strings.ReplaceAll(content, "\n", "<br>"), imagesHTML)
}
