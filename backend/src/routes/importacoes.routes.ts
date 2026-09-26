import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/importacoes.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB por arquivo
    // 5 arquivos de 10 MB por envio: bastante para um lote de boletos.
    files: 5,
  },
});

router.use(authMiddleware);

router.post('/', upload.array('files', 5), ctrl.enviar);
router.get('/', ctrl.listar);
router.post('/:id/confirmar', ctrl.confirmar);
router.delete('/:id', ctrl.descartar);

export default router;
