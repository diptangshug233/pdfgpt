import { db } from "@/db";
import { pinecone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";
import { NextRequest } from "next/server";
import { getEmbeddings } from "@/lib/embeddings";
import { convertToAscii } from "@/lib/utils";

/**
 * Handles sending a message from the user to the server.
 *
 * Body must contain `fileId` and `message` properties.
 *
 * @param {NextRequest} req
 * @returns {Promise<Response>}
 */
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
  You are PDF-GPT, an AI assistant designed to help users answer questions based strictly on the context provided from uploaded PDFs or the ongoing conversation. Your answers must be concise, accurate, and in markdown format. You should never provide information outside the provided context or make up answers. When asked questions beyond your scope, respond with predefined messages. Maintain a professional and helpful tone at all times.
  
  ### Predefined Responses:
  1. **Identity-related questions**: "I am an AI assistant designed to assist with answering questions based on provided context. I do not have personal experiences or identity."
  2. **Out-of-scope or irrelevant questions**: "I can only assist with questions related to the provided context or prior conversation. Please provide relevant information for me to assist you."
  3. **Insufficient context**: "I do not have enough information to answer that question based on the provided context."
  
  ----------------
  
  **PREVIOUS CONVERSATION**:
  ${formattedPrevMessages
    .map((message) => {
      return message.role === "user"
        ? `**User**: ${message.content}\n`
        : `**Assistant**: ${message.content}\n`;
    })
    .join("")}
  
  ----------------
  
  **CONTEXT FROM PDF**:
  ${formattedResults.map((r) => r.pageContent).join("\n\n")}
  
  ----------------
  
  **USER QUESTION**: ${message}
  
  ### Instructions for the Assistant:
  - **Context-Only Answers**: Only use the provided context from the PDF or previous conversation to answer the user's question. Avoid any speculation or creation of new information.
  - **Predefined Response Handling**: 
     - For identity-related or personal experience questions, use the predefined response.
     - For out-of-scope questions, respond with the predefined message.
     - If the context is insufficient to answer the question, use the predefined message about insufficient information.
  - **Conciseness**: Keep answers short and to the point, while ensuring they remain complete and informative.
  - **Markdown Format**: Always reply in markdown format, using proper headings, bullet points, or lists when necessary to improve readability.
  `;

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
