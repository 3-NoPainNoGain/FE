// src/index.js
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import './index.css'   // FE/src에 없으면 새로 만들어주세요.

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
