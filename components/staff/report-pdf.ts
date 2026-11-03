// Informe en PDF con los colores de YPF (azul). Se arma en el navegador del staff, no pasa por ningún servidor.
// Las librerías se cargan recién cuando se toca "Descargar PDF", así el panel no se hace más pesado.

const AZUL = [0, 87, 165] as const // #0057a5
const AZUL_OSCURO = [0, 48, 135] as const // #003087
const CELESTE = [230, 240, 250] as const // #e6f0fa
const GRIS = [100, 116, 139] as const

type Fmt = {
  price: (n: number) => string
  hours: (n: number) => string
  workspace: (w: string) => string
}

// La letra estándar del PDF no tiene algunos símbolos: se reemplazan por equivalentes
const clean = (v: unknown) => String(v ?? '').replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[^\x00-\xFF]/g, '')

export async function downloadReportPdf(summary: any, fmt: Fmt) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14 // margen

  // ---------- encabezado
  doc.setFillColor(...AZUL)
  doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...AZUL_OSCURO)
  doc.rect(0, 34, W, 2.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text('Informe Fullwork', M, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text('YPF MARIJO · Coworking', M, 23)
  const rango = summary.range.from === summary.range.to
    ? `Día ${dmy(summary.range.from)}`
    : `Del ${dmy(summary.range.from)} al ${dmy(summary.range.to)}`
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text(rango, W - M, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text(`Generado el ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`, W - M, 23, { align: 'right' })

  // ---------- recuadros con los números principales
  let y = 44
  const kpis: [string, string][] = [
    ['Reservas', String(summary.reservations.total)],
    ['Horas reservadas', fmt.hours(summary.reservations.totalHours)],
    ['Facturado espacios', fmt.price(summary.reservations.revenue)],
    ['Facturado Market', fmt.price(summary.market.revenue)],
  ]
  const gap = 4
  const bw = (W - M * 2 - gap * 3) / 4
  kpis.forEach(([label, value], i) => {
    const x = M + i * (bw + gap)
    doc.setFillColor(...CELESTE); doc.roundedRect(x, y, bw, 20, 2.5, 2.5, 'F')
    doc.setTextColor(...GRIS); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
    doc.text(label.toUpperCase(), x + 4, y + 7)
    doc.setTextColor(...AZUL); doc.setFontSize(13)
    doc.text(clean(value), x + 4, y + 15.5)
  })
  y += 26

  // total general (y con Plan FULL)
  doc.setFillColor(...AZUL); doc.roundedRect(M, y, W - M * 2, 13, 2.5, 2.5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('TOTAL GENERAL (espacio + Market)', M + 5, y + 8.5)
  doc.setFontSize(14); doc.text(clean(fmt.price(summary.totalRevenue)), W - M - 5, y + 8.8, { align: 'right' })
  y += 15
  if (summary.planFullTotal != null) {
    doc.setFillColor(...CELESTE); doc.roundedRect(M, y, W - M * 2, 11, 2.5, 2.5, 'F')
    doc.setTextColor(...AZUL_OSCURO); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('Con Plan FULL (el consumo cubre el espacio): lo que corresponde cobrar', M + 5, y + 7.2)
    doc.text(clean(fmt.price(summary.planFullTotal)), W - M - 5, y + 7.2, { align: 'right' })
    y += 13
  }

  const table = (title: string, head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) => {
    y += 5
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 18 }
    doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(title, M, y)
    autoTable(doc, {
      startY: y + 2,
      head: [head.map(clean)],
      body: body.map((r) => r.map(clean)),
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: [215, 225, 235], lineWidth: 0.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: AZUL as unknown as [number, number, number], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 249, 252] },
      ...opts,
    })
    y = (doc as any).lastAutoTable.finalY + 3
  }

  // ---------- resumen para decidir
  const ins = summary.insights
  if (ins) {
    y += 6
    doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text('Resumen para decidir', M, y)
    y += 2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59)
    for (const t of ins.tips as string[]) {
      const lines = doc.splitTextToSize(clean(t), W - M * 2 - 6)
      if (y + lines.length * 4.6 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 18 }
      y += 4.8
      doc.setFillColor(...AZUL); doc.circle(M + 1.2, y - 1.2, 0.8, 'F')
      doc.text(lines, M + 4, y)
      y += (lines.length - 1) * 4.6
    }
    y += 2
    const money = new Set(['espacio', 'market', 'planFull', 'avgConsumo'])
    const v = (k: string, n: number) => (money.has(k) ? fmt.price(n) : n.toLocaleString('es-AR'))
    table(`Contra el período anterior (${dmy(ins.comparison.previousRange.from)} al ${dmy(ins.comparison.previousRange.to)})`, ['', 'Antes', 'Ahora', 'Cambio'],
      ins.comparison.rows.map((x: any) => [x.label, v(x.key, x.previous), v(x.key, x.current), x.change == null ? '-' : `${x.change > 0 ? '+' : ''}${x.change.toLocaleString('es-AR')}%`]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } } })
    table('Ocupación por espacio', ['Espacio', 'Horas reservadas', 'Ocupación'],
      ins.occupancy.map((o: any) => [o.label, `${o.hours.toLocaleString('es-AR')} h`, `${o.percent.toLocaleString('es-AR')}%`]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' } } })
    doc.setTextColor(...GRIS); doc.setFontSize(7.5); doc.text(clean(ins.note), M, y + 1); y += 3
    table('Escritorios más pedidos', ['Escritorio', 'Reservas', 'Horas'],
      ins.desks.map((d: any) => [`N.° ${d.desk}`, d.reservations, `${d.hours.toLocaleString('es-AR')} h`]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
    table('Gente por hora (promedio)', ['Franja', 'Personas en promedio'],
      ins.byHour.map((h: any) => [`${h.hour} a ${h.hour + 1} h`, h.people.toLocaleString('es-AR')]),
      { columnStyles: { 1: { halign: 'right' } } })
    table('Horas por día de la semana', ['Día', 'Reservas', 'Horas'],
      [1, 2, 3, 4, 5, 6, 0].map((i) => ins.byWeekday[i]).map((d: any) => [d.day, d.reservations, `${d.hours.toLocaleString('es-AR')} h`]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
    if (ins.topProducts.length) table('Lo más consumido', ['Producto', 'Unidades', 'Total'],
      ins.topProducts.map((p: any) => [p.name, p.quantity, fmt.price(p.revenue)]), { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
    table('Clientes y consumo', ['', ''], [
      ['Clientes distintos', ins.clients.total], ['Nuevos', ins.clients.new], ['Volvieron', ins.clients.returning],
      ['Visitas por cliente', ins.clients.visitsPerClient.toLocaleString('es-AR')],
      ['Visitas que pidieron algo del Market', `${ins.consumption.percentWithConsumption.toLocaleString('es-AR')}%`],
      ['Visitas que consumieron más que el espacio', `${ins.consumption.percentOverSpace.toLocaleString('es-AR')}%`],
      ['Saldo a favor que quedó sin usar', fmt.price(ins.consumption.unusedCredit)],
      ...ins.combos.map((c: any) => [`Combo ${c.name}`, c.count]),
      ...ins.benefitsUsed.map((b: any) => [`Beneficio: ${b.description}`, b.count]),
    ], { columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }, showHead: 'never' })
  }

  const r = summary.reservations
  table('Reservas', ['', 'Cantidad', 'Horas'], [
    ['Hechas por los clientes desde la app', r.bySource.app.count, fmt.hours(r.bySource.app.hours)],
    ['Cargadas por el staff', r.bySource.staff.count, fmt.hours(r.bySource.staff.hours)],
    ['Total (sin canceladas)', r.bySource.app.count + r.bySource.staff.count, fmt.hours(r.totalHours)],
  ], { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text(clean(`${r.confirmed} confirmadas · ${r.completed} finalizadas · ${r.cancelled} canceladas`), M, y + 1)
  y += 3

  const m = summary.market
  table('Market', ['', 'Pedidos', 'Facturado'], [
    ['Pedidos desde la app', m.bySource.app.count, fmt.price(m.bySource.app.revenue)],
    ['Cargados por el staff', m.bySource.staff.count, fmt.price(m.bySource.staff.revenue)],
    ['Total', m.orderCount, fmt.price(m.revenue)],
  ], { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })

  if (m.products.length > 0) {
    table('Productos consumidos', ['Producto', 'Cantidad', 'Total'],
      m.products.map((p: any) => [p.name, p.quantity, fmt.price(p.revenue)]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  }

  if (summary.byAge && summary.byAge.length > 0) {
    table('Por rango de edad (aprox., según DNI)', ['Rango de edad', 'Clientes', 'Reservas', 'Horas', 'Valor espacios', 'Consumo Market'],
      summary.byAge.map((a: any) => [a.range, a.clients, a.reservations, fmt.hours(a.hours), fmt.price(a.espacio), fmt.price(a.market)]),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } })
  }

  const METODO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'MercadoPago', tarjeta: 'Tarjeta' }
  if (summary.cashPayments && summary.cashPayments.count > 0) {
    table('Cobrado registrado en caja', ['Medio de pago', 'Total'], [
      ...summary.cashPayments.byMethod.filter((x: any) => x.total > 0).map((x: any) => [METODO[x.method] || x.method, fmt.price(x.total)]),
      [`Total (${summary.cashPayments.count} pagos)`, fmt.price(summary.cashPayments.total)],
    ], { columnStyles: { 1: { halign: 'right' } } })
  }

  if (summary.feedback && summary.feedback.count > 0) {
    const f = summary.feedback
    table(`Opiniones de los clientes · promedio ${String(f.average).replace('.', ',')} de 5 (${f.count})`,
      ['5 estrellas', '4', '3', '2', '1'], [f.byStars.map((b: any) => b.count)],
      { styles: { halign: 'center', fontSize: 9, cellPadding: 2 } })
    const withComment = f.items.filter((it: any) => it.comment)
    if (withComment.length > 0) {
      table('Comentarios', ['Fecha', 'Cliente', 'Estrellas', 'Comentario'],
        withComment.map((it: any) => [dmy(it.date), it.customer, `${it.rating} de 5`, it.comment]),
        { columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 35 }, 2: { cellWidth: 20 } } })
    }
  }

  // ---------- detalle: hoja horizontal para que entren las columnas
  if (summary.reservationsDetail.length > 0) {
    doc.addPage('a4', 'landscape')
    const WL = doc.internal.pageSize.getWidth()
    doc.setFillColor(...AZUL); doc.rect(0, 0, WL, 16, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text('Detalle de reservas', M, 10.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(clean(rango), WL - M, 10.5, { align: 'right' })
    const ESTADO: Record<string, string> = { confirmed: 'Confirmada', completed: 'Finalizada', cancelled: 'Cancelada' }
    autoTable(doc, {
      startY: 22,
      head: [['Fecha', 'Código', 'Espacio', 'Horario', 'Horas', 'Cliente', 'Teléfono', 'Edad aprox.', 'Origen', 'Estado', 'Espacio $', 'Market $', 'Plan FULL $'].map(clean)],
      body: summary.reservationsDetail.map((d: any) => [
        dmy(d.date), d.code || '-',
        fmt.workspace(d.workspace) + (d.deskNumber && d.deskNumber !== '-' ? ` N.° ${d.deskNumber}` : ''),
        `${d.timeFrom} a ${d.timeTo}`, fmt.hours(d.hours), `${d.firstName} ${d.lastName}`.trim(), d.phone, d.ageRange || 'Sin dato',
        d.source === 'app' ? 'App' : 'Staff', ESTADO[d.status] || d.status,
        fmt.price(d.espacioRevenue), fmt.price(d.marketConsumption), fmt.price(d.planFull ?? d.total),
      ].map(clean)),
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, lineColor: [215, 225, 235], lineWidth: 0.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: AZUL as unknown as [number, number, number], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 249, 252] },
      columnStyles: { 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.raw?.[9] === 'Cancelada') data.cell.styles.textColor = [148, 163, 184]
      },
    })
  }

  // ---------- pie de página en todas las hojas
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.6); doc.line(M, ph - 11, pw - M, ph - 11)
    doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text('Fullwork · YPF MARIJO', M, ph - 6.5)
    doc.text(`Página ${i} de ${pages}`, pw - M, ph - 6.5, { align: 'right' })
  }

  doc.save(`informe-fullwork-${summary.range.from}-a-${summary.range.to}.pdf`)
}

function dmy(iso: string) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : String(iso || '')
}
