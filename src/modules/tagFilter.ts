import rules from '../config/tagRules.json';

export function isExcluded(ev) {
  const txt = ev.rawText;
  return Object.values(rules.exclude).some(list => list.some(k => txt.includes(k)));
}

export function isImportant(ev) {
  const txt = ev.rawText;
  return Object.values(rules.important).some(list => list.some(k => txt.includes(k)));
} 