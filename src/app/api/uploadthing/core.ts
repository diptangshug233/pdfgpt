import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { pinecone } from "@/lib/pinecone";
import { convertToAscii } from "@/lib/utils";
import {
  Document,
  RecursiveCharacterTextSplitter,
} from "@pinecone-database/doc-splitter";
import { getEmbeddings } from "@/lib/embeddings";
import { md5 } from "js-md5";
import { PineconeRecord } from "@pinecone-database/pinecone";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";

type PDFPage = {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
  };
};

const f = createUploadthing();

/**
 * Gets the user's ID and subscription plan.
 *
 * @returns {Promise<{userId: string, subscriptionPlan: import("@/config/stripe").Plan}>}
 * @throws {Error} If the user is not logged in.
 */
const middleware = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user || !user.id) throw new Error("Unauthorized");

  const subscriptionPlan = await getUserSubscriptionPlan();

  return { userId: user.id, subscriptionPlan };
};

/**
 * Called after a file has been uploaded to the server. This function
 * checks if a file with the same key already exists in the database.
 * If it does, it exits early. If it doesn't, it creates a new file document
 * with an upload status of "PROCESSING". It then attempts to load the
 * PDF file and extract its pages. If the file is too large for the user's
 * plan, it updates the upload status to "FAILED". Otherwise, it extracts
 * the pages, embeds them, and indexes them in Pinecone. Finally, it updates
 * the upload status to "SUCCESS".
 *
 * @param {Object} opts
 * @prop {Object} metadata - The user's ID and subscription plan
 * @prop {Object} file - The uploaded file
 * @prop {string} file.key - The file's key
 * @prop {string} file.name - The file's name
 * @prop {string} file.url - The file's URL
 */
const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>;
  file: { key: string; name: string; url: string };
}) => {
  const isFileExists = await db.file.findFirst({
    where: {
      key: file.key,
    },
  });

  if (isFileExists) return;

  const createdFile = await db.file.create({
    data: {
      key: file.key,
      name: file.name,
      userId: metadata.userId,
      url: file.url,
      uploadStatus: "PROCESSING",
    },
  });

  try {
    const response = await fetch(file.url);
    const blob = await response.blob();
    const loader = new PDFLoader(blob);
    const pageLevelDocs = (await loader.load()) as PDFPage[];
    const pagesAmt = pageLevelDocs.length;
    const { subscriptionPlan } = metadata;
    const { isSubscribed } = subscriptionPlan;
    const isProExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Pro")!.pagesPerPdf;
    const isFreeExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Free")!.pagesPerPdf;

    if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
      await db.file.update({
        data: {
          uploadStatus: "FAILED",
        },
        where: {
          id: createdFile.id,
        },
      });
    }

    const documents = await Promise.all(pageLevelDocs.map(prepareDocument));
    const vectors = await Promise.all(documents.flat().map(embedDocument));

    const pineconeIndex = pinecone.index("pdfgpt");
    const namespace = pineconeIndex.namespace(convertToAscii(createdFile.id));
    await namespace.upsert(vectors);

    await db.file.update({
      data: {
        uploadStatus: "SUCCESS",
      },
      where: {
        id: createdFile.id,
      },
    });
  } catch (err) {
    await db.file.update({
      data: {
        uploadStatus: "FAILED",
      },
      where: {
        id: createdFile.id,
      },
    });
  }
};

export const ourFileRouter = {
  freePlanUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

/**
 * Takes a PDFPage and returns an array of Documents after splitting its pageContent into chunks of 5000 bytes or less.
 * The Documents' metadata includes the original page number and a truncated version of the page text (up to 3600 bytes).
 * @param {PDFPage} page The PDFPage to process
 * @returns {Promise<Document[]>} A promise that resolves to an array of Documents
 */
async function prepareDocument(page: PDFPage) {
  let { pageContent, metadata } = page;
  pageContent = pageContent.replace(/\n/g, "");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 5000,
  });
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: truncateStringByBytes(pageContent, 3600),
      },
    }),
  ]);
  return docs;
}

/**
 * Takes a Document and embeds its pageContent using the Gemini text-embedding-004 model.
 * Returns a PineconeRecord with the id set to the md5 of the pageContent, values set to the Gemini embeddings,
 * and metadata set to the text and pageNumber of the original Document.
 * @param {Document} doc The Document to process
 * @returns {Promise<PineconeRecord>} A promise that resolves to a PineconeRecord
 */
async function embedDocument(doc: Document) {
  try {
    const embeddings = await getEmbeddings(doc.pageContent);
    const hash = md5(doc.pageContent);
    return {
      id: hash,
      values: embeddings,
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    } as PineconeRecord;
  } catch (error) {
    throw error;
  }
}

/**
 * Truncates a string to fit within the given number of bytes. Works by encoding
 * the string to a Uint8Array and then slicing off the bytes that are over the
 * limit. Be aware that this can result in a string that is not a valid UTF-8
 * sequence, depending on the input.
 *
 * @param {string} str The string to truncate
 * @param {number} bytes The maximum number of bytes that the string should take
 * @returns {string} The truncated string
 */
export const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};
