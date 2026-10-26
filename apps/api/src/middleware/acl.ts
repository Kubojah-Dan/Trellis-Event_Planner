import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { EventRepository, EventAggregateWithItems } from '../domain/ports';

declare global {
  namespace Express {
    interface Request {
      eventAggregate?: EventAggregateWithItems;
    }
  }
}

export function createAclMiddleware(repository: EventRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const rawEventId = req.params.eventId;
    const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId;
    if (!eventId) {
      next(new AppError(400, 'BAD_REQUEST', 'Missing eventId parameter in route.'));
      return;
    }

    const actor = req.actor;
    if (!actor) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required.'));
      return;
    }

    try {
      const aggregate = await repository.getById(eventId);
      if (!aggregate) {
        next(new AppError(404, 'EVENT_NOT_FOUND', `Event "${eventId}" was not found.`));
        return;
      }

      // Check tenant ownership / access
      if (aggregate.event.ownerId !== actor.uid) {
        next(
          new AppError(
            403,
            'FORBIDDEN',
            'You do not have permission to access or modify this celebration plan.'
          )
        );
        return;
      }

      req.eventAggregate = aggregate;
      next();
    } catch (err) {
      next(err);
    }
  };
}
