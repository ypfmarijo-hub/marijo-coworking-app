// Menú en Excel: armar la planilla (agrupada por categoría, como en la app) y leerla de vuelta.
// Se usa desde el panel del staff (components/staff/menu-excel.tsx). No depende del navegador, así se puede probar.

export interface MenuProd { id: string; name: string; price: number; category?: string | null }
export interface PriceChange { id: string; name: string; from: number; to: number }
export interface NewProd { name: string; category: string; price: number }
export interface MenuPreview { changes: PriceChange[]; news: NewProd[]; unknown: string[]; same: number }

const SIN_CATEGORIA = 'Sin categoría'
const AZUL = 'FF0057A5'
const CELESTE = 'FFDCEBFA'

export const normText = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const byEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true })

export function toNumber(v: any): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'result' in v) return toNumber(v.result)
  // "$ 12.100", "12100,50", "12.100"
  if (/[a-z]/i.test(String(v))) return null // "18 productos" no es un precio
  const s = String(v).replace(/[^\d,.-]/g, '')
  if (!s) return null
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, ''))
  return Number.isFinite(n) ? n : null
}

export const cellText = (v: any) =>
  (v == null ? '' : typeof v === 'object' ? String(v.text ?? v.result ?? v.richText?.map((r: any) => r.text).join('') ?? '') : String(v)).trim()

/** Categorías en el mismo orden que las ve el cliente (alfabético), cada una con sus productos en orden alfabético. */
export function groupMenu(products: MenuProd[]): { category: string; items: MenuProd[] }[] {
  const groups = new Map<string, MenuProd[]>()
  for (const p of products) {
    const c = (p.category || '').trim() || SIN_CATEGORIA
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(p)
  }
  return [...groups.keys()]
    .sort((a, b) => (a === SIN_CATEGORIA ? 1 : b === SIN_CATEGORIA ? -1 : byEs(a, b)))
    .map((category) => ({ category, items: groups.get(category)!.sort((a, b) => byEs(a.name, b.name)) }))
}

const bandText = (category: string, n: number) => `${category.toUpperCase()}  ·  ${n} ${n === 1 ? 'producto' : 'productos'}`

/** Llena la hoja: fila de títulos y, por cada categoría, una franja celeste con su nombre y debajo sus productos. */
export function fillMenuSheet(ws: any, products: MenuProd[]) {
  ws.columns = [
    { header: 'ID (no tocar)', key: 'id', width: 14 },
    { header: 'Categoría', key: 'category', width: 24 },
    { header: 'Producto', key: 'name', width: 50 },
    { header: 'Precio', key: 'price', width: 14 },
  ]
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }

  for (const g of groupMenu(products)) {
    // sin combinar celdas (así se lee bien de vuelta): el texto va en la primera y se ve de corrido sobre la franja
    const band = ws.addRow([bandText(g.category, g.items.length)])
    band.height = 22
    band.font = { bold: true, size: 12, color: { argb: AZUL } }
    band.alignment = { vertical: 'middle' }
    for (let c = 1; c <= 4; c++) band.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
    for (const p of g.items) {
      const r = ws.addRow({ id: p.id, category: (p.category || '').trim(), name: p.name, price: Number(p.price) })
      r.getCell(1).font = { color: { argb: 'FF94A3B8' } }
      r.getCell(4).numFmt = '"$" #,##0'
    }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } // si lo imprimen, entra a lo ancho
}

/**
 * Lee la hoja (la que bajó el botón, aunque le hayan movido columnas o filas) y compara con el menú actual.
 * Las franjas de categoría se saltean; un producto nuevo escrito debajo de una franja queda en esa categoría.
 */
export function readMenuSheet(ws: any, products: MenuProd[]): MenuPreview | { error: string } {
  const head: Record<string, number> = {}
  ws.getRow(1).eachCell((c: any, col: number) => {
    const t = normText(cellText(c.value))
    if (t.startsWith('id')) head.id = col
    else if (t.startsWith('producto') || t === 'nombre') head.name = col
    else if (t.startsWith('precio')) head.price = col
    else if (t.startsWith('categor')) head.category = col
  })
  if (!head.price || (!head.id && !head.name)) return { error: 'No encuentro las columnas "Producto" y "Precio" en la primera fila. Usá el Excel que baja este botón.' }

  const byId = new Map(products.map((p) => [p.id, p]))
  const byName = new Map(products.map((p) => [normText(p.name), p]))
  const knownCats = new Map(products.filter((p) => p.category).map((p) => [normText(p.category!), p.category!.trim()]))
  const changes: PriceChange[] = [], news: NewProd[] = [], unknown: string[] = []
  let same = 0
  let currentCat = ''

  ws.eachRow((row: any, i: number) => {
    if (i === 1) return
    const id = head.id ? cellText(row.getCell(head.id).value) : ''
    const name = head.name ? cellText(row.getCell(head.name).value) : ''
    const rawPrice = row.getCell(head.price).value
    const price = toNumber(rawPrice)
    const known = id ? byId.get(id) : undefined

    // franja de categoría: sin producto, sin nombre y sin precio → recordar la categoría y seguir
    if (!known && !name && cellText(rawPrice) === '') {
      let text = ''
      row.eachCell((c: any) => { if (!text) text = cellText(c.value) })
      if (text) {
        const catName = text.split('·')[0].trim()
        currentCat = knownCats.get(normText(catName)) || (catName === catName.toUpperCase() ? catName.charAt(0) + catName.slice(1).toLowerCase() : catName)
        if (normText(currentCat) === normText(SIN_CATEGORIA)) currentCat = ''
      }
      return
    }
    if (!name && !id) return
    if (price == null || price < 0) { unknown.push(`${name || id}: el precio no es un número`); return }
    const p = known || (name ? byName.get(normText(name)) : undefined)
    if (!p) {
      if (name && price > 0) news.push({ name, category: (head.category ? cellText(row.getCell(head.category).value) : '') || currentCat, price: Math.round(price) })
      return
    }
    if (Math.round(price) === Math.round(Number(p.price))) same++
    else changes.push({ id: p.id, name: p.name, from: Number(p.price), to: Math.round(price) })
  })
  return { changes, news, unknown, same }
}
