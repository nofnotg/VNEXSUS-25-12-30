import React, { useState, useEffect } from 'react';

const InsurerSelect = ({ value, onChange, label = '보험사', id = 'insurer-select' }) => {
  const [insurerOptions, setInsurerOptions] = useState({});
  const [selected, setSelected] = useState(value || '');

  useEffect(() => {
    const loadInsurerOptions = async () => {
      try {
        const response = await fetch('/config/insurers.json');
        const data = await response.json();
        setInsurerOptions(data);
      } catch (error) {
        console.error('보험사 목록을 로드하는 중 오류가 발생했습니다:', error);
        // 기본 옵션
        setInsurerOptions({
          '손해보험': ['삼성화재', 'DB손해보험', '현대해상'],
          '생명보험': ['삼성생명', '한화생명', '교보생명']
        });
      }
    };

    loadInsurerOptions();
  }, []);

  useEffect(() => {
    setSelected(value || '');
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setSelected(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="form-group mb-3">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="form-select insurance-company"
        value={selected}
        onChange={handleChange}
        required
      >
        <option value="" disabled>보험사 선택</option>
        {Object.entries(insurerOptions).map(([category, companies]) => (
          <optgroup key={category} label={category}>
            {companies.map(company => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export default InsurerSelect; 