function cleanDisplay(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    // 볼드 처리: **텍스트** → <strong>텍스트</strong>
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "  • ")
    .replace(/[-–—]{3,}/g, "")
    .replace(/^>\s*/gm, "")
    .trim()
}

interface ResponseDisplayProps {
  response: string
  status: "idle" | "listening" | "processing" | "speaking"
  onStop: () => void
}

export default function ResponseDisplay({ response, status, onStop }: ResponseDisplayProps) {
  if (!response) return null

  const displayText = cleanDisplay(response)

  return (
    <div
      aria-live="polite"
      style={{
        marginTop: "1.5rem",
        background: "white",
        borderRadius: "1rem",
        padding: "1.5rem",
        width: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          color: "#1E3A5F",
          fontSize: "1.125rem",
          lineHeight: 1.9,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
        dangerouslySetInnerHTML={{ __html: displayText }}
      />
      {status === "speaking" && (
        <button
          onClick={onStop}
          aria-label="읽기 중지"
          style={{
            marginTop: "1rem",
            minWidth: "48px",
            minHeight: "48px",
            background: "#0D9488",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          ⏹ 읽기 중지
        </button>
      )}
    </div>
  )
}
