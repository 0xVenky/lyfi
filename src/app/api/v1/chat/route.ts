import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/chat/tools";

export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Chat service unavailable" }, { status: 500 });
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  if (!body.messages?.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  if (body.messages.length > 20) {
    return Response.json({ error: "Too many messages. Please start a new conversation." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // Build message history for Anthropic API
  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Tool-use loop: call Claude, execute tools, repeat until text response
  const MAX_TOOL_ROUNDS = 5;
  let rounds = 0;

  // We accumulate the full conversation including tool calls/results
  const apiMessages: Anthropic.MessageParam[] = [...messages];

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: apiMessages,
    });

    // Check for tool use blocks
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    if (toolUseBlocks.length === 0) {
      // Final response — extract text and stream it
      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
      }
      return streamText(text);
    }

    // Execute tools and build result messages
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(block.name, block.input),
      }))
    );

    apiMessages.push({ role: "user", content: toolResults });
  }

  // Safety: if we hit max rounds, return whatever we have
  return streamText("I've gathered the data but hit the processing limit. Please try a more specific question.");
}

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunkSize = 8;
      let i = 0;
      function push() {
        if (i >= text.length) {
          controller.close();
          return;
        }
        const chunk = text.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(chunk));
        i += chunkSize;
        if (i < text.length) {
          setTimeout(push, 10);
        } else {
          controller.close();
        }
      }
      push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
