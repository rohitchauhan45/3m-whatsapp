# Interfaces module

The `src/interfaces` directory centralizes the most common contracts that every
domain can reference. Having the shared types in one place gives junior
contributors quick visibility into the expected shapes for entities, payloads,
and service methods without forcing domains into a rigid structure.

## Available helpers

- `BaseEntity` – canonical entity shape (`id`, `createdAt`, `updatedAt`)
- `BaseAuditFields` – optional metadata for who/what changed an entity
- `PaginatedQuery` / `PaginatedResult<T>` – request/response helpers for list
  endpoints
- `ApiResponse<TData>` – generic REST response envelope
- `DomainServiceContract<TEntity, TCreate, TUpdate, TSearch>` – strongly typed
  CRUD contract each domain service can implement
- `DomainRequestPayload<TPayload>` – typed controller payload helper you can
  use when wiring `express` route handlers

## Example: User domain

```ts
import { User } from "@prisma/client";
import { DomainServiceContract } from "../../interfaces";

interface UserInput {
  username: string;
  email: string;
  password: string;
}

type UserServiceContract = DomainServiceContract<
  User,
  UserInput,
  Partial<UserInput>,
  Record<string, unknown>
>;
```

Each domain can tailor the generics to its own models while still presenting the
same surface area to the rest of the codebase.

