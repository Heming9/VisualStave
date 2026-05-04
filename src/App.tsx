import DiagnosticPage from './pages/Diagnostic';
import Home from './pages/Home';
import { useState } from 'react';

function App() {
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  return (
    <>
      {showDiagnostic ? (
        <DiagnosticPage />
      ) : (
        <Home />
      )}
      <button
        onClick={() => setShowDiagnostic(!showDiagnostic)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
        }}
      >
        {showDiagnostic ? '返回主页面' : '🔧 诊断工具'}
      </button>
    </>
  );
}

export default App;
