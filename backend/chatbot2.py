import os
import vertexai
from vertexai.generative_models import (
    Content,
    FunctionDeclaration,
    GenerativeModel,
    Part,
    Tool,
)
import paho.mqtt.client as mqtt

# ── 1.  Initialise Vertex AI ────────────────────────────────────────────────────
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
    "/Users/pareshmahajan/Downloads/genai-exchange-bootcamp-460110-b585ba900da9.json"
)
vertexai.init(project="genai-exchange-bootcamp-460110")
model = GenerativeModel("gemini-2.0-flash-001")

# ── 2.  Define the structured function Gemini may call ─────────────────────────
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
            # speed of motor in percentage, optional, default is '7'
            "speed": {
                "type": "string",
                "default": "7",
                "description": "Speed of the motors in percentage (default is '7')"
            },
        },
        "required": ["right_motors", "left_motors"],
    },
)
movement_tool = Tool(function_declarations=[get_direction_func])

# ── 3.  Dummy implementation of the robot command ──────────────────────────────
def move_car(right_motors: str, left_motors: str, speed: str = '7') -> dict:
    """
    Publish motor movement commands to NodeMCU using MQTT.
    """
    broker = "35.200.230.224"  # Replace with IP of your MQTT broker (e.g., Raspberry Pi or laptop running Mosquitto)
    topic = "robot/control"
    client_id = "GeminiClient"
    message = f"right={right_motors},left={left_motors},speed={speed}"

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
        client.connect(broker, 1883, 60)
        client.publish(topic, message)
        client.disconnect()
        print(f"[MQTT] Published: {message} to topic: {topic}")
        return {"status": "MQTT message sent"}
    except Exception as e:
        print(f"[MQTT ERROR] {e}")
        return {"status": "Error", "error": str(e)}

# ── 4.  Conversation loop ──────────────────────────────────────────────────────
history: list[Content] = []

print("🔧 Type anything (or 'exit' to quit)…\n")
while True:
    user_input = input("👤: ")
    if user_input.lower() in {"exit", "quit"}:
        break
    
    user_input = user_input + "Note: My motors are individually mounted on four corners of the chassis, so each motor must get either 1, 0, or -1. Left side motors are left_motors set, right side motors are right_motors set. You can interprete the request in any language\n"
    # ---- add latest user message to history ----------------------------------
    history.append(Content(role="user", parts=[Part.from_text(user_input)]))

    # ---- ask Gemini for a response -------------------------------------------
    response = model.generate_content(
        history,
        tools=[movement_tool],
    )
    gemini_reply = response.candidates[0].content
    parts = gemini_reply.parts

    print("\n🔍 Gemini returned parts:")
    for part in parts:
        print(part)

    function_call_part = None
    for part in parts:
        if hasattr(part, "function_call") and part.function_call:
            if part.function_call.name == "get_direction":
                function_call_part = part
                break

    
    # ---- Did Gemini ask us to call get_direction? ----------------------------
    if function_call_part:
        # Extract arguments
        args = function_call_part.function_call.args
        result = move_car(
            right_motors=args["right_motors"],
            left_motors=args["left_motors"],
        )

        # Send the function *response* back to Gemini so it can finish the answer
        history.extend([
            gemini_reply,                     # Gemini's function_call request
            Content(                          # Our function response
                role="function",
                parts=[
                    Part.from_function_response(
                        name="get_direction",
                        response=result,
                    )
                ],
            ),
        ])

        # Ask Gemini to finish the thought, now that it has the function result
        follow_up = model.generate_content(
            history,
            tools=[movement_tool],
        )
        final_text = follow_up.candidates[0].content.parts[0].text
        history.append(follow_up.candidates[0].content)  # maintain full history
        print("🤖:", final_text)

    else:
        # No function call – just show Gemini's text
        final_text = gemini_reply.parts[0].text
        history.append(gemini_reply)
        print("🤖:", final_text)
