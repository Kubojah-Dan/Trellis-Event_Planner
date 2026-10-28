import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { EmailService } from '../infrastructure/email/email-service';
import { UserPreferencesRepository } from '../infrastructure/repositories/user-preferences-repo';
import { EventRepository } from '../domain/ports';
import { NotificationPreferencesSchema } from '@trellis/contracts';

// In-memory set to prevent duplicate day-of reminders during server lifetime
const sentEventReminders = new Set<string>();

export function createNotificationsRouter(
  emailService: EmailService,
  preferencesRepo: UserPreferencesRepository,
  eventRepo: EventRepository
) {
  const router = Router();

  router.use(authMiddleware);

  // ---------------------------------------------------------------------------
  // Get User Notification Preferences
  // ---------------------------------------------------------------------------
  router.get('/preferences', async (req, res, next) => {
    try {
      const actor = req.actor!;
      const prefs = await preferencesRepo.getPreferences(actor.uid);
      // Pre-fill recipientEmail with actor's auth email if not explicitly set
      if (!prefs.recipientEmail && actor.email) {
        prefs.recipientEmail = actor.email;
      }
      res.json({
        preferences: prefs,
        emailServiceConfigured: emailService.isConfigured(),
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Update Notification Preferences
  // ---------------------------------------------------------------------------
  const UpdatePrefsSchema = NotificationPreferencesSchema.partial();

  router.patch('/preferences', async (req, res, next) => {
    try {
      const actor = req.actor!;
      const validated = UpdatePrefsSchema.parse(req.body);
      const updated = await preferencesRepo.savePreferences(actor.uid, validated);
      res.json({ preferences: updated });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Send a Test Notification Email
  // ---------------------------------------------------------------------------
  const TestEmailInputSchema = z.object({
    recipientEmail: z.string().email().optional(),
  });

  router.post('/test', async (req, res, next) => {
    try {
      const actor = req.actor!;
      const { recipientEmail } = TestEmailInputSchema.parse(req.body);
      const prefs = await preferencesRepo.getPreferences(actor.uid);
      const targetEmail = recipientEmail || prefs.recipientEmail || actor.email;

      if (!targetEmail) {
        throw new AppError(400, 'NO_RECIPIENT_EMAIL', 'Please provide a valid recipient email address.');
      }

      const result = await emailService.sendTestEmail(targetEmail);
      res.json({
        success: result.success,
        recipient: targetEmail,
        simulated: result.simulated ?? false,
        error: result.error,
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Check and send event day / countdown reminders for the authenticated host
  // ---------------------------------------------------------------------------
  router.post('/check-reminders', async (req, res, next) => {
    try {
      const actor = req.actor!;
      const prefs = await preferencesRepo.getPreferences(actor.uid);

      if (!prefs.emailNotificationsEnabled || !prefs.notifyOnEventDayReminder) {
        res.json({ message: 'Event day notifications are disabled for this account.', sentCount: 0 });
        return;
      }

      const targetEmail = prefs.recipientEmail || actor.email;
      if (!targetEmail) {
        res.json({ message: 'No recipient email available.', sentCount: 0 });
        return;
      }

      const events = await eventRepo.listByActor(actor.uid);
      const todayIso = new Date().toISOString().split('T')[0];
      let sentCount = 0;

      for (const event of events) {
        if (!event.eventDate) continue;
        const dateStr = event.eventDate.split('T')[0];

        // 1. Day of event check
        if (dateStr === todayIso) {
          const reminderKey = `day_of_${event.id}_${todayIso}`;
          if (!sentEventReminders.has(reminderKey)) {
            sentEventReminders.add(reminderKey);
            await emailService.sendEventDayAlertEmail(
              targetEmail,
              event.title,
              event.id,
              event.location?.city || event.location?.label
            );
            sentCount++;
          }
        }
      }

      res.json({ success: true, sentCount });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
