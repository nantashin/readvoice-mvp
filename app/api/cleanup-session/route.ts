export async function POST() {
  console.log("[세션] 클리닝 요청 (클라이언트에서 처리)")

  return Response.json({
    success: true,
    message: "세션 정리는 클라이언트에서 처리됨"
  })
}
