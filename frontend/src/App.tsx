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
import "./App.css"; // Import your external CSS file

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
      const response = await fetch("http://127.0.0.1:8000/start_session", {
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
          navigator.sendBeacon("http://127.0.0.1:8000/end_session", blob);
        } else {
          await fetch("http://127.0.0.1:8000/end_session", {
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
      const response = await fetch("http://127.0.0.1:8000/chat", {
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
      const response = await fetch("http://127.0.0.1:8000/transcribe_audio", {
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

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <Car style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <div>
              <h1 className="title">Robotic Car Control AI ChatBot</h1>
              <div className="status">
                <div
                  className={`status-dot ${
                    connectionStatus === "connected"
                      ? "connected"
                      : "disconnected"
                  }`}
                ></div>
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
              <div className="session-info">
                Session: {sessionId.substring(0, 8)}...
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="main-content">
        {/* Chat Area */}
        <div className="chat-area">
          {/* Messages */}
          <div className="messages-container">
            <div className="messages-scroll">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-container ${message.role}`}
                >
                  <div
                    className={`message ${message.role} ${
                      message.isError ? "error" : ""
                    }`}
                  >
                    <div>{message.text}</div>
                    <div className="message-time">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="loading-container">
                  <div className="loading-message">
                    <div className="loading-dots">
                      <div className="loading-dot loading-dot-1"></div>
                      <div className="loading-dot loading-dot-2"></div>
                      <div className="loading-dot loading-dot-3"></div>
                    </div>
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* Input Area */}
          <div className="input-area">
            <div className="input-container">
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
                className="input"
                disabled={isLoading || !sessionId || isRecording} // Disable input while recording
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || !sessionId}
                className={`mic-button ${
                  isLoading || !sessionId ? "disabled" : ""
                } ${isRecording ? "recording" : ""}`}
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
                className={`send-button ${
                  isLoading || !input.trim() || !sessionId || isRecording
                    ? "disabled"
                    : ""
                }`}
              >
                <Send style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        </div>
        {/* Quick Commands Panel */}
        <div className="sidebar">
          <div className="quick-commands">
            <h3 className="sidebar-title">Quick Commands</h3>
            <div className="command-grid">
              {quickCommands.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickCommand(cmd.command)}
                  disabled={isLoading || !sessionId || isRecording} // Disable quick commands if recording
                  className={`command-button ${
                    isLoading || !sessionId || isRecording ? "disabled" : ""
                  }`}
                >
                  <cmd.icon
                    style={{ width: "20px", height: "20px", color: "#6b7280" }}
                  />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
            <div className="speed-control">
              <h3 className="sidebar-title">Speed Control</h3>
              <input
                type="range"
                min="0"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="speed-slider"
                disabled={isLoading || !sessionId || isRecording}
              />
              <div className="speed-value">Speed (%): {speed}</div>
            </div>
            <button onClick={clearChat} className="clear-button">
              Clear Chat (UI Only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
