import type { tags as t } from '@datacapy/schema'

/** @schema l10n construct=L10n */
export interface L10nData {
  [language: string]: string & t.Trim
}

/** @schema thing */
export interface ThingData {
  title: L10nData
  attributes: Record<string, string & t.StripHtml>
  counts: { [key: string]: number }
  meta: Record<string, unknown>
  raw?: object
  optionalMap?: Record<string, string>
  nullableMap: Record<string, boolean> | null
}
