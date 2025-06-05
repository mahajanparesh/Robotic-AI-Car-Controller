from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import (
    Content, FunctionDeclaration, GenerativeModel, Part, Tool
)
import paho.mqtt.client as mqtt
import os
# Setup
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/Users/pareshmahajan/Downloads/genai-exchange-bootcamp-460110-b585ba900da9.json"
vertexai.init(project="genai-exchange-bootcamp-460110")

# Define the system instruction
SYSTEM_INSTRUCTION = ["You are a helpful assistant that controls a four-wheel robot car using MQTT. The car has two motors on the left and two on the right of the chassis. Each motor can go forward (1), stop (0), or go backward (-1).",
"You will get a message telling you how the left and right motors should move. This message can be in any language, and your reply must be in the same language as the last message you received.", "Greet the user along with your introduction."]
model = GenerativeModel("gemini-2.0-flash-001", system_instruction= SYSTEM_INSTRUCTION)

get_direction_func = FunctionDeclaration(
    name="get_direction",
    description=(
        "Return the direction each motor should move for a four-wheel robot car.\n"
        "Allowed values for each motor: 1 (forward), 0 (stop), -1 (backward)."
    ),
    parameters={
        "type": "object",
        "properties": {
            "right_motors": {"type": "string"},
            "left_motors":  {"type": "string"},
        },
        "required": ["right_motors", "left_motors"],
    },
)
tool = Tool(function_declarations=[get_direction_func])
history: list[Content] = []

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

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    global history
    user_input = req.message

    history.append(Content(role="user", parts=[Part.from_text(user_input)]))

    response = model.generate_content(history, tools=[tool])
    reply = response.candidates[0].content
    function_call_part = next(
        (p for p in reply.parts if hasattr(p, "function_call") and p.function_call), None
    )

    if function_call_part and function_call_part.function_call.name == "get_direction":
        args = function_call_part.function_call.args
        mqtt_result = move_car(args["right_motors"], args["left_motors"])

        history.extend([
            reply,
            Content(role="function", parts=[
                Part.from_function_response(name="get_direction", response=mqtt_result)
            ]),
        ])

        follow_up = model.generate_content(history, tools=[tool])
        final_text = follow_up.candidates[0].content.parts[0].text
        history.append(follow_up.candidates[0].content)
        return {"response": final_text}
    
    history.append(reply)
    return {"response": reply.parts[0].text}

def move_car(right_motors: str, left_motors: str) -> dict:
    broker = "192.168.1.3"
    topic = "robot/control"
    message = f"right={right_motors},left={left_motors}"
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, "GeminiClient")
        client.connect(broker, 1883, 60)
        client.publish(topic, message)
        client.disconnect()
        return {"status": "MQTT message sent"}
    except Exception as e:
        return {"status": "Error", "error": str(e)}
