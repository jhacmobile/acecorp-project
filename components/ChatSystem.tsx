import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage } from '../types';

interface ChatSystemProps {
  currentUser: User;
  users: User[];
  messages: ChatMessage[];
  onSendMessage: (content: string, recipientId: string) => Promise<void>;
  onMarkAsRead: (senderId: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const ChatSystem: React.FC<ChatSystemProps> = ({ currentUser, users, messages, onSendMessage, onMarkAsRead, isOpen, onClose }) => {
  const [selectedRecipient, setSelectedRecipient] = useState<string | 'global'>('global');
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      setTimeout(() => {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  // Auto-scroll when messages or recipients change
  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages.length, selectedRecipient, isMinimized, isOpen]);

  // Mark conversation as read whenever the selected tab changes or the modal opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      onMarkAsRead(selectedRecipient);
    }
  }, [selectedRecipient, isOpen, isMinimized]);

  const filteredMessages = useMemo(() => {
    if (selectedRecipient === 'global') {
      return messages.filter(m => String(m.recipientId) === 'global');
    }
    const currentIdStr = String(currentUser.id);
    const targetIdStr = String(selectedRecipient);

    return messages.filter(m => {
      const msgSenderId = String(m.senderId);
      const msgRecipientId = String(m.recipientId);
      return (msgSenderId === currentIdStr && msgRecipientId === targetIdStr) ||
             (msgSenderId === targetIdStr && msgRecipientId === currentIdStr);
    });
  }, [messages, selectedRecipient, currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const content = inputText;
    setInputText('');
    await onSendMessage(content, selectedRecipient);
  };

  const visibleUsers = users.filter(u => String(u.id) !== String(currentUser.id) && u.username.toLowerCase() !== 'jhacace');

  const getUnreadCount = (senderId: string | 'global') => {
    const senderIdStr = String(senderId);
    const currentUserIdStr = String(currentUser.id);
    return messages.filter(m => !m.isRead && String(m.senderId) === senderIdStr && String(m.recipientId) === currentUserIdStr).length;
  };

  const hasUnreadGlobal = messages.some(m => !m.isRead && String(m.recipientId) === 'global');

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[3000] animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button 
          onClick={() => setIsMinimized(false)}
          className="bg-sky-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-sky-700 transition-all border-4 border-white group relative"
        >
          <i className="fas fa-comment-dots text-xl"></i>
          {messages.some(m => !m.isRead && (String(m.recipientId) === String(currentUser.id) || String(m.recipientId) === 'global')) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[3000] w-[400px] h-[600px] bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 text-gray-900">
      {/* Header */}
      <div className="p-6 bg-slate-950 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg border border-sky-400/30">
            <i className="fas fa-comments text-white"></i>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none">Internal Hub</h3>
            <p className="text-[8px] font-black text-sky-400 uppercase tracking-widest mt-1">Live Comms Protocol</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsMinimized(true)} className="w-8 h-8 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center text-slate-400"><i className="fas fa-minus text-xs"></i></button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-red-500 transition-colors flex items-center justify-center text-slate-400 hover:text-white"><i className="fas fa-times text-xs"></i></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Contacts Sidebar */}
        <div className="w-24 bg-slate-50 border-r border-slate-100 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
          <button 
            onClick={() => setSelectedRecipient('global')}
            className={`p-4 flex flex-col items-center gap-1 transition-all border-b border-slate-100 relative ${selectedRecipient === 'global' ? 'bg-white text-sky-600' : 'text-slate-400'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${selectedRecipient === 'global' ? 'bg-sky-100' : 'bg-slate-200'}`}>
              <i className="fas fa-bullhorn"></i>
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest text-center">Global</span>
            {hasUnreadGlobal && selectedRecipient !== 'global' && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
            )}
          </button>
          {visibleUsers.map(u => {
            const unreadCount = getUnreadCount(u.id);
            return (
              <button 
                key={u.id}
                onClick={() => setSelectedRecipient(u.id)}
                className={`p-4 flex flex-col items-center gap-1 transition-all border-b border-slate-100 relative ${selectedRecipient === String(u.id) ? 'bg-white text-sky-600' : 'text-slate-400'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black uppercase italic ${selectedRecipient === String(u.id) ? 'bg-sky-100' : 'bg-slate-200'}`}>
                  {u.username[0]}
                </div>
                <span className="text-[7px] font-black uppercase tracking-widest text-center truncate w-full">{u.username}</span>
                {unreadCount > 0 && selectedRecipient !== String(u.id) && (
                  <span className="absolute top-3 right-3 w-4 h-4 bg-red-500 rounded-full border border-white text-[8px] text-white font-black flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-3 border-b border-slate-50 bg-white/50 backdrop-blur-sm shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {selectedRecipient === 'global' ? 'Broadcast Announcement' : `Secure Link: ${users.find(u => String(u.id) === String(selectedRecipient))?.username || 'Unknown'}`}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
            {filteredMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-slate-400">
                <i className="fas fa-comment-slash text-3xl mb-3"></i>
                <p className="text-[9px] font-black uppercase tracking-widest">No Transmissions</p>
              </div>
            )}
            {filteredMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${String(msg.senderId) === String(currentUser.id) ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {String(msg.senderId) !== String(currentUser.id) && <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight italic">{msg.senderName}</span>}
                  <span className="text-[7px] text-slate-300 font-mono">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`max-w-[85%] px-4 py-3 rounded-[20px] text-[12px] font-medium leading-relaxed shadow-sm border ${
                  String(msg.senderId) === String(currentUser.id) 
                    ? 'bg-sky-600 text-white border-sky-500 rounded-tr-none' 
                    : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-5 border-t border-slate-100 bg-white shrink-0">
            <div className="relative group">
              <input 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type transmission..."
                className="w-full pl-5 pr-14 py-3.5 bg-slate-50 border border-slate-100 rounded-[20px] text-[12px] font-bold outline-none focus:bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-50 transition-all shadow-inner"
              />
              <button 
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 transition-all active:scale-90 disabled:opacity-30 shadow-lg shadow-sky-200"
              >
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatSystem;