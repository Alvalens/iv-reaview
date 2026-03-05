import type { WebSocket } from "ws";

export function handleWebSocketConnection(ws: WebSocket, sessionId: string) {
  console.log(`[WS] Client connected for session: ${sessionId}`);

  // TODO: Implement Gemini Live API WebSocket proxy
  // 1. Validate session exists and is in CREATED state
  // 2. Open WebSocket to Gemini Live API
  // 3. Send setup message with persona system prompt
  // 4. Relay audio: client PCM16 → base64 → Gemini
  // 5. Relay audio: Gemini base64 → PCM16 → client
  // 6. Collect transcript entries from Gemini responses
  // 7. Handle session lifecycle (start, end, error)

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      // Binary frame = PCM16 audio from client mic
      // TODO: relay to Gemini Live API
      console.log(`[WS] Received audio frame: ${(data as Buffer).length} bytes`);
    } else {
      // Text frame = JSON control message
      const message = JSON.parse(data.toString());
      console.log(`[WS] Received control message:`, message);
    }
  });

  ws.on("close", () => {
    console.log(`[WS] Client disconnected for session: ${sessionId}`);
    // TODO: Clean up Gemini connection, save transcript
  });

  ws.on("error", (error) => {
    console.error(`[WS] Error for session ${sessionId}:`, error);
  });

  // Send initial status
  ws.send(JSON.stringify({ type: "status", status: "CREATED" }));
}
