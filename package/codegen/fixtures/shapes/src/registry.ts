export const validators = {
  slugUnique: (value: unknown) => typeof value === 'string' || 'not a string',
}

export const filters = {
  stripEmoji: (value: unknown) => typeof value === 'string',
}

export const initialisers = {
  genId: () => 'id',
  now: () => new Date(),
}
