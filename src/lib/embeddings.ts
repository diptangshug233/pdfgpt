import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

/**
 * Embeds the given text into a numerical vector using the Gemini text-embedding-004 model.
 * @param {string} text The text to embed
 * @returns {Promise<number[]>} A promise that resolves to the embedded vector
 */

export async function getEmbeddings(text: string) {
  try {
    const embeddingModel = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });
    const response = await embeddingModel.embedContent(
      text.replace(/\n/g, " ")
    );
    return response.embedding.values as number[];
  } catch (error) {
    console.log("error calling gemini embeddings", error);
    throw error;
  }
}
