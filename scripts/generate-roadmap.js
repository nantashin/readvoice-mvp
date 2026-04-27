const pptxgen = require("pptxgenjs")
const fs = require("fs")
const path = require("path")

const dataPath = path.join(__dirname, "../docs/roadmap-data.json")
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"))

const pres = new pptxgen()
pres.layout = "LAYOUT_16x9"
pres.title = "READ VOICE Pro 개발 로드맵"

const W = 10, H = 5.625
const BG = "0A0E1A"
const ACCENT = "3B82F6"
const DONE = "10B981"
const CURRENT = "F59E0B"
const TODO = "374151"
const TEXT = "F9FAFB"
const MUTED = "9CA3AF"

// Slide 1: 전체 로드맵
const s1 = pres.addSlide()
s1.background = { color: BG }
s1.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.55, fill:{color:"111827"}, line:{color:"111827"} })
s1.addText("READ VOICE Pro — 개발 로드맵", { x:0.3, y:0.06, w:6, h:0.42, fontSize:16, bold:true, color:TEXT, fontFace:"Arial", margin:0 })
s1.addText(`${data.lastUpdated}  |  ${data.version}`, { x:6.5, y:0.06, w:3.2, h:0.42, fontSize:10, color:MUTED, fontFace:"Arial", align:"right", margin:0 })

const colors = { done:DONE, current:CURRENT, todo:TODO }
const statusLabels = { done:"완료", current:"진행 중", todo:"예정" }
const bw=1.7, bh=3.2, gap=0.175, startX=0.3, startY=0.75

data.phases.forEach((p, i) => {
  const x = startX + i*(bw+gap)
  const col = colors[p.status]
  const isCurrent = p.status==="current"

  s1.addShape(pres.shapes.RECTANGLE, { x, y:startY, w:bw, h:bh, fill:{color:isCurrent?"1E3A5F":"111827"}, line:{color:col, pt:isCurrent?2:1} })
  s1.addShape(pres.shapes.RECTANGLE, { x, y:startY, w:bw, h:0.18, fill:{color:col}, line:{color:col} })
  s1.addText(p.phase, { x:x+0.08, y:startY+0.22, w:bw-0.16, h:0.28, fontSize:11, bold:true, color:col, fontFace:"Arial", margin:0 })
  s1.addText(p.name, { x:x+0.08, y:startY+0.52, w:bw-0.16, h:0.32, fontSize:12, bold:true, color:TEXT, fontFace:"Arial", margin:0 })
  s1.addText(p.detail, { x:x+0.08, y:startY+0.88, w:bw-0.16, h:0.25, fontSize:9, color:MUTED, fontFace:"Arial", margin:0 })
  s1.addText(p.dates, { x:x+0.08, y:startY+1.16, w:bw-0.16, h:0.22, fontSize:9, color:MUTED, fontFace:"Arial", margin:0 })
  s1.addShape(pres.shapes.RECTANGLE, { x:x+0.08, y:startY+1.52, w:bw-0.16, h:0.12, fill:{color:"1F2937"}, line:{color:"1F2937"} })
  if(p.pct>0) s1.addShape(pres.shapes.RECTANGLE, { x:x+0.08, y:startY+1.52, w:(bw-0.16)*p.pct/100, h:0.12, fill:{color:col}, line:{color:col} })
  s1.addText(`${p.pct}%`, { x:x+0.08, y:startY+1.68, w:bw-0.16, h:0.2, fontSize:9, color:col, bold:true, fontFace:"Arial", margin:0 })
  s1.addShape(pres.shapes.ROUNDED_RECTANGLE, { x:x+0.08, y:startY+1.96, w:0.75, h:0.22, fill:{color:col}, line:{color:col}, rectRadius:0.05 })
  s1.addText(statusLabels[p.status], { x:x+0.08, y:startY+1.97, w:0.75, h:0.22, fontSize:8, bold:true, color:"FFFFFF", fontFace:"Arial", align:"center", margin:0 })

  if(isCurrent) s1.addText("▼ 현재", { x:x+bw/2-0.4, y:startY+3.15, w:0.8, h:0.22, fontSize:9, bold:true, color:CURRENT, fontFace:"Arial", align:"center", margin:0 })
})

s1.addShape(pres.shapes.RECTANGLE, { x:0, y:4.65, w:W, h:0.975, fill:{color:"111827"}, line:{color:"111827"} })
const stats = [
  { val:data.version, label:"현재 버전" },
  { val:`${data.totalProgress}%`, label:"전체 진행률" },
  { val:"6일", label:"개발 기간" },
  { val:"D+76", label:"완료까지 (예상)" },
  { val:data.estimatedCompletion.slice(5), label:"예상 완료일" }
]
stats.forEach((st,i) => {
  const x = 0.5+i*1.9
  s1.addText(st.val, { x, y:4.72, w:1.5, h:0.4, fontSize:20, bold:true, color:ACCENT, fontFace:"Arial", align:"center", margin:0 })
  s1.addText(st.label, { x, y:5.13, w:1.5, h:0.2, fontSize:8, color:MUTED, fontFace:"Arial", align:"center", margin:0 })
})

// Slide 2: 스프린트
const s2 = pres.addSlide()
s2.background = { color: BG }
s2.addShape(pres.shapes.RECTANGLE, { x:0, y:0, w:W, h:0.55, fill:{color:"111827"}, line:{color:"111827"} })
s2.addText("Phase 2 — 스프린트 현황", { x:0.3, y:0.06, w:7, h:0.42, fontSize:15, bold:true, color:TEXT, fontFace:"Arial", margin:0 })
s2.addText(data.lastUpdated, { x:8, y:0.1, w:1.7, h:0.35, fontSize:10, color:MUTED, fontFace:"Arial", align:"right", margin:0 })

data.sprints.forEach((sp,i) => {
  const col = sp.status==="done"?DONE:sp.status==="current"?CURRENT:TODO
  const x=0.2+i*2.43, y=0.7, w=2.28, h=4.5
  s2.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill:{color:sp.status==="current"?"1E3A5F":"111827"}, line:{color:col, pt:sp.status==="current"?2:1} })
  s2.addShape(pres.shapes.RECTANGLE, { x, y, w, h:0.18, fill:{color:col}, line:{color:col} })
  s2.addText(sp.sprint, { x:x+0.08, y:y+0.22, w:w-0.16, h:0.25, fontSize:11, bold:true, color:col, fontFace:"Arial", margin:0 })
  s2.addText(sp.dates, { x:x+0.08, y:y+0.5, w:w-0.16, h:0.2, fontSize:9, color:MUTED, fontFace:"Arial", margin:0 })
  s2.addShape(pres.shapes.LINE, { x:x+0.08, y:y+0.76, w:w-0.16, h:0, line:{color:"1F2937", pt:1} })
  sp.items.forEach((item,j) => {
    const iDone=sp.status==="done"
    const iCol=iDone?DONE:sp.status==="current"?TEXT:MUTED
    const prefix=iDone?"✓ ":sp.status==="current"?"→ ":"○ "
    s2.addText(prefix+item, { x:x+0.08, y:y+0.88+j*0.65, w:w-0.16, h:0.58, fontSize:9, color:iCol, fontFace:"Arial", margin:0, wrap:true })
  })
  if(sp.status==="current") s2.addText("◀ 지금 여기", { x:x+0.08, y:y+h-0.32, w:w-0.16, h:0.25, fontSize:9, bold:true, color:CURRENT, fontFace:"Arial", align:"center", margin:0 })
})

// 저장
const today = new Date().toISOString().slice(0,10).replace(/-/g,"")
const outPath = path.join(__dirname, `../docs/daily-reports/roadmap_${today}.pptx`)
pres.writeFile({ fileName: outPath })
  .then(() => console.log("✅ 로드맵 생성:", outPath))
  .catch(e => console.error("❌ 오류:", e))
