export const CAPSULE_CATEGORY_FILTERS = [
  '전체',
  '☕ 숨은 카페',
  '📸 포토스팟',
  '🚶 산책 포인트',
  '🛍 로컬 스토어',
  '🌙 야경 포인트',
  '🧩 기타',
];

export const CAPSULE_CATEGORY_OPTIONS = CAPSULE_CATEGORY_FILTERS.filter((category) => category !== '전체');

const LEGACY_CATEGORY_MAP = {
  '☕️ 로컬 카페': '☕ 숨은 카페',
  '☕ 로컬 카페': '☕ 숨은 카페',
  '🍽️ 동네 숨은 맛집': '🛍 로컬 스토어',
  '🍽 동네 숨은 맛집': '🛍 로컬 스토어',
  '🌄 나만 아는 경관': '📸 포토스팟',
  '🌃 비밀 야경': '🌙 야경 포인트',
  '🎧 인디 음악/바': '🛍 로컬 스토어',
  '🧩 기타 아지트': '🧩 기타',
};

// 기존 DB에 저장된 예전 카테고리 문자열을 새 MVP 카테고리로 안전하게 표시합니다.
export function normalizeCapsuleCategory(category) {
  const trimmed = (category || '').trim();
  return LEGACY_CATEGORY_MAP[trimmed] || trimmed || '🧩 기타';
}

// 쉼표로 저장된 카테고리 문자열을 필터/표시에 사용할 배열로 변환합니다.
export function getCapsuleCategories(categoryValue) {
  return (categoryValue || '')
    .split(',')
    .map(normalizeCapsuleCategory)
    .filter(Boolean);
}

export function getPrimaryCapsuleCategory(categoryValue) {
  return getCapsuleCategories(categoryValue)[0] || '🧩 기타';
}

export function getCapsuleCategoryIcon(categoryValue) {
  return getPrimaryCapsuleCategory(categoryValue).split(' ')[0] || '📍';
}
