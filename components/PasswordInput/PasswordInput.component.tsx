"use client";

import { useState } from "react";

import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  /** Applied to the outer wrapper — pass the same border/bg/rounded/padding/
   *  margin classes you'd put on a plain `<input>`. Use `focus-within:` instead
   *  of `focus:` for any focus-ring class, since focus actually lands on the
   *  inner `<input>`, not this wrapper. */
  className?: string;
};

/** Password field with a show/hide (eye) toggle. Renders its own bordered box
 *  — the wrapper carries the visual styling so the toggle button sits inside
 *  the same field instead of overlaying a separately-bordered input. */
export default function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`flex items-center ${className}`}>
      <input {...props} type={visible ? "text" : "password"} className="flex-1 min-w-0 bg-transparent outline-none pr-2" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="shrink-0 text-slate-400 hover:text-slate-600"
      >
        {visible ? (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Eye className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
