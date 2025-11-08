/**
 * Simple test script to call /api/generate-report and print response
 */

const url = 'http://localhost:3030/api/generate-report';

async function main() {
  try {
    const payload = {
      text: '테스트 보고서 생성용 텍스트입니다. 피보험자의 병력과 진단 기록이 포함되어 있습니다.',
      patientInfo: { insuranceJoinDate: '2023-01-01' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
  } catch (err) {
    console.error('Error:', err?.message || String(err));
  }
}

main();