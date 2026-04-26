import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';

// Provides invoices + payments + stock movements as structured exports for
// downstream accounting systems (SAP / Odoo / Sage / QuickBooks). The exports
// are deliberately format-neutral; we offer JSON, CSV and XML so the receiving
// system's adapter can pick whichever format it speaks.

interface InvoiceLineExport {
  invoiceNumber: string;
  invoiceDate: string;
  customerCode: string;
  customerName: string;
  customerVat: string | null;
  productSku: string | null;
  productTitle: string;
  quantity: number;
  unitPriceExclTax: number;
  taxRate: number;
  taxAmount: number;
  lineTotalExclTax: number;
  lineTotalInclTax: number;
}

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  private readonly TAX_RATE = 19; // Tunisia VAT default

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async invoiceLines(periodStart: Date, periodEnd: Date): Promise<InvoiceLineExport[]> {
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('order_items', 'oi', 'oi.order_id = o.id')
      .leftJoin(User, 'u', 'u.id = o.user_id')
      .leftJoin(Product, 'p', 'p.id = oi.product_id')
      .select([
        'o.id AS oid',
        'o.reference AS reference',
        'o.created_at AS createdAt',
        'o.user_id AS userId',
        'oi.title AS itemTitle',
        'oi.unit_price AS itemUnitPrice',
        'oi.quantity AS itemQty',
        'oi.product_id AS itemProductId',
        'p.sku AS itemSku',
        'u.email AS userEmail',
        'u.first_name AS firstName',
        'u.last_name AS lastName',
      ])
      .where('o.created_at BETWEEN :s AND :e', { s: periodStart, e: periodEnd })
      .andWhere("o.status NOT IN ('cancelled','failed','CANCELLED','FAILED','draft','DRAFT')")
      .orderBy('o.created_at', 'ASC')
      .getRawMany();

    const lines: InvoiceLineExport[] = [];
    for (const r of orders) {
      const unitInclTax = Number(r.itemUnitPrice || 0);
      const qty = Number(r.itemQty || 0);
      if (qty === 0) continue;
      const unitExcl = unitInclTax / (1 + this.TAX_RATE / 100);
      const taxAmount = (unitInclTax - unitExcl) * qty;
      const lineExcl = unitExcl * qty;
      const lineIncl = unitInclTax * qty;
      lines.push({
        invoiceNumber: r.reference || `ORD-${r.oid}`,
        invoiceDate: new Date(r.createdAt).toISOString().slice(0, 10),
        customerCode: `C${r.userId}`,
        customerName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || (r.userEmail || `user-${r.userId}`),
        customerVat: null,
        productSku: r.itemSku || null,
        productTitle: r.itemTitle || '(no title)',
        quantity: qty,
        unitPriceExclTax: Math.round(unitExcl * 1000) / 1000,
        taxRate: this.TAX_RATE,
        taxAmount: Math.round(taxAmount * 1000) / 1000,
        lineTotalExclTax: Math.round(lineExcl * 1000) / 1000,
        lineTotalInclTax: Math.round(lineIncl * 1000) / 1000,
      });
    }
    return lines;
  }

  async exportCSV(periodStart: Date, periodEnd: Date): Promise<string> {
    const lines = await this.invoiceLines(periodStart, periodEnd);
    const headers = [
      'invoiceNumber','invoiceDate','customerCode','customerName','customerVat',
      'productSku','productTitle','quantity','unitPriceExclTax',
      'taxRate','taxAmount','lineTotalExclTax','lineTotalInclTax',
    ];
    const escape = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = lines.map((l) => headers.map((h) => escape((l as any)[h])).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  async exportXML(periodStart: Date, periodEnd: Date): Promise<string> {
    const lines = await this.invoiceLines(periodStart, periodEnd);
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const items = lines.map((l) => `
    <line>
      <invoiceNumber>${esc(l.invoiceNumber)}</invoiceNumber>
      <invoiceDate>${esc(l.invoiceDate)}</invoiceDate>
      <customerCode>${esc(l.customerCode)}</customerCode>
      <customerName>${esc(l.customerName)}</customerName>
      <productSku>${esc(l.productSku)}</productSku>
      <productTitle>${esc(l.productTitle)}</productTitle>
      <quantity>${l.quantity}</quantity>
      <unitPriceExclTax>${l.unitPriceExclTax}</unitPriceExclTax>
      <taxRate>${l.taxRate}</taxRate>
      <taxAmount>${l.taxAmount}</taxAmount>
      <lineTotalExclTax>${l.lineTotalExclTax}</lineTotalExclTax>
      <lineTotalInclTax>${l.lineTotalInclTax}</lineTotalInclTax>
    </line>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<invoiceExport from="${periodStart.toISOString()}" to="${periodEnd.toISOString()}">${items}\n</invoiceExport>`;
  }

  // Aggregated GL summary suitable for posting to accounting software directly.
  async glSummary(periodStart: Date, periodEnd: Date) {
    const lines = await this.invoiceLines(periodStart, periodEnd);
    const grossInclTax = lines.reduce((s, l) => s + l.lineTotalInclTax, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const grossExclTax = grossInclTax - taxTotal;

    const orderCount = new Set(lines.map((l) => l.invoiceNumber)).size;
    const customerCount = new Set(lines.map((l) => l.customerCode)).size;

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      orderCount,
      customerCount,
      grossInclTax: Math.round(grossInclTax * 1000) / 1000,
      grossExclTax: Math.round(grossExclTax * 1000) / 1000,
      vatCollected: Math.round(taxTotal * 1000) / 1000,
      vatRate: this.TAX_RATE,
      proposedJournalEntries: [
        { account: '411 - Customers', debit: grossInclTax, credit: 0 },
        { account: '707 - Sales of goods', debit: 0, credit: grossExclTax },
        { account: '4457 - VAT collected', debit: 0, credit: taxTotal },
      ],
    };
  }
}
