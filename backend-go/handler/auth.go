package handler

import (
	"context"
	"net/http"
	"picshare/middleware"
	"picshare/model"
	"picshare/repository"
	"picshare/service"
	"picshare/util"
	"time"

	"github.com/gin-gonic/gin"
)

type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name" binding:"required"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type resetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required"`
}

type updateProfileRequest struct {
	Name string `json:"name" binding:"required"`
}

// Register - POST /api/auth/register
func Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的邮箱地址"})
		return
	}

	// Validate password
	if !util.ValidatePassword(req.Password) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码至少6位，且必须包含字母和数字"})
		return
	}

	// Validate name
	if !util.ValidateName(req.Name) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "昵称为1-50个字符"})
		return
	}

	ctx := context.Background()

	// Check if email already exists
	existingUser, _ := repository.FindUserByEmail(ctx, req.Email)
	if existingUser != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该邮箱已被注册"})
		return
	}

	// Hash password
	passwordHash, err := util.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败，请稍后重试"})
		return
	}

	// Generate verification token
	verificationToken := util.GenerateRandomToken()
	verificationExpires := time.Now().Add(24 * time.Hour)

	// Create user
	user := &model.User{
		Email:             req.Email,
		PasswordHash:      passwordHash,
		Name:              req.Name,
		Role:              "photographer",
		EmailVerified:      false,
		VerificationToken: &verificationToken,
		VerificationExpires: &verificationExpires,
	}

	err = repository.CreateUser(ctx, user)
	if err != nil {
		util.Log("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "注册失败，请稍后重试"})
		return
	}

	// Auto-verify if SMTP not configured
	emailService := service.GetEmailService()
	if !emailService.IsConfigured() {
		// Auto-verify in dev
		repository.VerifyEmail(ctx, verificationToken)
		user.EmailVerified = true
	} else {
		// Send verification email
		_ = emailService.SendVerificationEmail(req.Email, verificationToken)
	}

	// Generate JWT token
	token, _ := util.GenerateJWT(user.ID, user.Email, user.Role, user.Name)

	message := "注册成功！"
	if !user.EmailVerified {
		message = "注册成功！我们已向您的邮箱发送了验证邮件，请查收并点击链接验证邮箱。验证后即可使用全部功能。"
	} else {
		message = "注册成功！"
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": message,
		"token":   token,
		"user": gin.H{
			"id":           user.ID,
			"email":        user.Email,
			"name":         user.Name,
			"role":         user.Role,
			"emailVerified": user.EmailVerified,
		},
	})
}

// Login - POST /api/auth/login
func Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的邮箱地址"})
		return
	}

	ctx := context.Background()

	// Find user
	user, err := repository.FindUserByEmail(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	// Verify password
	if !util.ComparePassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	// Generate token
	token, _ := util.GenerateJWT(user.ID, user.Email, user.Role, user.Name)

	message := "登录成功"
	emailVerified := user.EmailVerified
	if !emailVerified {
		message = "登录成功！请尽快验证您的邮箱以使用全部功能。"
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           message,
		"token":             token,
		"user": gin.H{
			"id":           user.ID,
			"email":        user.Email,
			"name":         user.Name,
			"role":         user.Role,
			"avatarUrl":    user.AvatarURL,
			"emailVerified": emailVerified,
		},
		"requiresVerification": !emailVerified,
	})
}

// VerifyEmail - GET /api/auth/verify-email
func VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的验证链接"})
		return
	}

	ctx := context.Background()
	err := repository.VerifyEmail(ctx, token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "验证链接已过期或无效"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "邮箱验证成功！"})
}

// ResendVerification - POST /api/auth/resend-verification
func ResendVerification(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入有效的邮箱地址"})
		return
	}

	ctx := context.Background()

	// Always return success to prevent email enumeration
	user, err := repository.FindUserByEmail(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "如果该邮箱已注册，我们已发送验证邮件"})
		return
	}

	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "该邮箱已验证，无需重新验证"})
		return
	}

	// Generate new verification token
	verificationToken := util.GenerateRandomToken()
	verificationExpires := time.Now().Add(24 * time.Hour)

	_ = repository.SetVerificationToken(ctx, user.ID, verificationToken, verificationExpires)

	// Send email
	emailService := service.GetEmailService()
	_ = emailService.SendVerificationEmail(req.Email, verificationToken)

	c.JSON(http.StatusOK, gin.H{"message": "如果该邮箱已注册，我们已发送验证邮件"})
}

// ForgotPassword - POST /api/auth/forgot-password
func ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入邮箱地址"})
		return
	}

	ctx := context.Background()

	// Always return success to prevent email enumeration
	user, err := repository.FindUserByEmail(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "如果该邮箱已注册，我们已发送密码重置邮件"})
		return
	}

	// Generate reset token
	resetToken := util.GenerateRandomToken()
	resetExpires := time.Now().Add(1 * time.Hour)

	_ = repository.SetResetToken(ctx, user.ID, resetToken, resetExpires)

	// Send email
	emailService := service.GetEmailService()
	_ = emailService.SendPasswordResetEmail(req.Email, resetToken)

	c.JSON(http.StatusOK, gin.H{"message": "如果该邮箱已注册，我们已发送密码重置邮件"})
}

// ResetPassword - POST /api/auth/reset-password
func ResetPassword(c *gin.Context) {
	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写完整"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码至少6位"})
		return
	}

	ctx := context.Background()

	// Find user with valid reset token
	user, err := repository.FindUserByResetToken(ctx, req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "重置链接已过期或无效"})
		return
	}

	// Hash new password
	newHash, err := util.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "重置密码失败"})
		return
	}

	// Update password
	err = repository.UpdateUserPassword(ctx, user.ID, newHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "重置密码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码重置成功，请使用新密码登录"})
}

// GetProfile - GET /api/auth/profile
func GetProfile(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	ctx := context.Background()
	user, err := repository.FindUserByID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":           user.ID,
			"email":        user.Email,
			"name":         user.Name,
			"role":         user.Role,
			"avatarUrl":    user.AvatarURL,
			"emailVerified": user.EmailVerified,
			"createdAt":    user.CreatedAt,
		},
	})
}

// UpdateProfile - PUT /api/auth/profile
func UpdateProfile(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入昵称"})
		return
	}

	ctx := context.Background()
	err := repository.UpdateUser(ctx, userID, req.Name, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// ChangePassword - PUT /api/auth/change-password
func ChangePassword(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写完整"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "新密码至少6位"})
		return
	}

	ctx := context.Background()
	user, err := repository.FindUserByID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户不存在"})
		return
	}

	// Verify current password
	if !util.ComparePassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前密码错误"})
		return
	}

	// Hash new password
	newHash, err := util.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改密码失败"})
		return
	}

	err = repository.UpdateUserPassword(ctx, userID, newHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改密码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}
