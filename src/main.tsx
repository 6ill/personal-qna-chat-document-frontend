import { StrictMode } from 'react'
import './index.css'
import App from './App.tsx'
import { Provider } from 'react-redux';
import { store } from './store/store';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);