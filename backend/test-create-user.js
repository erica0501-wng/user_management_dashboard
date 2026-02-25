const fetch = require('node-fetch');

async function testCreateUser() {
  console.log('🧪 Testing user creation...\n');
  
  try {
    // Register a test user
    const res = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test123!',
        age: 25,
        gender: 'Male'
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      console.log('✅ User created successfully!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed to create user');
      console.log('Error:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCreateUser();
