import { db } from "@/db";
import { pinecone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";
import { NextRequest } from "next/server";
import { getEmbeddings } from "@/lib/embeddings";
import { convertToAscii } from "@/lib/utils";

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  const { id: userId } = user!;

  if (!userId)
    return new Response("Unauthorized", {
      status: 401,
    });

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file)
    return new Response("Not found", {
      status: 404,
    });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  const queryEmbeddings = await getEmbeddings(message);

  const pineconeIndex = pinecone.index("pdfgpt");

  const namespace = pineconeIndex.namespace(convertToAscii(file.id));
  const results = await namespace.query({
    vector: queryEmbeddings,
    topK: 4,
    includeMetadata: true,
  });

  const formattedResults = results.matches.map((match) => {
    return {
      pageContent: match.metadata?.text ?? "",
      metadata: {
        pageNumber: match.metadata?.pageNumber ?? 0,
      },
      id: match.id,
    };
  });

  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 6,
  });

  const formattedPrevMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage ? ("user" as const) : ("assistant" as const),
    content: msg.text,
  }));

  const prompt = `
  System message:
  Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
        
  \n----------------\n
  
  PREVIOUS CONVERSATION:
  ${formattedPrevMessages.map((message) => {
    if (message.role === "user") return `User: ${message.content}\n`;
    return `Assistant: ${message.content}\n`;
  })}
  
  \n----------------\n
  
  CONTEXT:
  ${formattedResults.map((r) => r.pageContent).join("\n\n")}
  
  USER INPUT: ${message}`;

  const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

  const generationConfig = {
    temperature: 1.0,
    topK: 40,
    topP: 0.9,
  };
  const response = await genai
    .getGenerativeModel({ model: "gemini-1.5-flash", generationConfig })
    .generateContentStream(prompt);

  const stream = GoogleGenerativeAIStream(response, {
    async onCompletion(completion) {
      await db.message.create({
        data: {
          text: completion,
          isUserMessage: false,
          fileId,
          userId,
        },
      });
    },
  });

  return new StreamingTextResponse(stream);
};
