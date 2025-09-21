import { Router } from 'express';
import { 
  getArtists, 
  getArtistById, 
  createArtist, 
  updateArtist, 
  deleteArtist,
  deleteAllArtists,
  batchImportArtists
} from '../controllers/artistController';

const router = Router();

router.get('/', getArtists);
router.get('/:id', getArtistById);
router.post('/', createArtist);
router.put('/:id', updateArtist);
router.delete('/:id', deleteArtist);
router.delete('/', deleteAllArtists);
router.post('/batch-import', batchImportArtists);

export default router;
