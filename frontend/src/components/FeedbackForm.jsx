import React, { useState } from 'react';
import './FeedbackForm.css';

/**
 * 사용자 피드백 입력 폼 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {string} props.documentId - 문서 ID
 * @param {string} props.reportText - 보고서 텍스트
 * @param {Function} props.onSubmit - 제출 핸들러 함수
 * @param {Function} props.onClose - 닫기 핸들러 함수
 * @returns {JSX.Element} 피드백 폼 컴포넌트
 */
const FeedbackForm = ({ documentId, reportText, onSubmit, onClose }) => {
  // 상태 관리
  const [score, setScore] = useState(7); // 기본값 7로 설정
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  
  // 점수에 따라 피드백 질문 텍스트 변경
  const getFeedbackPrompt = () => {
    if (score === 10) {
      return '추가되었으면 하는 기능이 있나요?';
    } else {
      return '조금 아쉬운 부분은 어떤가요?';
    }
  };
  
  // 만족도 점수 변경 핸들러
  const handleScoreChange = (e) => {
    setScore(parseInt(e.target.value, 10));
  };
  
  // 코멘트 변경 핸들러
  const handleCommentChange = (e) => {
    setComment(e.target.value);
  };
  
  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // 유효성 검사
    if (comment.trim() === '') {
      setError('의견을 작성해주세요.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // 피드백 데이터 구성
      const feedbackData = {
        score,
        userComment: comment,
        documentId,
        reportText
      };
      
      // 피드백 제출
      if (onSubmit) {
        await onSubmit(feedbackData);
      }
      
      // 제출 성공 상태로 변경
      setSubmitted(true);
      
    } catch (err) {
      setError(err.message || '피드백 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 제출 완료 화면
  if (submitted) {
    return (
      <div className="feedback-form-container success">
        <div className="feedback-success">
          <h3>피드백을 주셔서 감사합니다</h3>
          <p>말씀해주신 의견을 반영하여 더 발전된 시스템을 제공하겠습니다. :)</p>
          <button 
            className="feedback-close-btn"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    );
  }
  
  // 피드백 입력 폼
  return (
    <div className="feedback-form-container">
      <div className="feedback-form-header">
        <h3>타임라인 품질 평가</h3>
        <button 
          className="feedback-close-btn"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="feedback-score-container">
          <label htmlFor="satisfaction-score">만족도 점수</label>
          <div className="score-slider-container">
            <input
              type="range"
              id="satisfaction-score"
              min="1"
              max="10"
              value={score}
              onChange={handleScoreChange}
              className="score-slider"
            />
            <div className="score-display">{score}/10</div>
          </div>
          <div className="score-labels">
            <span>불만족</span>
            <span>만족</span>
          </div>
        </div>
        
        <div className="feedback-comment-container">
          <label htmlFor="feedback-comment">{getFeedbackPrompt()}</label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={handleCommentChange}
            placeholder="의견을 자유롭게 작성해주세요..."
            rows="4"
            required
          />
        </div>
        
        {error && <div className="feedback-error">{error}</div>}
        
        <div className="feedback-actions">
          <button 
            type="button" 
            className="feedback-cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </button>
          <button 
            type="submit" 
            className="feedback-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm; 