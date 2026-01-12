import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize theme on page load
const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
const initialTheme = savedTheme || 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);
// Legacy class support
document.documentElement.classList.remove('theme-dark', 'theme-light');
document.documentElement.classList.add(initialTheme === 'light' ? 'theme-light' : 'theme-dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)