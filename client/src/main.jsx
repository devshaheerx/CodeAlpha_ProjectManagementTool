import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfirmProvider } from './context/ConfirmContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
            <Toaster
              position="top-center"
              gutter={10}
              containerStyle={{ top: 68 }} // just below the 56px header
              toastOptions={{
                duration: 3500,
                className:
                  '!max-w-[min(26rem,calc(100vw-2rem))] !rounded-xl !border !border-zinc-200 !bg-white !px-4 !py-3 !text-sm !text-zinc-800 !shadow-lg dark:!border-zinc-700 dark:!bg-zinc-800 dark:!text-zinc-100',
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { duration: 4500, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
