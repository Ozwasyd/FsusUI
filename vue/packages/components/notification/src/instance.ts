const notificationBaseOffsets = new Map<string, number>()

export const GAP_SIZE = 16

export const setNotificationBaseOffset = (id: string, offset: number) => {
  notificationBaseOffsets.set(id, offset)
}

export const getNotificationBaseOffset = (id: string, fallback: number) => {
  return notificationBaseOffsets.get(id) ?? fallback
}

export const deleteNotificationBaseOffset = (id: string) => {
  notificationBaseOffsets.delete(id)
}
