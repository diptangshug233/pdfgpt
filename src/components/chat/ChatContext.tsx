import { ChangeEvent, createContext, ReactNode, useRef, useState } from "react";
import { useToast } from "../ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/app/_trpc/client";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";

type StreamResponse = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};

interface Props {
  fileId: string;
  children: ReactNode;
}

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: "",
  handleInputChange: () => {},
  isLoading: false,
});

/**
 * A provider for the chat context, which is used to manage the state of
 * the chat input and messages.
 *
 * The provider uses the `useMutation` hook to create a mutation function
 * that sends a message to the server and updates the chat state based on the
 * response.
 *
 * The provider also exposes a `handleInputChange` function that is used
 * to update the chat input message state when the user types something.
 *
 * The provider also exposes an `addMessage` function that is used to
 * send a message to the server and update the chat state based on the
 * response.
 *
 * The provider also exposes an `isLoading` value that is used to
 * indicate whether a message is being sent or not.
 */
export const ChatContextProvider = ({ fileId, children }: Props) => {
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const utils = trpc.useContext();

  const { toast } = useToast();

  const backupMessage = useRef("");

  const { mutate: sendMessage } = useMutation({
    /**
     * Mutation function to add a new message to the chat.
     * @param {{ message: string }} opts - The message to be added.
     * @returns {Promise<Response>} - The response from the server.
     * @throws {Error} - If the server returns an error.
     */
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch("/api/message", {
        method: "POST",
        body: JSON.stringify({
          fileId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add message");
      }

      return response.body;
    },
    /**
     * Called when the mutation is initiated. Sets the chat input message to an
     * empty string, cancels any ongoing `getFileMessages` query, and sets the
     * infinite data to the current data with the new message inserted at the
     * top of the latest page. The component is set to a loading state.
     *
     * @param {{ message: string }} opts - The message to be added.
     * @returns {Promise<{ previousMessages: Message[] }>} - A promise that resolves
     * to an object with a single property `previousMessages` which is an array
     * of all the messages that existed in the chat before the new message was
     * added.
     */
    onMutate: async ({ message }) => {
      backupMessage.current = message;
      setMessage("");

      await utils.getFileMessages.cancel();
      const previousMessages = utils.getFileMessages.getInfiniteData();

      utils.getFileMessages.setInfiniteData(
        { fileId, limit: INFINITE_QUERY_LIMIT },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            };
          }
          let newPages = [...old.pages];
          let latestPage = newPages[0]!;
          latestPage.messages = [
            {
              createdAt: new Date().toISOString(),
              id: crypto.randomUUID(),
              text: message,
              isUserMessage: true,
            },
            ...latestPage.messages,
          ];

          newPages[0] = latestPage;

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      setIsLoading(true);

      return {
        previousMessages:
          previousMessages?.pages.flatMap((page) => page.messages) ?? [],
      };
    },

    /**
     * Called when the mutation fails.
     * Resets the chat input message to the last message sent before the mutation
     * and sets the infinite data to the previous messages.
     * @param _ - The error that caused the mutation to fail.
     * @param __ - The variables passed to the mutation.
     * @param context - The context of the mutation.
     */
    onError: (_, __, context) => {
      setMessage(backupMessage.current);
      utils.getFileMessages.setData(
        { fileId },
        { messages: context?.previousMessages ?? [] }
      );
    },

    /**
     * Called when the mutation is successful.
     * Sets the chat input message to an empty string and sets the infinite data
     * to the previous messages with the new message inserted at the top of the
     * latest page.
     * @param stream - The response from the server.
     */
    onSuccess: async (stream) => {
      setIsLoading(false);
      if (!stream) {
        return toast({
          title: "There was a problem sending this message",
          description: "Please refresh this page and try again",
          variant: "destructive",
        });
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let accResponse = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        let chunkValue = decoder.decode(value);
        if (chunkValue.startsWith("0:")) {
          chunkValue = chunkValue.substring(2);
        }
        accResponse += chunkValue;

        utils.getFileMessages.setInfiniteData(
          { fileId, limit: INFINITE_QUERY_LIMIT },
          (old) => {
            if (!old) {
              return {
                pages: [],
                pageParams: [],
              };
            }

            let isAiResponseCreated = old.pages.some((page) =>
              page.messages.some((message) => message.id === "ai-response")
            );

            let updatedPages = old.pages.map((page) => {
              if (page === old.pages[0]) {
                let updatedMessages;

                if (!isAiResponseCreated) {
                  updatedMessages = [
                    {
                      createdAt: new Date().toISOString(),
                      id: "ai-response",
                      text: accResponse,
                      isUserMessage: false,
                    },
                    ...page.messages,
                  ];
                } else {
                  updatedMessages = page.messages.map((message) => {
                    if (message.id === "ai-response") {
                      return { ...message, text: accResponse };
                    }
                    return message;
                  });
                }

                return { ...page, messages: updatedMessages };
              }
              return page;
            });
            return { ...old, pages: updatedPages };
          }
        );
      }
    },

    /**
     * Called when the mutation has finished, regardless of whether it was successful
     * or not. Sets isLoading to false and invalidates the getFileMessages query.
     */
    onSettled: async () => {
      setIsLoading(false);
      await utils.getFileMessages.invalidate({ fileId });
    },
  });

  const addMessage = () => sendMessage({ message });

  /**
   * Handles a change event from the text area, and updates the message
   * state with the new value.
   * @param {ChangeEvent<HTMLTextAreaElement>} e - The change event.
   */
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <ChatContext.Provider
      value={{ addMessage, message, handleInputChange, isLoading }}
    >
      {children}
    </ChatContext.Provider>
  );
};
