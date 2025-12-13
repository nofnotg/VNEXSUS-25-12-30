// Date input utilities for VNEXSUS

/**
 * Normalize date string: 20230329 → 2023-03-29
 * Also handles already formatted dates YYYY-MM-DD
 */
export function normalizeDate(str) {
  if (!str) return '';

  // Remove any non-digit characters first
  const digitsOnly = str.replace(/\D/g, '');

  // If exactly 8 digits: YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(digitsOnly)) {
    const year = digitsOnly.substring(0, 4);
    const month = digitsOnly.substring(4, 6);
    const day = digitsOnly.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return str;
}

/**
 * Format date as user types (real-time)
 * Shows: 2025-01-01 format
 */
export function formatDateAsTyping(value) {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');

  // Format progressively
  if (digits.length <= 4) {
    return digits; // YYYY
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`; // YYYY-MM
  } else {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`; // YYYY-MM-DD
  }
}

/**
 * Setup date input handlers for insurance date fields
 */
export function setupDateInputs() {
  document.querySelectorAll('.insurance-date').forEach(dateInput => {
    if (!dateInput.dataset.hasHandler) {
      dateInput.dataset.hasHandler = 'true';

      // Format on input (real-time)
      dateInput.addEventListener('input', e => {
        const cursorPos = e.target.selectionStart;
        const oldLength = e.target.value.length;

        e.target.value = formatDateAsTyping(e.target.value);

        // Adjust cursor position after formatting
        const newLength = e.target.value.length;
        const newPos = cursorPos + (newLength - oldLength);
        e.target.setSelectionRange(newPos, newPos);
      });

      // Normalize on blur
      dateInput.addEventListener('blur', e => {
        e.target.value = normalizeDate(e.target.value.trim());
      });

      // Handle paste
      dateInput.addEventListener('paste', e => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        e.target.value = normalizeDate(pastedText.trim());
      });
    }
  });
}

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupDateInputs);

  // Also observe for dynamically added insurance records
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        setupDateInputs();
      }
    });
  });

  const insuranceRecords = document.getElementById('insuranceRecords');
  if (insuranceRecords) {
    observer.observe(insuranceRecords, { childList: true, subtree: true });
  }
}