"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, Bot, User, Loader2, Sparkles, 
  RefreshCw, Lightbulb, MessageSquare
} from "lucide-react";
import { askAI } from "../lib/api";
import { LoadingSpinner } from "../components/ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: {
    total_nodes: number;
    online_nodes: number;
    network_score: number;
    countries_count: number;
  };
}

const EXAMPLE_QUESTIONS = [
  "How many nodes are in Nigeria?",
  "What's the overall network health?",
  "Which country has the most nodes?",
  "How many nodes are online right now?",
  "What's the average CPU usage across the network?",
  "Are there any nodes with poor health scores?",
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: q,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await askAI(q);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        data: response.data_snapshot,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process your question. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b border-card-border bg-card-bg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orb-purple rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-foreground">AI Assistant</h1>
              <p className="text-gray-400 font-mono text-sm">Ask questions about the Xandeum network</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:bg-card-border/30 rounded-lg transition font-mono text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-orb-purple rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-mono font-bold text-foreground mb-2">
              Ask me anything about the network
            </h2>
            <p className="text-gray-400 font-mono mb-8 max-w-md">
              I can help you understand network statistics, find specific nodes, 
              and analyze performance metrics in real-time.
            </p>
            
            {/* Example Questions */}
            <div className="max-w-2xl w-full">
              <div className="flex items-center gap-2 mb-4 text-gray-400 font-mono">
                <Lightbulb className="w-4 h-4" />
                <span className="text-sm font-medium">Try asking:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-left p-4 bg-card-bg border border-card-border rounded-xl hover:border-orb-purple/50 hover:bg-orb-purple/10 transition group"
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-orb-purple mt-0.5" />
                      <span className="text-gray-300 font-mono text-sm group-hover:text-orb-purple transition-colors">{q}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-10 h-10 bg-orb-purple rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-4 font-mono text-sm ${
                    message.role === "user"
                      ? "bg-orb-teal text-white"
                      : "bg-card-bg border border-card-border text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  
                  {message.data && (
                    <div className="mt-3 pt-3 border-t border-card-border flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 bg-card-border/30 text-gray-300 rounded-full">
                        {message.data.total_nodes} total nodes
                      </span>
                      <span className="text-xs px-2 py-1 bg-orb-teal/20 text-orb-teal rounded-full">
                        {message.data.online_nodes} online
                      </span>
                      <span className="text-xs px-2 py-1 bg-orb-purple/20 text-orb-purple rounded-full">
                        Score: {message.data.network_score}/100
                      </span>
                    </div>
                  )}
                  
                  <p className={`text-xs mt-2 ${message.role === "user" ? "text-teal-100" : "text-gray-500"}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                
                {message.role === "user" && (
                  <div className="w-10 h-10 bg-orb-teal rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-orb-purple rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-card-bg border border-card-border rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-2 text-gray-400 font-mono text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing network data...
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-card-border bg-card-bg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the network..."
                disabled={loading}
                className="w-full px-5 py-4 pr-14 bg-background border border-card-border rounded-xl text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orb-purple focus:border-orb-purple disabled:bg-navy-900 disabled:cursor-not-allowed placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="px-6 py-4 bg-orb-purple text-white rounded-xl hover:bg-orb-purple/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center font-mono">
            AI responses are based on real-time network data
          </p>
        </div>
      </div>
    </div>
  );
}
