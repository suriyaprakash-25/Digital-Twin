import { useState, useEffect } from 'react';
import FloatingButton from './FloatingButton';
import CopilotWindow from './CopilotWindow';
import { FEATURES } from '../../config/features';
import { apiDelete, apiGet, apiPost } from '../../utils/api';
import { useAuth } from '../../context/authContextCore';
import { useToast } from '../../context/toastContextCore';
import { getErrorMessage } from '../../utils/api';

const Copilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, role, isAuthenticated } = useAuth();
  const { showError } = useToast();
  const userName = user?.name || '';
  const userRole = role || 'USER';
  const [activeVehicleId, setActiveVehicleId] = useState(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!isAuthenticated) return;

        const data = await apiGet('/copilot/history');

        if (data.success && data.data) {
          const history = [];
          data.data.forEach(item => {
            history.push({ text: item.message, isUser: true, timestamp: item.createdAt, hasImage: item.hasImage });
            if (item.response) {
              history.push({ 
                text: item.response, 
                isUser: false, 
                timestamp: item.createdAt,
                type: item.type || 'text',
                payload: item.payload || null
              });
            }
          });
          setMessages(history);
        }
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      }
    };

    if (isOpen && messages.length === 0) {
      fetchHistory();
    }
  }, [isOpen, messages.length, isAuthenticated]);

  const handleSendMessage = async (text, imageBase64 = null) => {
    if (!text?.trim() && !imageBase64) return;

    if (!isAuthenticated) return;

    if (!FEATURES.AI_DOCTOR && text) {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('ai doctor') || lowerText.includes('diagnos')) {
        const userMsg = { text: text || '[Image Attached]', isUser: true, timestamp: new Date(), hasImage: !!imageBase64 };
        setMessages(prev => [...prev, userMsg]);
        
        const aiMsg = { 
          text: "This feature is currently under development and will be available in a future update.",
          isUser: false, 
          timestamp: new Date() 
        };
        setTimeout(() => setMessages(prev => [...prev, aiMsg]), 400);
        return;
      }
    }

    const userMsg = { text: text || '[Image Attached]', isUser: true, timestamp: new Date(), hasImage: !!imageBase64 };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const data = await apiPost('/copilot/chat', { message: text, activeVehicleId, imageBase64 });

      if (data.success) {
        const aiMsg = { 
          text: data.data.response,
          type: data.data.type || 'text',
          payload: data.data.payload || null,
          isUser: false, 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = { 
        text: "I'm sorry, I encountered an error connecting to my servers. Please try again.", 
        isUser: false, 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await apiDelete('/copilot/history');
      setMessages([]);
    } catch (error) {
      showError(getErrorMessage(error, 'Could not clear the chat history.'));
    }
  };

  return (
    <>
      <FloatingButton 
        isOpen={isOpen} 
        onClick={() => setIsOpen(!isOpen)} 
      />
      <CopilotWindow 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        userName={userName}
        userRole={userRole}
        activeVehicleId={activeVehicleId}
        setActiveVehicleId={setActiveVehicleId}
        onAppendMessage={(msg) => setMessages(prev => [...prev, msg])}
      />
    </>
  );
};

export default Copilot;
