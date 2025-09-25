import express from 'express';

const router = express.Router();

// 채팅 메시지 처리 엔드포인트
router.post('/message', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: '메시지가 제공되지 않았습니다.' 
      });
    }

    // 기본 채팅 응답 로직 (향후 AI 통합 가능)
    const response = {
      success: true,
      message: '채팅 메시지를 받았습니다.',
      reply: `받은 메시지: "${message}"에 대한 응답입니다.`,
      timestamp: new Date().toISOString(),
      context: context || null
    };

    res.json(response);
  } catch (error) {
    console.error('채팅 처리 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '채팅 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 채팅 히스토리 조회 엔드포인트
router.get('/history', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // 기본 히스토리 응답 (향후 데이터베이스 연동 가능)
    const history = {
      success: true,
      messages: [],
      limit: parseInt(limit),
      timestamp: new Date().toISOString()
    };

    res.json(history);
  } catch (error) {
    console.error('채팅 히스토리 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '채팅 히스토리 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 상태 확인 엔드포인트
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: '채팅 서비스가 정상적으로 작동 중입니다.',
    timestamp: new Date().toISOString()
  });
});

export default router;