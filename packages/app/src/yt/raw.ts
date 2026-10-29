/** A node of the parser's raw response: its shape varies per type, so it is read defensively. */
export type Raw = Record<string, any>

export const text = (t: any): string | undefined => (typeof t === 'string' ? t : t?.text)
