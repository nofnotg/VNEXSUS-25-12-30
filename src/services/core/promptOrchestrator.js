// Prompt Orchestrator — minimal core
import OpenAI from "openai";

export async function orchestrateReport({ model = "gpt-4o-mini", systemPrompt, userPrompt }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await client.responses.create({
    model,
    temperature: 0.2,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });
  const full = resp.output_text;

  const finalSummaryPrompt = `\n너는 보험 손해사정 보고서 전문 AI이다.\n아래 보고서 전문(full report)을 기반으로 지정된 결재용 요약본 포맷만 출력하라.\n\n--- FULL REPORT START ---\n${full}\n--- FULL REPORT END ---\n\n📑 손해사정 보고서 (결재용 요약본)\n- 내원일시:\n- 내원경위:\n- 진단병명:\n- 검사결과:\n- 수술 후 조직검사 결과 (암의 경우만):\n- 치료내용:\n- 통원기간:\n- 입원기간:\n- 과거병력:\n- 의사소견:\n`;

  const sum = await client.responses.create({
    model,
    temperature: 0.1,
    input: [
      { role: "system", content: "You are a loss-adjusting report expert. Output in Korean." },
      { role: "user", content: finalSummaryPrompt }
    ]
  });

  return { fullReportText: full, summaryText: sum.output_text };
}