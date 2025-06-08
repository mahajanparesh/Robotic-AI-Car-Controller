from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import (
    Content, FunctionDeclaration, GenerativeModel, Part, Tool
)
import paho.mqtt.client as mqtt
import os
import uuid
from typing import Dict
import time
from threading import Timer
from google.cloud import speech_v1p1beta1 as speech # Import Speech-to-Text client
from google.oauth2 import service_account # To load credentials from JSON

# Setup
# Ensure your GOOGLE_APPLICATION_CREDENTIALS points to your service account key.
# For local development, this is generally sufficient.
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "genai-exchange-bootcamp-460110-b585ba900da9.json"

vertexai.init(project="genai-exchange-bootcamp-460110")

# Initialize Google Cloud Speech-to-Text client
# It's recommended to load credentials explicitly if GOOGLE_APPLICATION_CREDENTIALS
# is not set as an environment variable in deployment.
try:
    credentials = service_account.Credentials.from_service_account_file(
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    )
    speech_client = speech.SpeechClient(credentials=credentials)
except Exception as e:
    print(f"Error initializing Google Cloud SpeechClient: {e}")
    print("Please ensure GOOGLE_APPLICATION_CREDENTIALS is set and points to a valid service account key JSON file.")
    speech_client = None # Handle case where client can't be initialized

# Define the system instruction
SYSTEM_INSTRUCTION = [
    "You are a helpful assistant that controls a four-wheel robot car using MQTT. The car has two left-side motors and two right-side motors. Each motor can go forward (1), stop (0), or go backward (-1).",
    "When the user gives a message about movement (in any language), figure out the correct direction for both the left and right motors and call the appropriate function with the correct values.",
    "Always reply in the same language as the user's last message.",
    "Start by greeting the user and introducing yourself briefly.",
    "The 'get_direction' function has a 'speed' parameter. If the user specifies a speed (a number from 0 to 100), use that speed value for the 'speed' parameter. If no speed is mentioned, use the default speed of '7'.",
    "After successfully calling the 'get_direction' function, you MUST generate a response that confirms the action (e.g., 'moving forward', 'turning left', 'stopping') and explicitly states the speed used. For example: 'Okay, the car is moving forward at speed 7.', or 'The car is now turning right at speed 5.', 'The car has stopped.'"
]
model = GenerativeModel("gemini-2.0-flash-001", system_instruction=SYSTEM_INSTRUCTION)

get_direction_func = FunctionDeclaration(
    name="get_direction",
    description=(
        "Returns the direction for each side's motors of a four-wheel robot car.\n"
        "Each side (left or right) has two motors.\n"
        "Direction values:\n"
        "  1 = forward\n"
        "  0 = stop\n"
        " -1 = backward\n"
        "You must infer these values from the user's natural language message."
    ),
    parameters={
        "type": "object",
        "properties": {
            "right_motors": {
                "type": "string",
                "description": "Direction for both right motors (must be one of: '1', '0', '-1')"
            },
            "left_motors": {
                "type": "string",
                "description": "Direction for both left motors (must be one of: '1', '0', '-1')"
            },
            "speed": {
                "type": "string",
                "default": "7",
                "description": "Optional: Speed of the motors in percentage (default is '7')"
            },
        },
        "required": ["right_motors", "left_motors"],
    },
)

tool = Tool(function_declarations=[get_direction_func])

# Session management
sessions: Dict[str, Dict] = {}
SESSION_TIMEOUT = 30 * 60  # 30 minutes in seconds

def cleanup_expired_sessions():
    """Remove sessions that haven't been active for SESSION_TIMEOUT seconds"""
    current_time = time.time()
    expired_sessions = [
        session_id for session_id, session_data in sessions.items()
        if current_time - session_data['last_activity'] > SESSION_TIMEOUT
    ]
    for session_id in expired_sessions:
        del sessions[session_id]
        print(f"Cleaned up expired session: {session_id}")

def schedule_cleanup():
    """Schedule periodic cleanup of expired sessions"""
    cleanup_expired_sessions()
    Timer(300, schedule_cleanup).start()  # Clean up every 5 minutes

# Start the cleanup scheduler
schedule_cleanup()

# FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = None

class SessionResponse(BaseModel):
    session_id: str

@app.post("/start_session")
async def start_session():
    """Create a new session and return session ID"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'history': [],
        'last_activity': time.time()
    }
    print(f"Started new session: {session_id}")
    return {"session_id": session_id}

@app.post("/end_session")
async def end_session(request: dict):
    """End a session and clear its history"""
    session_id = request.get("session_id")
    if session_id and session_id in sessions:
        del sessions[session_id]
        print(f"Ended session: {session_id}")
        return {"status": "Session ended successfully"}
    return {"status": "Session not found"}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    session_id = req.session_id
    
    # If no session_id provided, create a new session
    if not session_id or session_id not in sessions:
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
            'history': [],
            'last_activity': time.time()
        }
        print(f"Created new session for chat: {session_id}")
    
    # Update last activity time
    sessions[session_id]['last_activity'] = time.time()
    
    # Get session history
    history = sessions[session_id]['history']
    user_input = req.message

    # Add user message to history
    history.append(Content(role="user", parts=[Part.from_text(user_input)]))

    # Generate response
    response = model.generate_content(history, tools=[tool])
    reply = response.candidates[0].content
    function_call_part = next(
        (p for p in reply.parts if hasattr(p, "function_call") and p.function_call), None
    )
    print("History:", history)
    print(reply)
    if function_call_part and function_call_part.function_call.name == "get_direction":
        args = function_call_part.function_call.args
        # The speed value is correctly extracted and passed to move_car
        mqtt_result = move_car(args["right_motors"], args["left_motors"], args.get("speed", "7"))

        history.extend([
            reply,
            Content(role="function", parts=[
                Part.from_function_response(name="get_direction", response=mqtt_result)
            ]),
        ])

        # The follow_up model call will now use the updated SYSTEM_INSTRUCTION
        # to generate a response that includes the speed.
        follow_up = model.generate_content(history, tools=[tool])
        final_text = follow_up.candidates[0].content.parts[0].text
        history.append(follow_up.candidates[0].content)
        
        # Update session history
        sessions[session_id]['history'] = history
        return {"response": final_text, "session_id": session_id}
    
    history.append(reply)
    # Update session history
    sessions[session_id]['history'] = history
    return {"response": reply.parts[0].text, "session_id": session_id}

@app.post("/transcribe_audio")
async def transcribe_audio(audio: UploadFile = File(...)):
    if speech_client is None:
        raise HTTPException(status_code=500, detail="Speech-to-Text client not initialized. Check server logs.")

    try:
        audio_content = await audio.read()

        # Configure the recognition request
        audio_source = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS, # Match frontend encoding
            sample_rate_hertz=48000, # Common sample rate for WebM Opus. Adjust if your actual recording differs.
            language_code="en-US", # Set to your desired language
            enable_automatic_punctuation=True,
            enable_spoken_punctuation=True,
            enable_word_time_offsets=False,
            model="latest_long", # Use a suitable model
        )

        # Perform the speech-to-text recognition
        response = speech_client.recognize(config=config, audio=audio_source)

        transcription = ""
        for result in response.results:
            transcription += result.alternatives[0].transcript

        return {"transcription": transcription}
    except Exception as e:
        print(f"Error during audio transcription: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")


@app.get("/session_info/{session_id}")
async def get_session_info(session_id: str):
    """Get information about a session"""
    if session_id in sessions:
        return {
            "session_id": session_id,
            "message_count": len(sessions[session_id]['history']),
            "last_activity": sessions[session_id]['last_activity'],
            "active": True
        }
    return {"session_id": session_id, "active": False}

@app.get("/active_sessions")
async def get_active_sessions():
    """Get count of active sessions (for debugging)"""
    return {"active_sessions": len(sessions)}

def move_car(right_motors: str, left_motors: str, speed: str = '7') -> dict:
    broker = "35.200.230.224"
    topic = "robot/control"
    message = f"right={right_motors},left={left_motors},speed={speed}"
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, "GeminiClient")
        client.connect(broker, 1883, 60)
        client.publish(topic, message)
        client.disconnect()
        return {"status": "MQTT message sent"}
    except Exception as e:
        return {"status": "Error", "error": str(e)}
