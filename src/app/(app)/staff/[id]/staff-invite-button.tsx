"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendStaffInvitation } from "@/actions/staff";

interface StaffInviteButtonProps {
  staffId: string;
  organizationId: string;
  staffEmail: string | null;
}

export function StaffInviteButton({
  staffId,
  organizationId,
  staffEmail,
}: StaffInviteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!staffEmail) return null;

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await sendStaffInvitation(organizationId, staffId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "招待メールを送信しました" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "送信中…" : "招待メールを送る"}
      </Button>
      {message && (
        <p
          className={`text-xs ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
