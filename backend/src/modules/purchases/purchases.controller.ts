import { Request, Response } from 'express';
import * as purchasesService from './purchases.service';
import {
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
  createPurchaseReturnSchema,
  updateStockDcAndPricesSchema,
} from './purchases.schemas';

export async function getPurchaseInvoices(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const supplier_id = req.query.supplier_id as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const invoice_type = req.query.invoice_type as string;

    const userRole = (req.user?.roleName || (req.user as any)?.role || '').trim().toUpperCase();
    const userId = req.user?.id;

    // RBAC: Cashiers can only view invoices they personally created
    let created_by: string | undefined = undefined;
    if (userRole === 'CASHIER' && userId) {
      created_by = userId;
    }

    const result = await purchasesService.getPurchaseInvoices({
      page,
      limit,
      search,
      status,
      supplier_id,
      startDate,
      endDate,
      created_by,
      invoice_type,
    });

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getUnpaidPurchaseInvoices(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const supplier_id = req.query.supplier_id as string;

    const userRole = (req.user?.roleName || (req.user as any)?.role || '').trim().toUpperCase();
    const userId = req.user?.id;

    let created_by: string | undefined = undefined;
    if (userRole === 'CASHIER' && userId) {
      created_by = userId;
    }

    const result = await purchasesService.getPurchaseInvoices({
      page,
      limit,
      supplier_id,
      created_by,
    });

    const unpaidRows = result.rows.filter((inv: any) => inv.status !== 'PAID');

    res.json({
      success: true,
      data: unpaidRows,
      meta: {
        total: unpaidRows.length,
        page,
        limit,
        totalPages: 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPurchaseInvoiceById(req: Request, res: Response) {
  try {
    const invoice = await purchasesService.getPurchaseInvoiceById(req.params.id);
    const userRole = (req.user?.roleName || (req.user as any)?.role || '').trim().toUpperCase();
    const userId = req.user?.id;

    // RBAC: Cashiers can only fetch invoices they created
    if (userRole === 'CASHIER' && userId && invoice.created_by && invoice.created_by !== userId) {
      res.status(403).json({ success: false, error: 'You are only authorized to view invoices you personally created.' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
}

export async function createPurchaseInvoice(req: Request, res: Response) {
  try {
    const data = createPurchaseInvoiceSchema.parse(req.body);
    const userId = req.user!.id;
    
    const invoice = await purchasesService.createPurchaseInvoice(data, userId);
    res.status(201).json({ success: true, data: invoice });
  } catch (error: any) {
    if (error.errors) {
      res.status(400).json({ success: false, error: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export async function updatePurchaseInvoiceStatus(req: Request, res: Response) {
  try {
    const data = updatePurchaseInvoiceSchema.parse(req.body);
    const invoice = await purchasesService.updatePurchaseInvoiceStatus(req.params.id, data);
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    if (error.errors) {
      res.status(400).json({ success: false, error: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

/**
 * Phase 1 & Phase 2: POST /api/purchase-returns Controller
 * Accepts parent_invoice_id and line_items (or items) in body (or param).
 * Strictly rejects with STOCK_ALREADY_SOLD if stock remaining is insufficient.
 */
export async function createPurchaseReturn(req: Request, res: Response) {
  try {
    const parsed = createPurchaseReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(', '),
      });
      return;
    }

    const parentInvoiceId = req.params.id || parsed.data.parent_invoice_id || (req.body as any).parentInvoiceId;
    if (!parentInvoiceId) {
      res.status(400).json({
        success: false,
        error: 'parent_invoice_id is required',
      });
      return;
    }

    const items = parsed.data.line_items || parsed.data.items || [];
    const userId = req.user?.id;

    const debitNote = await purchasesService.processPurchaseReturn(
      {
        parent_invoice_id: parentInvoiceId,
        items,
        line_items: items,
        return_reason: parsed.data.return_reason || (req.body as any).notes,
      },
      userId
    );

    res.status(201).json({
      success: true,
      data: debitNote,
    });
  } catch (error: any) {
    if (error.message === 'STOCK_ALREADY_SOLD') {
      res.status(400).json({
        success: false,
        error: 'STOCK_ALREADY_SOLD',
        message: 'Return rejected: Cannot return goods to supplier if stock has already been sold.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process purchase return',
    });
  }
}

export async function getPurchaseInvoiceReturnSummary(req: Request, res: Response) {
  try {
    const parentInvoiceId = req.params.id;
    const summary = await purchasesService.getPurchaseInvoiceReturnSummary(parentInvoiceId);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getRecentPurchasesForStockUpdate(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const purchases = await purchasesService.getRecentPurchasesForStockUpdate(limit);
    res.json({
      success: true,
      data: purchases,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function updateStockDcAndPrices(req: Request, res: Response) {
  try {
    const parsed = updateStockDcAndPricesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(', '),
      });
      return;
    }

    const purchaseId = req.params.id;
    const userId = req.user?.id;

    const result = await purchasesService.updateStockDcAndPrices(purchaseId, parsed.data, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
