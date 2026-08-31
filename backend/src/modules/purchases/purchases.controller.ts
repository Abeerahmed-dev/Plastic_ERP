import { Request, Response } from 'express';
import * as purchasesService from './purchases.service';
import { createPurchaseInvoiceSchema, updatePurchaseInvoiceSchema } from './purchases.schemas';

export async function getPurchaseInvoices(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const supplier_id = req.query.supplier_id as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const result = await purchasesService.getPurchaseInvoices({
      page,
      limit,
      search,
      status,
      supplier_id,
      startDate,
      endDate
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

export async function getPurchaseInvoiceById(req: Request, res: Response) {
  try {
    const invoice = await purchasesService.getPurchaseInvoiceById(req.params.id);
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
