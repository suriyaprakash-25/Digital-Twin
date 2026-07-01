import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FloatingButton from './FloatingButton';
import CopilotWindow from './CopilotWindow';

const Copilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [activeVehicleId, setActiveVehicleId] = useState(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            setUserName(JSON.parse(storedUser).name);
          } catch (e) {}
        }

        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/copilot/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.success && res.data.data) {
          const history = [];
          res.data.data.forEach(item => {
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
  }, [isOpen, messages.length]);

  const handleSendMessage = async (text, imageBase64 = null) => {
    if (!text?.trim() && !imageBase64) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const userMsg = { text: text || '[Image Attached]', isUser: true, timestamp: new Date(), hasImage: !!imageBase64 };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/copilot/chat`, 
        { message: text, activeVehicleId, imageBase64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        const aiMsg = { 
          text: res.data.data.response,
          type: res.data.data.type || 'text',
          payload: res.data.data.payload || null,
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
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/copilot/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
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
        activeVehicleId={activeVehicleId}
        setActiveVehicleId={setActiveVehicleId}
        onAppendMessage={(msg) => setMessages(prev => [...prev, msg])}
      />
    </>
  );
};

export default Copilot;
