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
  Mic, // Import the Mic icon
  StopCircle, // Import StopCircle icon for stopping recording
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(7); // New state for speed, default to 7
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionInitialized = useRef(false);

  // Speech-to-Text states and refs
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize session when component mounts
  useEffect(() => {
    if (!sessionInitialized.current) {
      initializeSession();
      sessionInitialized.current = true;
    }
    // Cleanup session when component unmounts (page closes/refreshes)
    const handleBeforeUnload = () => {
      endSession();
    };
    const handleUnload = () => {
      endSession();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
      endSession();
    };
  }, []);

  const initializeSession = async () => {
    try {
      const response = await fetch("http://localhost:8000/start_session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session_id);
        console.log("Session initialized:", data.session_id);
      } else {
        console.error("Failed to initialize session");
      }
    } catch (error) {
      console.error("Error initializing session:", error);
    }
  };

  const endSession = async () => {
    if (sessionId) {
      try {
        const data = JSON.stringify({ session_id: sessionId });
        if (navigator.sendBeacon) {
          const blob = new Blob([data], { type: "application/json" });
          navigator.sendBeacon("http://localhost:8000/end_session", blob);
        } else {
          await fetch("http://localhost:8000/end_session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: data,
            keepalive: true,
          });
        }
        console.log("Session ended:", sessionId);
      } catch (error) {
        console.error("Error ending session:", error);
      }
    }
  };

  const quickCommands = [
    { icon: ArrowUp, label: "Forward", command: `move forward at ${speed}` },
    {
      icon: ArrowDown,
      label: "Backward",
      command: `move backward at ${speed}`,
    },
    { icon: ArrowLeft, label: "Left", command: `turn left at ${speed}` },
    { icon: ArrowRight, label: "Right", command: `turn right at ${speed}` },
    { icon: Square, label: "Stop", command: "stop" },
    { icon: RotateCcw, label: "Rotate", command: `rotate around at ${speed}` },
  ];

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || !sessionId) return;
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
        body: JSON.stringify({
          message: messageText,
          session_id: sessionId,
        }),
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }
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

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        role: "bot",
        text: 'Hello! I\'m your robotic car assistant. You can control the car with natural language commands like "move forward", "turn left", or "stop".',
        timestamp: new Date(),
      },
    ]);
  };

  // --- Speech-to-Text Functions ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm; codecs=opus",
        });
        await sendAudioForTranscription(audioBlob);
      };

      mediaRecorderRef.current.start(100); // Record in 100ms chunks for real-time processing
      setIsRecording(true);
      setInput("Listening..."); // Indicate that the bot is listening

      // Setup for real-time transcription (optional, but good for responsiveness)
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // Continuously send audio chunks for real-time transcription
      const processAudio = () => {
        if (!isRecording) return; // Stop if not recording
        if (audioChunksRef.current.length > 0) {
          const currentAudioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm; codecs=opus",
          });
          audioChunksRef.current = []; // Clear chunks after sending
          sendAudioForTranscription(currentAudioBlob, true); // Send as interim
        }
        animationFrameIdRef.current = requestAnimationFrame(processAudio);
      };
      animationFrameIdRef.current = requestAnimationFrame(processAudio);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Please allow microphone access to use voice commands.");
      setIsRecording(false);
      setInput("");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsRecording(false);
      setInput("");
    }
  };

  const sendAudioForTranscription = async (
    audioBlob: Blob,
    isInterim: boolean = false
  ) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("audio", audioBlob);

    try {
      const response = await fetch("http://localhost:8000/transcribe_audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription network response was not ok");
      }

      const data = await response.json();
      if (data.transcription) {
        setInput(data.transcription); // Update input field with transcribed text
        if (!isInterim) {
          // If it's a final transcription, send it as a message
          sendMessage(data.transcription);
        }
      } else {
        console.warn("No transcription received.");
      }
    } catch (error) {
      console.error("Error sending audio for transcription:", error);
      alert("Error transcribing audio. Please try again.");
    } finally {
      if (!isInterim) {
        // Only set loading to false for final transcription
        setIsLoading(false);
      }
    }
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
    sessionInfo: {
      fontSize: "12px",
      color: "#9ca3af",
      fontFamily: "monospace",
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
    clearButton: {
      backgroundColor: "#ef4444",
      color: "white",
      border: "none",
      padding: "8px 12px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "12px",
      marginTop: "10px",
    },
    micButton: {
      backgroundColor: isRecording ? "#ef4444" : "#4CAF50", // Red when recording, green when not
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
    micButtonDisabled: {
      backgroundColor: "#d1d5db",
      cursor: "not-allowed",
    },
    speedControl: {
      marginTop: "20px",
      paddingTop: "16px",
      borderTop: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
    },
    speedSlider: {
      width: "100%",
      height: "8px",
      borderRadius: "4px",
      background: "#d1d5db",
      outline: "none",
      cursor: "pointer",
    },
    speedValue: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#374151",
      textAlign: "center" as const,
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
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 0 1px #3b82f6;
          }
          input[type=range]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 0 1px #3b82f6;
          }

          /* --- Responsive Styles --- */
          @media (max-width: 768px) {
            .main-content-responsive {
              flex-direction: column; /* Stack chat and sidebar vertically */
              padding: 0; /* Remove main padding to allow inner cards to use full width with their own margins */
              gap: 0; /* No gap needed if margins are applied to children */
              max-width: 100%; /* Ensure it takes full width */
              margin: 0; /* Remove auto margins */
            }

            .header-content-responsive {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
                padding: 15px; /* Adjust header content padding */
            }

            .header-responsive {
                padding: 15px; /* Adjust header padding */
            }

            .header-left-responsive {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .title-responsive {
                font-size: 20px;
            }

            .chat-area-responsive,
            .sidebar-responsive {
              width: 100%; /* Make both chat area and sidebar take full width */
              margin-left: auto; /* Center if needed, but not strictly if 100% */
              margin-right: auto;
            }

            .messages-container-responsive {
                height: 350px; /* Reduce chat height */
                margin: 16px; /* Add margin around the container */
            }
            .input-area-responsive {
                margin: 0 16px 16px 16px; /* Add margin for input area */
            }
            .quick-commands-responsive {
                margin: 0 16px 16px 16px; /* Add margin for quick commands */
            }

            /* For the very first element in main-content, add top margin */
            .main-content-responsive > .chat-area-responsive {
                margin-top: 16px;
            }

            .messages-container-responsive,
            .input-area-responsive,
            .quick-commands-responsive {
                border-radius: 12px;
                padding: 20px; /* Keep padding consistent for content inside cards */
            }

            .command-grid-responsive {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            }
          }

          @media (max-width: 480px) {
            .header-responsive {
                padding: 10px; /* Even smaller header padding */
            }
            .title-responsive {
                font-size: 16px; /* Even smaller title */
            }
            .logo-responsive {
                padding: 6px; /* Smaller logo padding */
            }
            .messages-container-responsive {
                height: 250px; /* Further reduce chat height */
                margin: 10px; /* Smaller margins for very small screens */
            }
            .input-area-responsive {
                margin: 0 10px 10px 10px; /* Smaller margins */
            }
            .quick-commands-responsive {
                margin: 0 10px 10px 10px; /* Smaller margins */
            }
            .messages-container-responsive,
            .input-area-responsive,
            .quick-commands-responsive {
                padding: 15px; /* Adjust padding for content inside cards */
            }
            .message-responsive {
                max-width: 95%; /* Messages take more width */
                font-size: 13px; /* Smaller message font size */
            }
            .input-responsive {
                padding: 10px 12px; /* Smaller input padding */
                font-size: 13px;
            }
            .send-button-responsive,
            .mic-button-responsive {
                padding: 10px 12px; /* Smaller button padding */
                min-width: 40px; /* Adjust min-width */
            }
            .command-button-responsive {
                padding: 10px 6px; /* Smaller command button padding */
                font-size: 11px; /* Smaller command button font */
            }
            .clear-button-responsive {
                padding: 5px 8px; /* Smaller clear button padding */
                font-size: 10px;
            }
             .main-content-responsive > .chat-area-responsive {
                margin-top: 10px;
            }
          }
        `}
      </style>
      {/* Header */}
      <div style={styles.header} className="header-responsive">
        <div style={styles.headerContent} className="header-content-responsive">
          <div style={styles.headerLeft} className="header-left-responsive">
            <div style={styles.logo} className="logo-responsive">
              <Car style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <div>
              <h1 style={styles.title} className="title-responsive">
                Robotic Car Control AI ChatBot
              </h1>
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
          <div>
            {sessionId && (
              <div style={styles.sessionInfo}>
                Session: {sessionId.substring(0, 8)}...
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div style={styles.mainContent} className="main-content-responsive">
        {/* Chat Area */}
        <div style={styles.chatArea} className="chat-area-responsive">
          {/* Messages */}
          <div
            style={styles.messagesContainer}
            className="messages-container-responsive"
          >
            <div
              style={styles.messagesScroll}
              className="messages-scroll-responsive"
            >
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
                    className="message-responsive"
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
          <div style={styles.inputArea} className="input-area-responsive">
            <div style={styles.inputContainer}>
              <input
                type="text"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInput(e.target.value)
                }
                onKeyDown={handleKeyPress}
                placeholder={
                  isRecording ? "Listening..." : "Type your command here..."
                }
                style={styles.input}
                disabled={isLoading || !sessionId || isRecording} // Disable input while recording
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.backgroundColor = "white";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.backgroundColor = "#fafafa";
                }}
                className="input-responsive"
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || !sessionId}
                style={{
                  ...styles.micButton,
                  ...(isLoading || !sessionId ? styles.micButtonDisabled : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && sessionId) {
                    (e.target as HTMLElement).style.backgroundColor =
                      isRecording ? "#dc2626" : "#45a049"; // Darker red/green on hover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && sessionId) {
                    (e.target as HTMLElement).style.backgroundColor =
                      isRecording ? "#ef4444" : "#4CAF50"; // Original red/green
                  }
                }}
                className="mic-button-responsive"
              >
                {isRecording ? (
                  <StopCircle style={{ width: "18px", height: "18px" }} />
                ) : (
                  <Mic style={{ width: "18px", height: "18px" }} />
                )}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={
                  isLoading || !input.trim() || !sessionId || isRecording
                } // Disable send button if recording
                style={{
                  ...styles.sendButton,
                  ...(isLoading || !input.trim() || !sessionId || isRecording
                    ? styles.sendButtonDisabled
                    : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && input.trim() && sessionId && !isRecording) {
                    (e.target as HTMLElement).style.backgroundColor = "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && input.trim() && sessionId && !isRecording) {
                    (e.target as HTMLElement).style.backgroundColor = "#3b82f6";
                  }
                }}
                className="send-button-responsive"
              >
                <Send style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        </div>
        {/* Quick Commands Panel */}
        <div style={styles.sidebar} className="sidebar-responsive">
          <div
            style={styles.quickCommands}
            className="quick-commands-responsive"
          >
            <h3 style={styles.sidebarTitle}>Quick Commands</h3>
            <div style={styles.commandGrid} className="command-grid-responsive">
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickCommand(cmd.command)}
                  disabled={isLoading || !sessionId || isRecording} // Disable quick commands if recording
                  style={{
                    ...styles.commandButton,
                    ...(isLoading || !sessionId || isRecording
                      ? styles.commandButtonDisabled
                      : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && sessionId && !isRecording) {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = "#f3f4f6";
                      target.style.borderColor = "#d1d5db";
                      target.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading && sessionId && !isRecording) {
                      const target = e.target as HTMLElement;
                      target.style.backgroundColor = "#f9fafb";
                      target.style.borderColor = "#e5e7eb";
                      target.style.transform = "translateY(0)";
                    }
                  }}
                  className="command-button-responsive"
                >
                  <cmd.icon
                    style={{ width: "20px", height: "20px", color: "#6b7280" }}
                  />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
            <div style={styles.speedControl}>
              <h3 style={styles.sidebarTitle}>Speed Control</h3>
              <input
                type="range"
                min="0"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={styles.speedSlider}
                disabled={isLoading || !sessionId || isRecording}
              />
              <div style={styles.speedValue}>Speed (%): {speed}</div>
            </div>
            <button
              onClick={clearChat}
              style={styles.clearButton}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#dc2626";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#ef4444";
              }}
              className="clear-button-responsive"
            >
              Clear Chat (UI Only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default App;
