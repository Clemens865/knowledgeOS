import React from 'react';

function TestApp() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '24px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        padding: '40px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <h1>KnowledgeOS is Loading...</h1>
        <p>If you see this, React is working!</p>
        <p style={{ fontSize: '14px', marginTop: '20px' }}>
          Check the console for any errors (Cmd+Option+I)
        </p>
      </div>
    </div>
  );
}

export default TestApp;