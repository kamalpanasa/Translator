# modules/context_assistant.py

INTENT_RULES = [
    {
        "id": "health",
        "intent": "🩺 Health & Medical",
        "color": "#ef4444",
        "bg": "rgba(239,68,68,0.08)",
        "border": "rgba(239,68,68,0.3)",
        "keywords": [
            "headache","fever","pain","sick","doctor","hospital","medicine","pill",
            "symptoms","cough","cold","flu","injury","hurt","bleeding","dizzy","cramps",
            "nausea","vomit","prescription","pharmacy","clinic","emergency","ambulance"
        ],
        "advice": "Health concern detected in your speech.",
        "actions": [
            ("📋 Note Symptoms", "Write down your symptoms with timestamps for your doctor."),
            ("💧 Stay Hydrated", "Drink plenty of water and rest as much as possible."),
            ("🏥 Seek Help", "If symptoms are severe or persistent, consult a doctor immediately.")
        ],
        "tip": "In an emergency, call your local emergency number immediately."
    },
    {
        "id": "productivity",
        "intent": "📅 Task & Productivity",
        "color": "#3b82f6",
        "bg": "rgba(59,130,246,0.08)",
        "border": "rgba(59,130,246,0.3)",
        "keywords": [
            "schedule","meeting","remind","task","calendar","email","deadline","project",
            "follow up","call","appointment","plan","organize","todo","list","agenda",
            "presentation","report","submit","due","urgent","priority","assign"
        ],
        "advice": "A task or productivity action was detected.",
        "actions": [
            ("📝 Create Note", "Capture this as a note or to-do item right away."),
            ("📅 Set Reminder", "Add this to your calendar so you don't forget."),
            ("🔊 Create Audio", "Use Voice Studio to generate an audio version of your notes.")
        ],
        "tip": "You can translate your meeting notes instantly using the dropdown above."
    },
    {
        "id": "translation",
        "intent": "🌍 Language & Translation",
        "color": "#a855f7",
        "bg": "rgba(168,85,247,0.08)",
        "border": "rgba(168,85,247,0.3)",
        "keywords": [
            "translate","translation","meaning","language","spanish","french","hindi",
            "telugu","arabic","chinese","japanese","korean","german","portuguese",
            "word","phrase","how do you say","what does","speak","dialect","accent"
        ],
        "advice": "A language or translation request was detected.",
        "actions": [
            ("🌍 Live Translate", "Select a target language from the dropdowns above to translate instantly."),
            ("🔊 Voiceover", "Copy the text to Voice Studio to generate a synthetic voiceover."),
            ("📖 Dictionary", "Search online for deeper definitions of specific phrases.")
        ],
        "tip": "Live, Parliament-style translation is active right here in the Speech Engine!"
    },
    {
        "id": "question",
        "intent": "❓ Question / Information Request",
        "color": "#f59e0b",
        "bg": "rgba(245,158,11,0.08)",
        "border": "rgba(245,158,11,0.3)",
        "keywords": [
            "what is","what are","how do","how to","why is","who is","when did",
            "where is","explain","tell me","define","describe","difference between",
            "meaning of","can you","could you","please explain","i want to know"
        ],
        "advice": "A question or information request was detected.",
        "actions": [
            ("🔍 Search", "This sounds like a question — try searching online for a detailed answer."),
            ("🎙 Re-record", "Speak your question clearly for better recognition."),
            ("📋 Copy Text", "Copy the transcribed text and paste it into a search engine.")
        ],
        "tip": "For best results, speak in complete sentences at a moderate pace."
    },
    {
        "id": "navigation",
        "intent": "🗺️ Navigation & Location",
        "color": "#10b981",
        "bg": "rgba(16,185,129,0.08)",
        "border": "rgba(16,185,129,0.3)",
        "keywords": [
            "directions","navigate","where is","how far","route","map","address",
            "near me","closest","get to","drive to","walk to","location","place",
            "restaurant","hospital","school","office","station","airport","hotel"
        ],
        "advice": "A navigation or location request was detected.",
        "actions": [
            ("🗺️ Open Maps", "Open Google Maps and search for this location."),
            ("📍 Share Location", "Share your destination with someone via message."),
            ("🔊 Read Aloud", "Use Voice Studio to generate audio directions.")
        ],
        "tip": "Copy the detected address and paste it directly into Google Maps."
    },
    {
        "id": "general",
        "intent": "💬 General Conversation",
        "color": "#64748b",
        "bg": "rgba(100,116,139,0.08)",
        "border": "rgba(100,116,139,0.3)",
        "keywords": [],   # fallback
        "advice": "Speech recognized and transcribed successfully.",
        "actions": [
            ("🌍 Translate", "Select a target language above to translate this text instantly."),
            ("🔊 Generate Audio", "Head to Voice Studio to create a voiceover from this text."),
            ("📋 Copy", "Select the transcribed text above to copy it.")
        ],
        "tip": "Use the dropdowns above to instantly translate your speech into another language."
    },
]


def analyze_intent(text: str) -> dict | None:
    if not text or not text.strip():
        return None

    text_lower = text.lower()

    for rule in INTENT_RULES[:-1]:
        if any(kw in text_lower for kw in rule["keywords"]):
            return rule

    return INTENT_RULES[-1]