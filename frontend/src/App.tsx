import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Car,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  RotateCcw,
  Circle,
} from "lucide-react";

interface Message {
  id: number;
  role: string;
  text: string;
  timestamp: Date;
  isError?: boolean;
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "bot",
      text: 'Hello! I\'m your robotic car assistant. You can control the car with natural language commands like "move forward", "turn left", or "stop".',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickCommands = [
    { icon: ArrowUp, label: "Forward", command: "move forward" },
    { icon: ArrowDown, label: "Backward", command: "move backward" },
    { icon: ArrowLeft, label: "Left", command: "turn left" },
    { icon: ArrowRight, label: "Right", command: "turn right" },
    { icon: Square, label: "Stop", command: "stop" },
    { icon: RotateCcw, label: "Rotate", command: "rotate around" },
  ];

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();

      const botMessage: Message = {
        id: Date.now() + 1,
        role: "bot",
        text: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error:", error);
      setConnectionStatus("disconnected");

      const errorMessage: Message = {
        id: Date.now() + 1,
        role: "bot",
        text: "Connection error. Please check the car connection and try again.",
        timestamp: new Date(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickCommand = (command: string) => {
    sendMessage(command);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#fafafa",
      display: "flex",
      flexDirection: "column" as const,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      backgroundColor: "white",
      borderBottom: "1px solid #e5e7eb",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    },
    headerContent: {
      maxWidth: "1200px",
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    logo: {
      backgroundColor: "#3b82f6",
      padding: "12px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: "24px",
      fontWeight: "600",
      color: "#111827",
      margin: 0,
    },
    status: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      color: "#6b7280",
    },
    statusDot: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: connectionStatus === "connected" ? "#10b981" : "#ef4444",
    },
    mainContent: {
      flex: 1,
      maxWidth: "1200px",
      margin: "0 auto",
      width: "100%",
      padding: "24px",
      display: "flex",
      gap: "24px",
    },
    chatArea: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      minWidth: 0,
    },
    messagesContainer: {
      flex: 1,
      backgroundColor: "white",
      borderRadius: "16px",
      border: "1px solid #e5e7eb",
      padding: "24px",
      marginBottom: "20px",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    },
    messagesScroll: {
      height: "500px",
      overflowY: "auto" as const,
      paddingRight: "8px",
    },
    messageContainer: {
      display: "flex",
      marginBottom: "20px",
    },
    userMessageContainer: {
      justifyContent: "flex-end",
    },
    botMessageContainer: {
      justifyContent: "flex-start",
    },
    message: {
      maxWidth: "75%",
      padding: "12px 16px",
      borderRadius: "16px",
      fontSize: "15px",
      lineHeight: "1.5",
    },
    userMessage: {
      backgroundColor: "#3b82f6",
      color: "white",
    },
    botMessage: {
      backgroundColor: "#f3f4f6",
      color: "#374151",
      border: "1px solid #e5e7eb",
    },
    errorMessage: {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      border: "1px solid #fecaca",
    },
    messageTime: {
      fontSize: "12px",
      opacity: 0.6,
      marginTop: "6px",
      textAlign: "right" as const,
    },
    loadingContainer: {
      display: "flex",
      justifyContent: "flex-start",
      marginBottom: "20px",
    },
    loadingMessage: {
      backgroundColor: "#f3f4f6",
      border: "1px solid #e5e7eb",
      padding: "12px 16px",
      borderRadius: "16px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    loadingDots: {
      display: "flex",
      gap: "4px",
    },
    loadingDot: {
      width: "6px",
      height: "6px",
      backgroundColor: "#9ca3af",
      borderRadius: "50%",
      animation: "bounce 1.4s infinite ease-in-out",
    },
    inputArea: {
      backgroundColor: "white",
      borderRadius: "16px",
      border: "1px solid #e5e7eb",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    },
    inputContainer: {
      display: "flex",
      gap: "12px",
    },
    input: {
      flex: 1,
      padding: "14px 16px",
      border: "1px solid #d1d5db",
      borderRadius: "12px",
      fontSize: "15px",
      outline: "none",
      transition: "border-color 0.2s",
      backgroundColor: "#fafafa",
    },
    inputFocus: {
      borderColor: "#3b82f6",
      backgroundColor: "white",
    },
    sendButton: {
      backgroundColor: "#3b82f6",
      color: "white",
      border: "none",
      padding: "14px 16px",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "background-color 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "50px",
    },
    sendButtonDisabled: {
      backgroundColor: "#d1d5db",
      cursor: "not-allowed",
    },
    sidebar: {
      width: "280px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px",
    },
    quickCommands: {
      backgroundColor: "white",
      borderRadius: "16px",
      border: "1px solid #e5e7eb",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    },
    sidebarTitle: {
      fontSize: "16px",
      fontWeight: "600",
      color: "#111827",
      marginBottom: "16px",
      margin: 0,
    },
    commandGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
    },
    commandButton: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: "8px",
      padding: "16px 12px",
      backgroundColor: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.2s",
      fontSize: "13px",
      fontWeight: "500",
      color: "#374151",
    },
    commandButtonHover: {
      backgroundColor: "#f3f4f6",
      borderColor: "#d1d5db",
      transform: "translateY(-1px)",
    },
    commandButtonDisabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% { 
              transform: scale(0);
              opacity: 0.5;
            }
            40% { 
              transform: scale(1);
              opacity: 1;
            }
          }
          .loading-dot-1 { animation-delay: -0.32s; }
          .loading-dot-2 { animation-delay: -0.16s; }
          .loading-dot-3 { animation-delay: 0s; }
          
          *::-webkit-scrollbar {
            width: 4px;
          }
          *::-webkit-scrollbar-track {
            background: transparent;
          }
          *::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 2px;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
        `}
      </style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <div style={styles.logo}>
              <Car style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <div>
              <h1 style={styles.title}>Robotic Car Control AI ChatBot</h1>
              <div style={styles.status}>
                <div style={styles.statusDot}></div>
                <span>
                  {connectionStatus === "connected"
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Chat Area */}
        <div style={styles.chatArea}>
          {/* Messages */}
          <div style={styles.messagesContainer}>
            <div style={styles.messagesScroll}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    ...styles.messageContainer,
                    ...(message.role === "user"
                      ? styles.userMessageContainer
                      : styles.botMessageContainer),
                  }}
                >
                  <div
                    style={{
                      ...styles.message,
                      ...(message.role === "user"
                        ? styles.userMessage
                        : message.isError
                        ? styles.errorMessage
                        : styles.botMessage),
                    }}
                  >
                    <div>{message.text}</div>
                    <div style={styles.messageTime}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={styles.loadingContainer}>
                  <div style={styles.loadingMessage}>
                    <div style={styles.loadingDots}>
                      <div
                        style={styles.loadingDot}
                        className="loading-dot-1"
                      ></div>
                      <div
                        style={styles.loadingDot}
                        className="loading-dot-2"
                      ></div>
                      <div
                        style={styles.loadingDot}
                        className="loading-dot-3"
                      ></div>
                    </div>
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div style={styles.inputArea}>
            <div style={styles.inputContainer}>
              <input
                type="text"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInput(e.target.value)
                }
                onKeyDown={handleKeyPress}
                placeholder="Type your command here..."
                style={styles.input}
                disabled={isLoading}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.backgroundColor = "white";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.backgroundColor = "#fafafa";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                style={{
                  ...styles.sendButton,
                  ...(isLoading || !input.trim()
                    ? styles.sendButtonDisabled
                    : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && input.trim()) {
                    (e.target as HTMLElement).style.backgroundColor = "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && input.trim()) {
                    (e.target as HTMLElement).style.backgroundColor = "#3b82f6";
                  }
                }}
              >
                <Send style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Commands Panel */}
        <div style={styles.sidebar}>
          <div style={styles.quickCommands}>
            <h3 style={styles.sidebarTitle}>Quick Commands</h3>
            <div style={styles.commandGrid}>
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickCommand(cmd.command)}
                  disabled={isLoading}
                  style={{
                    ...styles.commandButton,
                    ...(isLoading ? styles.commandButtonDisabled : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = "#f3f4f6";
                      target.style.borderColor = "#d1d5db";
                      target.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = "#f9fafb";
                      target.style.borderColor = "#e5e7eb";
                      target.style.transform = "translateY(0)";
                    }
                  }}
                >
                  <cmd.icon
                    style={{ width: "20px", height: "20px", color: "#6b7280" }}
                  />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
