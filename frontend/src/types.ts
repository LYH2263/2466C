export interface AssetRecord {
  id: string
  date: string
  cash: number
  longTermInvest: number
  stableBond: number
  total: number
  note: string
  createdAt: string
}

export interface AssetFormData {
  date: string
  cash: number | null
  longTermInvest: number | null
  stableBond: number | null
  note: string
}
