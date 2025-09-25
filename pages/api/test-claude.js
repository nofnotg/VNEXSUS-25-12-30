// API 엔드포인트: Claude API를 호출하는 서버 측 로직
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, model, prompt, maxTokens } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const baseUrl = 'https://api.anthropic.com/v1/messages';
    
    const response = await axios.post(
      baseUrl,
      {
        model: model || 'claude-3-opus-20240229',
        max_tokens: maxTokens ? parseInt(maxTokens) : 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // CSV 형식으로 데이터 변환 (다운로드용)
    const csvData = `"prompt","response"\n"${prompt.replace(/"/g, '""')}","${response.data.content[0].text.replace(/"/g, '""')}"`;
    
    // 응답 데이터 반환
    return res.status(200).json({
      response: response.data.content[0].text,
      csvData: csvData
    });
  } catch (error) {
    console.error('Error calling Claude API:', error.response?.data || error.message);
    return res.status(500).json({
      error: error.response?.data?.error?.message || 'Failed to call Claude API'
    });
  }
} 