# Lumen

Lumen is a Chrome extension and lightweight web app for looking up word meanings. Select a single word on a webpage to see its definition in a popup, or enter a word in the standalone web app.

The Flask backend uses the Free Dictionary API for English definitions and can use Groq for Tamil explanations and as a fallback for English words that are not found in the dictionary.

## Features

- Look up a selected word from the Chrome extension.
- Switch between English and Tamil in the extension popup.
- Get English definitions from the Free Dictionary API, with an optional Groq AI fallback.
- Get Tamil explanations using Groq.
- Look up English words in the standalone web chat.

## Project structure

```text
backend/
  app.py           Flask API
extension/
  background.js    Extension messaging and backend requests
  content.js       Word selection and popup trigger
  manifest.json    Chrome extension configuration
web/
  index.html       Standalone chat interface
requirements.txt   Python dependencies
.env.example      Environment variable template
```

## Requirements

- Python and pip
- Google Chrome
- A Groq API key for Tamil lookups and the English AI fallback
- Internet access for the dictionary and Groq APIs

## Setup

Run these commands from the project root.

### 1. Install backend dependencies

Create and activate a virtual environment, then install the dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On macOS or Linux, activate the environment with:

```bash
source .venv/bin/activate
```

### 2. Configure Groq (optional for English dictionary lookups)

Copy `.env.example` to `.env` and set `GROQ_API_KEY` to your key:

```text
GROQ_API_KEY=your_groq_api_key
```

The backend defaults to the `openai/gpt-oss-120b` model. To choose another model supported by your Groq account, set `GROQ_MODEL` in `.env`.

### 3. Start the backend

From the project root, run:

```bash
python backend/app.py
```

The API will be available at `http://127.0.0.1:5000`. Keep the backend running while using the extension or web app.

## Use the Chrome extension

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project's `extension` folder.
4. Open a webpage and select a single word to show its definition.
5. Use the **EN** and **தமிழ்** buttons in the popup to switch languages.

## Use the web app

With the backend running, open `web/index.html` in Chrome or another browser. Enter an English word and select **Send** (or press Enter). The web app submits lookups in English.

## API

The backend exposes a health-check route and a word lookup route:

- `GET /` — confirms that the backend is running.
- `POST /chat` — accepts a JSON request with a `message` word and an optional `lang` value. Use `ta` or `tamil` for a Tamil explanation; English is the default.

Example request:

```json
{
  "message": "serendipity",
  "lang": "ta"
}
```

Successful lookups return a JSON object containing `response`, `lang`, and `source`. Invalid requests and unsuccessful lookups return an `error` field.
