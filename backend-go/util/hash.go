package util

import (
	"golang.org/x/crypto/bcrypt"
)

// HashPassword hashes a password using bcrypt with cost 12
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ComparePassword compares a password with a hash
func ComparePassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ValidatePassword checks if a password meets requirements
// At least 6 characters, must contain letters and numbers
func ValidatePassword(password string) bool {
	if len(password) < 6 {
		return false
	}

	hasLetter := false
	hasNumber := false

	for _, c := range password {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') {
			hasLetter = true
		}
		if c >= '0' && c <= '9' {
			hasNumber = true
		}
	}

	return hasLetter && hasNumber
}

// ValidateEmail checks if email format is valid (basic validation)
func ValidateEmail(email string) bool {
	if len(email) < 3 || len(email) > 255 {
		return false
	}

	// Basic validation: must contain @ and at least one . after @
	at := -1
	dot := -1
	for i, c := range email {
		if c == '@' {
			at = i
		}
		if c == '.' && at > 0 && i > at {
			dot = i
		}
	}

	return at > 0 && dot > at && dot < len(email)-1
}

// ValidateName checks if name meets requirements (1-50 characters)
func ValidateName(name string) bool {
	if len(name) < 1 || len(name) > 50 {
		return false
	}
	return true
}
