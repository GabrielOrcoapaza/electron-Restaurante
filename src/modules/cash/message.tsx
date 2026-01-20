import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { SEND_BROADCAST_MESSAGE } from '../../graphql/mutations';

type MessageProps = {
  onBack?: () => void;
  onSuccess?: () => void;
};

// Opciones de destinatarios según el modelo
const RECIPIENT_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'WAITERS', label: 'Mozos' },
  { value: 'COOKS', label: 'Cocineros' },
  { value: 'CASHIERS', label: 'Cajeros' },
  { value: 'ADMINS', label: 'Administradores' },
];

const Message: React.FC<MessageProps> = ({ onBack, onSuccess }) => {
  const { companyData, user } = useAuth();
  const { breakpoint } = useResponsive();
  
  // Adaptar según tamaño de pantalla de PC
  const isSmallDesktop = breakpoint === 'lg'; // 1024px - 1279px
  
  // Tamaños adaptativos
  const containerPadding = isSmallDesktop ? '1.25rem' : '1.5rem';
  const containerGap = isSmallDesktop ? '1.5rem' : '2rem';
  const buttonPadding = isSmallDesktop ? '0.625rem 1.25rem' : '0.75rem 1.5rem';
  const buttonFontSize = isSmallDesktop ? '0.8125rem' : '0.875rem';
  const [messageText, setMessageText] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('ALL');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [sendBroadcastMessageMutation] = useMutation(SEND_BROADCAST_MESSAGE);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim()) {
      setError('Por favor, escribe un mensaje');
      return;
    }

    if (!companyData?.branch.id || !user?.id) {
      setError('No se pudo obtener la información de la sucursal o usuario');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await sendBroadcastMessageMutation({
        variables: {
          branchId: companyData.branch.id,
          senderId: user.id,
          message: messageText.trim(),
          recipients: selectedRecipient,
        },
      });

      if (result.data?.sendBroadcastMessage?.success) {
        setSuccessMessage(result.data.sendBroadcastMessage.message || 'Mensaje enviado exitosamente');
        setMessageText('');
        setSelectedRecipient('ALL');
        
        // Llamar callback de éxito si existe
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      } else {
        setError(result.data?.sendBroadcastMessage?.message || 'Error al enviar el mensaje');
      }
    } catch (err: any) {
      console.error('Error enviando mensaje broadcast:', err);
      setError(err.message || 'Error al enviar el mensaje. Por favor, intenta nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: containerGap,
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f9fafb 45%, #ffffff 100%)',
        padding: containerPadding,
        borderRadius: '18px',
        boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Elementos decorativos de fondo */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle at center, rgba(102,126,234,0.25), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle at center, rgba(72,219,251,0.18), transparent 70%)',
          filter: 'blur(2px)',
          zIndex: 0,
        }}
      />

      {/* Contenido principal */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: isSmallDesktop ? '1.5rem' : '2rem',
            flexWrap: isSmallDesktop ? 'wrap' : 'nowrap',
            gap: isSmallDesktop ? '1rem' : '0'
          }}
        >
          <div>
            <h2
              style={{
                fontSize: isSmallDesktop ? '1.5rem' : '1.75rem',
                fontWeight: 700,
                color: '#1e293b',
                margin: 0,
                marginBottom: '0.5rem',
              }}
            >
              Enviar Mensaje
            </h2>
            <p
              style={{
                fontSize: isSmallDesktop ? '0.875rem' : '0.95rem',
                color: '#64748b',
                margin: 0,
              }}
            >
              Envía un mensaje a cocina, mozos u otros usuarios
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: buttonPadding,
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '10px',
                color: '#475569',
                fontSize: buttonFontSize,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
              }}
            >
              ← Volver
            </button>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSendMessage}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: isSmallDesktop ? '1.5rem' : '2rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: isSmallDesktop ? '1.25rem' : '1.5rem',
            }}
          >
            {/* Selector de destinatarios */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.75rem',
                }}
              >
                Enviar a:
              </label>
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                disabled={isSending}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  fontSize: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  background: '#ffffff',
                  color: '#1e293b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {RECIPIENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo de mensaje */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.75rem',
                }}
              >
                Mensaje:
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={isSending}
                placeholder="Escribe tu mensaje aquí... (ej: Parrilla se terminó 🍖)"
                rows={6}
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  transition: 'all 0.2s',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  textAlign: 'right',
                }}
              >
                {messageText.length}/500
              </div>
            </div>

            {/* Mensajes de error y éxito */}
            {error && (
              <div
                style={{
                  padding: '1rem',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '0.95rem',
                }}
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  padding: '1rem',
                  background: '#d1fae5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '10px',
                  color: '#065f46',
                  fontSize: '0.95rem',
                }}
              >
                ✅ {successMessage}
              </div>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#ffffff',
                background: isSending || !messageText.trim() ? '#cbd5e1' : '#667eea',
                border: 'none',
                borderRadius: '10px',
                cursor: isSending || !messageText.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isSending || !messageText.trim() ? 'none' : '0 4px 6px -1px rgba(102, 126, 234, 0.3)',
              }}
              onMouseOver={(e) => {
                if (!isSending && messageText.trim()) {
                  e.currentTarget.style.background = '#5568d3';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(102, 126, 234, 0.4)';
                }
              }}
              onMouseOut={(e) => {
                if (!isSending && messageText.trim()) {
                  e.currentTarget.style.background = '#667eea';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(102, 126, 234, 0.3)';
                }
              }}
            >
              {isSending ? 'Enviando...' : '📤 Enviar Mensaje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Message;

