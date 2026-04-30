type Status = "idle" | "listening" | "processing" | "speaking"

interface MicButtonProps {
  status: Status
  onClick: () => void
}

export default function MicButton({ status, onClick }: MicButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={status === "listening" ? "마이크 중지" : "마이크 버튼, 눌러서 말하기"}
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: status === "listening" ? "#EF4444" : "#0284C7",
        border: "none",
        cursor: "pointer",
        fontSize: "3rem",
        boxShadow: "0 8px 32px rgba(2,132,199,0.35)",
        transition: "all 0.2s",
      }}
    >
      {status === "listening" ? "⏹" : "🎙"}
    </button>
  )
}
