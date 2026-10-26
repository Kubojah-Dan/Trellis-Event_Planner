import {
  EventAggregate,
  TaskItem,
  BudgetItem,
  VendorItem,
  IdeaItem,
  ChangeProposal,
  EventBrief,
} from '@trellis/contracts';
import { DiffImpactSummary } from '@trellis/domain';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface EventAggregateWithItems {
  event: EventAggregate;
  tasks: TaskItem[];
  budgetItems: BudgetItem[];
  vendors: VendorItem[];
  ideas: IdeaItem[];
  proposals: ChangeProposal[];
  versions: any[];
}

export function createApiClient(getIdToken: () => Promise<string | null>) {
  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.code || 'UNKNOWN_ERROR',
        data.message || `API request failed with status ${response.status}`,
        data.details
      );
    }

    return data as T;
  }

  return {
    async getEvents(): Promise<{ events: EventAggregate[] }> {
      return request<{ events: EventAggregate[] }>('/api/events');
    },

    async getEvent(eventId: string): Promise<EventAggregateWithItems> {
      return request<EventAggregateWithItems>(`/api/events/${eventId}`);
    },

    async createEvent(input: {
      title: string;
      eventType: string;
      eventDate?: string;
      timezone?: string;
      currency?: string;
      brief?: EventBrief;
    }): Promise<{ event: EventAggregate }> {
      return request<{ event: EventAggregate }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async updateEvent(
      eventId: string,
      patch: Partial<EventAggregate>
    ): Promise<{ event: EventAggregate }> {
      return request<{ event: EventAggregate }>(`/api/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async saveTask(eventId: string, task: Partial<TaskItem>): Promise<{ task: TaskItem }> {
      return request<{ task: TaskItem }>(`/api/events/${eventId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },

    async deleteTask(eventId: string, taskId: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
    },

    async saveBudgetItem(
      eventId: string,
      item: Partial<BudgetItem>
    ): Promise<{ budgetItem: BudgetItem }> {
      return request<{ budgetItem: BudgetItem }>(`/api/events/${eventId}/budget`, {
        method: 'POST',
        body: JSON.stringify(item),
      });
    },

    async deleteBudgetItem(eventId: string, itemId: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/events/${eventId}/budget/${itemId}`, {
        method: 'DELETE',
      });
    },

    async saveVendorItem(
      eventId: string,
      vendor: Partial<VendorItem>
    ): Promise<{ vendor: VendorItem }> {
      return request<{ vendor: VendorItem }>(`/api/events/${eventId}/vendors`, {
        method: 'POST',
        body: JSON.stringify(vendor),
      });
    },

    async deleteVendorItem(eventId: string, vendorId: string): Promise<{ success: boolean }> {
      return request<{ success: boolean }>(`/api/events/${eventId}/vendors/${vendorId}`, {
        method: 'DELETE',
      });
    },

    async saveIdeaItem(eventId: string, idea: Partial<IdeaItem>): Promise<{ idea: IdeaItem }> {
      return request<{ idea: IdeaItem }>(`/api/events/${eventId}/ideas`, {
        method: 'POST',
        body: JSON.stringify(idea),
      });
    },

    async proposeRevision(
      eventId: string,
      input: {
        baseVersion: number;
        requestedChange: string;
        operations: any[];
        assumptions?: string[];
        unresolvedQuestions?: string[];
      }
    ): Promise<{ proposal: ChangeProposal; diff: DiffImpactSummary }> {
      return request<{ proposal: ChangeProposal; diff: DiffImpactSummary }>(
        `/api/events/${eventId}/proposals`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
    },

    async decideProposal(
      eventId: string,
      proposalId: string,
      decision: 'approved' | 'rejected'
    ): Promise<{ proposal: ChangeProposal; updatedPlan?: EventAggregateWithItems }> {
      return request<{ proposal: ChangeProposal; updatedPlan?: EventAggregateWithItems }>(
        `/api/events/${eventId}/proposals/${proposalId}/decide`,
        {
          method: 'POST',
          body: JSON.stringify({ decision }),
        }
      );
    },

    // AI endpoints
    async postAI<T>(endpoint: string, body: unknown): Promise<T> {
      return request<T>(`/api/ai/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };
}
