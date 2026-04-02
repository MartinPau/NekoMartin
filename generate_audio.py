import json
import os
import asyncio
import edge_tts

# Read the data.js file
with open('data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract JSON portion
json_str = content.replace('const NekoData = ', '').strip()
if json_str.endswith(';'):
    json_str = json_str[:-1]

data = json.loads(json_str)
insights = data.get('aiInsights', {})

# Ensure audio directory exists
if not os.path.exists('audio'):
    os.makedirs('audio')

# Phenomenal Neural Swedish Female Voice (Calm & Young)
VOICE = "sv-SE-SofieNeural"

async def generate_all_mp3s():
    tasks = []
    
    for key, text in insights.items():
        output_file = f"audio/{key}.mp3"
        if not os.path.exists(output_file):
            print(f"Generating TTS for {key}...")
            # Pitch down slightly, speed down slightly for a more calm feel
            # Edge TTS supports prosody: --rate=-5% --pitch=+0Hz
            communicate = edge_tts.Communicate(text, VOICE, rate="-5%")
            await communicate.save(output_file)
        else:
            print(f"File {output_file} already exists, skipping.")

if __name__ == "__main__":
    asyncio.run(generate_all_mp3s())
    print("\nAudio generation successfully completed.")
