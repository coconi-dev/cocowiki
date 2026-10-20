export const pageStatuses = {
  draft: { label: '草稿', message: '此词条仍在编写，内容可能尚未核实。' },
  incomplete: { label: '待补充', message: '此词条尚有待补充的信息，欢迎协助完善。' },
  outdated: { label: '已过时', message: '此词条可能已过时，请结合维护说明阅读。' },
  stable: { label: '已完善', message: '此词条已整理，可继续反馈需要修订的内容。' }
} as const
export type PageStatus = keyof typeof pageStatuses
export function statusLabel(value: unknown) {
  return typeof value === 'string' && Object.hasOwn(pageStatuses, value) ? pageStatuses[value as PageStatus].label : ''
}
