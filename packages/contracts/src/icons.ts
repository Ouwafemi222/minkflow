/** Allowlisted Lucide (ISC) icon ids. AI output may only reference these. */
export const ICON_IDS = [
  'lightbulb', 'rocket', 'brain', 'book-open', 'graduation-cap', 'dollar-sign', 'piggy-bank', 'trending-up',
  'trending-down', 'globe', 'clock', 'calendar', 'users', 'user', 'heart', 'shield', 'lock', 'zap', 'target',
  'flag', 'star', 'check', 'x', 'search', 'cpu', 'database', 'cloud', 'smartphone', 'laptop', 'leaf', 'sun',
  'moon', 'droplet', 'flame', 'map-pin', 'message-circle', 'mic', 'headphones', 'play', 'settings', 'wrench',
  'briefcase', 'building', 'car', 'plane', 'coffee', 'gift', 'trophy', 'award', 'key', 'package',
  'shopping-cart', 'truck', 'wallet', 'percent', 'calculator', 'atom', 'microscope', 'sparkles', 'megaphone',
  'scale', 'hourglass', 'house', 'bell', 'camera', 'code', 'link', 'mail', 'chart-pie', 'activity',
] as const;

export type IconId = (typeof ICON_IDS)[number];
