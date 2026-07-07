import React, { useRef, useEffect, useState } from 'react';
import { X, Bot, Home, Loader2 } from 'lucide-react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import QuickActions from './QuickActions';
import EmergencyPanel from './EmergencyPanel';
import ContextPanel from './ContextPanel';
import VehicleCard from './cards/VehicleCard';
import PassportCard from './cards/PassportCard';
import GarageCard from './cards/GarageCard';
import EmergencyCard from './cards/EmergencyCard';
import InsuranceCard from './cards/InsuranceCard';
import ServiceTimeline from './cards/ServiceTimeline';
import DiagnosisCard from './cards/DiagnosisCard';
import InsightCard from './cards/InsightCard';
import PredictionCard from './cards/PredictionCard';
import ReminderCard from './cards/ReminderCard';

const CopilotWindow = ({ isOpen, onClose, messages = [], isLoading, onSendMessage, onClearChat, userName, activeVehicleId, setActiveVehicleId, onAppendMessage }) => {
  const [showEmergency, setShowEmergency] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleQuickAction = (action) => {
    if (action === '__OPEN_EMERGENCY__') {
      setShowEmergency(true);
    } else {
      onSendMessage(action);
    }
  };

  const handleEmergencySent = (data, category) => {
    setShowEmergency(false);
    if (onAppendMessage) {
      onAppendMessage({ text: `Emergency: ${category}`, isUser: true, timestamp: new Date() });
      onAppendMessage({ 
        text: `Found ${data.length} nearby services.`, 
        isUser: false, 
        type: 'emergency_list', 
        payload: data, 
        timestamp: new Date() 
      });
    }
  };

  const renderCard = (msg) => {
    switch (msg.type) {
      case 'vehicle_summary':
        return <VehicleCard data={msg.payload} />;
      case 'passport_summary':
      case 'passport_detail':
        return <PassportCard data={msg.payload} />;
      case 'garage_list':
        return <GarageCard data={msg.payload} />;
      case 'emergency_list':
        return <EmergencyCard data={msg.payload} />;
      case 'insurance_summary':
        return <InsuranceCard data={msg.payload} />;
      case 'service_history':
        return <ServiceTimeline data={msg.payload} />;
      case 'diagnosis_card':
        return <DiagnosisCard data={msg.payload} />;
      case 'insight_card':
        return <InsightCard data={msg.payload} />;
      case 'prediction_card':
        return <PredictionCard data={msg.payload} />;
      case 'reminder_card':
        return <ReminderCard data={msg.payload} />;
      default:
        return null;
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-36 right-4 md:bottom-28 md:right-8 z-50 w-[calc(100vw-2rem)] md:w-[420px] h-[75vh] max-h-[700px] flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {showEmergency && (
            <EmergencyPanel 
              onClose={() => setShowEmergency(false)} 
              onEmergencySent={handleEmergencySent} 
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">AI CoPilot</h3>
                <p className="text-xs text-slate-500 font-medium">Your Intelligent Mobility Companion</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && !showHome && (
                <button
                  onClick={() => setShowHome(true)}
                  title="Back to Home"
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                >
                  <Home className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <ContextPanel activeVehicleId={activeVehicleId} setActiveVehicleId={setActiveVehicleId} />

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {(messages.length === 0 || showHome) ? (
              <div className="h-full flex flex-col">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">
                    Hello {typeof userName === 'string' && userName ? userName.split(' ')[0] : 'there'} 👋
                  </h3>
                  <p className="text-sm text-slate-500">
                    {showHome ? 'What would you like to do?' : 'Welcome back to your Digital Twin. How can I help you today?'}
                  </p>
                </div>
                <div className="flex-1">
                  <QuickActions onSelectAction={(action) => { setShowHome(false); handleQuickAction(action); }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col min-h-full">
                <div className="flex justify-between items-center mb-6 mt-auto pt-2">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <button 
                    onClick={onClearChat}
                    className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 hover:text-slate-600 px-3 py-1 bg-white border border-slate-200 rounded-full mx-3 transition-colors"
                  >
                    Clear Chat
                  </button>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                {messages.map((msg, idx) => {
                  if (msg.isUser && msg.text.startsWith('__EMERGENCY_DATA__')) return null;

                  return (
                    <div key={idx} className="flex flex-col mb-4">
                      <ChatBubble 
                        message={msg.text} 
                        isUser={msg.isUser} 
                        timestamp={msg.timestamp} 
                      />
                      {!msg.isUser && msg.type && msg.type !== 'text' && msg.payload && (
                        <div className="mt-2 ml-11 max-w-[85%]">
                          {renderCard(msg)}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {isLoading && (
                  <div className="flex items-center gap-3 ml-2 mt-4 text-slate-400">
                    <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
        </div>
      )}
    </>
  );
};

export default CopilotWindow;
