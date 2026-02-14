package util

import (
	"fmt"

	"picshare/config"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims represents the JWT claims structure
type JWTClaims struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
	jwt.RegisteredClaims
}

// GenerateJWT creates a JWT token for a user
func GenerateJWT(id int, email, role, name string) (string, error) {
	cfg := config.Get()

	claims := JWTClaims{
		ID:    id,
		Email: email,
		Role:  role,
		Name:  name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWT.Secret))
}

// VerifyToken validates a JWT token and returns the claims
func VerifyToken(tokenString string) (*JWTClaims, error) {
	cfg := config.Get()

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.JWT.Secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
