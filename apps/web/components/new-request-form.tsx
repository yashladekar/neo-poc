"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { createRequestAction } from "@/app/actions/requests"

const CATEGORIES = ["TRANSPORT", "LODGING", "MEALS", "OTHER"] as const

interface ItemDraft {
  category: string
  description: string
  amount: string
  receiptRequired: boolean
}

const EMPTY_ITEM: ItemDraft = { category: "TRANSPORT", description: "", amount: "", receiptRequired: false }

export function NewRequestForm() {
  const [title, setTitle] = useState("")
  const [purpose, setPurpose] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [hasReceipts, setHasReceipts] = useState(false)
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }])

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const payload = JSON.stringify({
    title,
    purpose: purpose || undefined,
    destination,
    startDate,
    endDate,
    currency,
    hasReceipts,
    items: items.map((item) => ({
      category: item.category,
      description: item.description,
      amount: Number(item.amount) || 0,
      receiptRequired: item.receiptRequired,
    })),
  })

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <form action={createRequestAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
          <CardDescription>The Appian “Add Business Trip” start form.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {["USD", "EUR", "GBP"].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={hasReceipts}
              onChange={(e) => setHasReceipts(e.target.checked)}
            />
            Original receipts must be submitted (adds a signing step)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense items</CardTitle>
          <CardDescription>Total: {total.toFixed(2)} {currency}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[8rem_1fr_7rem_auto]">
              <select
                value={item.category}
                onChange={(e) => updateItem(index, { category: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                required
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => updateItem(index, { amount: e.target.value })}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                disabled={items.length === 1}
                aria-label="Remove item"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}>
            <Plus /> Add item
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit">Submit request</Button>
      </div>
    </form>
  )
}
