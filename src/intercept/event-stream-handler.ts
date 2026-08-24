/**
 * Event Stream Handler - 正确版本
 */

import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

export async function handleVirtualSupplierRequest(
  vsName: string,
  config: any,
  modelId: string,
  messages: any[],
  doStream: boolean,
  signal?: AbortSignal  // ← 新增中止信号
) {
  const gatewayUrl = `http://127.0.0.1:${config.port}/v1/chat/completions`;
  
  const eventStream = createAssistantMessageEventStream();
  
  // 完整的供应商注册名
  const providerName = `local-gateway-${vsName}`;
  
  // 创建 output 对象，所有事件共享
  const output: any = {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: providerName,
    model: modelId,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "pending",
    timestamp: Date.now(),
  };
  
  let thinkingBlock: any = null;
  let textBlock: any = null;
  let thinkingCompleted = false;
  
  const getContentIndex = (block: any) => output.content.indexOf(block);
  
  (async () => {
    try {
      // 检查是否已中止
      if (signal?.aborted) {
        eventStream.push({
          type: "error",
          reason: "aborted",
          error: { ...output, stopReason: "aborted", errorMessage: "Request aborted" }
        });
        return;
      }
      
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ virtualSupplier: vsName, model: modelId, messages, doStream: true }),
        signal,  // ← 传递中止信号
      });
      
      // 检查是否已中止
      if (signal?.aborted) {
        eventStream.push({
          type: "error",
          reason: "aborted",
          error: { ...output, stopReason: "aborted", errorMessage: "Request aborted" }
        });
        return;
      }

      if (!response.ok) {
        eventStream.push({
          type: "error",
          reason: "error",
          error: { ...output, stopReason: "error", errorMessage: `HTTP ${response.status}` }
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        eventStream.push({
          type: "error",
          reason: "error",
          error: { ...output, stopReason: "error", errorMessage: "No body" }
        });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // start
      eventStream.push({ type: "start", partial: output });

      while (true) {
        // 检查是否已中止
        if (signal?.aborted) {
          eventStream.push({
            type: "error",
            reason: "aborted",
            error: { ...output, stopReason: "aborted", errorMessage: "Request aborted" }
          });
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
            const delta = json.choices?.[0]?.delta;
            
            // 思维链
            if (delta?.reasoning_content && !thinkingCompleted) {
              if (!thinkingBlock) {
                thinkingBlock = { type: "thinking", thinking: "" };
                output.content.push(thinkingBlock);
                eventStream.push({
                  type: "thinking_start",
                  contentIndex: getContentIndex(thinkingBlock),
                  partial: output
                });
              }
              thinkingBlock.thinking += delta.reasoning_content;
              eventStream.push({
                type: "thinking_delta",
                contentIndex: getContentIndex(thinkingBlock),
                delta: delta.reasoning_content,
                partial: output
              });
            }
            
            // 正文
            if (delta?.content) {
              if (thinkingBlock && !thinkingCompleted) {
                thinkingCompleted = true;
                eventStream.push({
                  type: "thinking_end",
                  contentIndex: getContentIndex(thinkingBlock),
                  content: thinkingBlock.thinking,
                  partial: output
                });
              }
              if (!textBlock) {
                textBlock = { type: "text", text: "" };
                output.content.push(textBlock);
                eventStream.push({
                  type: "text_start",
                  contentIndex: getContentIndex(textBlock),
                  partial: output
                });
              }
              textBlock.text += delta.content;
              eventStream.push({
                type: "text_delta",
                contentIndex: getContentIndex(textBlock),
                delta: delta.content,
                partial: output
              });
            }
          } catch {
            // ignore
          }
        }
      }

      // done（检查是否已中止）
      if (signal?.aborted) {
        eventStream.push({
          type: "error",
          reason: "aborted",
          error: { ...output, stopReason: "aborted", errorMessage: "Request aborted" }
        });
        return;
      }
      
      eventStream.push({
        type: "done",
        reason: "stop",
        message: { ...output, stopReason: "stop", timestamp: Date.now() }
      });

    } catch (err) {
      // 中止导致的错误
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
        eventStream.push({
          type: "error",
          reason: "aborted",
          error: { ...output, stopReason: "aborted", errorMessage: "Request aborted" }
        });
      } else {
        eventStream.push({
          type: "error",
          reason: "error",
          error: { ...output, stopReason: "error", errorMessage: String(err) }
        });
      }
    }
  })();

  return eventStream;
}
