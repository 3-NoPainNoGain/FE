// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Provider 대신 Loader를 쓰거나(아래 3번), 이후에 다시 Provider로 바꿔도 됨

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
