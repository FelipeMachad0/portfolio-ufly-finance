import { Request, Response } from 'express';
import { CategoryFieldsArraySchema } from '@ufly/shared';
import { getTypeFields, upsertTypeFields } from '../models/typefields.model';

const FieldsArraySchema = CategoryFieldsArraySchema;

export async function index(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getTypeFields());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const tipo = req.params.tipo as string;
    if (tipo !== 'income' && tipo !== 'expense') {
      res.status(400).json({ error: 'Tipo inválido (use income ou expense)' });
      return;
    }
    const parsed = FieldsArraySchema.safeParse(req.body?.fieldsSchema);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
      return;
    }
    res.json(await upsertTypeFields(req.userId!, tipo, parsed.data));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}
