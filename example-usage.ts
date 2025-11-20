
import { loginWithEmail } from './auth';

async function handleLogin() {
  const email = 'user@example.com'; // Replace with user input
  const password = 'password123'; // Replace with user input

  try {
    const user = await loginWithEmail(email, password);
    console.log('Login successful:', user);
  } catch (err) {
    console.error('Error during login:', err);
  }
}

handleLogin();