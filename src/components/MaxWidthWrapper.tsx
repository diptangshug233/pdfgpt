import { cn } from "@/lib/utils";
import { ReactNode } from "react";

/**
 * A component that wraps its children in a div with a maximum width of
 * `max-w-screen-xl` and adds some horizontal padding.
 *
 * @param {Object} props
 * @prop {string} [className] - Additional className for the outer div.
 * @prop {ReactNode} children - The content to be wrapped.
 * @returns {ReactElement}
 */
const MaxWidthWrapper = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-screen-xl px-2.5 md:px-20",
        className
      )}
    >
      {children}
    </div>
  );
};

export default MaxWidthWrapper;
