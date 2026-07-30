import { test, expect } from '@playwright/test'
import { buildPrefillSuggestion, type HistoricalOrder } from '../../lib/orders/prefill'

const box = { componentId: 'c-box', name: 'Small box', unit: 'unit', costPerUnit: 0.8, quantity: 1 }
const tape = { componentId: 'c-tape', name: 'Tape', unit: 'meter', costPerUnit: 0.1, quantity: 2 }
const mailer = { componentId: 'c-mailer', name: 'Mailer', unit: 'unit', costPerUnit: 0.5, quantity: 1 }

const history: HistoricalOrder[] = [
  { productIds: ['p1', 'p2'], components: [mailer] },        // most recent
  { productIds: ['p1'], components: [box, tape] },
  { productIds: ['p3'], components: [] },                     // packed nothing
]

test('matches the most recent order with the same product set', () => {
  expect(buildPrefillSuggestion(['p1'], history)).toEqual([box, tape])
})

test('product-set match ignores duplicates and order', () => {
  expect(buildPrefillSuggestion(['p2', 'p1', 'p2'], history)).toEqual([mailer])
})

test('falls back to the most recent packed order when no set matches', () => {
  expect(buildPrefillSuggestion(['p99'], history)).toEqual([mailer])
})

test('ignores history orders with no components', () => {
  expect(buildPrefillSuggestion(['p3'], history)).toEqual([mailer])
})

test('null product ids (unlinked items) do not join the set key', () => {
  expect(buildPrefillSuggestion(['p1', null], history)).toEqual([box, tape])
})

test('empty history yields empty suggestion', () => {
  expect(buildPrefillSuggestion(['p1'], [])).toEqual([])
})
