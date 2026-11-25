import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { chatWithBot, getChatSuggestions } from '../controllers/chatbot.controller';

const router = Router();
router.use(authenticate, authorize('student', 'teacher'));

router.post('/message', chatWithBot);
router.get('/suggestions', getChatSuggestions);

export default router;
