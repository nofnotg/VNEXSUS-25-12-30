export function normalizeDate(str){
  // 20230329 → 2023-03-29
  if(/^(\d{4})(\d{2})(\d{2})$/.test(str)) {
    const matches = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    return `${matches[1]}-${matches[2]}-${matches[3]}`;
  }
  return str;
}

// 가입일 입력 onchange
export function setupDateInputs() {
  document.querySelectorAll('.insurance-date').forEach(dateInput => {
    if (!dateInput.dataset.hasHandler) {
      dateInput.dataset.hasHandler = 'true';
      dateInput.addEventListener('change', e => {
        e.target.value = normalizeDate(e.target.value.trim());
      });
    }
  });
} 