// Simple test script to verify the API endpoint works
const testApi = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello, can you help me?' }
        ],
        role: 'employee'
      }),
    });

    const data = await response.json();
    console.log('API Response:', data);
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testApi();