/**
 * Event Stream Handler - 简化版，不干扰 Pi
 */

import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

export async function handleVirtualSupplierRequest(
  vsName: string,
  config: any,
  modelId: string,
  messages: any[],
  doStream: boolean,
  signal?: AbortSignal
) {
  const eventStream = createAssistantMessageEventStream();
  
  const providerName = `local-gateway-${vsName}`;
  
  const output: any = {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: providerName,
    model: modelId,
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "pending",
    timestamp: Date.now(),
  };
  
  // 异步处理，不阻塞 Pi
  (async () => {
    try {
      if (signal?.aborted) {
        eventStream.push({ type: "error", reason: "aborted", error: { ...output, stopReason: "aborted", errorMessage: "Aborted" } });
        return;
      }
      
      const gatewayUrl = `http://127.0.0.1:${config.port}/v1/chat/completions`;
      
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ virtualSupplier: vsName, model: modelId, messages, doStream: true }),
        signal,
      });

      if (signal?.aborted) {
        eventStream.push({ type: "error", reason: "aborted", error: { ...output, stopReason: "aborted", errorMessage: "Aborted" } });
        return;
      }

      if (!response.ok) {
        eventStream.push({ type: "error", reason: "error", error: { ...output, stopReason: "error", errorMessage: `HTTP ${response.status}` } });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        eventStream.push({ type: "error", reason: "error", error: { ...output, stopReason: "error", errorMessage: "No body" } });
        return;
      }

      eventStream.push({ type: "start", partial: output });

      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      while (true) {
        if (signal?.aborted) {
          eventStream.push({ type: "error", reason: "aborted", error: { ...output, stopReason: "aborted", errorMessage: "Aborted" } });
          return;
        }
        
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;

            if (content) {
              text += content;
              eventStream.push({
                type: "text_delta",
                contentIndex: 0,
                delta: content,
                partial: { ...output, content: [{ type: "text", text }] }
              });
            }
          } catch {
            // ignore
          }
        }
      }

      if (signal?.aborted) {
        eventStream.push({ type: "error", reason: "aborted", error: { ...output, stopReason: "aborted", errorMessage: "Aborted" } });
        return;
      }
      
      eventStream.push({
        type: "done",
        reason: "stop",
        message: { ...output, content: [{ type: "text", text }], stopReason: "stop", timestamp: Date.now() }
      });

    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        eventStream.push({ type: "error", reason: "aborted", error: { ...output, stopReason: "aborted", errorMessage: "Aborted" } });
      } else {
        eventStream.push({ type: "error", reason: "error", error: { ...output, stopReason: "error", errorMessage: String(err) } });
      }
    }
  })();

  return eventStream;
}
