/**
 * Shared interface contracts that every domain can consume.
 * Keep them lean so each domain can extend them without losing flexibility.
 */

export interface BaseEntity {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BaseAuditFields {
  createdBy?: string;
  updatedBy?: string;
  source?: string;
}

export interface PaginatedQuery {
  page?: number;
  limit?: number;
  sort?: string;
  keyword?: string;
  filters?: Record<string, unknown>;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface ApiResponse<TData, TMeta = Record<string, unknown>> {
  data: TData;
  meta?: TMeta;
}

export type DomainServiceContract<
  TEntity,
  TCreatePayload extends Record<string, unknown>,
  TUpdatePayload = Partial<TCreatePayload>,
  TSearchPayload = PaginatedQuery,
  TSearchResult = TEntity[] | PaginatedResult<TEntity>,
> = {
  create(payload: TCreatePayload): Promise<TEntity>;
  getById(id: string): Promise<TEntity | null>;
  updateById(id: string, payload: TUpdatePayload): Promise<TEntity | null>;
  deleteById(id: string): Promise<boolean>;
  search?(payload?: TSearchPayload): Promise<TSearchResult>;
};

export type DomainRequestPayload<TPayload extends Record<string, unknown>> = {
  body: TPayload;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
};

