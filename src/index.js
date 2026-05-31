import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import AdminPage from './AdminPage';

const isAdmin = window.location.pathname === '/admin';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <><App /><Analytics /></>}
  </React.StrictMode>
);