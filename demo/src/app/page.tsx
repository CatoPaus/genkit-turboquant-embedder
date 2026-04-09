'use client';

import { useState, useEffect } from 'react';
import { streamFlow } from '@genkit-ai/next/client';
import { chatFlow } from '@/genkit/chatFlow';

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [costStats, setCostStats] = useState({ original: 0, compressed: 0, saved: 0 });

  useEffect(() => {
    // Bring back history from Firestore Vector document logs
    fetch('/api/chat/history')
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (data.stats) {
          setCostStats({
            original: data.stats.originalBytes,
            compressed: data.stats.compressedBytes,
            saved: data.stats.bytesSaved,
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isStreaming) return;

    const userMessage = inputVal;
    setInputVal('');
    
    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    // Add empty placeholder for streaming AI response
    setMessages(prev => [...prev, { role: 'ai', text: '' }]);
    setIsStreaming(true);

    try {
      // Connect to our Genkit Route to stream
      const result = streamFlow<typeof chatFlow>({
        url: '/api/chat',
        // Hardcoded generic user ID for testing the Vector DB retrieval scope
        input: { userId: 'my-test-user-123', userMessage }, 
      });

      // Stream the response back dynamically
      let streamedResponse = '';
      for await (const chunk of result.stream) {
        streamedResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = streamedResponse;
          return newMessages;
        });
      }

      // Finish streaming and update exactly to final output
      const finalOutput = await result.output;
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text = finalOutput.answer;
        return newMessages;
      });

      if (finalOutput.savings) {
        setCostStats(prev => ({
          original: prev.original + finalOutput.savings.originalBytes,
          compressed: prev.compressed + finalOutput.savings.compressedBytes,
          saved: prev.saved + finalOutput.savings.bytesSaved,
        }));
      }

    } catch (error) {
      console.error('Error in chat generation:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text = 'An error occurred fetching response.';
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white selection:bg-fuchsia-500 selection:text-white">
      
      <div className="z-10 max-w-5xl w-full flex-col items-center justify-center font-mono text-sm flex gap-8">
        
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-xl inline-block transition-transform hover:scale-105 duration-300">
            TurboQuant Chat
          </h1>
          <p className="text-gray-300 text-center max-w-lg">
            Every chat is natively quantized utilizing Genkit + TurboQuant 1-bit Polar extraction and streamed seamlessly into Google Cloud Vertex AI.
          </p>
        </div>

        {/* Cost Savings Widget */}
        <div className="w-full max-w-3xl flex justify-around bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-md">
           <div className="flex flex-col items-center">
             <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-widest">Original Footprint</span>
             <span className="text-md sm:text-lg font-bold text-gray-300">{costStats.original} B</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-widest">TurboQuant Storage</span>
             <span className="text-md sm:text-lg font-bold text-cyan-400">{costStats.compressed} B</span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-[10px] sm:text-xs text-fuchsia-400 uppercase tracking-widest">Space Saved</span>
             <span className="text-md sm:text-lg font-bold text-fuchsia-500 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
               {costStats.saved > 0 ? `-${((costStats.saved / costStats.original) * 100).toFixed(1)}%` : '0%'}
             </span>
           </div>
        </div>

        {/* Chat Window */}
        <div className="w-full max-w-3xl border border-white/10 bg-black/40 backdrop-blur-xl rounded-3xl p-6 min-h-[60vh] max-h-[60vh] flex flex-col shadow-2xl overflow-hidden relative">
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-white/40 italic">
                Send a message to see Vector memory in action...
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div 
                  className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-lg whitespace-pre-wrap leading-relaxed 
                    ${msg.role === 'user' 
                      ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-br-sm' 
                      : 'bg-white/10 ring-1 ring-white/10 rounded-bl-sm text-gray-200'}`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isStreaming && (
               <div className="flex justify-start w-full opacity-50">
                  <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl rounded-bl-sm px-5 py-3">
                    <span className="flex space-x-1 items-center">
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                    </span>
                  </div>
               </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 relative group">
            <input 
              type="text" 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isStreaming}
              className="w-full bg-white/5 border border-white/20 rounded-full px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all duration-300 disabled:opacity-50 placeholder:text-gray-500"
              placeholder="Ask me something to store..."
            />
            <button 
              type="submit" 
              disabled={isStreaming || !inputVal.trim()}
              className="absolute right-2 top-2 bottom-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full px-6 transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(192,38,211,0.5)] active:scale-95"
            >
              Send
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
