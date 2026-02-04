/**
 * Validates password requirements:
 * - Must contain at least one letter (A-Z, a-z)
 * - Must contain at least one number (0-9)
 * - Cannot be only numbers
 * - Cannot be only symbols
 */
export function validatePassword(password) {
  if (!password || password.trim().length === 0) {
    return { valid: false, message: "Password is required" }
  }

  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasLetter || !hasNumber) {
    return { 
      valid: false, 
      message: "Password must contain both letters and numbers" 
    }
  }

  return { valid: true, message: "" }
}

/**
 * Validates password confirmation
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, message: "Passwords do not match" }
  }
  return { valid: true, message: "" }
}
