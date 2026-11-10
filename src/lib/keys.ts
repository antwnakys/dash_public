/** The command palette's shortcut as this computer writes it: ⌘K on Apple devices, Ctrl K elsewhere. */
export const paletteKey = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'
