import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";

// 引入环境变量
const cartesiaApiKey = process.env.CARTESIA_API_KEY;
const modelId = process.env.CARTESIA_MODEL_ID;
const voiceId = process.env.CHINESE_VOICE_ID;
const groqApiKey = process.env.GROQ_API_KEY;

if (!cartesiaApiKey || !modelId || !voiceId || !groqApiKey) {
  throw new Error("Missing required environment variables.");
}

const groq = new Groq({ apiKey: groqApiKey });

const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  console.time("transcribe " + request.headers.get("x-vercel-id") || "local");

  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response("Invalid request", { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response("Invalid audio", { status: 400 });

  console.timeEnd("transcribe " + request.headers.get("x-vercel-id") || "local");
  console.time(
    "respond " + request.headers.get("x-vercel-id") || "local"
  );

  // 使用环境变量进行某些操作
  const ttsResponse = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': cartesiaApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transcript,
      model_id: modelId,
      voice: { mode: "id", id: voiceId },
      output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: 44100 }
    })
  });

  if (!ttsResponse.ok) {
    return new Response("TTS request failed", { status: 500 });
  }

  const audioBuffer = await ttsResponse.arrayBuffer();
  return new Response(audioBuffer, {
    headers: { "Content-Type": "audio/wav" }
  });
}

async function getTranscript(input: FormDataEntryValue): Promise<string | null> {
  // Your implementation to get transcript from input
  return "Sample transcript"; // Replace with actual implementation
}
