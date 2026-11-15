import { useEffect, useMemo, useState } from 'react'
import Sheet from '../components/Sheet.jsx'
import { PrimaryButton } from '../components/brand.jsx'

/**
 * "Saw a different price?" Kraft sheet: item, price, in stock, Send.
 * items_breakdown has no product_id, so items map to GET /api/products by name.
 */
export default function ReportPriceSheet({ open, store, products, onClose, onSend }) {
  const options = useMemo(() => {
    if (!store) return []
    const byName = new Map(products.map((p) => [p.name, p.product_id]))
    return store.items_breakdown
      .map((i) => ({ product_id: byName.get(i.name), name: i.name, price: i.price }))
      .filter((o) => o.product_id)
  }, [store, products])

  const [productId, setProductId] = useState('')
  const [price, setPrice] = useState('')
  const [inStock, setInStock] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const first = options[0]
    setProductId(first?.product_id ?? '')
    setPrice(first ? first.price.toFixed(2) : '')
    setInStock(true)
    setError('')
    setSending(false)
  }, [open, options])

  const priceNum = Number(price)
  const valid = productId && (!inStock || priceNum > 0)

  async function send(e) {
    e.preventDefault()
    if (!valid || sending) return
    setSending(true)
    setError('')
    try {
      // The contract needs price > 0 even when out of stock; keep the shown price then.
      const fallback = options.find((o) => o.product_id === productId)?.price ?? 0.01
      await onSend({ store_id: store.store_id, product_id: productId, price: priceNum > 0 ? priceNum : fallback, in_stock: inStock })
    } catch {
      setError("That didn't go through. Try again in a moment.")
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Saw a different price?">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-[26px] leading-tight text-ink">Saw a different price?</h2>
          {store && <p className="mt-1 text-[16px] text-ink">At {store.name}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] text-ink">
          ×
        </button>
      </div>

      <form onSubmit={send} className="mt-4 space-y-4">
        <label className="block">
          <span className="label text-ink">Item</span>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              const o = options.find((x) => x.product_id === e.target.value)
              if (o) setPrice(o.price.toFixed(2))
            }}
            className="mt-1.5 min-h-[52px] w-full appearance-none rounded-2xl border-[1.5px] border-ink bg-receipt px-4 text-[17px] text-ink"
          >
            {options.map((o) => (
              <option key={o.product_id} value={o.product_id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label text-ink">Price</span>
          <div className="mt-1.5 flex min-h-[52px] items-center rounded-2xl border-[1.5px] border-ink bg-receipt px-4">
            <span className="font-mono text-[20px] font-bold text-ink">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={price}
              disabled={!inStock}
              onChange={(e) => setPrice(e.target.value)}
              className="ml-1 w-full bg-transparent font-mono text-[20px] font-bold text-ink focus:outline-none disabled:opacity-50"
            />
          </div>
        </label>

        <fieldset>
          <legend className="label text-ink">In stock</legend>
          <div role="radiogroup" className="mt-1.5 flex rounded-2xl border-[1.5px] border-ink bg-receipt p-1">
            {[
              [true, 'Yes'],
              [false, 'No'],
            ].map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={inStock === v}
                onClick={() => setInStock(v)}
                className={`min-h-[44px] flex-1 rounded-xl text-[16px] font-semibold ${inStock === v ? 'bg-ink text-eggshell' : 'text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-[15px] text-ink">{error}</p>}

        <PrimaryButton type="submit" disabled={!valid || sending}>
          {sending ? 'Sending...' : 'Send'}
        </PrimaryButton>
      </form>
    </Sheet>
  )
}
