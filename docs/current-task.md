Review app/page.tsx and fix any issues to ensure the full voice flow works:
1. Mic button click -> useSpeechRecognition.startListening
2. On transcript -> POST to /api/chat with message
3. Stream response chunks -> append to display text
4. On complete -> useSpeechSynthesis.speak(fullResponse)
5. Handle all errors gracefully with Korean error messages
Also add a Stop button (aria-label=읽기 중지) that calls tts.stop()
Fix and save app/page.tsx now.
