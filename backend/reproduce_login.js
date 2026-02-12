async function testLogin() {
  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: 'ericawong@gmail.com',
        password: 'password123'
      })
    });
    
    if (response.ok) {
        const data = await response.json();
        console.log('Login successful:', data.token ? 'Token received' : 'No token');
    } else {
        console.log('Login failed with status:', response.status);
        const text = await response.text();
        console.log('Response body:', text);
    }

  } catch (error) {
    console.log('Error:', error.message);
  }
}

testLogin();