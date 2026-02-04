// Only letters (A-Z, a-z)
function isValidUsername(username) {
  return /^[A-Za-z]+$/.test(username)
}

// Must be @gmail.com
function isValidGmail(email) {
  return /^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)
}

module.exports = {
  isValidUsername,
  isValidGmail,
}
