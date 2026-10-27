# app.py

import json
import os
import sys
import urllib.parse
import urllib.request
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from groq import Groq

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Define the model name ---
configured_model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
MODEL_NAME = "openai/gpt-oss-120b" if configured_model == "gpt-oss-120b" else configured_model

# --- Initialize Groq API client ---
client = None
groq_api_key = os.environ.get("GROQ_API_KEY")
if groq_api_key:
    client = Groq(api_key=groq_api_key)
    print(f"Groq API client initialized successfully with model: {MODEL_NAME}")
else:
    print("WARNING: GROQ_API_KEY environment variable not set. Please set it in your .env file.")


def fetch_standard_dictionary(word):
    """Fetches English word details from the standard Free Dictionary API (non-AI)."""
    try:
        clean_word = urllib.parse.quote(word.strip().lower())
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{clean_word}"
        req = urllib.request.Request(url, headers={"User-Agent": "LumenDictionary/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                if isinstance(data, list) and len(data) > 0:
                    entry = data[0]
                    word_title = entry.get("word", word)
                    meanings = entry.get("meanings", [])

                    part_of_speech = ""
                    definition = ""
                    example = ""
                    synonyms = []

                    for m in meanings:
                        if not part_of_speech:
                            part_of_speech = m.get("partOfSpeech", "")

                        for syn in m.get("synonyms", []):
                            if syn not in synonyms:
                                synonyms.append(syn)

                        for d in m.get("definitions", []):
                            if not definition and d.get("definition"):
                                definition = d.get("definition")
                            if not example and d.get("example"):
                                example = d.get("example")
                            for syn in d.get("synonyms", []):
                                if syn not in synonyms:
                                    synonyms.append(syn)

                    lines = [
                        f"Word: {word_title}",
                        f"Part of speech: {part_of_speech}",
                        f"Definition: {definition}",
                    ]
                    if synonyms:
                        lines.append(f"Synonyms: {', '.join(synonyms[:3])}")
                    if example:
                        lines.append("Example sentences:")
                        lines.append(example)

                    return "\n".join(lines)
    except Exception as e:
        print(f"Standard Dictionary API lookup failed for '{word}': {e}")
    return None


def fetch_tamil_ai(word):
    """Uses Groq AI to explain an English word entirely in Tamil."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert bilingual English-to-Tamil lexicographer.\n"
                "Explain the given English word in Tamil. The ENTIRE response must be in the Tamil language, "
                "except for the word itself and the original English example sentence.\n"
                "Do NOT use markdown bolding (**, ##, etc.). Produce exact plain text adhering to this format:\n\n"
                "Word: [English Word]\n"
                "Part of speech: [Tamil part of speech: பெயர்ச்சொல் / வினைச்சொல் / பெயரடை / வினையடை]\n"
                "Definition: [Clear, natural Tamil explanation of the meaning]\n"
                "Synonyms: [Up to 3 Tamil synonym words separated by comma]\n"
                "Example sentences:\n"
                "[English sentence] - [Tamil translation of this sentence]\n"
                "Translations:\n"
                "தமிழ் அர்த்தம்: [Direct Tamil word equivalents / தமிழ் சொல்லாக்கம்]"
            )
        },
        {
            "role": "user",
            "content": "Define the word: serendipity"
        },
        {
            "role": "assistant",
            "content": (
                "Word: serendipity\n"
                "Part of speech: பெயர்ச்சொல்\n"
                "Definition: நாம் திட்டமிடாமல் அல்லது எதிர்பாராமல் இருக்கும்போது எதேச்சையாக நிகழும் நல்வாய்ப்பு அல்லது மகிழ்ச்சியான கண்டுபிடிப்பு.\n"
                "Synonyms: நல்வாய்ப்பு, எதிர்பாராத நன்மை, அதிர்ஷ்ட நிகழ்வு\n"
                "Example sentences:\n"
                "Finding this rare book was pure serendipity. - அந்த அரிய பழைய புத்தகத்தைக் கண்டெடுத்தது ஒரு எதிர்பாராத நல்வாய்ப்பே ஆகும்.\n"
                "Translations:\n"
                "தமிழ் அர்த்தம்: எதிர்பாராத நல்வாய்ப்பு, தற்செயல் நன்மை"
            )
        },
        {
            "role": "user",
            "content": f"Define the word: {word}"
        }
    ]

    chat_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        temperature=0.3,
    )
    return chat_completion.choices[0].message.content or ""


def fetch_english_ai(word):
    """Fallback Groq AI for English definitions if not found in the standard dictionary API."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert lexicographer. Provide definitions for words in the exact plain text format below.\n"
                "Do NOT use any Markdown or extra formatting characters.\n\n"
                "Format:\n"
                "Word: [Word]\n"
                "Definition: [Definition(s)]\n"
                "Part of speech: [Part of speech]\n"
                "Synonyms: [Up to 3 synonyms separated by comma]\n"
                "Example sentences:\n"
                "[Example 1]\n"
                "Translations:\n"
                "Spanish: [Spanish translation]\n"
                "French: [French translation]"
            )
        },
        {
            "role": "user",
            "content": f"Define the following word: {word}"
        }
    ]

    chat_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        temperature=0.3,
    )
    return chat_completion.choices[0].message.content or ""


@app.route('/')
def home():
    return "Python Flask Backend for Lumen (Standard Dictionary + Groq AI Tamil) is running!"


@app.route('/chat', methods=['POST'])
def chat_endpoint():
    global client
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    word_to_define = data.get('message')
    lang = data.get('lang', 'en').lower()

    if not word_to_define:
        return jsonify({"error": "No word provided to define"}), 400

    print(f"Received request to define: '{word_to_define}' (Language: '{lang}')")

    # --- Mode 1: Tamil (Powered by Groq AI) ---
    if lang in ('ta', 'tamil'):
        if not client:
            current_key = os.environ.get("GROQ_API_KEY")
            if current_key:
                client = Groq(api_key=current_key)
            else:
                return jsonify({"error": "GROQ_API_KEY environment variable is not configured"}), 500

        try:
            ai_response = fetch_tamil_ai(word_to_define)
            return jsonify({
                "response": ai_response,
                "lang": "ta",
                "source": "groq_ai"
            })
        except Exception as e:
            print(f"Error generating Tamil AI content: {e}")
            return jsonify({"error": f"Failed to get Tamil AI response: {str(e)}"}), 500

    # --- Mode 2: English (Standard Dictionary API with AI Fallback) ---
    else:
        dict_response = fetch_standard_dictionary(word_to_define)
        if dict_response:
            return jsonify({
                "response": dict_response,
                "lang": "en",
                "source": "standard_dictionary"
            })

        print(f"Standard Dictionary did not find '{word_to_define}'; attempting AI fallback...")
        if not client:
            current_key = os.environ.get("GROQ_API_KEY")
            if current_key:
                client = Groq(api_key=current_key)

        if client:
            try:
                ai_response = fetch_english_ai(word_to_define)
                return jsonify({
                    "response": ai_response,
                    "lang": "en",
                    "source": "groq_ai_fallback"
                })
            except Exception as e:
                print(f"AI fallback failed: {e}")

        return jsonify({"error": f"Definition for '{word_to_define}' could not be found."}), 404


if __name__ == '__main__':
    app.run(debug=True)
